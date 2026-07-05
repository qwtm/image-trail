import test from 'node:test';
import assert from 'node:assert/strict';

import { createRecallDrawerView } from '../../extension/src/ui/components/recall-drawer-view.js';
import type { RecallCandidate } from '../../extension/src/core/types.js';

const record: RecallCandidate = {
  id: 'recall-1',
  url: 'https://images.example.test/recall/photo_0042.jpg',
  timestamp: '2026-06-25T15:30:00.000Z',
  source: 'bookmark',
  envelopeCreatedAt: '2026-06-25T15:30:00.000Z',
};

const geometry = {
  side: 'right' as const,
  inlineStart: 0,
  inlineSize: 320,
  blockStart: 0,
  blockSize: 480,
};

function buildRecallView(
  actions: unknown[],
  selectedIds: readonly string[] = [],
  candidates: readonly RecallCandidate[] = [record],
): HTMLElement {
  return createRecallDrawerView(
    {
      open: true,
      busy: false,
      side: 'right',
      candidates,
      selectedIds,
      offset: 0,
      nextOffset: candidates.length,
      hasMore: false,
      total: candidates.length,
      failedCount: 0,
    },
    geometry,
    (action) => actions.push(action),
  );
}

function rowFor(view: HTMLElement, id: string): HTMLElement {
  const row = Array.from(view.querySelectorAll<HTMLElement>('[data-image-trail-row-id]')).find(
    (candidate) => candidate.dataset['imageTrailRowId'] === id,
  );
  assert.ok(row, `expected a Recall row for record "${id}"`);
  return row;
}

test('a plain click selects an unselected Recall row without previewing it', () => {
  const actions: unknown[] = [];
  const view = buildRecallView(actions);
  const row = rowFor(view, 'recall-1');

  row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

  assert.deepEqual(actions, [{ name: 'recall-selection/select', ids: ['recall-1'] }]);
});

test('a plain click previews an already selected Recall row', () => {
  const actions: unknown[] = [];
  const view = buildRecallView(actions, ['recall-1']);
  const row = rowFor(view, 'recall-1');

  row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

  assert.deepEqual(actions, [{ name: 'capture/preview', url: record.url, blobId: undefined, scrollAnchorId: 'recall-1' }]);
});

test('Enter on a selected Recall row previews it', () => {
  const actions: unknown[] = [];
  const view = buildRecallView(actions, ['recall-1']);
  const row = rowFor(view, 'recall-1');

  const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true });
  row.dispatchEvent(enter);

  assert.equal(enter.defaultPrevented, true);
  assert.deepEqual(actions, [{ name: 'capture/preview', url: record.url, blobId: undefined, scrollAnchorId: 'recall-1' }]);
});

test('ctrl-click and checkbox clicks keep Recall multi-select behavior', () => {
  const actions: unknown[] = [];
  const view = buildRecallView(actions);
  const row = rowFor(view, 'recall-1');
  const checkbox = row.querySelector('input');
  assert.ok(checkbox instanceof HTMLInputElement);

  row.dispatchEvent(new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true }));
  checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

  assert.deepEqual(actions, [
    { name: 'recall-selection/toggle', id: 'recall-1' },
    { name: 'recall-selection/toggle', id: 'recall-1' },
  ]);
});

test('ArrowDown moves Recall single selection to the next row', () => {
  const actions: unknown[] = [];
  const second = { ...record, id: 'recall-2', url: 'https://images.example.test/recall/photo_0043.jpg' };
  const view = buildRecallView(actions, ['recall-1'], [record, second]);
  const row = rowFor(view, 'recall-1');

  const arrow = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true, bubbles: true });
  row.dispatchEvent(arrow);

  assert.equal(arrow.defaultPrevented, true);
  assert.deepEqual(actions, [{ name: 'recall-selection/select', ids: ['recall-2'] }]);
});

test('Recall rows render thumbnail images when available', () => {
  const actions: unknown[] = [];
  const thumbnail = 'data:image/png;base64,abc';
  const view = buildRecallView(actions, [], [{ ...record, thumbnail }]);
  const row = rowFor(view, 'recall-1');
  const image = row.querySelector('img');

  assert.ok(image instanceof HTMLImageElement);
  assert.equal(image.src, thumbnail);
});
