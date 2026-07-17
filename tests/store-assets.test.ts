import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
const assets = [
  { file: 'image-trail-screenshot-1280x800.png', width: 1280, height: 800 },
  { file: 'image-trail-small-promo-440x280.png', width: 440, height: 280 },
] as const;

test('Chrome Web Store assets are valid PNGs with the required dimensions', () => {
  for (const asset of assets) {
    const bytes = readFileSync(path.resolve('store-assets', asset.file));
    assert.deepEqual([...bytes.subarray(0, 8)], pngSignature, `${asset.file} should be a PNG`);
    assert.equal(bytes.readUInt32BE(16), asset.width, `${asset.file} should have the required width`);
    assert.equal(bytes.readUInt32BE(20), asset.height, `${asset.file} should have the required height`);
    assert.ok(bytes.byteLength > 10_000, `${asset.file} should contain a rendered asset, not an empty placeholder`);
  }
});
