import * as v from 'valibot';
import type { InteropProduct } from '../../core/interop/contract.js';
import type { InteropRecord } from '../../core/interop/records.js';
import { requestToPromise, transactionDone } from '../idb-helpers.js';
import { DataStore, SchemaIndex } from '../schema.js';
import {
  emptySyncCounts,
  syncAuditRecordSchema,
  syncItemId,
  syncItemRecordSchema,
  syncSessionRecordSchema,
  type SyncAuditRecord,
  type SyncItemRecord,
  type SyncProgressCounts,
  type SyncSessionRecord,
} from './sync-journal-types.js';

export async function getSyncSession(db: IDBDatabase, sessionId: string): Promise<SyncSessionRecord | undefined> {
  const transaction = db.transaction(DataStore.SyncSessions, 'readonly');
  const row = await requestToPromise<unknown>(transaction.objectStore(DataStore.SyncSessions).get(sessionId));
  await transactionDone(transaction);
  return row === undefined ? undefined : v.parse(syncSessionRecordSchema, row);
}

export async function getSyncItem(db: IDBDatabase, sessionId: string, interopId: string): Promise<SyncItemRecord | undefined> {
  const transaction = db.transaction(DataStore.SyncItems, 'readonly');
  const row = await requestToPromise<unknown>(transaction.objectStore(DataStore.SyncItems).get(syncItemId(sessionId, interopId)));
  await transactionDone(transaction);
  return row === undefined ? undefined : v.parse(syncItemRecordSchema, row);
}

export async function listSyncItems(db: IDBDatabase, sessionId: string): Promise<readonly SyncItemRecord[]> {
  const transaction = db.transaction(DataStore.SyncItems, 'readonly');
  const index = transaction.objectStore(DataStore.SyncItems).index(SchemaIndex.SyncItemsBySessionId);
  const rows = await requestToPromise<unknown[]>(index.getAll(IDBKeyRange.only(sessionId)));
  await transactionDone(transaction);
  return rows.map((row) => v.parse(syncItemRecordSchema, row)).sort((left, right) => left.interopId.localeCompare(right.interopId));
}

export async function countSyncItems(db: IDBDatabase, sessionId: string): Promise<SyncProgressCounts> {
  const counts = emptySyncCounts();
  for (const item of await listSyncItems(db, sessionId)) {
    counts.total += 1;
    if (item.state === 'delete-review') counts.deleteReview += 1;
    else counts[item.state] += 1;
  }
  return counts;
}

export async function listSyncChanges(
  db: IDBDatabase,
  sessionId: string,
  product: InteropProduct,
  checkpoint: number,
): Promise<readonly InteropRecord[]> {
  const revisionKey = product === 'image-trail' ? 'imageTrail' : 'overlook';
  return (await listSyncItems(db, sessionId))
    .map((item) => (product === 'image-trail' ? item.imageTrailRecord : item.overlookRecord))
    .filter((record): record is InteropRecord => record !== null && record.revision[revisionKey] > checkpoint)
    .sort((left, right) => left.identity.interopId.localeCompare(right.identity.interopId));
}

export async function listSyncAudit(db: IDBDatabase, sessionId: string): Promise<readonly SyncAuditRecord[]> {
  const transaction = db.transaction(DataStore.SyncAudit, 'readonly');
  const index = transaction.objectStore(DataStore.SyncAudit).index(SchemaIndex.SyncAuditBySessionId);
  const rows = await requestToPromise<unknown[]>(index.getAll(IDBKeyRange.only(sessionId)));
  await transactionDone(transaction);
  return rows
    .map((row) => v.parse(syncAuditRecordSchema, row))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.eventKey.localeCompare(right.eventKey));
}
