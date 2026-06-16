export type EncryptionAlgorithm = 'AES-GCM';
export type KeyKind = 'root' | 'history' | 'bookmark' | 'metadata' | 'export';
export type KeyWrappingMode = 'session' | 'password' | 'webauthn' | 'imported';

export interface KeyReference {
  readonly kind: KeyKind;
  readonly uuid: string;
  readonly reference: string;
}

export interface StoredKeyRecord extends KeyReference {
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly wrapping: {
    readonly mode: KeyWrappingMode;
    readonly algorithm: EncryptionAlgorithm | 'none';
    readonly salt?: string;
    readonly iterations?: number;
    readonly wrappedKey?: string;
  };
  readonly extractable: boolean;
}

export interface EncryptedEnvelope<TMetadata extends Record<string, unknown> = Record<string, unknown>> {
  readonly schemaVersion: 1;
  readonly payloadVersion: number;
  readonly algorithm: EncryptionAlgorithm;
  readonly iv: string;
  readonly ciphertext: string;
  readonly key: KeyReference;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly authenticatedMetadata: TMetadata;
}
