import type { ImageDisplayRecord } from '../../extension/src/core/display-records.js';

type DisplayRecordSource = NonNullable<ImageDisplayRecord['source']>;

export interface PanelRecordFixtureOptions extends Partial<Omit<ImageDisplayRecord, 'id' | 'source'>> {
  readonly id: string;
  readonly source: DisplayRecordSource;
}

export function createPanelRecordFixture({
  id,
  source,
  url = `https://example.test/${id}.jpg`,
  timestamp = '2026-06-20T00:00:00.000Z',
  ...overrides
}: PanelRecordFixtureOptions): ImageDisplayRecord {
  return { id, source, url, timestamp, ...overrides };
}
