import type { UrlField } from './types.js';

export type UrlSteppingPresetId = 'numbered-filename' | 'gallery-path' | 'gallery-query' | 'all-detected';

export interface UrlSteppingPresetSuggestion {
  readonly id: UrlSteppingPresetId;
  readonly label: string;
  readonly description: string;
  readonly fieldIds: readonly string[];
  readonly fieldLabels: readonly string[];
}

interface PresetDefinition {
  readonly id: UrlSteppingPresetId;
  readonly label: string;
  readonly description: string;
  readonly matches: (field: UrlField) => boolean;
}

const PRESET_DEFINITIONS: readonly PresetDefinition[] = [
  {
    id: 'numbered-filename',
    label: 'Numbered filename',
    description: 'Step numeric parts of the filename.',
    matches: (field) => field.location === 'path' && field.label.startsWith('file '),
  },
  {
    id: 'gallery-path',
    label: 'Gallery path',
    description: 'Step numeric gallery or album path parts.',
    matches: (field) => field.location === 'path' && !field.label.startsWith('file '),
  },
  {
    id: 'gallery-query',
    label: 'Gallery query',
    description: 'Step numeric query parameters such as page or image.',
    matches: (field) => field.location === 'query',
  },
  {
    id: 'all-detected',
    label: 'All detected numbers',
    description: 'Step every detected numeric URL field together.',
    matches: () => true,
  },
];

export function suggestUrlSteppingPresets(fields: readonly UrlField[]): readonly UrlSteppingPresetSuggestion[] {
  const candidates = fields.filter(
    (field) =>
      (field.tokenKind === 'int' || field.tokenKind === 'hex') && field.splitBaseId === undefined && field.splitPartIndex === undefined,
  );
  const seen = new Set<string>();
  const suggestions: UrlSteppingPresetSuggestion[] = [];
  for (const definition of PRESET_DEFINITIONS) {
    const matching = candidates.filter(definition.matches);
    if (matching.length === 0) continue;
    const key = matching.map((field) => field.id).join('\u0000');
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push({
      id: definition.id,
      label: definition.label,
      description: definition.description,
      fieldIds: matching.map((field) => field.id),
      fieldLabels: matching.map((field) => field.label),
    });
  }
  return suggestions;
}
