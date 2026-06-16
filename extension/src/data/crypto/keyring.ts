import type { KeyKind, KeyReference, StoredKeyRecord } from './types.js';
import { generateAesGcmKey } from './webcrypto.js';
export interface SessionKeyRecord { readonly reference: KeyReference; readonly key: CryptoKey; readonly metadata: StoredKeyRecord; }
export async function createSessionKey(kind: KeyKind = 'history', uuid: string = crypto.randomUUID(), now = new Date().toISOString()): Promise<SessionKeyRecord> {
  const reference = { kind, uuid, reference: `${kind}:${uuid}` };
  return { reference, key: await generateAesGcmKey(false), metadata: { ...reference, createdAt: now, updatedAt: now, wrapping: { mode: 'session', algorithm: 'none' }, extractable: false } };
}
