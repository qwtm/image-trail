import assert from 'node:assert/strict';
import test from 'node:test';
import { act, type ReactNode } from 'react';

import { DestinationFrame } from '../../extension/src/destinations/destination-frame.js';
import { ExtensionDestinationShell } from '../../extension/src/ui/react/extension-destination-shell.js';
import { renderReactSubtree, unmountReactSubtree } from '../../extension/src/ui/react/react-subtree.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function mount(content: ReactNode): Promise<HTMLElement> {
  const root = document.createElement('div');
  document.body.append(root);
  await act(async () => renderReactSubtree(root, content));
  return root;
}

async function cleanup(root: HTMLElement): Promise<void> {
  await act(async () => unmountReactSubtree(root));
  root.remove();
}

const routes = [
  { id: 'dashboard' as const, href: '/dashboard' },
  { id: 'gallery' as const, href: '/gallery' },
  { id: 'recall' as const, href: '/recall' },
  { id: 'settings' as const, href: '/settings' },
];

test('extension destination shell exposes one current route and honest unbound source state', async () => {
  const root = await mount(
    <ExtensionDestinationShell destination="dashboard" routes={routes} sourceState="unbound" onReturnToSource={() => undefined}>
      <p>Durable dashboard</p>
    </ExtensionDestinationShell>,
  );
  try {
    assert.equal(root.querySelector('h1')?.textContent, 'Dashboard');
    assert.equal(root.querySelectorAll('nav a').length, 4);
    assert.equal(root.querySelector('a[aria-current="page"]')?.textContent?.trim(), '◱Dashboard');
    assert.equal(root.querySelector('[data-source-state="unbound"]')?.textContent, 'Durable-only view');
    assert.equal(root.querySelector<HTMLButtonElement>('.image-trail-destination-page__return')?.disabled, true);
    assert.match(root.textContent ?? '', /Durable dashboard/u);
  } finally {
    await cleanup(root);
  }
});

test('connected shell enables the explicit return path', async () => {
  let returns = 0;
  const root = await mount(
    <ExtensionDestinationShell destination="recall" routes={routes} sourceState="connected" onReturnToSource={() => (returns += 1)}>
      <p>Recall records</p>
    </ExtensionDestinationShell>,
  );
  try {
    const button = root.querySelector<HTMLButtonElement>('.image-trail-destination-page__return');
    assert.equal(button?.disabled, false);
    assert.equal(root.querySelector('[data-source-state="connected"]')?.textContent, 'Source tab available');
    assert.equal(button?.textContent, '↩ Source tab');
    button?.click();
    assert.equal(returns, 1);
  } finally {
    await cleanup(root);
  }
});

test('destination frame renders without extension globals for Storybook and DOM previews', async () => {
  const originalChrome = globalThis.chrome;
  globalThis.chrome = undefined as unknown as typeof chrome;
  const root = await mount(
    <DestinationFrame destination="settings">
      <p>Settings body</p>
    </DestinationFrame>,
  );
  try {
    assert.equal(root.querySelector('h1')?.textContent, 'Settings');
    assert.equal(root.querySelectorAll('nav a').length, 4);
    assert.equal(root.querySelector('[data-source-state="unbound"]')?.textContent, 'Durable-only view');
    assert.equal(document.title, 'Settings · Image Trail');
  } finally {
    await cleanup(root);
    globalThis.chrome = originalChrome;
  }
});
