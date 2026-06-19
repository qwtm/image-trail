import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { openImageTrailDb } from '../extension/src/data/db.js';
import { DataStore, IMAGE_TRAIL_DB_NAME, SchemaIndex } from '../extension/src/data/schema.js';
import { HistoryRepository, type EncryptedHistoryRecord } from '../extension/src/data/repositories/history-repository.js';
import { BookmarksRepository, type EncryptedBookmarkRecord } from '../extension/src/data/repositories/bookmarks-repository.js';
import { KeysRepository } from '../extension/src/data/repositories/keys-repository.js';
import type { StoredKeyRecord } from '../extension/src/data/crypto/types.js';
import { IndexedDbBookmarkStore } from '../extension/src/content/bookmarks-controller.js';
import { createDisplayRecord } from '../extension/src/core/display-records.js';
import { DEFAULT_LOCAL_SETTINGS } from '../extension/src/data/local-settings.js';

async function deleteImageTrailDb(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(IMAGE_TRAIL_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Timed out deleting test IndexedDB database.'));
  });
}

async function openFreshImageTrailDb(): Promise<IDBDatabase> {
  await deleteImageTrailDb();
  const result = await openImageTrailDb();
  assert.equal(result.status.ok, true, result.status.message);
  assert.ok(result.db);
  return result.db;
}

function asArray(list: DOMStringList): string[] {
  return Array.from({ length: list.length }, (_, index) => list.item(index)).filter((value): value is string => value !== null);
}

function storedKeyRecord(reference: `history:${string}` = 'history:key-001', uuid = 'key-001'): StoredKeyRecord<'history'> {
  return {
    kind: 'history',
    uuid,
    reference,
    createdAt: '2026-06-17T00:00:00.000Z',
    updatedAt: '2026-06-17T00:00:00.000Z',
    wrapping: {
      mode: 'session',
      algorithm: 'none',
    },
    extractable: false,
  };
}

function bookmarkRecord(uuid = 'bookmark-001'): EncryptedBookmarkRecord {
  return {
    uuid,
    url: 'https://example.test/bookmark.jpg',
    envelope: {
      schemaVersion: 1,
      payloadVersion: 1,
      algorithm: 'AES-GCM',
      iv: 'test-iv',
      ciphertext: 'test-ciphertext',
      key: {
        kind: 'bookmark',
        uuid: 'key-001',
        reference: 'bookmark:key-001',
      },
      createdAt: '2026-06-17T00:00:00.000Z',
      updatedAt: '2026-06-17T00:00:01.000Z',
      authenticatedMetadata: { recordType: 'bookmark' },
    },
  };
}

function historyRecord(uuid = 'history-001'): EncryptedHistoryRecord {
  return {
    uuid,
    envelope: {
      schemaVersion: 1,
      payloadVersion: 1,
      algorithm: 'AES-GCM',
      iv: 'test-iv',
      ciphertext: 'test-ciphertext',
      key: {
        kind: 'history',
        uuid: 'key-001',
        reference: 'history:key-001',
      },
      createdAt: '2026-06-17T00:00:00.000Z',
      updatedAt: '2026-06-17T00:00:01.000Z',
      authenticatedMetadata: { recordType: 'history' },
    },
  };
}

test('IndexedDB migrations create data stores, indexes, and schema metadata', async (t) => {
  const db = await openFreshImageTrailDb();
  t.after(() => db.close());

  assert.deepEqual(
    asArray(db.objectStoreNames),
    [DataStore.Blobs, DataStore.Bookmarks, DataStore.History, DataStore.Keys, DataStore.Metadata].sort(),
  );

  const transaction = db.transaction(
    [DataStore.Metadata, DataStore.Keys, DataStore.History, DataStore.Bookmarks, DataStore.Blobs],
    'readonly',
  );
  const keys = transaction.objectStore(DataStore.Keys);
  const history = transaction.objectStore(DataStore.History);
  const bookmarks = transaction.objectStore(DataStore.Bookmarks);
  const blobs = transaction.objectStore(DataStore.Blobs);

  assert.deepEqual(asArray(keys.indexNames), [SchemaIndex.KeysByKind, SchemaIndex.KeysByReference, SchemaIndex.KeysByUuid].sort());
  assert.deepEqual(asArray(history.indexNames), [SchemaIndex.HistoryByKeyReference, SchemaIndex.HistoryByUpdatedAt].sort());
  assert.deepEqual(
    asArray(bookmarks.indexNames),
    [SchemaIndex.BookmarksByKeyReference, SchemaIndex.BookmarksByUpdatedAt, SchemaIndex.BookmarksByUrl].sort(),
  );
  assert.deepEqual(asArray(blobs.indexNames), [SchemaIndex.BlobsByCreatedAt, SchemaIndex.BlobsByKeyReference].sort());

  const metadata = await new Promise((resolve, reject) => {
    const request = transaction.objectStore(DataStore.Metadata).get('schema');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  assert.equal((metadata as { databaseVersion: number }).databaseVersion, db.version);
  assert.match((metadata as { migratedAt: string }).migratedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('KeysRepository writes complete transactions and reads records back', async (t) => {
  const db = await openFreshImageTrailDb();
  t.after(() => db.close());
  const repository = new KeysRepository(db);
  const record = storedKeyRecord();

  await repository.put(record);

  assert.deepEqual(await repository.get(record.reference), record);
  assert.equal(await repository.get('history:missing'), undefined);
});

test('HistoryRepository writes complete transactions and reads encrypted records back', async (t) => {
  const db = await openFreshImageTrailDb();
  t.after(() => db.close());
  const repository = new HistoryRepository(db);
  const record = historyRecord();

  await repository.putEncrypted(record);

  assert.deepEqual(await repository.getEncrypted(record.uuid), record);
  assert.equal(await repository.getEncrypted('missing-history'), undefined);
});

test('BookmarksRepository writes encrypted records and dedupes by URL index', async (t) => {
  const db = await openFreshImageTrailDb();
  t.after(() => db.close());
  const repository = new BookmarksRepository(db);
  const record = bookmarkRecord();

  await repository.putEncrypted(record);

  assert.deepEqual(await repository.getEncrypted(record.uuid), record);
  assert.deepEqual(await repository.listEncrypted(), [record]);
  assert.deepEqual(await repository.getEncryptedByUrl(record.url), record);
  assert.equal(await repository.getEncryptedByUrl('https://example.test/missing.jpg'), undefined);
});

test('BookmarksRepository pages encrypted records newest first', async (t) => {
  const db = await openFreshImageTrailDb();
  t.after(() => db.close());
  const repository = new BookmarksRepository(db);

  await repository.putEncrypted(bookmarkRecord('bookmark-old'));
  await repository.putEncrypted({
    ...bookmarkRecord('bookmark-new'),
    url: 'https://example.test/new.jpg',
    envelope: { ...bookmarkRecord('bookmark-new').envelope, updatedAt: '2026-06-17T00:00:03.000Z' },
  });
  await repository.putEncrypted({
    ...bookmarkRecord('bookmark-middle'),
    url: 'https://example.test/middle.jpg',
    envelope: { ...bookmarkRecord('bookmark-middle').envelope, updatedAt: '2026-06-17T00:00:02.000Z' },
  });

  assert.equal(await repository.countEncrypted(), 3);
  assert.deepEqual(
    (await repository.listEncryptedPage({ offset: 0, limit: 2 })).map((record) => record.uuid),
    ['bookmark-new', 'bookmark-middle'],
  );
  assert.deepEqual(
    (await repository.listEncryptedPage({ offset: 2, limit: 2 })).map((record) => record.uuid),
    ['bookmark-old'],
  );
});

test('BookmarksRepository exposes one older page after the bookmark soft max is exceeded', async (t) => {
  const db = await openFreshImageTrailDb();
  t.after(() => db.close());
  const repository = new BookmarksRepository(db);
  const limit = DEFAULT_LOCAL_SETTINGS.visibleBookmarkSoftMax;

  for (let index = 0; index <= limit; index += 1) {
    const id = `bookmark-${String(index).padStart(2, '0')}`;
    await repository.putEncrypted({
      ...bookmarkRecord(id),
      url: `https://example.test/${id}.jpg`,
      envelope: {
        ...bookmarkRecord(id).envelope,
        updatedAt: `2026-06-17T00:00:${String(index).padStart(2, '0')}.000Z`,
      },
    });
  }

  const newestPage = await repository.listEncryptedPage({ offset: 0, limit });
  const olderPage = await repository.listEncryptedPage({ offset: limit, limit });
  const newerAgain = await repository.listEncryptedPage({ offset: 0, limit });

  assert.equal(await repository.countEncrypted(), limit + 1);
  assert.equal(newestPage.length, limit);
  assert.equal(newestPage[0]?.uuid, `bookmark-${String(limit).padStart(2, '0')}`);
  assert.equal(newestPage.at(-1)?.uuid, 'bookmark-01');
  assert.deepEqual(
    olderPage.map((record) => record.uuid),
    ['bookmark-00'],
  );
  assert.deepEqual(
    newerAgain.map((record) => record.uuid),
    newestPage.map((record) => record.uuid),
  );
});

test('IndexedDbBookmarkStore recalls saved bookmarks after a new store instance opens', async () => {
  await deleteImageTrailDb();
  const firstStore = new IndexedDbBookmarkStore();
  try {
    await firstStore.save(
      createDisplayRecord({
        id: 'https://example.test/recalled.jpg',
        url: 'https://example.test/recalled.jpg',
        label: 'recalled.jpg',
        timestamp: '2026-06-19T00:00:00.000Z',
        source: 'bookmark',
      }),
    );
  } finally {
    await firstStore.close();
  }

  const reloadedStore = new IndexedDbBookmarkStore();
  try {
    const page = await reloadedStore.loadPage({ offset: 0, limit: 30 });

    assert.equal(page.total, 1);
    assert.equal(page.items.length, 1);
    assert.equal(page.items[0]?.url, 'https://example.test/recalled.jpg');
    assert.equal(page.hasOlder, false);
    assert.equal(page.hasNewer, false);
  } finally {
    await reloadedStore.close();
  }
});

test('IndexedDbBookmarkStore recalls encrypted bookmark thumbnails after reload', async () => {
  await deleteImageTrailDb();
  const firstStore = new IndexedDbBookmarkStore();
  try {
    await firstStore.save(
      createDisplayRecord({
        id: 'https://example.test/thumbnailed.jpg',
        url: 'https://example.test/thumbnailed.jpg',
        label: 'thumbnailed.jpg',
        thumbnail: 'data:image/jpeg;base64,thumbnail',
        timestamp: '2026-06-19T00:00:00.000Z',
        source: 'bookmark',
      }),
    );
  } finally {
    await firstStore.close();
  }

  const reloadedStore = new IndexedDbBookmarkStore();
  try {
    const page = await reloadedStore.loadPage({ offset: 0, limit: 30 });

    assert.equal(page.items.length, 1);
    assert.equal(page.items[0]?.thumbnail, 'data:image/jpeg;base64,thumbnail');
  } finally {
    await reloadedStore.close();
  }
});

test('IndexedDbBookmarkStore keeps bookmark order stable when refreshing an existing thumbnail', async () => {
  await deleteImageTrailDb();
  const store = new IndexedDbBookmarkStore();
  try {
    await store.save(
      createDisplayRecord({
        id: 'https://example.test/first.jpg',
        url: 'https://example.test/first.jpg',
        label: 'first.jpg',
        timestamp: '2026-06-19T00:00:00.000Z',
        source: 'bookmark',
      }),
    );
    await store.save(
      createDisplayRecord({
        id: 'https://example.test/second.jpg',
        url: 'https://example.test/second.jpg',
        label: 'second.jpg',
        timestamp: '2026-06-19T00:00:01.000Z',
        source: 'bookmark',
      }),
    );

    const before = await store.loadPage({ offset: 0, limit: 30 });
    await store.save({ ...before.items[1]!, thumbnail: 'data:image/jpeg;base64,thumbnail' });
    const after = await store.loadPage({ offset: 0, limit: 30 });

    assert.deepEqual(
      after.items.map((item) => item.url),
      before.items.map((item) => item.url),
    );
    assert.equal(after.items[1]?.thumbnail, 'data:image/jpeg;base64,thumbnail');
  } finally {
    await store.close();
  }
});

test('IndexedDbBookmarkStore paginates visible bookmarks without counting undecryptable legacy rows', async () => {
  await deleteImageTrailDb();
  const firstStore = new IndexedDbBookmarkStore();
  try {
    for (let index = 0; index < 6; index += 1) {
      await firstStore.save(
        createDisplayRecord({
          id: `https://example.test/visible-${index}.jpg`,
          url: `https://example.test/visible-${index}.jpg`,
          label: `visible-${index}.jpg`,
          timestamp: `2026-06-19T00:00:0${index}.000Z`,
          source: 'bookmark',
        }),
      );
    }
  } finally {
    await firstStore.close();
  }

  const openResult = await openImageTrailDb();
  assert.ok(openResult.db);
  try {
    const repository = new BookmarksRepository(openResult.db);
    await repository.putEncrypted({
      ...bookmarkRecord('legacy-hidden-newer'),
      url: 'https://example.test/legacy-hidden-newer.jpg',
      envelope: {
        ...bookmarkRecord('legacy-hidden-newer').envelope,
        updatedAt: '2999-01-01T00:00:00.000Z',
      },
    });
    await repository.putEncrypted({
      ...bookmarkRecord('legacy-hidden-middle'),
      url: 'https://example.test/legacy-hidden-middle.jpg',
      envelope: {
        ...bookmarkRecord('legacy-hidden-middle').envelope,
        updatedAt: '2026-06-19T00:00:03.500Z',
      },
    });
  } finally {
    openResult.db.close();
  }

  const reloadedStore = new IndexedDbBookmarkStore();
  try {
    const firstPage = await reloadedStore.loadPage({ offset: 0, limit: 3 });
    const secondPage = await reloadedStore.loadPage({ offset: 3, limit: 3 });

    assert.equal(firstPage.total, 6);
    assert.equal(firstPage.items.length, 3);
    assert.equal(firstPage.hasOlder, true);
    assert.equal(firstPage.hasNewer, false);
    assert.equal(secondPage.total, 6);
    assert.equal(secondPage.items.length, 3);
    assert.equal(secondPage.hasOlder, false);
    assert.equal(secondPage.hasNewer, true);
    assert.deepEqual(
      [...firstPage.items, ...secondPage.items].map((item) => item.url).sort(),
      Array.from({ length: 6 }, (_, index) => `https://example.test/visible-${index}.jpg`).sort(),
    );
  } finally {
    await reloadedStore.close();
  }
});

test('IndexedDbBookmarkStore clamps offsets after visible bookmark totals shrink', async () => {
  await deleteImageTrailDb();
  const store = new IndexedDbBookmarkStore();
  try {
    for (let index = 0; index < 4; index += 1) {
      await store.save(
        createDisplayRecord({
          id: `https://example.test/clamp-${index}.jpg`,
          url: `https://example.test/clamp-${index}.jpg`,
          label: `clamp-${index}.jpg`,
          timestamp: `2026-06-19T00:00:0${index}.000Z`,
          source: 'bookmark',
        }),
      );
    }

    const lastPage = await store.loadPage({ offset: 3, limit: 3 });
    assert.equal(lastPage.offset, 3);
    assert.equal(lastPage.items.length, 1);
    await store.remove(lastPage.items[0]!);

    const clampedPage = await store.loadPage({ offset: 3, limit: 3 });
    assert.equal(clampedPage.total, 3);
    assert.equal(clampedPage.offset, 0);
    assert.equal(clampedPage.items.length, 3);
    assert.equal(clampedPage.hasOlder, false);
    assert.equal(clampedPage.hasNewer, false);
  } finally {
    await store.close();
  }
});

test('repository transaction failures are surfaced to callers', async (t) => {
  const db = await openFreshImageTrailDb();
  t.after(() => db.close());
  const repository = new KeysRepository(db);
  const uncloneableRecord = {
    ...storedKeyRecord('history:uncloneable', 'uncloneable'),
    wrapping: {
      mode: 'session',
      algorithm: 'none',
      wrappedKey: () => 'not structured-cloneable',
    },
  } as unknown as StoredKeyRecord<'history'>;

  await assert.rejects(repository.put(uncloneableRecord), (error) => error instanceof DOMException || error instanceof Error);
});
