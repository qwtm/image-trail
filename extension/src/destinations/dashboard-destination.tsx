import { useCallback, useEffect, useState } from 'react';

import type { DashboardSnapshot, DestinationServices } from './destination-services.js';
import { useRequestGeneration } from './request-generation.js';

interface DashboardState {
  readonly loading: boolean;
  readonly snapshot: DashboardSnapshot | null;
  readonly error: string | null;
}

function useDashboard(services: DestinationServices) {
  const [state, setState] = useState<DashboardState>({ loading: true, snapshot: null, error: null });
  const requests = useRequestGeneration();
  const load = useCallback(async () => {
    const request = requests.begin();
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const snapshot = await services.loadDashboard();
      if (requests.isCurrent(request)) setState({ loading: false, snapshot, error: null });
    } catch {
      if (requests.isCurrent(request)) {
        setState((current) => ({ ...current, loading: false, error: 'Dashboard could not load durable records.' }));
      }
    }
  }, [requests, services]);
  useEffect(() => {
    void load();
    return services.subscribeLibrary(() => void load());
  }, [load, services]);
  return { ...state, reload: load };
}

function Stat({ label, value, accent = false }: { readonly label: string; readonly value: number; readonly accent?: boolean }) {
  return (
    <div className="image-trail-destination-page__stat" data-accent={accent ? 'true' : undefined}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export function DashboardDestination({ services }: { readonly services: DestinationServices }) {
  const dashboard = useDashboard(services);
  const snapshot = dashboard.snapshot;
  return (
    <div className="image-trail-destination-dashboard">
      <div className="image-trail-destination-page__target-card">
        <span className="image-trail-destination-page__placeholder" aria-hidden="true">
          IMG
        </span>
        <div>
          <strong>Target and Trail controls stay with the source panel</strong>
          <p>This tab intentionally does not clone page-coupled target, field, or navigation state.</p>
        </div>
      </div>
      {dashboard.error ? <p className="image-trail-destination-page__status is-error">{dashboard.error}</p> : null}
      <div className="image-trail-destination-page__stats" aria-busy={dashboard.loading}>
        <Stat label="Durable records" value={snapshot?.total ?? 0} />
        <Stat label="Loaded pins" value={snapshot?.pins ?? 0} />
        <Stat label="Loaded bookmarks" value={snapshot?.captured ?? 0} accent />
        <Stat label="Snapshot limit" value={snapshot?.limit ?? 200} />
      </div>
      <p className="image-trail-destination-page__note">
        {dashboard.loading
          ? 'Loading a bounded durable snapshot…'
          : snapshot?.truncated
            ? 'Counts for pins and bookmarks describe the bounded 200-record snapshot; the durable total is exact.'
            : 'All durable records are represented. Transient Recents are never included.'}
      </p>
      <div className="image-trail-destination-page__actions">
        <button type="button" disabled={dashboard.loading} onClick={() => void dashboard.reload()}>
          {dashboard.loading ? 'Loading…' : 'Reload'}
        </button>
      </div>
    </div>
  );
}
