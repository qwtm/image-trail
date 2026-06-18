export type DataStoreName = 'metadata' | 'keys' | 'history' | 'bookmarks' | 'blobs';
export type DataStatusCode =
  | 'ok'
  | 'db-open-failed'
  | 'migration-failed'
  | 'encryption-failed'
  | 'decryption-failed'
  | 'not-found'
  | 'locked';

export interface RecoverableDataStatus {
  readonly ok: boolean;
  readonly code: DataStatusCode;
  readonly message: string;
  readonly cause?: unknown;
}

export interface VersionMetadataRecord {
  readonly key: 'schema';
  readonly databaseVersion: number;
  readonly migratedAt: string;
}

export type BlobKind = 'original' | 'thumbnail';

export interface StoredBlobRecord {
  readonly id: string;
  readonly kind: BlobKind;
  readonly sha256: string;
  readonly mimeType: string;
  readonly byteLength: number;
  readonly bytes: ArrayBuffer;
  readonly createdAt: string;
  readonly sourceUrl: string;
  readonly referenceCount: number;
}

export interface StoredOriginalReference {
  readonly blobId: string;
  readonly sha256: string;
  readonly mimeType: string;
  readonly byteLength: number;
  readonly capturedAt: string;
}

export interface DurableHistoryPayloadV1 {
  readonly url: string;
  readonly title?: string;
  readonly label?: string;
  readonly thumbnail?: string;
  readonly capturedAt: string;
  readonly captureStatus: 'remote-only' | 'downloaded' | 'failed';
  readonly storedOriginal?: StoredOriginalReference;
}

export interface DurableBookmarkPayloadV1 {
  readonly url: string;
  readonly title?: string;
  readonly label?: string;
  readonly thumbnail?: string;
  readonly bookmarkedAt: string;
  readonly downloadedAt?: string;
  readonly capturedAt?: string;
  readonly sourceCompatibility?: 'favorites';
  readonly storedOriginal?: StoredOriginalReference;
}
