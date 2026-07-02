import test from 'node:test';
import assert from 'node:assert/strict';
import { defineMessage, dispatchRequest } from '../extension/src/background/message-dispatch.js';
import { MessageType, createPingMessage, createStatusMessage, createTogglePanelMessage } from '../extension/src/background/messages.js';
import type { PingMessage, StatusMessage } from '../extension/src/background/messages.js';

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

function registryWith(handle: () => Promise<string>) {
  return {
    [MessageType.Ping]: defineMessage<PingMessage, StatusMessage, string>({
      handle,
      respond: (result) => createStatusMessage(true, result),
      fallback: () => createStatusMessage(false, 'fallback'),
    }),
  };
}

test('dispatchRequest runs the handler, wraps the result with respond, and returns true', async () => {
  let sent: StatusMessage | undefined;
  const registry = registryWith(async () => 'handled');

  const kept = dispatchRequest(registry, createPingMessage(), (response) => {
    sent = response as StatusMessage;
  });

  assert.equal(kept, true); // keeps the sendResponse channel open, like the former `case … return true`
  await flushMicrotasks();
  assert.equal(sent?.type, MessageType.Status);
  assert.equal(sent?.payload.panelVisible, true);
  assert.equal(sent?.payload.status, 'handled');
});

test('dispatchRequest replies with the entry fallback when the handler rejects', async () => {
  let sent: StatusMessage | undefined;
  const registry = registryWith(async () => {
    throw new Error('handler blew up');
  });

  const kept = dispatchRequest(registry, createPingMessage(), (response) => {
    sent = response as StatusMessage;
  });

  assert.equal(kept, true);
  await flushMicrotasks();
  assert.equal(sent?.payload.panelVisible, false);
  assert.equal(sent?.payload.status, 'fallback');
});

test('dispatchRequest returns false and never responds for an unregistered request type', async () => {
  let responded = false;
  const registry = registryWith(async () => 'handled');

  // TogglePanel has no registry entry (handled by the content script), matching the former `default: return false`.
  const kept = dispatchRequest(registry, createTogglePanelMessage(), () => {
    responded = true;
  });

  assert.equal(kept, false);
  await flushMicrotasks();
  assert.equal(responded, false);
});
