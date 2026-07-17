import type { InteropProviderId, InteropProviderState, InteropRuntimeError } from '../core/interop/runtime-state.js';
import { InteropKeysRepository } from '../data/repositories/interop-keys-repository.js';
import * as progressViews from './interop-runtime-progress.js';

export const INTEROP_PROVIDERS: Record<InteropProviderId, { readonly label: string; readonly disconnected: string }> = {
  pcloud: { label: 'pCloud', disconnected: 'Separate pCloud interoperability access is not configured.' },
  'google-drive': { label: 'Google Drive', disconnected: 'Connect Google Drive for the dedicated Image Trail Interop folder.' },
  'icloud-drive': { label: 'iCloud Drive', disconnected: 'Install and authorize the signed Overlook interoperability host.' },
};

export async function interopPairingState(getDb: () => Promise<IDBDatabase | null>): Promise<'paired' | 'unpaired' | 'invalid'> {
  try {
    const db = await getDb();
    if (!db) return 'invalid';
    return (await new InteropKeysRepository(db).list()).length > 0 ? 'paired' : 'unpaired';
  } catch {
    return 'invalid';
  }
}

export async function interopProviderStatus(
  dependencies: {
    readonly probePCloud: (interactive: boolean) => Promise<boolean>;
    readonly probeGoogleDrive: (interactive: boolean) => Promise<void>;
    readonly probeICloud: () => Promise<void>;
  },
  provider: InteropProviderId,
  interactive: boolean,
): Promise<{ readonly state: InteropProviderState; readonly detail: string; readonly error: InteropRuntimeError | null }> {
  try {
    if (provider === 'pcloud') {
      if (!(await dependencies.probePCloud(interactive))) {
        return { state: 'disconnected', detail: INTEROP_PROVIDERS.pcloud.disconnected, error: null };
      }
    } else if (provider === 'google-drive') await dependencies.probeGoogleDrive(interactive);
    else await dependencies.probeICloud();
    return { state: 'connected', detail: `${INTEROP_PROVIDERS[provider].label} is connected.`, error: null };
  } catch (error) {
    const normalized = progressViews.interopRuntimeError(error);
    return { state: progressViews.interopProviderFailureState(normalized), detail: normalized.message, error: normalized };
  }
}
