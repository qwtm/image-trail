export interface PlaintextLocalSettings {
  readonly schemaVersion: 1;
  readonly showHistoryThumbnails: boolean;
  readonly requestThrottleMs: number;
  readonly maxRequestsPerMinute: number;
  readonly slideshowIntervalMs: number;
  readonly retryMaxAttempts: number;
  readonly retryDelayMs: number;
  readonly retryAdvanceOnExhaust: boolean;
  readonly panelDock: 'right' | 'left';
}

export const DEFAULT_LOCAL_SETTINGS: PlaintextLocalSettings = {
  schemaVersion: 1,
  showHistoryThumbnails: false,
  requestThrottleMs: 250,
  maxRequestsPerMinute: 60,
  slideshowIntervalMs: 2000,
  retryMaxAttempts: 3,
  retryDelayMs: 1000,
  retryAdvanceOnExhaust: true,
  panelDock: 'right',
};

const LOCAL_SETTINGS_KEY = 'imageTrail.localSettings';
const MIN_REQUEST_THROTTLE_MS = 0;
const MAX_REQUEST_THROTTLE_MS = 60_000;

export interface StringStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export class LocalSettingsRepository {
  constructor(private readonly storage: StringStorage = globalThis.localStorage) {}

  load(): PlaintextLocalSettings {
    const raw = this.storage.getItem(LOCAL_SETTINGS_KEY);
    if (!raw) return DEFAULT_LOCAL_SETTINGS;

    try {
      return migrateLocalSettings(JSON.parse(raw) as Partial<PlaintextLocalSettings>);
    } catch {
      return DEFAULT_LOCAL_SETTINGS;
    }
  }

  save(settings: PlaintextLocalSettings): void {
    this.storage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(migrateLocalSettings(settings)));
  }
}

export function migrateLocalSettings(input: Partial<PlaintextLocalSettings>): PlaintextLocalSettings {
  return {
    schemaVersion: 1,
    showHistoryThumbnails: input.showHistoryThumbnails === true,
    requestThrottleMs: isSafeThrottle(input.requestThrottleMs) ? input.requestThrottleMs : DEFAULT_LOCAL_SETTINGS.requestThrottleMs,
    maxRequestsPerMinute: isSafePositiveInt(input.maxRequestsPerMinute, 1, 600) ? input.maxRequestsPerMinute : DEFAULT_LOCAL_SETTINGS.maxRequestsPerMinute,
    slideshowIntervalMs: isSafePositiveInt(input.slideshowIntervalMs, 500, 60_000) ? input.slideshowIntervalMs : DEFAULT_LOCAL_SETTINGS.slideshowIntervalMs,
    retryMaxAttempts: isSafePositiveInt(input.retryMaxAttempts, 1, 20) ? input.retryMaxAttempts : DEFAULT_LOCAL_SETTINGS.retryMaxAttempts,
    retryDelayMs: isSafePositiveInt(input.retryDelayMs, 100, 30_000) ? input.retryDelayMs : DEFAULT_LOCAL_SETTINGS.retryDelayMs,
    retryAdvanceOnExhaust: typeof input.retryAdvanceOnExhaust === 'boolean' ? input.retryAdvanceOnExhaust : DEFAULT_LOCAL_SETTINGS.retryAdvanceOnExhaust,
    panelDock: input.panelDock === 'left' ? 'left' : 'right',
  };
}

function isSafeThrottle(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= MIN_REQUEST_THROTTLE_MS && value <= MAX_REQUEST_THROTTLE_MS;
}

function isSafePositiveInt(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}
