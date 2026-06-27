import {
  createConnectPCloudProviderMessage,
  createDisconnectPCloudProviderMessage,
  createPCloudProviderStatusMessage,
  createUploadPCloudBackupMessage,
  isConnectPCloudProviderResultMessage,
  isDisconnectPCloudProviderResultMessage,
  isPCloudProviderStatusResultMessage,
  isUploadPCloudBackupResultMessage,
} from '../background/messages.js';
import type {
  PCloudBackupUploadInput,
  PCloudBackupUploadResult,
  PCloudProviderResult,
  PCloudProviderStatus,
} from '../core/cloud/pcloud-provider.js';
import { sendRuntimeMessage } from './runtime-message.js';

function hasRuntimeMessaging(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.runtime?.sendMessage;
}

function unavailableStatus(): PCloudProviderStatus {
  return { connected: false, message: 'pCloud connection is only available in the extension runtime.' };
}

export async function loadPCloudProviderStatus(): Promise<PCloudProviderStatus> {
  if (!hasRuntimeMessaging()) return unavailableStatus();
  try {
    const response = await sendRuntimeMessage(createPCloudProviderStatusMessage());
    return isPCloudProviderStatusResultMessage(response) ? response.payload : unavailableStatus();
  } catch {
    return unavailableStatus();
  }
}

export async function connectPCloudProvider(): Promise<PCloudProviderResult> {
  if (!hasRuntimeMessaging()) {
    const status = unavailableStatus();
    return { ok: false, status, message: status.message ?? 'pCloud connection is unavailable.' };
  }
  try {
    const response = await sendRuntimeMessage(createConnectPCloudProviderMessage());
    if (isConnectPCloudProviderResultMessage(response)) return response.payload;
  } catch {
    const status = { connected: false, message: 'pCloud connection failed.' };
    return { ok: false, status, message: status.message };
  }
  const status = { connected: false, message: 'pCloud connection failed.' };
  return { ok: false, status, message: status.message };
}

export async function disconnectPCloudProvider(): Promise<PCloudProviderResult> {
  if (!hasRuntimeMessaging()) {
    const status = unavailableStatus();
    return { ok: false, status, message: status.message ?? 'pCloud disconnect is unavailable.' };
  }
  try {
    const response = await sendRuntimeMessage(createDisconnectPCloudProviderMessage());
    if (isDisconnectPCloudProviderResultMessage(response)) return response.payload;
  } catch {
    const status = { connected: false, message: 'pCloud disconnect failed.' };
    return { ok: false, status, message: status.message };
  }
  const status = { connected: false, message: 'pCloud disconnect failed.' };
  return { ok: false, status, message: status.message };
}

export async function uploadPCloudBackup(input: PCloudBackupUploadInput): Promise<PCloudBackupUploadResult> {
  if (!hasRuntimeMessaging()) {
    const message = 'pCloud backup upload is only available in the extension runtime.';
    return { ok: false, status: { connected: false, message, messageIsError: true }, reason: 'runtime-unavailable', message };
  }
  try {
    const response = await sendRuntimeMessage(createUploadPCloudBackupMessage(input));
    if (isUploadPCloudBackupResultMessage(response)) return response.payload;
  } catch {
    const message = 'pCloud backup upload failed.';
    return { ok: false, status: { connected: false, message, messageIsError: true }, reason: 'upload-failed', message };
  }
  const message = 'pCloud backup upload failed.';
  return { ok: false, status: { connected: false, message, messageIsError: true }, reason: 'upload-failed', message };
}
