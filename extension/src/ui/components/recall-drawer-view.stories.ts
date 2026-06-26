import type { Meta, StoryObj } from '@storybook/html-vite';

import { createRecallDrawerView } from './recall-drawer-view.js';
import { recallState } from '../stories/fixtures.js';
import { drawerStory, mockDispatch } from '../stories/story-host.js';

const geometry = {
  side: 'right' as const,
  inlineStart: 16,
  inlineSize: 340,
  blockStart: 16,
  blockSize: 480,
};

const meta = {
  title: 'Extension UI/Recall drawer',
  render: () => recallStory(),
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Normal: Story = {};

export const Empty: Story = {
  render: () => recallStory({ candidates: [], total: 0, nextOffset: 0 }),
};

export const Loading: Story = {
  render: () => recallStory({ busy: true, candidates: [], total: 0, nextOffset: 0 }),
};

export const Error: Story = {
  render: () => recallStory({ message: 'Some Recall rows could not be decrypted.', messageIsError: true, failedCount: 2 }),
};

export const Selected: Story = {
  render: () => {
    const state = recallState();
    return recallStory({ selectedIds: [state.candidates[0]?.id ?? ''] });
  },
};

export const HasMore: Story = {
  render: () => recallStory({ hasMore: true, total: 18, nextOffset: 4 }),
};

export const Narrow: Story = {
  render: () =>
    recallStory(
      {},
      {
        ...geometry,
        inlineSize: 280,
      },
    ),
};

function recallStory(stateOverrides = {}, geometryOverrides = geometry) {
  return drawerStory(createRecallDrawerView(recallState(stateOverrides), geometryOverrides, mockDispatch()));
}
