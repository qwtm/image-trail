import { sourceImageUrlFrom, type ImageDisplayRecord } from '../../core/display-records.js';

type BookmarkAction =
  | { readonly name: 'bookmark/current' }
  | { readonly name: 'bookmark/load'; readonly id: string }
  | { readonly name: 'bookmark/remove'; readonly id: string }
  | { readonly name: 'bookmarks/older' }
  | { readonly name: 'bookmarks/newer' }
  | { readonly name: 'capture/request'; readonly url: string; readonly sourceType: 'bookmark'; readonly sourceRecordId: string }
  | { readonly name: 'capture/preview'; readonly blobId: string }
  | { readonly name: 'capture/delete'; readonly id: string; readonly blobId: string };

export function createBookmarksView(
  currentUrl: string | null,
  items: readonly ImageDisplayRecord[],
  captureInProgress: boolean,
  page: {
    readonly offset: number;
    readonly limit: number;
    readonly total: number;
    readonly hasOlder: boolean;
    readonly hasNewer: boolean;
  },
  dispatch: (action: BookmarkAction) => void,
): HTMLElement {
  const section = document.createElement('section');
  section.className = 'image-trail-panel__section';

  const heading = document.createElement('h3');
  heading.textContent = 'Bookmarks';

  const add = document.createElement('button');
  add.type = 'button';
  add.textContent = 'Bookmark current image';
  add.disabled = currentUrl === null;
  add.addEventListener('click', () => dispatch({ name: 'bookmark/current' }));

  const pageMeta = document.createElement('p');
  pageMeta.className = 'image-trail-panel__meta';
  const pageStart = page.total === 0 ? 0 : page.offset + 1;
  const pageEnd = Math.min(page.offset + page.limit, page.total);
  pageMeta.textContent = `Bookmarks ${pageStart}-${pageEnd} of ${page.total}`;

  const pager = document.createElement('div');
  pager.className = 'image-trail-panel__actions';
  const newer = document.createElement('button');
  newer.type = 'button';
  newer.textContent = 'Newer';
  newer.disabled = !page.hasNewer;
  newer.addEventListener('click', () => dispatch({ name: 'bookmarks/newer' }));
  const older = document.createElement('button');
  older.type = 'button';
  older.textContent = 'Older';
  older.disabled = !page.hasOlder;
  older.addEventListener('click', () => dispatch({ name: 'bookmarks/older' }));
  pager.append(newer, older);

  const list = document.createElement('ol');
  list.className = 'image-trail-panel__record-list';
  for (const item of items) {
    const entry = document.createElement('li');
    const bookmarkLabel = document.createElement('div');
    bookmarkLabel.className = 'image-trail-panel__bookmark-label';
    const source = document.createElement('span');
    source.className = 'image-trail-panel__bookmark-source';
    source.textContent = extensionLabelFor(item);
    const label = document.createElement('span');
    label.className = 'image-trail-panel__bookmark-name';
    label.textContent = item.label ?? item.url;
    bookmarkLabel.append(source, label);

    const actions = document.createElement('span');
    actions.className = 'image-trail-panel__item-actions';

    if (item.captureStatus === 'captured' && item.blobId) {
      const badge = document.createElement('span');
      badge.className = 'image-trail-panel__capture-badge';
      badge.textContent = 'Stored';
      const preview = document.createElement('button');
      preview.type = 'button';
      preview.textContent = 'Preview original';
      preview.addEventListener('click', () => dispatch({ name: 'capture/preview', blobId: item.blobId! }));
      const deleteCapture = document.createElement('button');
      deleteCapture.type = 'button';
      deleteCapture.textContent = 'Delete original';
      deleteCapture.addEventListener('click', () => dispatch({ name: 'capture/delete', id: item.id, blobId: item.blobId! }));
      actions.append(badge, preview, deleteCapture);
    } else {
      const capture = document.createElement('button');
      capture.type = 'button';
      capture.textContent = 'Capture';
      capture.disabled = captureInProgress;
      capture.addEventListener('click', () =>
        dispatch({ name: 'capture/request', url: item.url, sourceType: 'bookmark', sourceRecordId: item.id }),
      );
      actions.append(capture);
    }

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => dispatch({ name: 'bookmark/remove', id: item.id }));
    actions.append(remove);
    entry.append(bookmarkLabel, actions);
    list.append(entry);
  }

  const empty = document.createElement('p');
  empty.className = 'image-trail-panel__meta';
  empty.textContent = 'Saved image URLs persist through the encrypted bookmarks repository.';
  section.append(heading, add, pageMeta, pager, items.length ? list : empty);
  return section;
}

function extensionLabelFor(item: ImageDisplayRecord): string {
  const extension = extensionFrom(item.label) ?? extensionFromUrl(item.url);
  return extension ? extension.toUpperCase() : 'IMAGE';
}

function extensionFrom(value: string | undefined): string | null {
  if (!value) return null;
  const cleanName = value.split(/[?#]/u)[0];
  const extension = cleanName.match(/\.([a-z0-9]+)$/iu)?.[1]?.toUpperCase();
  if (extension && ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP'].includes(extension)) return extension;
  return /(?:^|[/.-])OIP[.-]/iu.test(cleanName) ? 'JPG' : null;
}

function extensionFromUrl(url: string): string | null {
  try {
    const sourceUrl = sourceImageUrlFrom(url);
    return extensionFrom(sourceUrl.pathname);
  } catch {
    return extensionFrom(url);
  }
}
