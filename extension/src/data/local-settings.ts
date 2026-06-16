export interface PlaintextLocalSettings { readonly showHistoryThumbnails: boolean; readonly requestThrottleMs: number; readonly panelDock: 'right' | 'left'; readonly schemaVersion: 1; }
export const DEFAULT_LOCAL_SETTINGS: PlaintextLocalSettings = { schemaVersion: 1, showHistoryThumbnails: false, requestThrottleMs: 250, panelDock: 'right' };
const KEY = 'imageTrail.localSettings';
export interface StringStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; }
export class LocalSettingsRepository {
  constructor(private readonly storage: StringStorage = globalThis.localStorage) {}
  load(): PlaintextLocalSettings { const raw = this.storage.getItem(KEY); if (!raw) return DEFAULT_LOCAL_SETTINGS; return migrateLocalSettings(JSON.parse(raw) as Partial<PlaintextLocalSettings>); }
  save(settings: PlaintextLocalSettings): void { this.storage.setItem(KEY, JSON.stringify(migrateLocalSettings(settings))); }
}
export function migrateLocalSettings(input: Partial<PlaintextLocalSettings>): PlaintextLocalSettings { return { ...DEFAULT_LOCAL_SETTINGS, ...input, schemaVersion: 1, panelDock: input.panelDock === 'left' ? 'left' : 'right', requestThrottleMs: typeof input.requestThrottleMs === 'number' ? input.requestThrottleMs : DEFAULT_LOCAL_SETTINGS.requestThrottleMs }; }
