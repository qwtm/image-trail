import test from 'node:test';
import assert from 'node:assert/strict';

import type { PanelAction } from '../../extension/src/core/types.js';
import { parseUrl } from '../../extension/src/core/url/parse-url.js';
import { collectUrlFields } from '../../extension/src/core/url/tokenize-fields.js';
import { createUrlSteppingPresetView } from '../../extension/src/ui/components/url-stepping-preset-view.js';

test('shows exact preset fields and dispatches the selected preset', () => {
  const fields = collectUrlFields(parseUrl('https://cdn.example.test/gallery/12/photo_0042.jpg?page=3'));
  const actions: PanelAction[] = [];
  const view = createUrlSteppingPresetView(fields, (action) => actions.push(action));

  assert.match(view.textContent ?? '', /Fields: file 1/u);
  assert.match(view.textContent ?? '', /Fields: path 3\.0/u);
  const filenamePreset = Array.from(view.querySelectorAll('li')).find((item) => item.textContent?.includes('Numbered filename'));
  assert.ok(filenamePreset);
  filenamePreset.querySelector<HTMLButtonElement>('button')?.click();
  assert.deepEqual(actions, [{ name: 'url-template/save-step-preset', presetId: 'numbered-filename' }]);
});

test('shows a stable empty state without numeric URL fields', () => {
  const fields = collectUrlFields(parseUrl('https://example.test/gallery/photo.jpg'));
  assert.match(createUrlSteppingPresetView(fields, () => {}).textContent ?? '', /No numeric URL fields/u);
});
