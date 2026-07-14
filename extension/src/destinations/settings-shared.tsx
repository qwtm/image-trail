import type { FormEvent, ReactNode } from 'react';

import type { PlaintextLocalSettings } from '../data/local-settings.js';

export interface SettingsGroupProps {
  readonly settings: PlaintextLocalSettings;
  readonly disabled: boolean;
  readonly save: (settings: PlaintextLocalSettings) => void;
}

export function SettingsGroup({
  title,
  open = false,
  children,
}: {
  readonly title: string;
  readonly open?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <details className="image-trail-destination-settings__group" open={open}>
      <summary>{title}</summary>
      <div>{children}</div>
    </details>
  );
}

export function SettingField({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <label className="image-trail-destination-settings__field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function SettingToggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <label className="image-trail-destination-settings__toggle">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.currentTarget.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function formValues(event: FormEvent<HTMLFormElement>): FormData {
  event.preventDefault();
  return new FormData(event.currentTarget);
}

export function numberValue(data: FormData, name: string): number {
  return Number(data.get(name));
}

export function selectValue<T extends string>(data: FormData, name: string): T {
  return String(data.get(name)) as T;
}

export function SettingNote({ children }: { readonly children: ReactNode }) {
  return <p className="image-trail-destination-page__note">{children}</p>;
}

export function ApplyButton({ disabled }: { readonly disabled: boolean }) {
  return (
    <button type="submit" disabled={disabled}>
      {disabled ? 'Saving…' : 'Apply'}
    </button>
  );
}
