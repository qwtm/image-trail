import {
  createLoadLocalSettingsMessage,
  createSaveLocalSettingsMessage,
  isLoadLocalSettingsResultMessage,
  isSaveLocalSettingsResultMessage,
} from '../background/messages.js';
import { CaptureController } from '../content/capture-controller.js';
import { ExtensionBookmarkStore } from '../content/extension-bookmark-store.js';
import { sendRuntimeMessage } from '../content/runtime-message.js';
import type { ImageDisplayRecord } from '../core/display-records.js';
import { GALLERY_PAGE_LIMITS } from '../core/settings.js';
import { DEFAULT_LOCAL_SETTINGS, type PlaintextLocalSettings } from '../data/local-settings.js';
import { openActionForGalleryRecord } from './gallery-model.js';
import { loadGallerySearchPage } from './gallery-search-loader.js';
import { createGalleryView, type GalleryViewState } from './gallery-view.js';

const bookmarkStore = new ExtensionBookmarkStore();
const captureStore = new CaptureController();
const SEARCH_DEBOUNCE_MS = 180;

let state: GalleryViewState = {
  items: [],
  searchQuery: '',
  offset: 0,
  limit: DEFAULT_LOCAL_SETTINGS.galleryPageLimit,
  total: 0,
  hasOlder: false,
  hasNewer: false,
  loading: true,
  message: null,
  blobKeyUnlocked: false,
  privacyMode: DEFAULT_LOCAL_SETTINGS.privacyModeEnabled,
};
let searchTimer: number | null = null;
let loadGeneration = 0;

function root(): HTMLElement {
  const element = document.getElementById('image-trail-gallery-root');
  if (!element) throw new Error('Gallery root is missing.');
  return element;
}

function render(options: { readonly focusSearch?: boolean } = {}): void {
  root().replaceChildren(
    createGalleryView(state, {
      openRecord,
      updateSearch,
      clearSearch,
      updatePageLimit: (limit) => {
        void updatePageLimit(limit);
      },
      loadPage: (offset) => {
        void loadPage(offset);
      },
      reload: () => {
        void loadPage(state.offset);
      },
    }),
  );
  if (options.focusSearch) focusSearchInput();
}

async function loadPage(offset: number): Promise<void> {
  const generation = (loadGeneration += 1);
  const searchQuery = state.searchQuery;
  state = { ...state, loading: true, message: null };
  render();

  try {
    const [settings, blobKeyStatus] = await Promise.all([loadLocalSettings(), captureStore.requestBlobKeyStatus()]);
    const page = await loadGallerySearchPage({
      store: bookmarkStore,
      query: searchQuery,
      offset,
      limit: settings.galleryPageLimit,
      privacyMode: settings.privacyModeEnabled,
    });
    if (generation !== loadGeneration) return;
    state = {
      ...state,
      items: page.items,
      offset: page.offset,
      limit: page.limit,
      total: page.total,
      hasOlder: page.hasOlder,
      hasNewer: page.hasNewer,
      loading: false,
      message: null,
      blobKeyUnlocked: blobKeyStatus.unlocked,
      privacyMode: settings.privacyModeEnabled,
    };
  } catch {
    if (generation !== loadGeneration) return;
    state = { ...state, loading: false, message: 'Gallery could not load durable records.' };
  }
  render();
}

async function loadLocalSettings(): Promise<PlaintextLocalSettings> {
  const response = await sendRuntimeMessage(createLoadLocalSettingsMessage());
  if (isLoadLocalSettingsResultMessage(response) && response.payload.ok) {
    return response.payload.settings;
  }
  return DEFAULT_LOCAL_SETTINGS;
}

function updateSearch(query: string): void {
  loadGeneration += 1;
  state = { ...state, searchQuery: query, offset: 0, message: null };
  render({ focusSearch: true });
  if (searchTimer !== null) window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    searchTimer = null;
    void loadPage(0);
  }, SEARCH_DEBOUNCE_MS);
}

function clearSearch(): void {
  loadGeneration += 1;
  if (searchTimer !== null) window.clearTimeout(searchTimer);
  searchTimer = null;
  state = { ...state, searchQuery: '', offset: 0, message: 'Search cleared.' };
  render({ focusSearch: true });
  void loadPage(0);
}

async function updatePageLimit(limit: number): Promise<void> {
  if (!Number.isInteger(limit) || limit < GALLERY_PAGE_LIMITS.min || limit > GALLERY_PAGE_LIMITS.max || limit === state.limit) return;
  const settings = await loadLocalSettings();
  const response = await sendRuntimeMessage(createSaveLocalSettingsMessage({ ...settings, galleryPageLimit: limit }));
  if (!isSaveLocalSettingsResultMessage(response) || !response.payload.ok) {
    state = { ...state, message: 'Gallery page limit could not be saved.' };
    render();
    return;
  }
  state = { ...state, limit, offset: 0, message: limit === 0 ? 'Gallery page limit set to unlimited.' : 'Gallery page limit saved.' };
  render();
  void loadPage(0);
}

async function openRecord(record: ImageDisplayRecord): Promise<void> {
  const action = openActionForGalleryRecord(record, { blobKeyUnlocked: state.blobKeyUnlocked });
  if (action.kind === 'open-url') {
    window.open(action.url, '_blank', 'noopener,noreferrer');
    return;
  }
  if (action.kind === 'preview-data-url') {
    await showPreviewResult(captureStore.requestDataUrlPreview(action.dataUrl));
    return;
  }
  if (action.kind === 'preview-blob') {
    await showPreviewResult(captureStore.requestBlobPreview(action.blobId));
    return;
  }
  state = { ...state, message: action.message };
  render();
}

async function showPreviewResult(preview: Promise<Awaited<ReturnType<CaptureController['requestBlobPreview']>>>): Promise<void> {
  const result = await preview;
  if (result.ok) return;
  state = { ...state, message: result.message };
  render();
}

document.addEventListener('DOMContentLoaded', () => {
  render();
  void loadPage(0);
});

function focusSearchInput(): void {
  const input = root().querySelector<HTMLInputElement>('input[type="search"]');
  if (!input) return;
  input.focus();
  const position = input.value.length;
  input.setSelectionRange(position, position);
}
