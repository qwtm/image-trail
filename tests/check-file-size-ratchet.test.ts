import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

interface Change {
  status: string;
  path: string;
  previousPath?: string;
  baseText: string | null;
  currentText: string | null;
}

interface SizeResult {
  ok: boolean;
  results: readonly {
    path: string;
    baseLines: number | null;
    currentLines: number | null;
    ceiling: number;
    delta: number | null;
    target: number | null;
    status: string;
    ok: boolean;
  }[];
}

interface CheckFileSizeModule {
  countLines(text: string): number;
  classifyGuardedFile(file: string): { ceiling: number } | null;
  calculateReductionTarget(lines: number, ceiling: number): number | null;
  parseNameStatus(output: string): readonly { status: string; path: string; previousPath?: string }[];
  evaluateFileSizeChanges(changes: readonly Change[]): SizeResult;
}

const scriptPath = join(process.cwd(), 'scripts/check-file-size-ratchet.mjs');
const mod = (await import(pathToFileURL(scriptPath).href)) as CheckFileSizeModule;

function lines(count: number, newline = true): string {
  const value = Array.from({ length: count }, (_, index) => String(index + 1)).join('\n');
  return newline && count > 0 ? `${value}\n` : value;
}

function evaluate(change: Partial<Change> & Pick<Change, 'path'>): SizeResult['results'][number] {
  const result = mod.evaluateFileSizeChanges([{ status: 'M', baseText: lines(10), currentText: lines(10), ...change }]);
  assert.equal(result.results.length, 1);
  return result.results[0]!;
}

test('counts physical lines across newline formats without inventing a final line', () => {
  assert.equal(mod.countLines(''), 0);
  assert.equal(mod.countLines('one\n'), 1);
  assert.equal(mod.countLines('one\r\ntwo\r\n'), 2);
  assert.equal(mod.countLines('one\rtwo'), 2);
});

test('uses production and test ceilings only for guarded source files', () => {
  assert.deepEqual(mod.classifyGuardedFile('extension/src/gallery/view.ts'), { ceiling: 400 });
  assert.deepEqual(mod.classifyGuardedFile('scripts/check-example.mjs'), { ceiling: 400 });
  assert.deepEqual(mod.classifyGuardedFile('tests/gallery.test.ts'), { ceiling: 600 });
  assert.equal(mod.classifyGuardedFile('extension/dist/view.js'), null);
  assert.equal(mod.classifyGuardedFile('README.md'), null);
});

test('enforces new-file ceilings at their exact boundary', () => {
  assert.equal(evaluate({ status: 'A', path: 'extension/src/new.ts', baseText: null, currentText: lines(400) }).ok, true);
  assert.equal(evaluate({ status: 'A', path: 'extension/src/new.ts', baseText: null, currentText: lines(401) }).status, 'new-oversized');
  assert.equal(evaluate({ status: 'A', path: 'tests/new.test.ts', baseText: null, currentText: lines(600) }).ok, true);
  assert.equal(evaluate({ status: 'A', path: 'tests/new.test.ts', baseText: null, currentText: lines(601) }).status, 'new-oversized');
});

test('allows legacy oversized files to hold or shrink but not grow', () => {
  assert.equal(evaluate({ path: 'extension/src/legacy.ts', baseText: lines(900), currentText: lines(900) }).status, 'oversized-unchanged');
  assert.equal(evaluate({ path: 'extension/src/legacy.ts', baseText: lines(900), currentText: lines(880) }).status, 'oversized-reduced');
  const growth = evaluate({ path: 'extension/src/legacy.ts', baseText: lines(900), currentText: lines(901) });
  assert.equal(growth.status, 'oversized-grew');
  assert.equal(growth.ok, false);
});

test('allows ordinary growth below the ceiling but rejects crossing it', () => {
  assert.equal(evaluate({ path: 'extension/src/small.ts', baseText: lines(100), currentText: lines(400) }).ok, true);
  assert.equal(evaluate({ path: 'extension/src/small.ts', baseText: lines(400), currentText: lines(401) }).status, 'crossed-ceiling');
});

test('reports deletions and preserves the old baseline across renames', () => {
  const deleted = evaluate({ status: 'D', path: 'extension/src/old.ts', baseText: lines(500), currentText: null });
  assert.equal(deleted.status, 'deleted');
  assert.equal(deleted.ok, true);

  const renamed = evaluate({
    status: 'R',
    previousPath: 'extension/src/old.ts',
    path: 'extension/src/new.ts',
    baseText: lines(500),
    currentText: lines(501),
  });
  assert.equal(renamed.status, 'oversized-grew');
});

test('parses modified deleted and rename records from null-delimited git output', () => {
  assert.deepEqual(mod.parseNameStatus('M\0one.ts\0D\0gone.ts\0R095\0old.ts\0new.ts\0'), [
    { status: 'M', path: 'one.ts' },
    { status: 'D', path: 'gone.ts' },
    { status: 'R', previousPath: 'old.ts', path: 'new.ts' },
  ]);
});

test('calculates non-blocking two-percent or ten-line reduction targets', () => {
  assert.equal(mod.calculateReductionTarget(400, 400), null);
  assert.equal(mod.calculateReductionTarget(450, 400), 440);
  assert.equal(mod.calculateReductionTarget(1000, 400), 980);
  assert.equal(mod.calculateReductionTarget(405, 400), 400);
});

test('accepts explicit changes through the integration-test environment override', () => {
  const run = spawnSync(process.execPath, [scriptPath], {
    encoding: 'utf8',
    env: {
      ...process.env,
      FILE_SIZE_CHECK_CHANGES: JSON.stringify([{ status: 'A', path: 'extension/src/new.ts', baseText: null, currentText: lines(401) }]),
    },
  });
  assert.equal(run.status, 1);
  assert.match(run.stdout, /new-oversized/u);
});

test('skips cleanly when no main reference can be resolved', () => {
  const run = spawnSync(process.execPath, [scriptPath], {
    cwd: mkdtempSync(join(tmpdir(), 'image-trail-size-check-')),
    encoding: 'utf8',
  });
  assert.equal(run.status, 0);
  assert.match(run.stdout, /No origin\/main or main ref found/u);
});
