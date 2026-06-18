import type { AutomationPhase } from './automation/types.js';

export type PanelStatus = 'idle' | 'ready' | 'closed' | 'unsupported' | 'error' | 'picking';

export interface TargetState {
  readonly mode: 'auto' | 'manual' | 'none';
  readonly picking: boolean;
  readonly candidateCount: number;
  readonly selectedUrl: string | null;
  readonly selectedHandleId: string | null;
  readonly selectedDimensions: string | null;
  readonly message: string;
}

export interface AutomationState {
  readonly slideshowPhase: AutomationPhase;
  readonly slideshowCount: number;
  readonly retryPhase: AutomationPhase;
  readonly retriesUsed: number;
  readonly retriesMax: number;
  readonly governorStatus: 'ready' | 'throttled' | 'capped';
  readonly requestsInLastMinute: number;
}

export interface PanelState {
  readonly visible: boolean;
  readonly status: PanelStatus;
  readonly message: string;
  readonly lastUpdatedAt: number;
  readonly target: TargetState;
  readonly automation: AutomationState;
}

export type PanelActionName =
  | 'toggle-panel'
  | 'close-panel'
  | 'ping-status'
  | 'start-target-picker'
  | 'stop-target-picker'
  | 'slideshow-start'
  | 'slideshow-stop'
  | 'slideshow-pause'
  | 'slideshow-resume'
  | 'retry-start'
  | 'retry-stop'
  | 'navigate-next'
  | 'navigate-previous'
  | 'stop-all';

export interface PanelAction {
  readonly name: PanelActionName;
}
