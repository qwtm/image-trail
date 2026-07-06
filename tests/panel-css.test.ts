import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PANEL_CSS = readFileSync(resolve(process.cwd(), 'extension/src/ui/styles/panel.css'), 'utf8');

function cssRule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`${escaped}\\s*\\{(?<body>[^}]*)\\}`, 'u').exec(PANEL_CSS);
  assert.ok(match?.groups?.['body'], `missing CSS rule for ${selector}`);
  return match.groups['body'];
}

test('Recents list uses stable 120px rows with a one-to-three-row viewport (#446)', () => {
  const body = cssRule('.image-trail-panel-root .image-trail-panel__history-section .image-trail-panel__record-list');

  assert.match(body, /grid-auto-rows:\s*minmax\(120px,\s*max-content\);/u);
  assert.match(body, /align-content:\s*start;/u);
  assert.match(body, /max-block-size:\s*calc\(120px \* 3 \+ 6px \* 2\);/u);
  assert.match(body, /overflow-y:\s*auto;/u);
});

test('user-resized Recents changes the viewport, not the row height (#446)', () => {
  const body = cssRule('.image-trail-panel-root .image-trail-panel__history-section .image-trail-panel__record-list.is-user-resized');

  assert.match(body, /block-size:\s*max\(120px,\s*var\(--image-trail-history-size\)\);/u);
  assert.match(body, /max-block-size:\s*none;/u);
});
