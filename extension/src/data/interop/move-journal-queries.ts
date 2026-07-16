import type { InteropEnvelope } from '../../core/interop/messages.js';
import { requestToPromise, transactionDone } from '../idb-helpers.js';
import { hydrateRecord, hydrateRecords } from '../repositories/hydration.js';
import { DataStore, SchemaIndex } from '../schema.js';
import {
  moveAuditRecordSchema,
  moveCountsFor,
  moveItemId,
  moveItemRecordSchema,
  moveJournalRecordSchema,
  moveOutboxRecordSchema,
  type MoveItemRecord,
  type StoredMoveAuditEvent,
  type StoredMoveJournal,
} from './move-journal-types.js';

export async function getMoveJournal(db: IDBDatabase, transferId: string): Promise<StoredMoveJournal | undefined> {
  const transaction = db.transaction([DataStore.MoveJournals, DataStore.MoveItems], 'readonly');
  const journal = hydrateRecord(
    DataStore.MoveJournals,
    moveJournalRecordSchema,
    await requestToPromise<unknown>(transaction.objectStore(DataStore.MoveJournals).get(transferId)),
  );
  const items = await listMoveItemsIn(transaction, transferId);
  await transactionDone(transaction);
  return journal ? { ...journal, counts: moveCountsFor(items) } : undefined;
}

export async function getMoveItem(db: IDBDatabase, transferId: string, interopId: string): Promise<MoveItemRecord | undefined> {
  const transaction = db.transaction(DataStore.MoveItems, 'readonly');
  const item = hydrateRecord(
    DataStore.MoveItems,
    moveItemRecordSchema,
    await requestToPromise<unknown>(transaction.objectStore(DataStore.MoveItems).get(moveItemId(transferId, interopId))),
  );
  await transactionDone(transaction);
  return item;
}

export async function listMoveItems(db: IDBDatabase, transferId: string): Promise<readonly MoveItemRecord[]> {
  const transaction = db.transaction(DataStore.MoveItems, 'readonly');
  const items = await listMoveItemsIn(transaction, transferId);
  await transactionDone(transaction);
  return items;
}

export async function listPendingFinalization(db: IDBDatabase, transferId: string): Promise<readonly MoveItemRecord[]> {
  return (await listMoveItems(db, transferId)).filter((item) => item.acknowledgedAt !== null && item.finalizedAt === null);
}

export async function listPendingOutbox(db: IDBDatabase, transferId: string): Promise<readonly InteropEnvelope[]> {
  const transaction = db.transaction(DataStore.MoveOutbox, 'readonly');
  const rows = hydrateRecords(
    DataStore.MoveOutbox,
    moveOutboxRecordSchema,
    await requestToPromise<unknown[]>(
      transaction.objectStore(DataStore.MoveOutbox).index(SchemaIndex.MoveOutboxByTransferId).getAll(transferId),
    ),
  );
  await transactionDone(transaction);
  return rows
    .filter((row) => row.deliveredAt === null)
    .sort((left, right) => left.sequence - right.sequence || left.messageId.localeCompare(right.messageId))
    .map((row) => row.envelope);
}

export async function listMoveAudit(db: IDBDatabase, transferId: string): Promise<readonly StoredMoveAuditEvent[]> {
  const transaction = db.transaction(DataStore.MoveAudit, 'readonly');
  const rows = hydrateRecords(
    DataStore.MoveAudit,
    moveAuditRecordSchema,
    await requestToPromise<unknown[]>(
      transaction.objectStore(DataStore.MoveAudit).index(SchemaIndex.MoveAuditByTransferId).getAll(transferId),
    ),
  );
  await transactionDone(transaction);
  return rows.sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.eventKey.localeCompare(right.eventKey));
}

export async function listMoveItemsIn(transaction: IDBTransaction, transferId: string): Promise<readonly MoveItemRecord[]> {
  const values = await requestToPromise<unknown[]>(
    transaction.objectStore(DataStore.MoveItems).index(SchemaIndex.MoveItemsByTransferId).getAll(transferId),
  );
  return hydrateRecords(DataStore.MoveItems, moveItemRecordSchema, values).sort((left, right) =>
    left.interopId.localeCompare(right.interopId),
  );
}
