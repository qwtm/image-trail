# Storybook UI Review

Image Trail uses Storybook as a component-first review harness for existing plain TypeScript DOM components. Stories should exercise isolated UI components with static fixtures and mock dispatch callbacks.

## Commands

- Run Storybook locally: `npm run storybook`
- Build static Storybook output: `npm run build:storybook`

## Story Scope

- Prefer existing exported DOM render functions from `extension/src/ui/components`.
- Use static fixtures from `extension/src/ui/stories`.
- Keep stories free of service worker, IndexedDB, encryption runtime, content-script page DOM, and full panel boot dependencies.
- Add stories for meaningful states: normal, selected, captured/original-linked, locked/private, loading, error, empty, long text, and narrow layout.

## Adding Stories

1. Put component stories next to the component as `*.stories.ts`.
2. Reuse the Storybook host helpers so panel CSS sees the same root classes as the extension.
3. Add or extend static fixtures instead of reaching into live stores or browser APIs.
4. Keep production extension builds clean by leaving stories under the existing `tsconfig` excludes.

## Acceptance

- `npm run build:storybook` succeeds.
- Existing `npm run lint`, `npm run format:check`, `npm test`, and `npm run build` behavior remains unchanged.
- The normal extension build output does not include `*.stories` files or `extension/src/ui/stories`.
