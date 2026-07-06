import type { ImageDisplayRecord } from '../core/display-records.js';
import { galleryRecordMatchesSearch, normalizeGallerySearchQuery } from './gallery-search.js';

export const GALLERY_SCAN_CHUNK_LIMIT = 100;

export interface GallerySearchPage {
  readonly items: readonly ImageDisplayRecord[];
  readonly offset: number;
  readonly limit: number;
  readonly total: number;
  readonly hasOlder: boolean;
  readonly hasNewer: boolean;
}

export interface GallerySearchStore {
  loadPage(input: {
    readonly offset: number;
    readonly limit: number;
    readonly scope?: 'global' | 'site' | undefined;
  }): Promise<GallerySearchPage>;
}

export async function loadGallerySearchPage(input: {
  readonly store: GallerySearchStore;
  readonly query: string;
  readonly offset: number;
  readonly limit: number;
  readonly privacyMode: boolean;
}): Promise<GallerySearchPage> {
  const limit = normalizeGalleryLimit(input.limit);
  const offset = limit === 0 ? 0 : Math.max(0, input.offset);
  const query = normalizeGallerySearchQuery(input.query);
  if (!query && limit > 0) return input.store.loadPage({ offset, limit, scope: 'global' });

  const matches: ImageDisplayRecord[] = [];
  let sourceOffset = 0;
  for (;;) {
    const page = await input.store.loadPage({ offset: sourceOffset, limit: GALLERY_SCAN_CHUNK_LIMIT, scope: 'global' });
    for (const record of page.items) {
      if (galleryRecordMatchesSearch(record, query, { privacyMode: input.privacyMode })) matches.push(record);
    }
    if (!page.hasOlder || page.items.length === 0) break;
    sourceOffset = page.offset + page.items.length;
  }

  const items = limit === 0 ? matches : matches.slice(offset, offset + limit);
  return {
    items,
    offset,
    limit,
    total: matches.length,
    hasOlder: limit > 0 && offset + limit < matches.length,
    hasNewer: limit > 0 && offset > 0,
  };
}

function normalizeGalleryLimit(limit: number): number {
  return Number.isInteger(limit) && limit >= 0 ? limit : 0;
}
