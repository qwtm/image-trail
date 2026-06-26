import type { Meta, StoryObj } from '@storybook/html-vite';

import { createHistoryView } from './history-view.js';
import {
  capturedRecord,
  lockedPrivateRecord,
  longOverflowRecord,
  pinnedRecentRecord,
  recentFixtures,
  selectedRecord,
} from '../stories/fixtures.js';
import { mockDispatch, panelStory } from '../stories/story-host.js';

const meta = {
  title: 'Extension UI/Recent history',
  render: () => historyStory(recentFixtures, []),
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Normal: Story = {};

export const Empty: Story = {
  render: () => historyStory([], []),
};

export const Selected: Story = {
  render: () => historyStory(recentFixtures, [selectedRecord.id]),
};

export const PinnedAndCaptured: Story = {
  render: () => historyStory([pinnedRecentRecord, capturedRecord], []),
};

export const LockedPrivate: Story = {
  render: () => historyStory([lockedPrivateRecord], []),
};

export const LongOverflow: Story = {
  render: () => historyStory([longOverflowRecord], []),
};

export const Narrow: Story = {
  render: () => historyStory(recentFixtures, [selectedRecord.id], { width: 300 }),
};

function historyStory(
  items: Parameters<typeof createHistoryView>[0],
  selectedIds: readonly string[],
  options: { readonly width?: number } = {},
) {
  return panelStory(
    createHistoryView(items, selectedIds, false, true, mockDispatch(), {
      blobKeyAvailable: true,
      listBlockSize: null,
      onListResize: mockDispatch<number>('history resize'),
    }),
    options,
  );
}
