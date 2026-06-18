import test from 'node:test';
import assert from 'node:assert/strict';
import { NavigationQueue } from '../extension/src/core/automation/navigation-queue.js';

test('starts in idle phase', () => {
  const queue = new NavigationQueue(async () => true, () => {});
  assert.equal(queue.currentPhase, 'idle');
  assert.equal(queue.length, 0);
});

test('processes enqueued entries', async () => {
  const loaded: string[] = [];
  const phases: string[] = [];
  const queue = new NavigationQueue(
    async (entry) => { loaded.push(entry.url); return true; },
    (phase) => phases.push(phase),
  );

  queue.enqueue({ url: 'https://example.com/1.jpg', source: 'manual' });
  await new Promise((r) => setTimeout(r, 50));

  assert.deepEqual(loaded, ['https://example.com/1.jpg']);
  assert.ok(phases.includes('running'));
});

test('stop clears queue and prevents processing', () => {
  const loaded: string[] = [];
  const queue = new NavigationQueue(
    async (entry) => { loaded.push(entry.url); return true; },
    () => {},
  );

  queue.stop();
  const result = queue.enqueue({ url: 'https://example.com/blocked.jpg', source: 'manual' });

  assert.equal(result, false);
  assert.equal(queue.currentPhase, 'stopped');
});

test('pause and resume work correctly', async () => {
  const loaded: string[] = [];
  let resolveFirst: (() => void) | null = null;
  const queue = new NavigationQueue(
    async (entry) => {
      if (!resolveFirst) {
        await new Promise<void>((r) => { resolveFirst = r; });
      }
      loaded.push(entry.url);
      return true;
    },
    () => {},
  );

  queue.enqueue({ url: 'https://example.com/1.jpg', source: 'manual' });
  queue.enqueue({ url: 'https://example.com/2.jpg', source: 'slideshow' });
  await new Promise((r) => setTimeout(r, 10));

  assert.equal(queue.currentPhase, 'running');
  queue.pause();

  resolveFirst!();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(loaded.length, 1);
  assert.equal(queue.currentPhase, 'paused');

  queue.resume();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(loaded.length, 2);
});

test('error phase on failed execution', async () => {
  const phases: string[] = [];
  const queue = new NavigationQueue(
    async () => false,
    (phase) => phases.push(phase),
  );

  queue.enqueue({ url: 'https://example.com/fail.jpg', source: 'manual' });
  await new Promise((r) => setTimeout(r, 50));

  assert.ok(phases.includes('error'));
  assert.equal(queue.currentPhase, 'error');
});

test('reset returns to idle', () => {
  const queue = new NavigationQueue(async () => true, () => {});
  queue.enqueue({ url: 'https://example.com/1.jpg', source: 'manual' });
  queue.reset();
  assert.equal(queue.currentPhase, 'idle');
  assert.equal(queue.length, 0);
});
