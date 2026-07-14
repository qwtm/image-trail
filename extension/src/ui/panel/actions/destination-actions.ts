import type { ActionEntries } from '../action-dispatch.js';
import type { PanelActionDeps } from './deps.js';

export type DestinationActionName = 'destination/select' | 'destination/close' | 'destination/open-tab';

export function buildDestinationActionEntries(deps: PanelActionDeps): ActionEntries<DestinationActionName> {
  return {
    'destination/open-tab': {
      handle(action) {
        void deps.openDestination(action.destination);
      },
    },
    'destination/select': {
      handle(action) {
        const current = deps.getState().activeDestination;
        if (action.destination === 'recall' && current !== 'recall') {
          void deps.openRecallDestination();
          return;
        }
        if (current === 'recall') deps.clearRecallMessageTimer();
        deps.reduce(action);
        deps.render();
      },
    },
    'destination/close': {
      handle(action) {
        if (deps.getState().activeDestination === 'recall') deps.clearRecallMessageTimer();
        deps.reduce(action);
        deps.render();
      },
    },
  };
}
