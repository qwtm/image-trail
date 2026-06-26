import test from 'node:test';
import assert from 'node:assert/strict';
import { ProjectionSessionController } from '../extension/src/core/projection-session.js';

test('projection sessions supersede previous active operations', () => {
  const controller = new ProjectionSessionController();

  const first = controller.begin({
    reason: 'record-preview',
    sourceUrl: 'https://example.test/first.jpg',
    selectedHandleId: 'target-1',
    originalSourceUrl: 'https://example.test/original.jpg',
  });
  const second = controller.begin({
    reason: 'selected-url-apply',
    sourceUrl: 'https://example.test/second.jpg',
    selectedHandleId: 'target-1',
    originalSourceUrl: 'https://example.test/original.jpg',
  });

  assert.equal(controller.isActive(first), false);
  assert.equal(controller.isActive(second), true);
  assert.equal(second.id, 'projection-2');
});

test('projection session updates are ignored for stale operations', () => {
  const controller = new ProjectionSessionController();
  const first = controller.begin({ reason: 'record-preview', sourceUrl: 'https://example.test/first.jpg' });
  const second = controller.begin({ reason: 'record-preview', sourceUrl: 'https://example.test/second.jpg' });

  assert.equal(controller.update(first, { status: 'loaded' }), null);
  assert.deepEqual(controller.update(second, { status: 'applying', displayUrl: 'data:image/jpeg;base64,second' }), {
    ...second,
    status: 'applying',
    displayUrl: 'data:image/jpeg;base64,second',
  });
});

test('projection loop guard blocks repeated identical ownership requests', () => {
  const controller = new ProjectionSessionController();
  const request = {
    reason: 'record-preview' as const,
    sourceUrl: 'https://example.test/repeated.jpg',
    selectedHandleId: 'target-1',
    originalSourceUrl: 'https://example.test/original.jpg',
  };

  for (let index = 0; index < 5; index += 1) {
    assert.equal(controller.beginGuarded(request, 1_000 + index).ok, true);
  }

  const blocked = controller.beginGuarded(request, 1_005);

  assert.equal(blocked.ok, false);
  if (!blocked.ok) {
    assert.deepEqual(blocked.warning, {
      reason: 'record-preview',
      sourceUrl: 'https://example.test/repeated.jpg',
      selectedHandleId: 'target-1',
      originalSourceUrl: 'https://example.test/original.jpg',
      repeatedCount: 6,
      threshold: 6,
      windowMs: 1500,
    });
  }
});

test('projection loop guard allows repeated requests after the guard window', () => {
  const controller = new ProjectionSessionController();
  const request = { reason: 'record-preview' as const, sourceUrl: 'https://example.test/repeated.jpg' };

  for (let index = 0; index < 5; index += 1) {
    assert.equal(controller.beginGuarded(request, 1_000 + index).ok, true);
  }

  assert.equal(controller.beginGuarded(request, 2_600).ok, true);
});
