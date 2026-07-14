import type { PanelAction, PanelDestinationId, PanelState } from '../core/types.js';
import { EXTENSION_DESTINATIONS } from '../core/destinations.js';

export interface PanelDestinationDefinition {
  readonly id: PanelDestinationId;
  readonly label: string;
  readonly glyph: string;
  readonly description: string;
  readonly available: (state: PanelState) => boolean;
  readonly activationAction: () => PanelAction;
  readonly openInTabAction?: (() => PanelAction) | undefined;
}

const alwaysAvailable = (): boolean => true;

export const PANEL_DESTINATIONS: readonly PanelDestinationDefinition[] = EXTENSION_DESTINATIONS.map((destination) => ({
  ...destination,
  available: alwaysAvailable,
  activationAction: () => ({ name: 'destination/select', destination: destination.id }),
  openInTabAction: () => ({ name: 'destination/open-tab', destination: destination.id }),
}));

export function isPanelDestinationId(value: string | undefined): value is PanelDestinationId {
  return PANEL_DESTINATIONS.some((destination) => destination.id === value);
}

export function panelDestination(id: PanelDestinationId): PanelDestinationDefinition {
  const destination = PANEL_DESTINATIONS.find((candidate) => candidate.id === id);
  if (!destination) throw new Error(`Unknown panel destination: ${id}`);
  return destination;
}

export function availablePanelDestinations(state: PanelState): readonly PanelDestinationDefinition[] {
  return PANEL_DESTINATIONS.filter((destination) => destination.available(state));
}
