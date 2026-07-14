import { destinationPageUrl, type ExtensionDestinationId } from '../../core/destinations.js';
import {
  createDestinationSourceStatusResultMessage,
  createFocusDestinationSourceResultMessage,
  createOpenDestinationResultMessage,
  type DestinationRequest,
  type DestinationResponse,
  type DestinationSourceStatusMessage,
  type DestinationSourceStatusResultMessage,
  type FocusDestinationSourceMessage,
  type FocusDestinationSourceResultMessage,
  type OpenDestinationMessage,
  type OpenDestinationResultMessage,
} from '../destination-messages.js';
import { defineMessage, type MessageDef, type MessageDispatchContext } from '../message-dispatch.js';
import { MessageType } from '../message-protocol.js';
import * as requestSchemas from '../message-schemas.js';
import type { ExtensionRequest, ExtensionResponse } from '../messages.js';

type DestinationRequestType = DestinationRequest['type'];
type Registry = Record<DestinationRequestType, MessageDef<ExtensionRequest, ExtensionResponse>>;

async function openDestination(
  destination: ExtensionDestinationId,
  context: MessageDispatchContext,
): Promise<OpenDestinationResultMessage['payload']> {
  try {
    const sourceTabId = supportedSourceTabId(context.sender?.tab);
    const url = destinationPageUrl(destination, chrome.runtime.getURL, sourceTabId);
    const tab = await chrome.tabs.create({ url });
    return { ok: true, url, tabId: tab.id, sourceTabId };
  } catch {
    return { ok: false, message: 'Destination tab could not be opened.' };
  }
}

async function sourceStatus(sourceTabId?: number): Promise<DestinationSourceStatusResultMessage['payload']> {
  if (sourceTabId === undefined) return { state: 'unbound' };
  const tab = await sourceTab(sourceTabId);
  return tab ? { state: 'connected', sourceTabId } : { state: 'missing', sourceTabId };
}

async function focusSource(sourceTabId: number): Promise<FocusDestinationSourceResultMessage['payload']> {
  const tab = await sourceTab(sourceTabId);
  if (!tab) return { ok: false, state: 'missing' };
  try {
    await chrome.tabs.update(sourceTabId, { active: true });
    if (tab.windowId !== undefined) await chrome.windows.update(tab.windowId, { focused: true });
    return { ok: true, state: 'connected' };
  } catch {
    return { ok: false, state: 'missing' };
  }
}

async function sourceTab(sourceTabId: number): Promise<chrome.tabs.Tab | null> {
  try {
    const tab = await chrome.tabs.get(sourceTabId);
    return supportedSourceTabId(tab) === sourceTabId ? tab : null;
  } catch {
    return null;
  }
}

function supportedSourceTabId(tab: chrome.tabs.Tab | undefined): number | undefined {
  if (tab?.id === undefined || !tab.url || !/^https?:\/\//u.test(tab.url)) return undefined;
  return tab.id;
}

export function createDestinationMessageRegistry(): Registry {
  return {
    [MessageType.OpenDestination]: defineMessage({
      requestSchema: requestSchemas.openDestinationRequestSchema,
      handle: (message: OpenDestinationMessage, context = {}) => openDestination(message.payload.destination, context),
      respond: (payload) => createOpenDestinationResultMessage(payload),
      fallback: () => createOpenDestinationResultMessage({ ok: false, message: 'Destination tab could not be opened.' }),
    }),
    [MessageType.DestinationSourceStatus]: defineMessage({
      requestSchema: requestSchemas.destinationSourceStatusRequestSchema,
      handle: (message: DestinationSourceStatusMessage) => sourceStatus(message.payload.sourceTabId),
      respond: (payload) => createDestinationSourceStatusResultMessage(payload),
      fallback: (message) =>
        createDestinationSourceStatusResultMessage({
          state: message.payload.sourceTabId === undefined ? 'unbound' : 'missing',
          sourceTabId: message.payload.sourceTabId,
        }),
    }),
    [MessageType.FocusDestinationSource]: defineMessage({
      requestSchema: requestSchemas.focusDestinationSourceRequestSchema,
      handle: (message: FocusDestinationSourceMessage) => focusSource(message.payload.sourceTabId),
      respond: (payload) => createFocusDestinationSourceResultMessage(payload),
      fallback: () => createFocusDestinationSourceResultMessage({ ok: false, state: 'missing' }),
    }),
  } satisfies Record<DestinationRequestType, MessageDef<DestinationRequest, DestinationResponse>>;
}
