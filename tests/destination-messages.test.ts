import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDestinationSourceStatusMessage,
  createFocusDestinationSourceMessage,
  createOpenDestinationMessage,
} from '../extension/src/background/destination-messages.js';
import { MESSAGE_PROTOCOL_VERSION, MessageType } from '../extension/src/background/message-protocol.js';
import { isExtensionRequest, isExtensionResponse } from '../extension/src/background/messages.js';

test('classifies destination page and source lifecycle messages', () => {
  const request = createOpenDestinationMessage('gallery');
  const success = {
    type: MessageType.OpenDestinationResult,
    version: MESSAGE_PROTOCOL_VERSION,
    payload: { ok: true, url: 'chrome-extension://id/src/gallery/gallery.html?view=gallery', tabId: 7, sourceTabId: 3 },
  };
  const failure = {
    type: MessageType.OpenDestinationResult,
    version: MESSAGE_PROTOCOL_VERSION,
    payload: { ok: false, message: 'Destination tab could not be opened.' },
  };

  assert.equal(request.type, MessageType.OpenDestination);
  assert.equal(isExtensionRequest(request), true);
  assert.equal(isExtensionRequest(createDestinationSourceStatusMessage(3)), true);
  assert.equal(isExtensionRequest(createFocusDestinationSourceMessage(3)), true);
  assert.equal(isExtensionResponse(success), true);
  assert.equal(isExtensionResponse(failure), true);
  assert.equal(isExtensionResponse(request), false);
});
