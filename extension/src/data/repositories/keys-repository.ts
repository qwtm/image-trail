import { DataStore } from '../schema.js';
import type { StoredKeyRecord } from '../crypto/types.js';
export class KeysRepository { constructor(private readonly db: IDBDatabase) {} async put(record: StoredKeyRecord): Promise<void> { await requestToPromise(this.db.transaction(DataStore.Keys, 'readwrite').objectStore(DataStore.Keys).put(record)); } async get(reference: string): Promise<StoredKeyRecord | undefined> { return requestToPromise(this.db.transaction(DataStore.Keys).objectStore(DataStore.Keys).get(reference)); } }
function requestToPromise<T>(request: IDBRequest<T>): Promise<T> { return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
