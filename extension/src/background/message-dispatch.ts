import type { ExtensionRequest, ExtensionResponse } from './messages.js';

/**
 * A single dispatched-request definition: how to handle it, how to wrap the
 * handler result into a response envelope, and what to reply with when the
 * handler rejects. One `MessageDef` per request the service worker dispatches
 * replaces one `case` in the former ~475-line message switch.
 *
 * Members are declared with METHOD syntax on purpose: method parameters are
 * checked bivariantly, so a narrowly-typed entry (e.g. `MessageDef<LoadBookmarksMessage, …>`)
 * stays assignable to the erased `MessageDef<ExtensionRequest, ExtensionResponse>`
 * used by the registry `satisfies` check and by {@link dispatchRequest}. Rewriting
 * these as arrow properties would make the parameters contravariant under
 * `strictFunctionTypes` and break both. Keep them as methods.
 *
 * `requestSchema` is reserved for the schema-validation work (#271) and is not
 * read yet.
 */
export interface MessageDef<Req extends ExtensionRequest, Res extends ExtensionResponse, Result = unknown> {
  handle(message: Req): Promise<Result>;
  respond(result: Result): Res;
  fallback(message: Req): Res;
  requestSchema?: unknown;
}

/** Identity helper that captures each entry's `Req`/`Res`/`Result` for precise inference. */
export function defineMessage<Req extends ExtensionRequest, Res extends ExtensionResponse, Result>(
  def: MessageDef<Req, Res, Result>,
): MessageDef<Req, Res, Result> {
  return def;
}

type AnyMessageDef = MessageDef<ExtensionRequest, ExtensionResponse, unknown>;

/**
 * Generic replacement for the old `switch (message.type)` dispatcher. Looks the
 * request up in the registry, runs its handler, and replies with the wrapped
 * result — or the entry's fallback if the handler rejects. Returns `true` for a
 * dispatched request (keeping the `sendResponse` channel open, exactly like every
 * former `case … return true`) and `false` for an unregistered type (Toggle/Ping
 * and anything else), matching the former `default: return false`.
 */
export function dispatchRequest(
  registry: Partial<Record<ExtensionRequest['type'], AnyMessageDef>>,
  message: ExtensionRequest,
  sendResponse: (response: ExtensionResponse) => void,
): boolean {
  const entry = registry[message.type];
  if (!entry) return false;
  entry
    .handle(message)
    .then((result) => sendResponse(entry.respond(result)))
    .catch(() => sendResponse(entry.fallback(message)));
  return true;
}
