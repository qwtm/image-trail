import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseInteropEnvelope } from '../extension/src/core/interop/messages.js';
import type { InteropRecord } from '../extension/src/core/interop/records.js';
import { analyzeSyncRecords, resolveSyncConflicts } from '../extension/src/core/interop/sync-resolution.js';

function fixtureRecord(): InteropRecord {
  const fixture = JSON.parse(readFileSync('contracts/interop/v1/fixtures/valid-record-message.json', 'utf8')) as unknown;
  const envelope = parseInteropEnvelope(fixture);
  assert.equal(envelope.payload.kind, 'record');
  return envelope.payload.record;
}

function conflictingRecords(): { imageTrail: InteropRecord; overlook: InteropRecord } {
  const base = fixtureRecord();
  return {
    imageTrail: {
      ...base,
      title: 'Image Trail title',
      revision: { imageTrail: 2, overlook: 0 },
      fieldRevisions: { ...base.fieldRevisions, title: { imageTrail: 2, overlook: 0 } },
    },
    overlook: {
      ...base,
      title: 'Overlook title',
      revision: { imageTrail: 1, overlook: 2 },
      fieldRevisions: { ...base.fieldRevisions, title: { imageTrail: 1, overlook: 2 } },
    },
  };
}

test('Sync convergence uses product roles, not delivery order', () => {
  const { imageTrail, overlook } = conflictingRecords();
  const first = analyzeSyncRecords(imageTrail, overlook);
  const second = analyzeSyncRecords(structuredClone(imageTrail), structuredClone(overlook));
  assert.deepEqual(second, first);
  assert.equal(first.category, 'conflict');
  assert.deepEqual(
    first.conflicts.map((conflict) => conflict.field),
    ['title'],
  );
  assert.deepEqual(first.merged.revision, { imageTrail: 2, overlook: 2 });
});

test('newer per-field revisions merge without a conflict and identical records deduplicate', () => {
  const base = fixtureRecord();
  const newer = {
    ...base,
    label: 'Overlook label',
    revision: { imageTrail: 1, overlook: 1 },
    fieldRevisions: { ...base.fieldRevisions, label: { imageTrail: 1, overlook: 1 } },
  };
  const analysis = analyzeSyncRecords(base, newer);
  assert.equal(analysis.category, 'eligible');
  assert.equal(analysis.merged.label, 'Overlook label');
  assert.deepEqual(analyzeSyncRecords(base, base), { category: 'duplicate', merged: base, conflicts: [] });
});

test('conflicts require explicit decisions and Keep both returns two deterministic records', () => {
  const { imageTrail, overlook } = conflictingRecords();
  const analysis = analyzeSyncRecords(imageTrail, overlook);
  assert.throws(() => resolveSyncConflicts(analysis, imageTrail, overlook, {}), /requires an explicit decision/u);
  const outcome = resolveSyncConflicts(analysis, imageTrail, overlook, { title: 'keep-both' });
  assert.equal(outcome.primary.title, 'Image Trail title');
  assert.equal(outcome.secondary?.title, 'Overlook title');
});

test('delete tombstones are always separated for review', () => {
  const base = fixtureRecord();
  const tombstone: InteropRecord = {
    ...base,
    deletedAt: '2026-07-16T18:20:00.000Z',
    revision: { imageTrail: 1, overlook: 1 },
    fieldRevisions: { ...base.fieldRevisions, deleted: { imageTrail: 1, overlook: 1 } },
  };
  assert.equal(analyzeSyncRecords(base, tombstone).category, 'delete-review');
});
