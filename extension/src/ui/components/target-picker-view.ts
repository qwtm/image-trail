import type { PanelAction, TargetState } from '../../core/types.js';

export function createTargetPickerView(target: TargetState, dispatch: (action: PanelAction) => void): HTMLElement {
  const wrapper = document.createElement('section');
  wrapper.className = 'image-trail-panel__section image-trail-panel__target-utility';

  const heading = document.createElement('h3');
  heading.textContent = 'Host target';

  const description = document.createElement('p');
  description.className = 'image-trail-panel__meta';
  description.textContent = target.selectedUrl
    ? `Projecting onto ${target.selectedDimensions ?? 'selected image'} from ${target.mode} pick mode.`
    : `Choose which page image receives the current edited URL. ${target.candidateCount} candidate${target.candidateCount === 1 ? '' : 's'} detected.`;

  const current = document.createElement('p');
  current.className = 'image-trail-panel__target-url';
  current.textContent = target.selectedUrl ?? 'No host image selected yet.';

  const actions = document.createElement('div');
  actions.className = 'image-trail-panel__actions';
  const pickButton = document.createElement('button');
  pickButton.type = 'button';
  pickButton.textContent = target.picking ? 'Cancel host pick' : 'Set host image';
  pickButton.addEventListener('click', () => dispatch({ name: target.picking ? 'stop-target-picker' : 'start-target-picker' }));
  actions.append(pickButton);

  wrapper.append(heading, description, current, actions);
  return wrapper;
}
