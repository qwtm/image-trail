import { InteropTransportError } from '../core/interop/transport.js';

export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/** Narrow OAuth custody for the interop Drive adapter. */
export class ChromeIdentityInteropDriveAuth {
  async accessToken(interactive = false): Promise<string> {
    if (typeof chrome === 'undefined' || chrome.identity?.getAuthToken === undefined)
      throw new InteropTransportError('Chrome identity is unavailable.', 'unsupported', false);
    let result: chrome.identity.GetAuthTokenResult;
    try {
      result = await chrome.identity.getAuthToken({ interactive, scopes: [DRIVE_FILE_SCOPE] });
    } catch {
      throw new InteropTransportError('Google Drive interoperability authorization failed.', 'auth-expired', false);
    }
    if (result.token === undefined || result.grantedScopes?.includes(DRIVE_FILE_SCOPE) !== true)
      throw new InteropTransportError('Google Drive did not grant the required drive.file scope.', 'auth-expired', false);
    return result.token;
  }

  async invalidateToken(token: string): Promise<void> {
    if (typeof chrome === 'undefined' || chrome.identity?.removeCachedAuthToken === undefined) return;
    await chrome.identity.removeCachedAuthToken({ token });
  }
}
