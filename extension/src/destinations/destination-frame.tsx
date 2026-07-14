import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { destinationSourceStatus, focusDestinationSource } from '../content/destination-client.js';
import {
  destinationPageUrl,
  EXTENSION_DESTINATION_IDS,
  extensionDestination,
  sourceTabIdFromSearch,
  type DestinationSourceState,
  type ExtensionDestinationId,
} from '../core/destinations.js';
import { ExtensionDestinationShell } from '../ui/react/extension-destination-shell.js';

interface DestinationFrameProps {
  readonly destination: ExtensionDestinationId;
  readonly children?: ReactNode;
}

const SOURCE_STATUS_POLL_MS = 2_000;

function resolveDestinationPage(path: string): string {
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) return chrome.runtime.getURL(path);
  const origin = window.location.origin && window.location.origin !== 'null' ? window.location.origin : 'http://localhost';
  return new URL(path, `${origin}/`).href;
}

export function DestinationDomBody({ content }: { readonly content: HTMLElement }) {
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const current = host.current;
    if (!current) return;
    current.replaceChildren(content);
    return () => {
      if (content.parentElement === current) content.remove();
    };
  }, [content]);
  return <div ref={host} className="image-trail-destination-page__dom-body" />;
}

function useSourceTabLifecycle(sourceTabId: number | undefined) {
  const [state, setState] = useState<DestinationSourceState | 'checking'>(sourceTabId === undefined ? 'unbound' : 'checking');
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const current = (generation.current += 1);
    const result = await destinationSourceStatus(sourceTabId);
    if (current === generation.current) setState(result.state);
  }, [sourceTabId]);
  useEffect(() => {
    void refresh();
    const poll = window.setInterval(() => void refresh(), SOURCE_STATUS_POLL_MS);
    const onFocus = () => void refresh();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      generation.current += 1;
      window.clearInterval(poll);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh]);
  const focusSource = useCallback(async () => {
    if (sourceTabId === undefined) return;
    const result = await focusDestinationSource(sourceTabId);
    setState(result.state);
  }, [sourceTabId]);
  return { state, focusSource };
}

export function DestinationFrame({ destination, children }: DestinationFrameProps) {
  const sourceTabId = sourceTabIdFromSearch(window.location.search);
  const source = useSourceTabLifecycle(sourceTabId);
  const routes = useMemo(
    () =>
      EXTENSION_DESTINATION_IDS.map((id) => ({
        id,
        href: destinationPageUrl(id, resolveDestinationPage, sourceTabId),
      })),
    [sourceTabId],
  );
  useEffect(() => {
    document.title = `${extensionDestination(destination).label} · Image Trail`;
  }, [destination]);
  return (
    <ExtensionDestinationShell
      destination={destination}
      routes={routes}
      sourceState={source.state}
      onReturnToSource={() => void source.focusSource()}
    >
      {children}
    </ExtensionDestinationShell>
  );
}
