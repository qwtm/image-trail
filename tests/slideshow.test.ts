import test from 'node:test';
import assert from 'node:assert/strict';
import { Slideshow } from '../extension/src/core/automation/slideshow.js';

test('slideshow starts in idle phase', () => {
  const slideshow = new Slideshow(() => {}, () => {});
  assert.equal(slideshow.currentPhase, 'idle');
  assert.equal(slideshow.slidesShown, 0);
  slideshow.destroy();
});

test('slideshow transitions through running → paused → running → stopped', () => {
  const phases: string[] = [];
  const slideshow = new Slideshow(
    () => {},
    (phase) => phases.push(phase),
    { intervalMs: 100_000 },
  );

  slideshow.start();
  assert.equal(slideshow.currentPhase, 'running');

  slideshow.pause();
  assert.equal(slideshow.currentPhase, 'paused');

  slideshow.resume();
  assert.equal(slideshow.currentPhase, 'running');

  slideshow.stop();
  assert.equal(slideshow.currentPhase, 'stopped');

  assert.deepEqual(phases, ['running', 'paused', 'running', 'stopped']);
  slideshow.destroy();
});

test('slideshow calls step with correct direction', async () => {
  const directions: number[] = [];
  const slideshow = new Slideshow(
    (dir) => directions.push(dir),
    () => {},
    { intervalMs: 10, direction: -1 },
  );

  slideshow.start();
  await new Promise((r) => setTimeout(r, 50));
  slideshow.stop();

  assert.ok(directions.length > 0);
  assert.ok(directions.every((d) => d === -1));
  slideshow.destroy();
});

test('slideshow does not fire steps when paused', async () => {
  let stepCount = 0;
  const slideshow = new Slideshow(
    () => { stepCount++; },
    () => {},
    { intervalMs: 10 },
  );

  slideshow.start();
  await new Promise((r) => setTimeout(r, 30));
  const countBeforePause = stepCount;
  slideshow.pause();
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(stepCount, countBeforePause);
  slideshow.destroy();
});

test('slideshow start is idempotent while running', () => {
  const phases: string[] = [];
  const slideshow = new Slideshow(
    () => {},
    (phase) => phases.push(phase),
    { intervalMs: 100_000 },
  );

  slideshow.start();
  slideshow.start();
  assert.deepEqual(phases, ['running']);
  slideshow.destroy();
});

test('destroy clears state', () => {
  const slideshow = new Slideshow(() => {}, () => {}, { intervalMs: 100_000 });
  slideshow.start();
  slideshow.destroy();
  assert.equal(slideshow.currentPhase, 'idle');
  assert.equal(slideshow.slidesShown, 0);
});
