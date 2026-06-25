export const OBJECT_FIT_MODES = ['contain', 'cover', 'fill', 'none', 'scale-down'] as const;

export type ObjectFitMode = (typeof OBJECT_FIT_MODES)[number];

export const DEFAULT_PREVIEW_OBJECT_FIT: ObjectFitMode = 'contain';

export function isObjectFitMode(value: unknown): value is ObjectFitMode {
  return typeof value === 'string' && (OBJECT_FIT_MODES as readonly string[]).includes(value);
}
