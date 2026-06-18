import type { PanelState } from '../../core/types.js';

function formatAutomationStatus(state: PanelState): string {
  const parts: string[] = [];
  const auto = state.automation;

  if (auto.slideshowPhase !== 'idle') {
    parts.push(`Slideshow: ${auto.slideshowPhase} (${auto.slideshowCount} shown)`);
  }
  if (auto.retryPhase !== 'idle') {
    parts.push(`Retry: ${auto.retryPhase} (${auto.retriesUsed}/${auto.retriesMax})`);
  }
  if (auto.governorStatus !== 'ready') {
    parts.push(`Requests: ${auto.governorStatus}`);
  }
  if (auto.requestsInLastMinute > 0) {
    parts.push(`${auto.requestsInLastMinute} req/min`);
  }

  return parts.join(' · ');
}

export function createStatusView(state: PanelState): HTMLElement {
  const wrapper = document.createElement('section');
  wrapper.className = 'image-trail-panel__section';

  const status = document.createElement('p');
  status.className = 'image-trail-panel__status';
  status.textContent = state.message;

  const meta = document.createElement('p');
  meta.className = 'image-trail-panel__meta';
  meta.textContent = `Status: ${state.status} · Updated: ${new Date(state.lastUpdatedAt).toLocaleTimeString()}`;

  wrapper.append(status, meta);

  const automationText = formatAutomationStatus(state);
  if (automationText) {
    const automationLine = document.createElement('p');
    automationLine.className = 'image-trail-panel__meta';
    automationLine.textContent = automationText;
    wrapper.append(automationLine);
  }

  return wrapper;
}
