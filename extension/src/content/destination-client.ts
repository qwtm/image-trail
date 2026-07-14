import {
  createDestinationSourceStatusMessage,
  createFocusDestinationSourceMessage,
  createOpenDestinationMessage,
  isDestinationSourceStatusResultMessage,
  isFocusDestinationSourceResultMessage,
  isOpenDestinationResultMessage,
  type DestinationSourceStatusResultMessage,
  type FocusDestinationSourceResultMessage,
  type OpenDestinationResultMessage,
} from '../background/destination-messages.js';
import type { ExtensionDestinationId } from '../core/destinations.js';
import { sendRuntimeMessage } from './runtime-message.js';

export async function openDestinationTab(destination: ExtensionDestinationId): Promise<OpenDestinationResultMessage['payload']> {
  const response = await sendRuntimeMessage(createOpenDestinationMessage(destination));
  return isOpenDestinationResultMessage(response) ? response.payload : { ok: false, message: 'Destination tab could not be opened.' };
}

export async function destinationSourceStatus(sourceTabId?: number): Promise<DestinationSourceStatusResultMessage['payload']> {
  const response = await sendRuntimeMessage(createDestinationSourceStatusMessage(sourceTabId));
  if (isDestinationSourceStatusResultMessage(response)) return response.payload;
  return { state: sourceTabId === undefined ? 'unbound' : 'missing', sourceTabId };
}

export async function focusDestinationSource(sourceTabId: number): Promise<FocusDestinationSourceResultMessage['payload']> {
  const response = await sendRuntimeMessage(createFocusDestinationSourceMessage(sourceTabId));
  return isFocusDestinationSourceResultMessage(response) ? response.payload : { ok: false, state: 'missing' };
}
