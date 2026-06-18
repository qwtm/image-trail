import type { AutomationState, PanelAction } from '../../core/types.js';

export interface ControlsViewCallbacks {
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly dispatch: (action: PanelAction) => void;
}

function makeButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

export function createControlsView(callbacks: ControlsViewCallbacks, automation: AutomationState): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'image-trail-panel__actions';

  const previous = makeButton('← Prev', callbacks.onPrevious);
  const next = makeButton('Next →', callbacks.onNext);
  wrapper.append(previous, next);

  const slideshowPhase = automation.slideshowPhase;
  if (slideshowPhase === 'idle' || slideshowPhase === 'stopped') {
    wrapper.append(makeButton('▶ Slideshow', () => callbacks.dispatch({ name: 'slideshow-start' })));
  } else if (slideshowPhase === 'running') {
    wrapper.append(
      makeButton('⏸ Pause', () => callbacks.dispatch({ name: 'slideshow-pause' })),
      makeButton('⏹ Stop', () => callbacks.dispatch({ name: 'slideshow-stop' })),
    );
  } else if (slideshowPhase === 'paused') {
    wrapper.append(
      makeButton('▶ Resume', () => callbacks.dispatch({ name: 'slideshow-resume' })),
      makeButton('⏹ Stop', () => callbacks.dispatch({ name: 'slideshow-stop' })),
    );
  }

  if (automation.governorStatus !== 'ready') {
    const badge = document.createElement('span');
    badge.className = 'image-trail-panel__badge';
    badge.textContent = automation.governorStatus === 'throttled' ? '⏳ Throttled' : '🚫 Rate limit';
    wrapper.append(badge);
  }

  return wrapper;
}
