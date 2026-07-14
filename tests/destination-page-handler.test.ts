import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDestinationSourceStatusMessage,
  createFocusDestinationSourceMessage,
  createOpenDestinationMessage,
  type DestinationResponse,
} from '../extension/src/background/destination-messages.js';
import { createDestinationMessageRegistry } from '../extension/src/background/handlers/destination-page-handler.js';
import { MessageType } from '../extension/src/background/message-protocol.js';
import type { MessageDispatchContext } from '../extension/src/background/message-dispatch.js';

interface FakeChromeState {
  readonly createdUrls: string[];
  readonly focusedTabIds: number[];
  readonly focusedWindowIds: number[];
  readonly tabs: Map<number, chrome.tabs.Tab>;
}

function installChrome(): { readonly state: FakeChromeState; readonly restore: () => void } {
  const originalChrome = globalThis.chrome;
  const state: FakeChromeState = { createdUrls: [], focusedTabIds: [], focusedWindowIds: [], tabs: new Map() };
  globalThis.chrome = {
    runtime: { getURL: (path: string) => `chrome-extension://test-id/${path}` },
    tabs: {
      create: async ({ url }: chrome.tabs.CreateProperties) => {
        state.createdUrls.push(url ?? '');
        return { id: 99, url } as chrome.tabs.Tab;
      },
      get: async (tabId: number) => {
        const tab = state.tabs.get(tabId);
        if (!tab) throw new Error('missing');
        return tab;
      },
      update: async (tabId: number) => {
        state.focusedTabIds.push(tabId);
        return state.tabs.get(tabId) as chrome.tabs.Tab;
      },
    },
    windows: {
      update: async (windowId: number) => {
        state.focusedWindowIds.push(windowId);
        return { id: windowId } as chrome.windows.Window;
      },
    },
  } as unknown as typeof chrome;
  return { state, restore: () => (globalThis.chrome = originalChrome) };
}

async function handle(
  message: ReturnType<
    typeof createOpenDestinationMessage | typeof createDestinationSourceStatusMessage | typeof createFocusDestinationSourceMessage
  >,
  context: MessageDispatchContext = {},
): Promise<DestinationResponse> {
  const registry = createDestinationMessageRegistry();
  const entry = registry[message.type];
  return entry.respond(await entry.handle(message, context)) as DestinationResponse;
}

test('open destination binds only a supported http source tab', async () => {
  const { state, restore } = installChrome();
  try {
    const response = await handle(createOpenDestinationMessage('dashboard'), {
      sender: { tab: { id: 7, url: 'https://example.test/photos' } as chrome.tabs.Tab },
    });
    assert.equal(response.type, MessageType.OpenDestinationResult);
    assert.deepEqual(state.createdUrls, ['chrome-extension://test-id/src/destinations/view.html?view=dashboard&sourceTab=7']);
  } finally {
    restore();
  }
});

test('source status and focus degrade safely after a source tab closes', async () => {
  const { state, restore } = installChrome();
  try {
    state.tabs.set(8, { id: 8, url: 'https://example.test/photos', windowId: 4 } as chrome.tabs.Tab);
    const connected = await handle(createDestinationSourceStatusMessage(8));
    assert.deepEqual(connected.payload, { state: 'connected', sourceTabId: 8 });

    const focused = await handle(createFocusDestinationSourceMessage(8));
    assert.deepEqual(focused.payload, { ok: true, state: 'connected' });
    assert.deepEqual(state.focusedTabIds, [8]);
    assert.deepEqual(state.focusedWindowIds, [4]);

    state.tabs.delete(8);
    const missing = await handle(createDestinationSourceStatusMessage(8));
    assert.deepEqual(missing.payload, { state: 'missing', sourceTabId: 8 });
  } finally {
    restore();
  }
});
