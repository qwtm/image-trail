export const EXTENSION_DESTINATION_IDS = ['dashboard', 'gallery', 'recall', 'settings'] as const;

export type ExtensionDestinationId = (typeof EXTENSION_DESTINATION_IDS)[number];
export type DestinationSourceState = 'connected' | 'missing' | 'unbound';

export interface ExtensionDestinationDefinition {
  readonly id: ExtensionDestinationId;
  readonly label: string;
  readonly glyph: string;
  readonly description: string;
  readonly pageDescription: string;
}

export const EXTENSION_DESTINATIONS: readonly ExtensionDestinationDefinition[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    glyph: '◱',
    description: 'Current target, trail status, durable queue totals, and safe navigation actions.',
    pageDescription: 'A durable overview with an explicit return path to page-coupled controls.',
  },
  {
    id: 'gallery',
    label: 'Gallery',
    glyph: '▦',
    description: 'Compact view of durable pins and captured originals.',
    pageDescription: 'Every durable pin and captured bookmark, with search and albums.',
  },
  {
    id: 'recall',
    label: 'Recall',
    glyph: '⟲',
    description: 'Browse offscreen durable queue records and move selected records to the front.',
    pageDescription: 'Page the durable queue producer and move selected records to the front.',
  },
  {
    id: 'settings',
    label: 'Settings',
    glyph: '⚙',
    description: 'Display, privacy, automation, utility, and system settings.',
    pageDescription: 'Extension-owned display, privacy, automation, utility, and system preferences.',
  },
];

export function isExtensionDestinationId(value: unknown): value is ExtensionDestinationId {
  return typeof value === 'string' && EXTENSION_DESTINATION_IDS.some((id) => id === value);
}

export function extensionDestination(id: ExtensionDestinationId): ExtensionDestinationDefinition {
  const definition = EXTENSION_DESTINATIONS.find((candidate) => candidate.id === id);
  if (!definition) throw new Error(`Unknown extension destination: ${id}`);
  return definition;
}

export function destinationPagePath(destination: ExtensionDestinationId): string {
  return destination === 'gallery' ? 'src/gallery/gallery.html' : 'src/destinations/view.html';
}

export function destinationPageUrl(
  destination: ExtensionDestinationId,
  resolveUrl: (path: string) => string,
  sourceTabId?: number,
): string {
  const url = new URL(resolveUrl(destinationPagePath(destination)));
  url.searchParams.set('view', destination);
  if (sourceTabId !== undefined) url.searchParams.set('sourceTab', String(sourceTabId));
  return url.href;
}

export function destinationFromLocation(location: Pick<Location, 'pathname' | 'search'>): ExtensionDestinationId {
  const requested = new URLSearchParams(location.search).get('view');
  if (isExtensionDestinationId(requested)) return requested;
  return location.pathname.endsWith('/gallery.html') ? 'gallery' : 'dashboard';
}

export function sourceTabIdFromSearch(search: string): number | undefined {
  const raw = new URLSearchParams(search).get('sourceTab');
  if (!raw || !/^\d+$/u.test(raw)) return undefined;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}
