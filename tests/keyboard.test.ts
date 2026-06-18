import test from 'node:test';
import assert from 'node:assert/strict';

import { KeyboardRouter, type KeyBinding } from '../extension/src/content/keyboard.js';

function makeFakeKeydown(key: string, opts: { shiftKey?: boolean; ctrlKey?: boolean; altKey?: boolean; target?: EventTarget } = {}): KeyboardEvent {
  return {
    key,
    shiftKey: opts.shiftKey ?? false,
    ctrlKey: opts.ctrlKey ?? false,
    altKey: opts.altKey ?? false,
    target: opts.target ?? ({ tagName: 'DIV' } as unknown as EventTarget),
    preventDefault: () => {},
    stopPropagation: () => {},
  } as unknown as KeyboardEvent;
}

test('classifyTarget skips input elements', () => {
  const actions: string[] = [];
  const router = new KeyboardRouter((a) => actions.push(a));

  const handler = (router as unknown as { onKeyDown: (e: KeyboardEvent) => void }).onKeyDown;

  handler(makeFakeKeydown('ArrowRight', { target: { tagName: 'INPUT' } as unknown as EventTarget }));
  assert.equal(actions.length, 0);

  handler(makeFakeKeydown('ArrowRight', { target: { tagName: 'TEXTAREA' } as unknown as EventTarget }));
  assert.equal(actions.length, 0);
});

test('dispatches arrow key actions on non-typing targets', () => {
  const actions: string[] = [];
  const router = new KeyboardRouter((a) => actions.push(a));
  const handler = (router as unknown as { onKeyDown: (e: KeyboardEvent) => void }).onKeyDown;

  handler(makeFakeKeydown('ArrowRight'));
  handler(makeFakeKeydown('ArrowLeft'));

  assert.deepEqual(actions, ['next', 'previous']);
});

test('dispatches shift+enter as download', () => {
  const actions: string[] = [];
  const router = new KeyboardRouter((a) => actions.push(a));
  const handler = (router as unknown as { onKeyDown: (e: KeyboardEvent) => void }).onKeyDown;

  handler(makeFakeKeydown('Enter', { shiftKey: true }));
  assert.deepEqual(actions, ['download']);
});

test('does not dispatch Enter without shift', () => {
  const actions: string[] = [];
  const router = new KeyboardRouter((a) => actions.push(a));
  const handler = (router as unknown as { onKeyDown: (e: KeyboardEvent) => void }).onKeyDown;

  handler(makeFakeKeydown('Enter'));
  assert.equal(actions.length, 0);
});

test('space dispatches slideshow-toggle', () => {
  const actions: string[] = [];
  const router = new KeyboardRouter((a) => actions.push(a));
  const handler = (router as unknown as { onKeyDown: (e: KeyboardEvent) => void }).onKeyDown;

  handler(makeFakeKeydown(' '));
  assert.deepEqual(actions, ['slideshow-toggle']);
});

test('escape dispatches stop', () => {
  const actions: string[] = [];
  const router = new KeyboardRouter((a) => actions.push(a));
  const handler = (router as unknown as { onKeyDown: (e: KeyboardEvent) => void }).onKeyDown;

  handler(makeFakeKeydown('Escape'));
  assert.deepEqual(actions, ['stop']);
});

test('custom bindings override defaults', () => {
  const bindings: KeyBinding[] = [
    { key: 'j', action: 'custom-next' },
    { key: 'k', action: 'custom-prev' },
  ];
  const actions: string[] = [];
  const router = new KeyboardRouter((a) => actions.push(a), bindings);
  const handler = (router as unknown as { onKeyDown: (e: KeyboardEvent) => void }).onKeyDown;

  handler(makeFakeKeydown('j'));
  handler(makeFakeKeydown('k'));
  handler(makeFakeKeydown('ArrowRight'));

  assert.deepEqual(actions, ['custom-next', 'custom-prev']);
});

test('skips focused button targets to preserve native activation', () => {
  const actions: string[] = [];
  const router = new KeyboardRouter((a) => actions.push(a));
  const handler = (router as unknown as { onKeyDown: (e: KeyboardEvent) => void }).onKeyDown;

  const buttonTarget = { tagName: 'BUTTON' } as unknown as EventTarget;
  handler(makeFakeKeydown(' ', { target: buttonTarget }));
  handler(makeFakeKeydown('Enter', { shiftKey: true, target: buttonTarget }));

  assert.equal(actions.length, 0);
});

test('skips contentEditable targets', () => {
  const actions: string[] = [];
  const router = new KeyboardRouter((a) => actions.push(a));
  const handler = (router as unknown as { onKeyDown: (e: KeyboardEvent) => void }).onKeyDown;

  const editableTarget = { tagName: 'DIV', isContentEditable: true } as unknown as EventTarget;
  handler(makeFakeKeydown('ArrowRight', { target: editableTarget }));

  assert.equal(actions.length, 0);
});
