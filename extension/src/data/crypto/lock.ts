import type { KeyReference } from './types.js';
export type LockState = { readonly status: 'locked' } | { readonly status: 'unlocked'; readonly unlockedAt: string; readonly keyReference: KeyReference };
export const LOCKED_STATE: LockState = { status: 'locked' };
