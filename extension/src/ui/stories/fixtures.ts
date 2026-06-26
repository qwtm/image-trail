import type { ImageDisplayRecord } from '../../core/display-records.js';
import type { RecallState } from '../../core/types.js';

const BASE_TIME = '2026-06-25T15:30:00.000Z';

const THUMBNAILS = {
  blue: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 80 80%22%3E%3Crect width=%2280%22 height=%2280%22 fill=%22%230f766e%22/%3E%3Ccircle cx=%2252%22 cy=%2228%22 r=%2218%22 fill=%22%23a7f3d0%22/%3E%3Cpath d=%22M8 70 30 44l13 14 12-10 17 22z%22 fill=%22%23ecfeff%22/%3E%3C/svg%3E',
  green:
    'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 80 80%22%3E%3Crect width=%2280%22 height=%2280%22 fill=%22%232f5d50%22/%3E%3Cpath d=%22M10 62h60L48 25 34 48 26 38z%22 fill=%22%23d9f99d%22/%3E%3C/svg%3E',
  purple:
    'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 80 80%22%3E%3Crect width=%2280%22 height=%2280%22 fill=%22%234c1d95%22/%3E%3Crect x=%2216%22 y=%2216%22 width=%2248%22 height=%2248%22 rx=%228%22 fill=%22%23ddd6fe%22/%3E%3C/svg%3E',
} as const;

function record(overrides: Partial<ImageDisplayRecord> & Pick<ImageDisplayRecord, 'id' | 'url'>): ImageDisplayRecord {
  return {
    timestamp: BASE_TIME,
    width: 1280,
    height: 854,
    source: 'history',
    ...overrides,
  };
}

export const normalRecord = record({
  id: 'recent-normal',
  url: 'https://images.example.test/gallery/quiet-ridge.jpg',
  label: 'quiet-ridge.jpg',
  thumbnail: THUMBNAILS.blue,
});

export const selectedRecord = record({
  id: 'recent-selected',
  url: 'https://images.example.test/gallery/selected-frame.webp',
  label: 'selected-frame.webp',
  thumbnail: THUMBNAILS.green,
});

export const capturedRecord = record({
  id: 'queue-captured',
  url: 'https://cdn.example.test/originals/captured-waterfall.png',
  label: 'captured-waterfall.png',
  thumbnail: THUMBNAILS.purple,
  source: 'bookmark',
  captureStatus: 'captured',
  blobId: 'blob-captured-waterfall',
  capturedAt: BASE_TIME,
  storedOriginal: {
    blobId: 'blob-captured-waterfall',
    mimeType: 'image/png',
    byteLength: 482132,
    capturedAt: BASE_TIME,
  },
});

export const pinnedRecentRecord = record({
  id: 'recent-pinned',
  url: 'https://images.example.test/gallery/pinned-ridge.jpeg',
  label: 'pinned-ridge.jpeg',
  thumbnail: THUMBNAILS.green,
  pinnedAt: BASE_TIME,
  pinnedRecordId: 'pin-pinned-ridge',
});

export const lockedPrivateRecord = record({
  id: 'private-locked',
  url: 'https://private.example.test/originals/private-image.jpg',
  label: 'private-image.jpg',
  source: 'bookmark',
  captureStatus: 'captured',
  blobId: 'blob-private-image',
  privacyStatus: 'locked',
  protectedPin: {
    plainPinId: 'plain-private-image',
    encryptedPinId: 'encrypted-private-image',
    encryptedThumbnailId: 'thumbnail-private-image',
    storedOriginalBlobId: 'blob-private-image',
    hasEncryptedMetadata: true,
    hasEncryptedThumbnail: true,
    hasStoredOriginal: true,
  },
});

export const longOverflowRecord = record({
  id: 'long-overflow',
  url: 'https://images.example.test/gallery/2026/06/very-long-descriptive-filename-with-camera-settings-and-location-notes-final-export.jpg?token=screen-review-fixture',
  label: 'very-long-descriptive-filename-with-camera-settings-and-location-notes-final-export.jpg',
  thumbnail: THUMBNAILS.blue,
});

export const missingThumbnailRecord = record({
  id: 'missing-thumbnail',
  url: 'https://images.example.test/gallery/no-thumbnail.gif',
  label: 'no-thumbnail.gif',
  source: 'bookmark',
});

export const recentFixtures = [normalRecord, selectedRecord, pinnedRecentRecord, capturedRecord, longOverflowRecord];

export const bookmarkFixtures = [
  { ...normalRecord, id: 'queue-normal', source: 'bookmark' as const, pinnedAt: BASE_TIME },
  capturedRecord,
  lockedPrivateRecord,
  longOverflowRecord,
  missingThumbnailRecord,
];

export function recallState(overrides: Partial<RecallState> = {}): RecallState {
  const candidates = [capturedRecord, lockedPrivateRecord, longOverflowRecord, missingThumbnailRecord].map((candidate, index) => ({
    ...candidate,
    id: `recall-${candidate.id}`,
    envelopeCreatedAt: new Date(Date.parse(BASE_TIME) - index * 60_000).toISOString(),
  }));

  return {
    open: true,
    busy: false,
    side: 'right',
    candidates,
    selectedIds: [],
    offset: 0,
    nextOffset: candidates.length,
    hasMore: false,
    total: candidates.length,
    failedCount: 0,
    ...overrides,
  };
}
