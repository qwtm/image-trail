import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SLIDESHOW_CONFIG,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_GOVERNOR_CONFIG,
} from '../extension/src/core/automation/types.js';

test('default slideshow config has safe values', () => {
  assert.equal(DEFAULT_SLIDESHOW_CONFIG.intervalMs, 2000);
  assert.equal(DEFAULT_SLIDESHOW_CONFIG.direction, 1);
});

test('default retry config has safe values', () => {
  assert.equal(DEFAULT_RETRY_CONFIG.maxRetries, 3);
  assert.equal(DEFAULT_RETRY_CONFIG.retryDelayMs, 1000);
  assert.equal(DEFAULT_RETRY_CONFIG.advanceOnExhaust, true);
});

test('default governor config has safe values', () => {
  assert.equal(DEFAULT_GOVERNOR_CONFIG.minimumIntervalMs, 250);
  assert.equal(DEFAULT_GOVERNOR_CONFIG.maxRequestsPerMinute, 60);
});
