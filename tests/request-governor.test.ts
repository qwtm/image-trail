import test from 'node:test';
import assert from 'node:assert/strict';
import { RequestGovernor } from '../extension/src/content/request-governor.js';

test('allows first request', () => {
  const gov = new RequestGovernor({ minimumIntervalMs: 250, maxRequestsPerMinute: 60 });
  assert.equal(gov.canRequest(1000), true);
});

test('throttles rapid requests', () => {
  const gov = new RequestGovernor({ minimumIntervalMs: 250, maxRequestsPerMinute: 60 });
  const now = Date.now();
  gov.record(now);
  assert.equal(gov.canRequest(now + 100), false);
  assert.equal(gov.canRequest(now + 250), true);
});

test('caps requests per minute', () => {
  const gov = new RequestGovernor({ minimumIntervalMs: 0, maxRequestsPerMinute: 3 });
  const now = Date.now();

  gov.record(now);
  gov.record(now + 1);
  gov.record(now + 2);

  assert.equal(gov.canRequest(now + 3), false);
});

test('old timestamps expire after 60 seconds', () => {
  const gov = new RequestGovernor({ minimumIntervalMs: 0, maxRequestsPerMinute: 3 });
  const baseTime = 100_000;

  gov.record(baseTime);
  gov.record(baseTime + 1);
  gov.record(baseTime + 2);

  assert.equal(gov.canRequest(baseTime + 60_001), true);
});

test('request() returns value on success and null on throttle', () => {
  const gov = new RequestGovernor({ minimumIntervalMs: 250, maxRequestsPerMinute: 60 });

  const first = gov.request(() => 'hello', 1000);
  assert.deepEqual(first, { value: 'hello', status: 'ok' });

  const second = gov.request(() => 'world', 1100);
  assert.equal(second.value, null);
  assert.equal(second.status, 'throttled');
});

test('requestsInLastMinute tracks count', () => {
  const gov = new RequestGovernor({ minimumIntervalMs: 0, maxRequestsPerMinute: 100 });
  const baseTime = 200_000;

  gov.record(baseTime);
  gov.record(baseTime + 100);
  gov.record(baseTime + 200);

  assert.equal(gov.requestsInLastMinute(baseTime + 300), 3);
  assert.equal(gov.requestsInLastMinute(baseTime + 60_001), 2);
});

test('reset clears state', () => {
  const gov = new RequestGovernor({ minimumIntervalMs: 250, maxRequestsPerMinute: 60 });
  gov.record(1000);
  assert.equal(gov.canRequest(1100), false);

  gov.reset();
  assert.equal(gov.canRequest(1100), true);
  assert.equal(gov.requestsInLastMinute(1100), 0);
});
