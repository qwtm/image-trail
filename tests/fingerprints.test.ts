import test from 'node:test';
import assert from 'node:assert/strict';
import { computeSha256 } from '../extension/src/core/image/fingerprints.js';

test('computes SHA-256 hex digest for known byte sequences', async () => {
  const bytes = new TextEncoder().encode('hello world').buffer as ArrayBuffer;
  const hash = await computeSha256(bytes);
  assert.equal(hash, 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
});

test('returns consistent hash for identical bytes', async () => {
  const data = new Uint8Array([1, 2, 3, 4, 5]).buffer as ArrayBuffer;
  const hash1 = await computeSha256(data);
  const hash2 = await computeSha256(data);
  assert.equal(hash1, hash2);
});

test('returns different hash for different bytes', async () => {
  const a = new Uint8Array([1, 2, 3]).buffer as ArrayBuffer;
  const b = new Uint8Array([4, 5, 6]).buffer as ArrayBuffer;
  const hashA = await computeSha256(a);
  const hashB = await computeSha256(b);
  assert.notEqual(hashA, hashB);
});

test('returns 64-character lowercase hex string', async () => {
  const bytes = new Uint8Array([0]).buffer as ArrayBuffer;
  const hash = await computeSha256(bytes);
  assert.equal(hash.length, 64);
  assert.match(hash, /^[0-9a-f]{64}$/);
});

test('handles empty ArrayBuffer', async () => {
  const empty = new ArrayBuffer(0);
  const hash = await computeSha256(empty);
  assert.equal(hash, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});
