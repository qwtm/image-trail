import test from 'node:test';
import assert from 'node:assert/strict';

import {
  destinationFromLocation,
  destinationPagePath,
  destinationPageUrl,
  EXTENSION_DESTINATION_IDS,
  isExtensionDestinationId,
  sourceTabIdFromSearch,
} from '../extension/src/core/destinations.js';

test('destination registry and routes cover the four handoff destinations', () => {
  assert.deepEqual(EXTENSION_DESTINATION_IDS, ['dashboard', 'gallery', 'recall', 'settings']);
  assert.equal(isExtensionDestinationId('recall'), true);
  assert.equal(isExtensionDestinationId('help'), false);
  assert.equal(destinationPagePath('gallery'), 'src/gallery/gallery.html');
  assert.equal(destinationPagePath('settings'), 'src/destinations/view.html');
});

test('destination URL preserves an explicit source tab without exposing page state', () => {
  const url = destinationPageUrl('settings', (path) => `chrome-extension://test-id/${path}`, 17);
  assert.equal(url, 'chrome-extension://test-id/src/destinations/view.html?view=settings&sourceTab=17');
  assert.equal(sourceTabIdFromSearch(new URL(url).search), 17);
});

test('route parsing rejects malformed destinations and source tab ids', () => {
  assert.equal(destinationFromLocation({ pathname: '/src/destinations/view.html', search: '?view=recall' }), 'recall');
  assert.equal(destinationFromLocation({ pathname: '/src/gallery/gallery.html', search: '?view=unknown' }), 'gallery');
  assert.equal(destinationFromLocation({ pathname: '/src/destinations/view.html', search: '?view=unknown' }), 'dashboard');
  assert.equal(sourceTabIdFromSearch('?sourceTab=-1'), undefined);
  assert.equal(sourceTabIdFromSearch('?sourceTab=3.2'), undefined);
  assert.equal(sourceTabIdFromSearch('?sourceTab=abc'), undefined);
});
