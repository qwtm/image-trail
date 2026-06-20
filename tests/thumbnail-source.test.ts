import test from 'node:test';
import assert from 'node:assert/strict';
import { revokeThumbnailObjectUrls, thumbnailSourceForDom } from '../extension/src/ui/components/thumbnail-source.js';

test('data thumbnail sources render through compact object URLs', () => {
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  const created: Blob[] = [];
  const revoked: string[] = [];
  URL.createObjectURL = ((blob: Blob) => {
    created.push(blob);
    return `blob:test-${created.length}`;
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = ((url: string) => {
    revoked.push(url);
  }) as typeof URL.revokeObjectURL;

  try {
    const dataUrl = 'data:image/png;base64,aGVsbG8=';

    assert.equal(thumbnailSourceForDom(dataUrl), 'blob:test-1');
    assert.equal(thumbnailSourceForDom(dataUrl), 'blob:test-1');
    assert.equal(created.length, 1);
    assert.equal(created[0]?.type, 'image/png');

    revokeThumbnailObjectUrls();
    assert.deepEqual(revoked, ['blob:test-1']);
  } finally {
    revokeThumbnailObjectUrls();
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
  }
});

test('non-data thumbnail sources render unchanged', () => {
  assert.equal(thumbnailSourceForDom('https://example.test/thumb.jpg'), 'https://example.test/thumb.jpg');
});
