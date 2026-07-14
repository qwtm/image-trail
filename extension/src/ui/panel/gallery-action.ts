import { openDestinationTab } from '../../content/destination-client.js';
import type { PanelDestinationId, PanelState } from '../../core/types.js';

export async function openDestinationErrorMessage(destination: PanelDestinationId): Promise<string | null> {
  const result = await openDestinationTab(destination);
  return result.ok ? null : result.message;
}

export function destinationOpenErrorState(state: PanelState, message: string): PanelState {
  return { ...state, message, lastUpdatedAt: Date.now() };
}
