import type { CaptureResult, StorageUsageSummary } from '../core/image/capture-result.js';
import {
  createCaptureImageMessage,
  createDeleteBlobMessage,
  createStorageUsageRequestMessage,
  isCaptureResultMessage,
} from '../background/messages.js';
import type { CaptureSourceType } from '../background/messages.js';

function extractOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export interface CaptureStore {
  readonly requestCapture: (url: string, sourceType: CaptureSourceType, sourceRecordId?: string) => Promise<CaptureResult>;
  readonly requestDeleteBlob: (blobId: string) => Promise<{ deleted: boolean; usage: StorageUsageSummary }>;
  readonly requestStorageUsage: () => Promise<StorageUsageSummary>;
}

export class CaptureController implements CaptureStore {
  async requestCapture(url: string, sourceType: CaptureSourceType, sourceRecordId?: string): Promise<CaptureResult> {
    const origin = extractOrigin(url);

    if (origin) {
      const hasPermission = await chrome.permissions.contains({ origins: [`${origin}/*`] });
      if (!hasPermission) {
        try {
          const granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
          if (!granted) {
            return { status: 'remote-only', reason: 'permission-needed', message: `Permission needed for ${origin}.`, origin };
          }
        } catch {
          return { status: 'remote-only', reason: 'permission-needed', message: `Permission needed for ${origin}.`, origin };
        }
      }
    }

    const response = await chrome.runtime.sendMessage(createCaptureImageMessage(url, sourceType, sourceRecordId));
    if (isCaptureResultMessage(response)) {
      return response.payload;
    }
    return { status: 'failed', reason: 'unknown', message: 'Invalid response from background.' };
  }

  async requestDeleteBlob(blobId: string): Promise<{ deleted: boolean; usage: StorageUsageSummary }> {
    const response = await chrome.runtime.sendMessage(createDeleteBlobMessage(blobId));
    if (response && typeof response === 'object' && 'payload' in response) {
      return (response as { payload: { deleted: boolean; usage: StorageUsageSummary } }).payload;
    }
    return { deleted: false, usage: { totalBytes: 0, blobCount: 0 } };
  }

  async requestStorageUsage(): Promise<StorageUsageSummary> {
    const response = await chrome.runtime.sendMessage(createStorageUsageRequestMessage());
    if (response && typeof response === 'object' && 'payload' in response) {
      return (response as { payload: StorageUsageSummary }).payload;
    }
    return { totalBytes: 0, blobCount: 0 };
  }
}
