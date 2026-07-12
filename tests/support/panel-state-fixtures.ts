import type { ImageDisplayRecord } from '../../extension/src/core/display-records.js';

type DisplayRecordSource = NonNullable<ImageDisplayRecord['source']>;

export interface PanelRecordFixtureOptions {
  readonly id: string;
  readonly source: DisplayRecordSource;
  readonly url?: string;
  readonly timestamp?: string;
}

export function createPanelRecordFixture({
  id,
  source,
  url = `https://example.test/${id}.jpg`,
  timestamp = '2026-06-20T00:00:00.000Z',
}: PanelRecordFixtureOptions): ImageDisplayRecord {
  return { id, source, url, timestamp };
}
