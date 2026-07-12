#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const PRODUCTION_MAX_LINES = 400;
const TEST_MAX_LINES = 600;
const GUARDED_SOURCE = /^(extension\/src|tests|scripts)\/.*\.(ts|tsx|js|mjs|css)$/u;
const IGNORED_PATH = /^(extension\/dist|\.test-dist|coverage|dist|storybook-static|node_modules)\//u;

function splitNullList(value) {
  return value.split('\0').filter(Boolean);
}

export function countLines(text) {
  if (text.length === 0) return 0;
  const normalized = text.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
  const withoutFinalBreak = normalized.endsWith('\n') ? normalized.slice(0, -1) : normalized;
  return withoutFinalBreak.length === 0 ? 0 : withoutFinalBreak.split('\n').length;
}

export function classifyGuardedFile(file) {
  if (!GUARDED_SOURCE.test(file) || IGNORED_PATH.test(file)) return null;
  return { ceiling: file.startsWith('tests/') ? TEST_MAX_LINES : PRODUCTION_MAX_LINES };
}

export function calculateReductionTarget(lines, ceiling) {
  if (lines <= ceiling) return null;
  return Math.max(ceiling, lines - Math.max(10, Math.ceil(lines * 0.02)));
}

function classifyChange(baseLines, currentLines, ceiling) {
  if (currentLines === null) return { status: 'deleted', ok: true };
  if (baseLines === null) {
    return currentLines > ceiling ? { status: 'new-oversized', ok: false } : { status: 'new-ok', ok: true };
  }
  if (currentLines <= ceiling) return { status: 'within-limit', ok: true };
  if (baseLines <= ceiling) return { status: 'crossed-ceiling', ok: false };
  if (currentLines > baseLines) return { status: 'oversized-grew', ok: false };
  return {
    status: currentLines < baseLines ? 'oversized-reduced' : 'oversized-unchanged',
    ok: true,
  };
}

export function parseNameStatus(output) {
  const fields = splitNullList(output);
  const changes = [];
  for (let index = 0; index < fields.length;) {
    const status = fields[index++];
    if (status.startsWith('R') || status.startsWith('C')) {
      changes.push({ status: status[0], previousPath: fields[index++], path: fields[index++] });
      continue;
    }
    changes.push({ status: status[0], path: fields[index++] });
  }
  return changes;
}

export function evaluateFileSizeChanges(changes) {
  const results = [];
  for (const change of changes) {
    const guardedPath = change.status === 'D' ? (change.previousPath ?? change.path) : change.path;
    const classification = classifyGuardedFile(guardedPath);
    if (!classification) continue;

    const baseLines = change.baseText === null ? null : countLines(change.baseText);
    const currentLines = change.currentText === null ? null : countLines(change.currentText);
    const { ceiling } = classification;
    const { status, ok } = classifyChange(baseLines, currentLines, ceiling);

    results.push({
      ...change,
      baseLines,
      currentLines,
      ceiling,
      delta: baseLines === null || currentLines === null ? null : currentLines - baseLines,
      target: currentLines === null ? null : calculateReductionTarget(currentLines, ceiling),
      status,
      ok,
    });
  }
  return { ok: results.every((result) => result.ok), results };
}

function resolveBaseRef() {
  for (const ref of ['origin/main', 'main']) {
    try {
      execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { stdio: 'ignore' });
      return ref;
    } catch {
      continue;
    }
  }
  return null;
}

function readGitText(revision, file) {
  try {
    return execFileSync('git', ['show', `${revision}:${file}`], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  } catch {
    return null;
  }
}

function gatherChanges() {
  if (process.env.FILE_SIZE_CHECK_CHANGES) return JSON.parse(process.env.FILE_SIZE_CHECK_CHANGES);

  const baseRef = resolveBaseRef();
  if (!baseRef) {
    console.log('No origin/main or main ref found; skipping file-size ratchet.');
    return null;
  }

  let mergeBase;
  try {
    mergeBase = execFileSync('git', ['merge-base', 'HEAD', baseRef], { encoding: 'utf8' }).trim();
  } catch {
    console.log(`Could not compute a merge-base with ${baseRef}; skipping file-size ratchet.`);
    return null;
  }

  const output = execFileSync('git', ['diff', '--name-status', '-z', '-M', mergeBase, '--'], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  const changes = parseNameStatus(output);
  const trackedPaths = new Set(changes.map((change) => change.path));
  const untracked = splitNullList(execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }));
  for (const path of untracked) {
    if (!trackedPaths.has(path)) changes.push({ status: 'A', path });
  }

  return changes.map((change) => ({
    ...change,
    baseText: change.status === 'A' ? null : readGitText(mergeBase, change.previousPath ?? change.path),
    currentText: change.status === 'D' || !existsSync(change.path) ? null : readFileSync(change.path, 'utf8'),
  }));
}

function formatLines(lines) {
  return lines === null ? '-' : String(lines);
}

function printReport(result) {
  if (result.results.length === 0) {
    console.log('File-size ratchet OK: no guarded files changed.');
    return;
  }
  console.log('File-size ratchet report (physical lines):');
  for (const item of result.results) {
    const delta = item.delta === null ? '-' : `${item.delta >= 0 ? '+' : ''}${item.delta}`;
    const target = item.target === null ? '' : ` target ${item.target}`;
    const rename = item.previousPath ? ` (from ${item.previousPath})` : '';
    console.log(
      `  ${item.ok ? 'PASS' : 'FAIL'} ${item.path}${rename}: ${formatLines(item.baseLines)} -> ${formatLines(item.currentLines)} (${delta}), ceiling ${item.ceiling}, ${item.status}${target}`,
    );
  }
}

function main() {
  const changes = gatherChanges();
  if (!changes) return;
  const result = evaluateFileSizeChanges(changes);
  printReport(result);
  if (!result.ok) {
    console.error('File-size ratchet failed: split new files at their ceiling and do not grow legacy oversized files.');
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
