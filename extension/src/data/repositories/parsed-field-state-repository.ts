import type { ParsedFieldStateRecord } from '../../core/types.js';
import { requestToPromise, transactionDone } from '../idb-helpers.js';
import { DataStore } from '../schema.js';

interface ParsedFieldStateMetadataRecord extends ParsedFieldStateRecord {
  readonly key: string;
  readonly kind: 'parsedFieldState';
}

const PARSED_FIELD_STATE_KEY_PREFIX = 'parsed-field-state:';

export class ParsedFieldStateRepository {
  constructor(private readonly db: IDBDatabase) {}

  async get(hostname: string, pageUrl: string): Promise<ParsedFieldStateRecord | null> {
    const transaction = this.db.transaction(DataStore.Metadata, 'readonly');
    const record = await requestToPromise<ParsedFieldStateMetadataRecord | undefined>(
      transaction.objectStore(DataStore.Metadata).get(parsedFieldStateKey(hostname, pageUrl)),
    );
    await transactionDone(transaction);
    return record?.kind === 'parsedFieldState' ? stripMetadataKey(record) : null;
  }

  async put(record: ParsedFieldStateRecord): Promise<void> {
    const transaction = this.db.transaction(DataStore.Metadata, 'readwrite');
    const store = transaction.objectStore(DataStore.Metadata);
    const key = parsedFieldStateKey(record.hostname, record.pageUrl);
    const existing = await requestToPromise<ParsedFieldStateMetadataRecord | undefined>(store.get(key));
    if (existing?.kind === 'parsedFieldState' && existing.updatedAt > record.updatedAt) {
      await transactionDone(transaction);
      return;
    }
    store.put({
      ...record,
      key,
      kind: 'parsedFieldState',
    } satisfies ParsedFieldStateMetadataRecord);
    await transactionDone(transaction);
  }
}

function stripMetadataKey(record: ParsedFieldStateMetadataRecord): ParsedFieldStateRecord {
  const { key: _key, kind: _kind, ...state } = record;
  return state;
}

function parsedFieldStateKey(hostname: string, pageUrl: string): string {
  return `${PARSED_FIELD_STATE_KEY_PREFIX}${hostname.toLowerCase()}:${encodeURIComponent(pageUrl)}`;
}
