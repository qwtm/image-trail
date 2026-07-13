import type { PanelAction } from '../../core/types.js';
import { suggestUrlSteppingPresets } from '../../core/url/stepping-presets.js';
import type { UrlField } from '../../core/url/types.js';

export function createUrlSteppingPresetView(fields: readonly UrlField[], dispatch: (action: PanelAction) => void): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'image-trail-panel__settings-templates';
  const heading = document.createElement('h4');
  heading.textContent = 'Stepping presets';
  wrapper.append(heading);
  const suggestions = suggestUrlSteppingPresets(fields);
  if (suggestions.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'image-trail-panel__settings-empty';
    empty.textContent = 'No numeric URL fields are available for a preset.';
    wrapper.append(empty);
    return wrapper;
  }
  const list = document.createElement('ul');
  list.className = 'image-trail-panel__settings-template-list';
  for (const suggestion of suggestions) {
    const item = document.createElement('li');
    const label = document.createElement('strong');
    label.textContent = suggestion.label;
    const description = document.createElement('p');
    description.className = 'image-trail-panel__settings-template-meta';
    description.textContent = suggestion.description;
    const fieldsLabel = document.createElement('p');
    fieldsLabel.className = 'image-trail-panel__settings-template-meta';
    fieldsLabel.textContent = `Fields: ${suggestion.fieldLabels.join(', ')}`;
    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'image-trail-panel__settings-template-clear';
    save.textContent = 'Save preset';
    save.addEventListener('click', () => dispatch({ name: 'url-template/save-step-preset', presetId: suggestion.id }));
    item.append(label, description, fieldsLabel, save);
    list.append(item);
  }
  wrapper.append(list);
  return wrapper;
}
