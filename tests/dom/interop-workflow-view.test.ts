import test from 'node:test';
import assert from 'node:assert/strict';

import { createInteropWorkflowView } from '../../extension/src/ui/components/interop-workflow-view.js';
import { blockedInteropWorkflow } from '../../extension/src/ui/interop/visible-workflow.js';

test('renders exact review and progress counts without claiming unavailable work completed', () => {
  const view = createInteropWorkflowView(blockedInteropWorkflow('selection', 4), { onClose: () => undefined });
  assert.match(view.textContent ?? '', /0 \/ 4 processed · 0 acknowledged · 0 finalized/);
  assert.match(view.textContent ?? '', /Eligibility has not been checked/);
  const start = Array.from(view.querySelectorAll('button')).find((control) => control.textContent === 'Start move');
  assert.ok(start instanceof HTMLButtonElement);
  assert.equal(start.disabled, true);
});

test('locked workflow does not render protected review, provider, count, or conflict rows', () => {
  const view = createInteropWorkflowView(blockedInteropWorkflow('captured-original', 9, true), { onClose: () => undefined });
  assert.equal(view.classList.contains('image-trail-interop--locked'), true);
  assert.equal(view.querySelector('.image-trail-interop__review'), null);
  assert.equal(view.querySelector('.image-trail-interop__provider'), null);
  assert.doesNotMatch(view.textContent ?? '', /9|captured original|No interop provider/);
});

test('conflict choice carries explicit apply-to-all intent', () => {
  const calls: unknown[] = [];
  const state = {
    ...blockedInteropWorkflow('selection', 1),
    provider: { id: 'pcloud' as const, label: 'pCloud', state: 'connected' as const, detail: 'Encrypted namespace' },
    pairing: 'paired' as const,
    phase: 'reviewing' as const,
    error: null,
    counts: { ...blockedInteropWorkflow('selection', 1).counts, conflict: 1 },
    conflicts: [{ interopId: 'interop-1', label: 'one.jpg', fields: ['title'] }],
  };
  const view = createInteropWorkflowView(state, {
    onClose: () => undefined,
    onConflict: (...args) => calls.push(args),
  });
  const apply = view.querySelector('input[type="checkbox"]');
  assert.ok(apply instanceof HTMLInputElement);
  apply.checked = true;
  const keepBoth = Array.from(view.querySelectorAll('button')).find((control) => control.textContent === 'Keep both');
  assert.ok(keepBoth instanceof HTMLButtonElement);
  keepBoth.click();
  assert.deepEqual(calls, [['interop-1', 'keep-both', true]]);
});
