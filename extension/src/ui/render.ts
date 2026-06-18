import type { PanelAction, PanelState } from '../core/types.js';
import { createBookmarksView } from './components/bookmarks-view.js';
import { createHistoryView } from './components/history-view.js';
import { createStatusView } from './components/status-view.js';
import { createTargetPickerView } from './components/target-picker-view.js';

export interface PanelRenderTarget {
  readonly root: HTMLElement;
  readonly dispatch: (action: PanelAction) => void;
}

function makeButton(label: string, action: PanelAction, dispatch: (action: PanelAction) => void, disabled = false): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.disabled = disabled;
  button.addEventListener('click', () => dispatch(action));
  return button;
}

export function renderPanel(target: PanelRenderTarget, state: PanelState): void {
  target.root.replaceChildren();

  const heading = document.createElement('h2');
  heading.textContent = 'Image Trail';

  const captureSection = document.createElement('div');
  captureSection.className = 'image-trail-panel__capture-actions';
  if (state.target.selectedUrl) {
    const captureBtn = makeButton(
      'Capture original',
      { name: 'capture/request', url: state.target.selectedUrl, sourceType: 'target' },
      target.dispatch,
      state.captureInProgress || !state.target.selectedUrl,
    );
    captureBtn.className = 'image-trail-panel__capture-btn';
    captureSection.append(captureBtn);
  }

  const actions = document.createElement('div');
  actions.className = 'image-trail-panel__actions';
  actions.append(
    makeButton('Ping status', { name: 'ping-status' }, target.dispatch),
    makeButton('Close', { name: 'close-panel' }, target.dispatch),
  );

  target.root.append(
    heading,
    createStatusView(state, target.dispatch),
    createTargetPickerView(state.target, target.dispatch),
    captureSection,
    createHistoryView(state.history, state.captureInProgress, target.dispatch),
    createBookmarksView(state.target.selectedUrl, state.bookmarks, state.captureInProgress, target.dispatch),
    actions,
  );
}
