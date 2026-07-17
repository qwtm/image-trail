import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { IDBFactory } from 'fake-indexeddb';

import {
  sha256,
  EncryptedInteropTransport,
  InteropTransportError,
  type InteropObjectPage,
  type InteropObjectStore,
} from '../extension/src/core/interop/transport.js';
import { ensureDurableBookmarkKey } from '../extension/src/data/durable-bookmark-key.js';
import { openImageTrailDb } from '../extension/src/data/db.js';
import { importInteropPairingBundle } from '../extension/src/data/interop/pairing-import.js';
import { MoveOutboxPublishError, MoveOutboxPublisher } from '../extension/src/data/interop/move-outbox-publisher.js';
import { InteropRecordExportStore } from '../extension/src/data/interop/record-export.js';
import { openInteropMessage } from '../extension/src/data/interop/sealed-message.js';
import { SecureMoveOutboxRepository } from '../extension/src/data/interop/secure-move-outbox-repository.js';
import { BookmarksRepository } from '../extension/src/data/repositories/bookmarks-repository.js';
import { InteropKeysRepository } from '../extension/src/data/repositories/interop-keys-repository.js';
import { KeysRepository } from '../extension/src/data/repositories/keys-repository.js';

const INTEROP_ID = '11111111-1111-4111-8111-111111111111';
const MESSAGE_ID = '22222222-2222-4222-8222-222222222222';
const TRANSFER_ID = '33333333-3333-4333-8333-333333333333';

class MemoryStore implements InteropObjectStore {
  readonly provider = 'pcloud' as const;
  readonly objects = new Map<string, Uint8Array>();
  failPuts = 0;

  authState(): Promise<'connected'> {
    return Promise.resolve('connected');
  }
  put(path: string, bytes: Uint8Array): Promise<{ readonly bytes: number }> {
    if (this.failPuts > 0) {
      this.failPuts -= 1;
      return Promise.reject(new InteropTransportError('offline', 'offline', true));
    }
    this.objects.set(path, bytes.slice());
    return Promise.resolve({ bytes: bytes.byteLength });
  }
  get(path: string): Promise<Uint8Array> {
    const value = this.objects.get(path);
    return value ? Promise.resolve(value.slice()) : Promise.reject(new InteropTransportError('missing', 'not-found', false));
  }
  list(prefix: string, _cursor: string | null): Promise<InteropObjectPage> {
    return Promise.resolve({
      entries: [...this.objects.entries()]
        .filter(([path]) => path.startsWith(prefix))
        .map(([path, value]) => ({ path, bytes: value.byteLength })),
      nextCursor: null,
    });
  }
  delete(path: string): Promise<void> {
    this.objects.delete(path);
    return Promise.resolve();
  }
  quota(): Promise<{ readonly usedBytes: number; readonly totalBytes: number }> {
    return Promise.resolve({ usedBytes: 0, totalBytes: 10_000_000 });
  }
  async verify(path: string): Promise<{ readonly sha256: string; readonly bytes: number }> {
    const value = await this.get(path);
    return { sha256: await sha256(value), bytes: value.byteLength };
  }
}

async function seedBookmark(db: IDBDatabase): Promise<void> {
  const key = await ensureDurableBookmarkKey(new KeysRepository(db));
  await new BookmarksRepository(db).sealAndPut(
    'bookmark-1',
    {
      url: 'https://example.test/original.jpg',
      title: 'Private title',
      label: 'original.jpg',
      thumbnail: 'data:image/png;base64,AQID',
      width: 640,
      height: 480,
      bookmarkedAt: '2026-07-17T12:00:00.000Z',
      capturedAt: '2026-07-17T12:01:00.000Z',
      storedOriginal: { blobId: 'blob-1', mimeType: 'image/jpeg', byteLength: 42, capturedAt: '2026-07-17T12:01:00.000Z' },
    },
    key.key,
    key.reference,
    '2026-07-17T12:02:00.000Z',
    'https://example.test/original.jpg',
    '2026-07-17T12:03:00.000Z',
  );
}

test('ordinary encrypted pins gain stable canonical custody without changing queue order', async (t) => {
  const opened = await openImageTrailDb(new IDBFactory());
  assert.ok(opened.db);
  t.after(() => opened.db?.close());
  await seedBookmark(opened.db);
  const exporter = new InteropRecordExportStore(opened.db, {
    now: () => '2026-07-17T12:04:00.000Z',
    createId: () => INTEROP_ID,
  });
  const first = await exporter.review(['bookmark-1']);
  const second = await exporter.review(['bookmark-1']);
  assert.equal(first.records[0]?.record.identity.interopId, INTEROP_ID);
  assert.deepEqual(second.records, first.records);
  assert.equal(first.records[0]?.reviewCategory, 'metadata-only');
  assert.equal(first.records[0]?.record.original.state, 'metadata-only');
  assert.equal((await new BookmarksRepository(opened.db).getEncrypted('bookmark-1'))?.queueUpdatedAt, '2026-07-17T12:03:00.000Z');
});

test('a failed provider write resumes from pairing-key-sealed local ciphertext after restart', async (t) => {
  const opened = await openImageTrailDb(new IDBFactory());
  assert.ok(opened.db);
  t.after(() => opened.db?.close());
  await seedBookmark(opened.db);
  await importInteropPairingBundle({
    db: opened.db,
    bundle: JSON.parse(readFileSync('contracts/interop/v1/fixtures/valid-pairing-bundle.json', 'utf8')) as unknown,
    password: 'fixture-password',
  });
  const pairing = (await new InteropKeysRepository(opened.db).list())[0];
  assert.ok(pairing);
  const ids = [INTEROP_ID, MESSAGE_ID];
  const store = new MemoryStore();
  store.failPuts = 1;
  const publisher = new MoveOutboxPublisher(opened.db, store, {
    now: () => '2026-07-17T12:04:00.000Z',
    createId: () => ids.shift() ?? crypto.randomUUID(),
  });
  await assert.rejects(
    publisher.start({ transferId: TRANSFER_ID, recordIds: ['bookmark-1'], pairing }),
    (error: unknown) => error instanceof MoveOutboxPublishError && error.progress.pending === 1,
  );
  const resumed = await new MoveOutboxPublisher(opened.db, store).resume(TRANSFER_ID, pairing, 1);
  assert.equal(resumed.pending, 0);
  assert.equal(resumed.delivered, 1);
});

test('Move publication stores only pairing-key ciphertext and leaves a durable delivered outbox', async (t) => {
  const opened = await openImageTrailDb(new IDBFactory());
  assert.ok(opened.db);
  t.after(() => opened.db?.close());
  await seedBookmark(opened.db);
  await importInteropPairingBundle({
    db: opened.db,
    bundle: JSON.parse(readFileSync('contracts/interop/v1/fixtures/valid-pairing-bundle.json', 'utf8')) as unknown,
    password: 'fixture-password',
  });
  const pairing = (await new InteropKeysRepository(opened.db).list())[0];
  assert.ok(pairing);
  const ids = [INTEROP_ID, MESSAGE_ID];
  const store = new MemoryStore();
  const publisher = new MoveOutboxPublisher(opened.db, store, {
    now: () => '2026-07-17T12:04:00.000Z',
    createId: () => ids.shift() ?? crypto.randomUUID(),
  });
  const progress = await publisher.start({ transferId: TRANSFER_ID, recordIds: ['bookmark-1'], pairing });
  assert.equal(progress.delivered, 1);
  assert.equal(progress.pending, 0);
  assert.equal(progress.counts.metadataOnly, 1);
  const outbox = (await new SecureMoveOutboxRepository(opened.db).outbox(TRANSFER_ID))[0];
  assert.ok(outbox);
  const path = outbox.path;
  const sealed = await new EncryptedInteropTransport(store).download({ pairingId: pairing.pairingId, transferId: TRANSFER_ID }, path);
  const envelope = await openInteropMessage(sealed, pairing);
  assert.equal(envelope.payload.kind, 'record');
  assert.equal(envelope.payload.kind === 'record' ? envelope.payload.record.sourceUrl : null, 'https://example.test/original.jpg');
  const providerBytes = new TextDecoder().decode(Uint8Array.from([...store.objects.values()].flatMap((value) => [...value])));
  assert.doesNotMatch(providerBytes, /Private title|example\.test|original\.jpg/u);
  const transaction = opened.db.transaction(['moveItems', 'moveOutbox'], 'readonly');
  const itemRequest = transaction.objectStore('moveItems').getAll();
  const outboxRequest = transaction.objectStore('moveOutbox').getAll();
  const requestResult = (request: IDBRequest<unknown[]>): Promise<unknown[]> =>
    new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  const [items, rawOutbox] = await Promise.all([requestResult(itemRequest), requestResult(outboxRequest)]);
  const raw = JSON.stringify({
    items,
    outbox: rawOutbox,
  });
  assert.doesNotMatch(raw, /Private title|example\.test|original\.jpg/u);
});
