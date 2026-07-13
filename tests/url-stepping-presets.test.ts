import test from 'node:test';
import assert from 'node:assert/strict';

import { parseUrl } from '../extension/src/core/url/parse-url.js';
import { suggestUrlSteppingPresets } from '../extension/src/core/url/stepping-presets.js';
import { collectUrlFields } from '../extension/src/core/url/tokenize-fields.js';
import type { UrlField } from '../extension/src/core/url/types.js';

test('suggests bounded, reviewable presets for filename, path, query, and combined fields', () => {
  const fields = collectUrlFields(parseUrl('https://cdn.example.test/gallery/12/photo_0042.jpg?page=3'));
  const suggestions = suggestUrlSteppingPresets(fields);

  assert.deepEqual(
    suggestions.map(({ id, fieldLabels }) => ({ id, fieldLabels })),
    [
      { id: 'numbered-filename', fieldLabels: ['file 1'] },
      { id: 'gallery-path', fieldLabels: ['path 3.0'] },
      { id: 'gallery-query', fieldLabels: ['query page'] },
      { id: 'all-detected', fieldLabels: ['path 3.0', 'file 1', 'query page'] },
    ],
  );
  assert.ok(suggestions.length <= 4);
});

test('deduplicates equivalent presets and excludes split child fields', () => {
  const filenameField: UrlField = {
    id: 'p:1:0',
    location: 'path',
    label: 'file 0',
    value: '0042',
    tokenKind: 'int',
    tokenIndex: 0,
  };
  const splitChild: UrlField = {
    ...filenameField,
    id: 'p:1:1',
    label: 'file 0 1/2',
    splitBaseId: 'p:1:0',
    splitPartIndex: 0,
    splitPartCount: 2,
  };

  assert.deepEqual(
    suggestUrlSteppingPresets([filenameField, splitChild]).map(({ id, fieldIds }) => ({ id, fieldIds })),
    [{ id: 'numbered-filename', fieldIds: ['p:1:0'] }],
  );
});

test('returns no suggestions when the URL has no unsplit numeric fields', () => {
  const fields = collectUrlFields(parseUrl('https://example.test/gallery/photo.jpg?view=large'));
  assert.deepEqual(suggestUrlSteppingPresets(fields), []);
});
