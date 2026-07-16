import * as v from 'valibot';
import {
  interopConflictActionSchema,
  interopProductSchema,
  interopTimestampSchema,
  interopUuidSchema,
  type InteropConflictAction,
  type InteropProduct,
} from '../../core/interop/contract.js';
import { parseInteropEnvelope, type InteropEnvelope } from '../../core/interop/messages.js';
import { interopRecordSchema, type InteropRecord } from '../../core/interop/records.js';
import { type SyncAnalysis, type SyncField } from '../../core/interop/sync-resolution.js';
import { requestToPromise, transactionDone } from '../idb-helpers.js';
import { DataStore } from '../schema.js';
import { countSyncItems, getSyncItem, getSyncSession, listSyncAudit, listSyncChanges, listSyncItems } from './sync-journal-queries.js';
import {
  syncAnalysisSchema,
  syncDeleteDecisionSchema,
  syncDirectionSchema,
  syncItemId,
  syncItemRecordSchema,
  syncReceiptId,
  syncReceiptRecordSchema,
  syncScopeSchema,
  syncSessionRecordSchema,
  type SyncAuditRecord,
  type SyncDeleteDecision,
  type SyncDirection,
  type SyncItemRecord,
  type SyncProgressCounts,
  type SyncScope,
  type SyncSessionRecord,
} from './sync-journal-types.js';

export class SyncJournalError extends Error {
  override readonly name = 'SyncJournalError';
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function hasTombstone(item: SyncItemRecord): boolean {
  return (
    (item.imageTrailRecord !== null && item.imageTrailRecord.deletedAt !== null) ||
    (item.overlookRecord !== null && item.overlookRecord.deletedAt !== null)
  );
}

function auditEvent(
  transaction: IDBTransaction,
  eventKey: string,
  sessionId: string,
  interopId: string | null,
  event: string,
  details: unknown,
  createdAt: string,
): void {
  transaction.objectStore(DataStore.SyncAudit).put({ eventKey, sessionId, interopId, event, details, createdAt } satisfies SyncAuditRecord);
}

export class SyncJournalRepository {
  constructor(private readonly db: IDBDatabase) {}

  async createSession(input: {
    readonly sessionId: string;
    readonly pairingId: string;
    readonly sourceProduct: InteropProduct;
    readonly targetProduct: InteropProduct;
    readonly direction: SyncDirection;
    readonly scope: SyncScope;
    readonly at: string;
  }): Promise<SyncSessionRecord> {
    const at = v.parse(interopTimestampSchema, input.at);
    if (input.sourceProduct === input.targetProduct) throw new SyncJournalError('Sync source and target products must differ.');
    if (
      (input.direction === 'image-trail-to-overlook' && (input.sourceProduct !== 'image-trail' || input.targetProduct !== 'overlook')) ||
      (input.direction === 'overlook-to-image-trail' && (input.sourceProduct !== 'overlook' || input.targetProduct !== 'image-trail'))
    ) {
      throw new SyncJournalError('Sync direction does not match the selected source and target products.');
    }
    const transaction = this.db.transaction([DataStore.SyncSessions, DataStore.SyncAudit], 'readwrite');
    const store = transaction.objectStore(DataStore.SyncSessions);
    const previous = await requestToPromise<unknown>(store.get(input.sessionId));
    const session =
      previous === undefined
        ? v.parse(syncSessionRecordSchema, {
            sessionId: v.parse(interopUuidSchema, input.sessionId),
            pairingId: v.parse(interopUuidSchema, input.pairingId),
            sourceProduct: v.parse(interopProductSchema, input.sourceProduct),
            targetProduct: v.parse(interopProductSchema, input.targetProduct),
            direction: v.parse(syncDirectionSchema, input.direction),
            scope: v.parse(syncScopeSchema, input.scope),
            phase: 'reviewing',
            connected: true,
            checkpoints: { 'image-trail': 0, overlook: 0 },
            createdAt: at,
            updatedAt: at,
          })
        : v.parse(syncSessionRecordSchema, previous);
    if (
      session.pairingId !== input.pairingId ||
      session.sourceProduct !== input.sourceProduct ||
      session.targetProduct !== input.targetProduct ||
      session.direction !== input.direction ||
      !sameValue(session.scope, input.scope)
    ) {
      transaction.abort();
      throw new SyncJournalError('Sync session identity was reused with different first-run choices.');
    }
    if (previous === undefined) {
      store.add(session);
      auditEvent(transaction, `${input.sessionId}:started`, input.sessionId, null, 'started', input.scope, at);
    }
    await transactionDone(transaction);
    return session;
  }

  getSession(sessionId: string): Promise<SyncSessionRecord | undefined> {
    return getSyncSession(this.db, sessionId);
  }

  activeSession(sessionId: string): Promise<SyncSessionRecord> {
    return this.requireActiveSession(sessionId);
  }

  async putItem(input: {
    readonly sessionId: string;
    readonly imageTrailRecord: InteropRecord | null;
    readonly overlookRecord: InteropRecord | null;
    readonly analysis: SyncAnalysis;
    readonly at: string;
  }): Promise<SyncItemRecord> {
    await this.requireActiveSession(input.sessionId);
    const at = v.parse(interopTimestampSchema, input.at);
    const analysis = v.parse(syncAnalysisSchema, input.analysis);
    const interopId = analysis.merged.identity.interopId;
    const imageTrailRecord = input.imageTrailRecord === null ? null : v.parse(interopRecordSchema, input.imageTrailRecord);
    const overlookRecord = input.overlookRecord === null ? null : v.parse(interopRecordSchema, input.overlookRecord);
    if ([imageTrailRecord, overlookRecord].some((record) => record !== null && record.identity.interopId !== interopId)) {
      throw new SyncJournalError('Sync item index does not match its canonical records.');
    }
    const item = v.parse(syncItemRecordSchema, {
      id: syncItemId(input.sessionId, interopId),
      sessionId: input.sessionId,
      interopId,
      imageTrailRecord,
      overlookRecord,
      analysis,
      decisions: {},
      deleteDecision: null,
      state: analysis.category,
      error: null,
      receivedAt: at,
      appliedAt: null,
    });
    const transaction = this.db.transaction([DataStore.SyncItems, DataStore.SyncAudit], 'readwrite');
    transaction.objectStore(DataStore.SyncItems).put(item);
    auditEvent(
      transaction,
      `${input.sessionId}:${interopId}:received:${at}`,
      input.sessionId,
      interopId,
      'received',
      { category: analysis.category },
      at,
    );
    await transactionDone(transaction);
    return item;
  }

  async recordReceipt(sessionId: string, envelopeInput: InteropEnvelope, atInput: string): Promise<void> {
    const envelope = parseInteropEnvelope(envelopeInput);
    const at = v.parse(interopTimestampSchema, atInput);
    if (envelope.payload.kind !== 'record') throw new SyncJournalError('Sync receipts require a record envelope.');
    const transaction = this.db.transaction(DataStore.SyncReceipts, 'readwrite');
    const store = transaction.objectStore(DataStore.SyncReceipts);
    const id = syncReceiptId(envelope.header.pairingId, envelope.header.messageId);
    const previous = await requestToPromise<unknown>(store.get(id));
    const receipt = v.parse(syncReceiptRecordSchema, {
      id,
      pairingId: envelope.header.pairingId,
      messageId: envelope.header.messageId,
      sessionId,
      interopId: envelope.payload.record.identity.interopId,
      envelope,
      receivedAt: at,
    });
    if (previous === undefined) store.add(receipt);
    else {
      const stored = v.parse(syncReceiptRecordSchema, previous);
      if (
        stored.sessionId === receipt.sessionId &&
        stored.interopId === receipt.interopId &&
        sameValue(stored.envelope, receipt.envelope)
      ) {
        await transactionDone(transaction);
        return;
      }
      transaction.abort();
      throw new SyncJournalError('Sync message identity was replayed with different content.');
    }
    await transactionDone(transaction);
  }

  async itemForReceipt(pairingId: string, messageId: string, envelopeInput: InteropEnvelope): Promise<SyncItemRecord | undefined> {
    const envelope = parseInteropEnvelope(envelopeInput);
    if (pairingId !== envelope.header.pairingId || messageId !== envelope.header.messageId) {
      throw new SyncJournalError('Sync replay lookup does not match the envelope identity.');
    }
    const transaction = this.db.transaction([DataStore.SyncReceipts, DataStore.SyncItems], 'readonly');
    const rawReceipt = await requestToPromise<unknown>(
      transaction.objectStore(DataStore.SyncReceipts).get(syncReceiptId(pairingId, messageId)),
    );
    if (rawReceipt === undefined) {
      await transactionDone(transaction);
      return undefined;
    }
    const receipt = v.parse(syncReceiptRecordSchema, rawReceipt);
    if (!sameValue(receipt.envelope, envelope)) {
      transaction.abort();
      throw new SyncJournalError('Sync message identity was replayed with different content.');
    }
    const rawItem = await requestToPromise<unknown>(
      transaction.objectStore(DataStore.SyncItems).get(syncItemId(receipt.sessionId, receipt.interopId)),
    );
    await transactionDone(transaction);
    if (rawItem === undefined) throw new SyncJournalError('Sync receipt points to a missing item.');
    return v.parse(syncItemRecordSchema, rawItem);
  }

  getItem(sessionId: string, interopId: string): Promise<SyncItemRecord | undefined> {
    return getSyncItem(this.db, sessionId, interopId);
  }

  items(sessionId: string): Promise<readonly SyncItemRecord[]> {
    return listSyncItems(this.db, sessionId);
  }

  counts(sessionId: string): Promise<SyncProgressCounts> {
    return countSyncItems(this.db, sessionId);
  }

  async decide(
    sessionId: string,
    interopId: string,
    field: SyncField,
    actionInput: InteropConflictAction,
    applyToAll: boolean,
    atInput: string,
  ): Promise<SyncItemRecord> {
    await this.requireActiveSession(sessionId);
    const item = await this.requireItem(sessionId, interopId);
    const action = v.parse(interopConflictActionSchema, actionInput);
    const at = v.parse(interopTimestampSchema, atInput);
    const conflictFields = item.analysis.conflicts.map((conflict) => conflict.field);
    if (!conflictFields.includes(field)) throw new SyncJournalError(`Sync field ${field} is not conflicted.`);
    const decisions = { ...item.decisions, [field]: action };
    if (applyToAll) for (const conflictField of conflictFields) decisions[conflictField] = action;
    const updated: SyncItemRecord = {
      ...item,
      decisions,
      state: conflictFields.every((candidate) => decisions[candidate] !== undefined)
        ? hasTombstone(item)
          ? 'delete-review'
          : 'ready'
        : 'conflict',
    };
    return this.putItemUpdate(updated, `${sessionId}:${interopId}:decision:${field}:${at}`, 'decision', { field, action, applyToAll }, at);
  }

  async reviewDelete(sessionId: string, interopId: string, decisionInput: SyncDeleteDecision, atInput: string): Promise<SyncItemRecord> {
    await this.requireActiveSession(sessionId);
    const item = await this.requireItem(sessionId, interopId);
    if (item.state !== 'delete-review') throw new SyncJournalError('Sync item is not awaiting delete review.');
    const decision = v.parse(syncDeleteDecisionSchema, decisionInput);
    const at = v.parse(interopTimestampSchema, atInput);
    const updated: SyncItemRecord = { ...item, deleteDecision: decision, state: decision === 'apply' ? 'ready' : 'skipped' };
    return this.putItemUpdate(updated, `${sessionId}:${interopId}:delete:${at}`, 'delete-reviewed', { decision }, at);
  }

  async setControl(sessionId: string, action: 'pause' | 'resume' | 'cancel' | 'disconnect', atInput: string): Promise<SyncSessionRecord> {
    const session = await this.requireSession(sessionId);
    if (action !== 'disconnect' && !session.connected) {
      throw new SyncJournalError('Disconnected Sync sessions cannot resume or change state.');
    }
    if (session.phase === 'cancelled' && action !== 'disconnect') {
      throw new SyncJournalError('Cancelled Sync sessions cannot resume or change state.');
    }
    if (action === 'resume' && (!session.connected || session.phase === 'cancelled')) {
      throw new SyncJournalError('Disconnected or cancelled Sync sessions cannot resume.');
    }
    const at = v.parse(interopTimestampSchema, atInput);
    const event = action === 'pause' ? 'paused' : action === 'resume' ? 'resumed' : action === 'cancel' ? 'cancelled' : 'disconnected';
    const updated: SyncSessionRecord = {
      ...session,
      phase: action === 'pause' ? 'paused' : action === 'resume' ? 'reviewing' : 'cancelled',
      connected: action === 'disconnect' ? false : session.connected,
      updatedAt: at,
    };
    const transaction = this.db.transaction([DataStore.SyncSessions, DataStore.SyncAudit], 'readwrite');
    transaction.objectStore(DataStore.SyncSessions).put(updated);
    auditEvent(transaction, `${sessionId}:${event}:${at}`, sessionId, null, event, {}, at);
    await transactionDone(transaction);
    return updated;
  }

  async markApplied(sessionId: string, interopId: string, atInput: string): Promise<SyncItemRecord> {
    const item = await this.requireItem(sessionId, interopId);
    const at = v.parse(interopTimestampSchema, atInput);
    const updated = { ...item, state: 'applied', error: null, appliedAt: item.appliedAt ?? at } as const;
    return this.putItemUpdate(updated, `${sessionId}:${interopId}:applied`, 'applied', {}, at);
  }

  async markFailed(sessionId: string, interopId: string, error: unknown, atInput: string): Promise<SyncItemRecord> {
    const item = await this.requireItem(sessionId, interopId);
    const at = v.parse(interopTimestampSchema, atInput);
    return this.putItemUpdate({ ...item, state: 'failed', error }, `${sessionId}:${interopId}:failed:${at}`, 'failed', error, at);
  }

  changesAfter(sessionId: string, product: InteropProduct, checkpoint: number): Promise<readonly InteropRecord[]> {
    if (!Number.isSafeInteger(checkpoint) || checkpoint < 0) throw new SyncJournalError('Sync checkpoint must be nonnegative.');
    return listSyncChanges(this.db, sessionId, v.parse(interopProductSchema, product), checkpoint);
  }

  async advanceCheckpoint(sessionId: string, product: InteropProduct, checkpoint: number, atInput: string): Promise<SyncSessionRecord> {
    const session = await this.requireActiveSession(sessionId);
    if (!Number.isSafeInteger(checkpoint) || checkpoint < 0) throw new SyncJournalError('Sync checkpoint must be nonnegative.');
    const at = v.parse(interopTimestampSchema, atInput);
    const updated: SyncSessionRecord = {
      ...session,
      checkpoints: { ...session.checkpoints, [product]: Math.max(session.checkpoints[product], checkpoint) },
      updatedAt: at,
    };
    const transaction = this.db.transaction([DataStore.SyncSessions, DataStore.SyncAudit], 'readwrite');
    transaction.objectStore(DataStore.SyncSessions).put(updated);
    auditEvent(transaction, `${sessionId}:checkpoint:${product}:${checkpoint}`, sessionId, null, 'checkpoint', { product, checkpoint }, at);
    await transactionDone(transaction);
    return updated;
  }

  audit(sessionId: string): Promise<readonly SyncAuditRecord[]> {
    return listSyncAudit(this.db, sessionId);
  }

  private async putItemUpdate(
    itemInput: SyncItemRecord,
    eventKey: string,
    event: string,
    details: unknown,
    at: string,
  ): Promise<SyncItemRecord> {
    const item = v.parse(syncItemRecordSchema, itemInput);
    const transaction = this.db.transaction([DataStore.SyncItems, DataStore.SyncAudit], 'readwrite');
    transaction.objectStore(DataStore.SyncItems).put(item);
    auditEvent(transaction, eventKey, item.sessionId, item.interopId, event, details, at);
    await transactionDone(transaction);
    return item;
  }

  private async requireSession(sessionId: string): Promise<SyncSessionRecord> {
    const session = await this.getSession(sessionId);
    if (session === undefined) throw new SyncJournalError(`Sync session ${sessionId} does not exist.`);
    return session;
  }

  private async requireActiveSession(sessionId: string): Promise<SyncSessionRecord> {
    const session = await this.requireSession(sessionId);
    if (!session.connected || session.phase === 'cancelled' || session.phase === 'completed' || session.phase === 'failed') {
      throw new SyncJournalError('Sync session is disconnected, cancelled, or complete.');
    }
    if (session.phase === 'paused') throw new SyncJournalError('Sync session is paused.');
    return session;
  }

  private async requireItem(sessionId: string, interopId: string): Promise<SyncItemRecord> {
    const item = await this.getItem(sessionId, interopId);
    if (item === undefined) throw new SyncJournalError('Sync item does not exist.');
    return item;
  }
}
