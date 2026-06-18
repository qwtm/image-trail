import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { openImageTrailDb } from '../extension/src/data/db.js';
import { IMAGE_TRAIL_DB_NAME } from '../extension/src/data/schema.js';
import { BlobsRepository } from '../extension/src/data/repositories/blobs-repository.js';
import type { StoredBlobRecord } from '../extension/src/data/types.js';

async function deleteDb(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(IMAGE_TRAIL_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Blocked deleting test database.'));
  });
}

async function openFreshDb(): Promise<IDBDatabase> {
  await deleteDb();
  const result = await openImageTrailDb();
  assert.ok(result.status.ok, `DB open failed: ${result.status.message}`);
  return result.db!;
}

function makeBlobRecord(overrides: Partial<StoredBlobRecord> = {}): StoredBlobRecord {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    kind: overrides.kind ?? 'original',
    sha256: overrides.sha256 ?? 'abc123',
    mimeType: overrides.mimeType ?? 'image/png',
    byteLength: overrides.byteLength ?? 100,
    bytes: overrides.bytes ?? new ArrayBuffer(100),
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    sourceUrl: overrides.sourceUrl ?? 'https://example.com/image.png',
    referenceCount: overrides.referenceCount ?? 1,
  };
}

test('BlobsRepository stores and retrieves blob records by id', async (t) => {
  const db = await openFreshDb();
  t.after(() => db.close());
  const repo = new BlobsRepository(db);

  const record = makeBlobRecord({ id: 'blob-1' });
  await repo.put(record);

  const retrieved = await repo.get('blob-1');
  assert.ok(retrieved);
  assert.equal(retrieved.id, 'blob-1');
  assert.equal(retrieved.sha256, record.sha256);
  assert.equal(retrieved.byteLength, 100);
});

test('BlobsRepository deduplicates by SHA-256 and increments reference count', async (t) => {
  const db = await openFreshDb();
  t.after(() => db.close());
  const repo = new BlobsRepository(db);

  const first = makeBlobRecord({ id: 'blob-a', sha256: 'dedup-hash', referenceCount: 1 });
  await repo.put(first);

  const second = makeBlobRecord({ id: 'blob-b', sha256: 'dedup-hash', referenceCount: 1 });
  const result = await repo.put(second);

  assert.equal(result.id, 'blob-a');
  assert.equal(result.referenceCount, 2);

  const notFound = await repo.get('blob-b');
  assert.equal(notFound, undefined);
});

test('BlobsRepository looks up blob by SHA-256 hash', async (t) => {
  const db = await openFreshDb();
  t.after(() => db.close());
  const repo = new BlobsRepository(db);

  const record = makeBlobRecord({ sha256: 'find-me-hash' });
  await repo.put(record);

  const found = await repo.getBySha256('find-me-hash');
  assert.ok(found);
  assert.equal(found.sha256, 'find-me-hash');

  const notFound = await repo.getBySha256('nonexistent');
  assert.equal(notFound, undefined);
});

test('BlobsRepository decrements reference count and deletes at zero', async (t) => {
  const db = await openFreshDb();
  t.after(() => db.close());
  const repo = new BlobsRepository(db);

  const record = makeBlobRecord({ id: 'blob-rc', referenceCount: 2 });
  await repo.put(record);

  await repo.remove('blob-rc');
  const afterFirst = await repo.get('blob-rc');
  assert.ok(afterFirst);
  assert.equal(afterFirst.referenceCount, 1);

  await repo.remove('blob-rc');
  const afterSecond = await repo.get('blob-rc');
  assert.equal(afterSecond, undefined);
});

test('BlobsRepository remove is a no-op for nonexistent blobs', async (t) => {
  const db = await openFreshDb();
  t.after(() => db.close());
  const repo = new BlobsRepository(db);

  await repo.remove('does-not-exist');
});

test('BlobsRepository reports storage usage across all records', async (t) => {
  const db = await openFreshDb();
  t.after(() => db.close());
  const repo = new BlobsRepository(db);

  const emptyUsage = await repo.getStorageUsage();
  assert.equal(emptyUsage.blobCount, 0);
  assert.equal(emptyUsage.totalBytes, 0);

  await repo.put(makeBlobRecord({ id: 'b1', sha256: 'h1', byteLength: 500 }));
  await repo.put(makeBlobRecord({ id: 'b2', sha256: 'h2', byteLength: 300 }));

  const usage = await repo.getStorageUsage();
  assert.equal(usage.blobCount, 2);
  assert.equal(usage.totalBytes, 800);

  await repo.remove('b1');
  const usageAfter = await repo.getStorageUsage();
  assert.equal(usageAfter.blobCount, 1);
  assert.equal(usageAfter.totalBytes, 300);
});
