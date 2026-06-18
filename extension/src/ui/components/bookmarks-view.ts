import type { ImageDisplayRecord } from '../../core/display-records.js';

type BookmarkAction =
  | { readonly name: 'bookmark/current' }
  | { readonly name: 'bookmark/load'; readonly id: string }
  | { readonly name: 'bookmark/remove'; readonly id: string }
  | { readonly name: 'capture/request'; readonly url: string; readonly sourceType: 'bookmark'; readonly sourceRecordId: string }
  | { readonly name: 'capture/delete'; readonly id: string; readonly blobId: string };

export function createBookmarksView(
  currentUrl: string | null,
  items: readonly ImageDisplayRecord[],
  captureInProgress: boolean,
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

  const list = document.createElement('ol');
  list.className = 'image-trail-panel__record-list';
  for (const item of items) {
    const entry = document.createElement('li');
    const load = document.createElement('button');
    load.type = 'button';
    load.textContent = item.label ?? item.url;
    load.addEventListener('click', () => dispatch({ name: 'bookmark/load', id: item.id }));

    const actions = document.createElement('span');
    actions.className = 'image-trail-panel__item-actions';

    if (item.captureStatus === 'captured' && item.blobId) {
      const badge = document.createElement('span');
      badge.className = 'image-trail-panel__capture-badge';
      badge.textContent = 'Stored';
      const deleteCapture = document.createElement('button');
      deleteCapture.type = 'button';
      deleteCapture.textContent = 'Delete original';
      deleteCapture.addEventListener('click', () => dispatch({ name: 'capture/delete', id: item.id, blobId: item.blobId! }));
      actions.append(badge, deleteCapture);
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
    entry.append(load, actions);
    list.append(entry);
  }

  const empty = document.createElement('p');
  empty.className = 'image-trail-panel__meta';
  empty.textContent = 'Saved image URLs persist through the encrypted bookmarks repository.';
  section.append(heading, add, items.length ? list : empty);
  return section;
}
