import test from 'node:test';
import assert from 'node:assert/strict';

import type { PanelAction, TargetState } from '../../extension/src/core/types.js';
import { renderPageContextSwitcher } from '../../extension/src/ui/react/page-context-switcher.js';
import { unmountReactSubtree } from '../../extension/src/ui/react/react-subtree.js';
import { createTargetPickerView } from '../../extension/src/ui/react/target-picker-view.js';

test('renders capability-aware context overrides and an explicit automatic reset', () => {
  const root = document.createElement('div');
  const actions: PanelAction[] = [];
  renderPageContextSwitcher(
    root,
    {
      detected: 'feed',
      effective: 'gallery',
      override: 'gallery',
      available: ['single', 'gallery', 'feed'],
      imageCount: 6,
    },
    (action) => actions.push(action),
  );
  assert.equal(root.querySelector('[aria-live="polite"] span')?.textContent, 'Override · Gallery page · detected Feed');
  assert.equal(root.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.textContent, 'Gallery page');

  root.querySelector<HTMLButtonElement>('button[title="Use Feed context"]')?.click();
  root.querySelector<HTMLButtonElement>('.image-trail-page-context__reset')?.click();
  assert.deepEqual(actions, [
    { name: 'page-context/set', context: 'feed' },
    { name: 'page-context/set', context: null },
  ]);
  unmountReactSubtree(root);
});

test('disables unsupported contexts and reports a stale saved override as inactive', () => {
  const root = document.createElement('div');
  renderPageContextSwitcher(
    root,
    { detected: 'single', effective: 'single', override: 'feed', available: ['single'], imageCount: 1 },
    () => undefined,
  );
  assert.equal(root.querySelector<HTMLButtonElement>('button[title^="Gallery page"]')?.disabled, true);
  assert.equal(root.querySelector<HTMLButtonElement>('button[title^="Feed"]')?.disabled, true);
  assert.equal(root.querySelector('[aria-live="polite"] span')?.textContent, 'Saved override unavailable · Automatic Single image');
  unmountReactSubtree(root);
});

test('preserves the zero-image target count before a qualifying image exists', () => {
  const target: TargetState = {
    mode: 'auto',
    picking: false,
    grabModeActive: false,
    candidateCount: 0,
    selectedUrl: null,
    selectedHandleId: null,
    selectedDimensions: null,
    fillScreen: false,
    objectFit: 'contain',
    message: '',
  };
  const root = createTargetPickerView(target, () => undefined, {
    pageContext: { detected: 'single', effective: 'single', override: null, available: [], imageCount: 0 },
  });
  assert.equal(root.querySelector('.image-trail-panel__target-count')?.textContent, '0 on page');
  unmountReactSubtree(root);
});
