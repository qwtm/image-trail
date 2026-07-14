import type { DestinationSourceState, ExtensionDestinationId } from '../core/destinations.js';
import { MESSAGE_PROTOCOL_VERSION, MessageType } from './message-protocol.js';

export interface OpenDestinationMessage {
  readonly type: typeof MessageType.OpenDestination;
  readonly version: typeof MESSAGE_PROTOCOL_VERSION;
  readonly payload: { readonly destination: ExtensionDestinationId };
}

export interface OpenDestinationResultMessage {
  readonly type: typeof MessageType.OpenDestinationResult;
  readonly version: typeof MESSAGE_PROTOCOL_VERSION;
  readonly payload:
    | { readonly ok: true; readonly url: string; readonly tabId?: number | undefined; readonly sourceTabId?: number | undefined }
    | { readonly ok: false; readonly message: string };
}

export interface DestinationSourceStatusMessage {
  readonly type: typeof MessageType.DestinationSourceStatus;
  readonly version: typeof MESSAGE_PROTOCOL_VERSION;
  readonly payload: { readonly sourceTabId?: number | undefined };
}

export interface DestinationSourceStatusResultMessage {
  readonly type: typeof MessageType.DestinationSourceStatusResult;
  readonly version: typeof MESSAGE_PROTOCOL_VERSION;
  readonly payload: { readonly state: DestinationSourceState; readonly sourceTabId?: number | undefined };
}

export interface FocusDestinationSourceMessage {
  readonly type: typeof MessageType.FocusDestinationSource;
  readonly version: typeof MESSAGE_PROTOCOL_VERSION;
  readonly payload: { readonly sourceTabId: number };
}

export interface FocusDestinationSourceResultMessage {
  readonly type: typeof MessageType.FocusDestinationSourceResult;
  readonly version: typeof MESSAGE_PROTOCOL_VERSION;
  readonly payload: { readonly ok: boolean; readonly state: DestinationSourceState };
}

export type DestinationRequest = OpenDestinationMessage | DestinationSourceStatusMessage | FocusDestinationSourceMessage;
export type DestinationResponse = OpenDestinationResultMessage | DestinationSourceStatusResultMessage | FocusDestinationSourceResultMessage;

export function createOpenDestinationMessage(destination: ExtensionDestinationId): OpenDestinationMessage {
  return { type: MessageType.OpenDestination, version: MESSAGE_PROTOCOL_VERSION, payload: { destination } };
}

export function createOpenDestinationResultMessage(payload: OpenDestinationResultMessage['payload']): OpenDestinationResultMessage {
  return { type: MessageType.OpenDestinationResult, version: MESSAGE_PROTOCOL_VERSION, payload };
}

export function createDestinationSourceStatusMessage(sourceTabId?: number): DestinationSourceStatusMessage {
  return { type: MessageType.DestinationSourceStatus, version: MESSAGE_PROTOCOL_VERSION, payload: { sourceTabId } };
}

export function createDestinationSourceStatusResultMessage(
  payload: DestinationSourceStatusResultMessage['payload'],
): DestinationSourceStatusResultMessage {
  return { type: MessageType.DestinationSourceStatusResult, version: MESSAGE_PROTOCOL_VERSION, payload };
}

export function createFocusDestinationSourceMessage(sourceTabId: number): FocusDestinationSourceMessage {
  return { type: MessageType.FocusDestinationSource, version: MESSAGE_PROTOCOL_VERSION, payload: { sourceTabId } };
}

export function createFocusDestinationSourceResultMessage(
  payload: FocusDestinationSourceResultMessage['payload'],
): FocusDestinationSourceResultMessage {
  return { type: MessageType.FocusDestinationSourceResult, version: MESSAGE_PROTOCOL_VERSION, payload };
}

export function isOpenDestinationResultMessage(value: unknown): value is OpenDestinationResultMessage {
  return isMessageType(value, MessageType.OpenDestinationResult);
}

export function isDestinationSourceStatusResultMessage(value: unknown): value is DestinationSourceStatusResultMessage {
  return isMessageType(value, MessageType.DestinationSourceStatusResult);
}

export function isFocusDestinationSourceResultMessage(value: unknown): value is FocusDestinationSourceResultMessage {
  return isMessageType(value, MessageType.FocusDestinationSourceResult);
}

function isMessageType(value: unknown, type: DestinationResponse['type']): boolean {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { type?: unknown; version?: unknown; payload?: unknown };
  return (
    candidate.type === type &&
    candidate.version === MESSAGE_PROTOCOL_VERSION &&
    !!candidate.payload &&
    typeof candidate.payload === 'object'
  );
}
