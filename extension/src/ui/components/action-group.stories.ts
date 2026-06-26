import type { Meta, StoryObj } from '@storybook/html-vite';

import { createActionGroup } from './action-group.js';
import { panelStory, storyButton } from '../stories/story-host.js';

const meta = {
  title: 'Extension UI/Settings action groups',
  render: () => panelStory(actionGroupsStory()),
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const PrimaryAndSecondary: Story = {};

export const WithAdvancedMigration: Story = {
  render: () => panelStory(actionGroupsStory({ includeMigrationActions: true })),
};

export const Narrow: Story = {
  render: () => panelStory(actionGroupsStory(), { width: 300 }),
};

function actionGroupsStory(options: { readonly includeMigrationActions?: boolean } = {}): HTMLElement {
  const section = document.createElement('section');
  section.className = 'image-trail-panel__section image-trail-panel__settings-section';

  const heading = document.createElement('h3');
  heading.textContent = 'Settings';

  const groups = document.createElement('div');
  groups.className = 'image-trail-panel__action-groups';
  const actionGroups = [
    createActionGroup('Encrypted originals', [
      storyButton('Unlock key backup', { primary: true }),
      storyButton('Export key'),
      storyButton('Clear key'),
    ]),
    createActionGroup('Import and export', [storyButton('Import pins'), storyButton('Export pins'), storyButton('Export recents')]),
  ];

  if (options.includeMigrationActions) {
    actionGroups.push(createActionGroup('Advanced migration', [storyButton('Import bookmarklet JSON')], { secondary: true }));
  }

  actionGroups.push(createActionGroup('Danger zone', [storyButton('Delete current queue', { danger: true })], { secondary: true }));

  groups.append(...actionGroups);

  section.append(heading, groups);
  return section;
}
