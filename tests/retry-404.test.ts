import test from 'node:test';
import assert from 'node:assert/strict';
import { Retry404 } from '../extension/src/core/automation/retry-404.js';

test('starts in idle phase', () => {
  const retry = new Retry404(
    async () => true,
    () => {},
    () => {},
  );
  assert.equal(retry.currentPhase, 'idle');
  assert.equal(retry.retriesUsed, 0);
  retry.destroy();
});

test('resolves immediately on successful load', async () => {
  const phases: string[] = [];
  const retry = new Retry404(
    async () => true,
    () => {},
    (phase) => phases.push(phase),
    { maxRetries: 3, retryDelayMs: 10, advanceOnExhaust: false },
  );

  retry.start();
  await new Promise((r) => setTimeout(r, 50));

  assert.ok(phases.includes('running'));
  assert.ok(phases.includes('idle'));
  assert.equal(retry.retriesUsed, 1);
  retry.destroy();
});

test('retries on failure up to max and reaches exhausted', async () => {
  const phases: string[] = [];
  const retry = new Retry404(
    async () => false,
    () => {},
    (phase) => phases.push(phase),
    { maxRetries: 2, retryDelayMs: 10, advanceOnExhaust: false },
  );

  retry.start();
  await new Promise((r) => setTimeout(r, 100));

  assert.equal(retry.currentPhase, 'exhausted');
  assert.equal(retry.retriesUsed, 2);
  retry.destroy();
});

test('advances on exhaust when configured', async () => {
  let advanceCalled = false;
  const retry = new Retry404(
    async () => false,
    () => { advanceCalled = true; },
    () => {},
    { maxRetries: 1, retryDelayMs: 10, advanceOnExhaust: true },
  );

  retry.start();
  await new Promise((r) => setTimeout(r, 50));

  assert.equal(advanceCalled, true);
  assert.equal(retry.currentPhase, 'exhausted');
  retry.destroy();
});

test('stop cancels in-progress retries', async () => {
  let attempts = 0;
  const retry = new Retry404(
    async () => { attempts++; return false; },
    () => {},
    () => {},
    { maxRetries: 10, retryDelayMs: 10, advanceOnExhaust: false },
  );

  retry.start();
  await new Promise((r) => setTimeout(r, 30));
  retry.stop();
  const stoppedAttempts = attempts;
  await new Promise((r) => setTimeout(r, 50));

  assert.equal(attempts, stoppedAttempts);
  assert.equal(retry.currentPhase, 'stopped');
  retry.destroy();
});

test('reset returns to idle', () => {
  const retry = new Retry404(
    async () => false,
    () => {},
    () => {},
  );
  retry.start();
  retry.reset();
  assert.equal(retry.currentPhase, 'idle');
  assert.equal(retry.retriesUsed, 0);
  retry.destroy();
});
