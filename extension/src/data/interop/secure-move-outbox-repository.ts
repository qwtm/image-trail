import * as v from 'valibot';

import type { InteropReviewCategory } from '../../core/interop/contract.js';
import type { InteropCounts } from '../../core/interop/messages.js';
import { requestToPromise, transactionDone } from '../idb-helpers.js';
import { DataStore, SchemaIndex } from '../schema.js';
import { hydrateRecord, hydrateRecords } from '../repositories/hydration.js';
import { moveItemId, moveJournalRecordSchema, type MoveJournalRecord, type StoredMoveJournal } from './move-journal-types.js';

const timestampSchema = v.pipe(v.string(), v.isoTimestamp());

const secureMoveItemSchema = v.object({
  id: v.string(),
  transferId: v.string(),
  interopId: v.string(),
  sourceMessageId: v.string(),
  sourceLocalId: v.string(),
  reviewCategory: v.picklist(['eligible', 'duplicate', 'conflict', 'metadata-only', 'unsupported', 'skipped']),
  state: v.literal('queued'),
  acknowledgedAt: v.null(),
  finalizedAt: v.null(),
});

const secureMoveOutboxSchema = v.object({
  messageId: v.string(),
  transferId: v.string(),
  sequence: v.number(),
  path: v.string(),
  ciphertext: v.instance(ArrayBuffer),
  createdAt: timestampSchema,
  deliveredAt: v.nullable(timestampSchema),
});

export type SecureMoveItem = v.InferOutput<typeof secureMoveItemSchema>;
export type SecureMoveOutboxRecord = v.InferOutput<typeof secureMoveOutboxSchema>;

const STORES = [DataStore.MoveJournals, DataStore.MoveItems, DataStore.MoveOutbox, DataStore.MoveAudit];

function countsFor(items: readonly SecureMoveItem[]): InteropCounts {
  const counts: InteropCounts = {
    total: items.length,
    eligible: 0,
    duplicate: 0,
    conflict: 0,
    metadataOnly: 0,
    unsupported: 0,
    skipped: 0,
    failed: 0,
    acknowledged: 0,
    finalized: 0,
  };
  for (const item of items) counts[item.reviewCategory === 'metadata-only' ? 'metadataOnly' : item.reviewCategory] += 1;
  return counts;
}

async function itemsIn(transaction: IDBTransaction, transferId: string): Promise<readonly SecureMoveItem[]> {
  const values = await requestToPromise<unknown[]>(
    transaction.objectStore(DataStore.MoveItems).index(SchemaIndex.MoveItemsByTransferId).getAll(transferId),
  );
  return hydrateRecords(DataStore.MoveItems, secureMoveItemSchema, values).sort((left, right) =>
    left.interopId.localeCompare(right.interopId),
  );
}

export class SecureMoveOutboxRepository {
  constructor(private readonly db: IDBDatabase) {}

  async queue(input: {
    readonly pairingId: string;
    readonly transferId: string;
    readonly messageId: string;
    readonly sequence: number;
    readonly interopId: string;
    readonly sourceLocalId: string;
    readonly reviewCategory: InteropReviewCategory;
    readonly path: string;
    readonly ciphertext: Uint8Array;
    readonly at: string;
  }): Promise<void> {
    const transaction = this.db.transaction(STORES, 'readwrite');
    const journals = transaction.objectStore(DataStore.MoveJournals);
    const existingJournal = hydrateRecord(
      DataStore.MoveJournals,
      moveJournalRecordSchema,
      await requestToPromise<unknown>(journals.get(input.transferId)),
    );
    if (
      existingJournal &&
      (existingJournal.pairingId !== input.pairingId ||
        existingJournal.sourceProduct !== 'image-trail' ||
        existingJournal.targetProduct !== 'overlook')
    ) {
      transaction.abort();
      throw new Error('Secure Move journal identity was reused across participants.');
    }
    const item: SecureMoveItem = {
      id: moveItemId(input.transferId, input.interopId),
      transferId: input.transferId,
      interopId: input.interopId,
      sourceMessageId: input.messageId,
      sourceLocalId: input.sourceLocalId,
      reviewCategory: input.reviewCategory,
      state: 'queued',
      acknowledgedAt: null,
      finalizedAt: null,
    };
    const items = transaction.objectStore(DataStore.MoveItems);
    const existingItem = hydrateRecord(DataStore.MoveItems, secureMoveItemSchema, await requestToPromise<unknown>(items.get(item.id)));
    if (
      existingItem &&
      (existingItem.sourceMessageId !== item.sourceMessageId ||
        existingItem.sourceLocalId !== item.sourceLocalId ||
        existingItem.reviewCategory !== item.reviewCategory)
    ) {
      transaction.abort();
      throw new Error('Secure Move item identity was replayed with different metadata.');
    }
    items.put(existingItem ?? item);
    const outbox = transaction.objectStore(DataStore.MoveOutbox);
    const existingOutbox = hydrateRecord(
      DataStore.MoveOutbox,
      secureMoveOutboxSchema,
      await requestToPromise<unknown>(outbox.get(input.messageId)),
    );
    if (existingOutbox && (existingOutbox.transferId !== input.transferId || existingOutbox.path !== input.path)) {
      transaction.abort();
      throw new Error('Secure Move message identity was replayed across outbox objects.');
    }
    if (!existingOutbox) {
      const ciphertext = input.ciphertext.buffer.slice(
        input.ciphertext.byteOffset,
        input.ciphertext.byteOffset + input.ciphertext.byteLength,
      ) as ArrayBuffer;
      outbox.put({
        messageId: input.messageId,
        transferId: input.transferId,
        sequence: input.sequence,
        path: input.path,
        ciphertext,
        createdAt: input.at,
        deliveredAt: null,
      } satisfies SecureMoveOutboxRecord);
    }
    const journal: MoveJournalRecord = existingJournal ?? {
      transferId: input.transferId,
      pairingId: input.pairingId,
      sourceProduct: 'image-trail',
      targetProduct: 'overlook',
      phase: 'awaiting-acknowledgement',
      lastSequence: input.sequence,
      createdAt: input.at,
      updatedAt: input.at,
    };
    journals.put({ ...journal, lastSequence: Math.max(journal.lastSequence, input.sequence), updatedAt: input.at });
    const audit = transaction.objectStore(DataStore.MoveAudit);
    const eventKey = `${input.messageId}:queued`;
    if ((await requestToPromise<IDBValidKey | undefined>(audit.getKey(eventKey))) === undefined) {
      audit.put({
        eventKey,
        transferId: input.transferId,
        interopId: input.interopId,
        event: 'queued',
        details: { sourceMessageId: input.messageId },
        createdAt: input.at,
      });
    }
    await transactionDone(transaction);
  }

  async progress(transferId: string): Promise<{ readonly journal: StoredMoveJournal; readonly pending: number } | null> {
    const transaction = this.db.transaction([DataStore.MoveJournals, DataStore.MoveItems, DataStore.MoveOutbox], 'readonly');
    const journal = hydrateRecord(
      DataStore.MoveJournals,
      moveJournalRecordSchema,
      await requestToPromise<unknown>(transaction.objectStore(DataStore.MoveJournals).get(transferId)),
    );
    const items = await itemsIn(transaction, transferId);
    const outbox = await this.outboxIn(transaction, transferId);
    await transactionDone(transaction);
    return journal ? { journal: { ...journal, counts: countsFor(items) }, pending: outbox.filter((row) => !row.deliveredAt).length } : null;
  }

  async pending(transferId: string): Promise<readonly SecureMoveOutboxRecord[]> {
    const transaction = this.db.transaction(DataStore.MoveOutbox, 'readonly');
    const rows = await this.outboxIn(transaction, transferId);
    await transactionDone(transaction);
    return rows.filter((row) => !row.deliveredAt);
  }

  async outbox(transferId: string): Promise<readonly SecureMoveOutboxRecord[]> {
    const transaction = this.db.transaction(DataStore.MoveOutbox, 'readonly');
    const rows = await this.outboxIn(transaction, transferId);
    await transactionDone(transaction);
    return rows;
  }

  async markDelivered(messageId: string, at: string): Promise<void> {
    const transaction = this.db.transaction(DataStore.MoveOutbox, 'readwrite');
    const store = transaction.objectStore(DataStore.MoveOutbox);
    const row = hydrateRecord(DataStore.MoveOutbox, secureMoveOutboxSchema, await requestToPromise<unknown>(store.get(messageId)));
    if (row && !row.deliveredAt) store.put({ ...row, deliveredAt: at });
    await transactionDone(transaction);
  }

  private async outboxIn(transaction: IDBTransaction, transferId: string): Promise<readonly SecureMoveOutboxRecord[]> {
    const values = await requestToPromise<unknown[]>(
      transaction.objectStore(DataStore.MoveOutbox).index(SchemaIndex.MoveOutboxByTransferId).getAll(transferId),
    );
    return hydrateRecords(DataStore.MoveOutbox, secureMoveOutboxSchema, values).sort(
      (left, right) => left.sequence - right.sequence || left.messageId.localeCompare(right.messageId),
    );
  }
}
