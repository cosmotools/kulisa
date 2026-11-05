// What Settings' pages are built of (docs/window.md, Settings): a list of things, what is added under it.
import { Children, useId, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronRightIcon, CircleAlertIcon, EllipsisIcon } from 'lucide-react';
import { Button, Field, FieldDescription, FieldError, FieldLabel, Input, Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemSeparator, ItemTitle,
  Alert, AlertDescription, FieldContent, FieldGroup, Separator, Spinner } from '@ui';
import { ButtonMenu, RightClickMenu } from '../Menus';
import type { MenuItem } from '../../lib/menu';

export function SettingsLoading({ children }: { children: ReactNode }) {
  return <div role="status" className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Spinner role={undefined} aria-hidden />{children}</div>;
}

export function SettingsError({ error }: { error: string }) {
  return error && <Alert variant="destructive"><CircleAlertIcon /><AlertDescription><span data-selectable>{error}</span></AlertDescription></Alert>;
}

export function SettingsHeading({ title, description, media, badge, action }: { title: string; description?: ReactNode; media?: ReactNode; badge?: ReactNode; action?: ReactNode }) {
  return <header className="flex flex-wrap items-center gap-3 px-3">
    {media}
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2"><h1 className="min-w-0 break-words text-xl font-semibold tracking-tight">{title}</h1>{badge}</div>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
    {action && <div className="ml-auto max-w-full shrink-0">{action}</div>}
  </header>;
}

// ItemGroup has no surface variant; this boundary clips square row states to the group's outer corners.
export function SettingsGroup({ title, label = title, count, description, action, children }: {
  title?: string; label?: string; count?: number; description?: string; action?: ReactNode; children: ReactNode;
}) {
  return <section role="group" aria-label={label} className="flex min-w-0 flex-col gap-2">
    {title && <Item size="sm">
      <ItemContent className="min-w-0">
        <ItemTitle><h2 className="flex items-center gap-2">{title}{count !== undefined && <span className="font-normal text-muted-foreground">{count}</span>}</h2></ItemTitle>
        {description && <ItemDescription>{description}</ItemDescription>}
      </ItemContent>
      {action && <ItemActions>{action}</ItemActions>}
    </Item>}
    <div className="min-w-0 overflow-hidden rounded-md border">{children}</div>
  </section>;
}

export function SettingsDivider() {
  return <div className="px-4"><Separator /></div>;
}

// Keep each field's validation with its row while sharing the form's responsive container.
export function SettingsFields({ children }: { children: ReactNode }) {
  const rows = Children.toArray(children);
  return <FieldGroup className="gap-0">{rows.map((row, i) => <div key={i}>
    {i > 0 && <SettingsDivider />}
    <div className="p-4">{row}</div>
  </div>)}</FieldGroup>;
}

export function SettingsField({ id, label, description, error, children }: {
  id: string; label: string; description?: ReactNode; error?: string; children: ReactNode;
}) {
  return <Field orientation="responsive" data-invalid={error ? true : undefined}>
    <FieldContent><FieldLabel htmlFor={id}>{label}</FieldLabel>
      {description && <FieldDescription>{description}</FieldDescription>}
      {error && <FieldError><span data-selectable>{error}</span></FieldError>}
    </FieldContent>
    <div className="min-w-0 @md/field-group:w-64 @md/field-group:min-w-64 @md/field-group:max-w-64">{children}</div>
  </Field>;
}

// A thing in a list: its picture, name, badges, a line under it; a control of its own (a repository's account); open:
// a row going to its page (a chevron at its end).
export interface Thing {
  key: string; name: string; media: ReactNode; badges?: ReactNode; description?: string; data?: Record<string, string>; control?: ReactNode;
  open?: () => void; details?: ReactNode;
}

// Things as rows, each one's actions behind its ⋯ and on its right-click. data-row, data-key, aria-label: the tests'
// handles (docs/testing.md).
// empty: said instead of the rows (a line, or work under way).
export function Things({ label, things, menu, empty, menuDisabled }: { label: string; things: Thing[]; menu: (key: string) => MenuItem[]; empty?: ReactNode; menuDisabled?: boolean }) {
  if (!things.length) return typeof empty === 'string' ? <p className="p-4 text-sm text-muted-foreground">{empty}</p> : empty ?? null;
  return <RightClickMenu items={(e) => { const k = (e.target as Element).closest<HTMLElement>('[data-row]')?.dataset.key; return k && !menuDisabled ? menu(k) : null; }}>
    <ItemGroup aria-label={label} className="has-data-[slot=item-separator]:gap-0">
      {things.map((t, i) => {
        const keys = t.open && ((e: KeyboardEvent) => { if (e.key === 'Enter' && e.target === e.currentTarget) t.open!(); });
        // title: what a cut line leaves out, whole
        return <div key={t.key} role="listitem" data-row="" data-key={t.key} aria-label={t.name} title={[t.name, t.description].filter(Boolean).join('\n')}
          tabIndex={t.open ? 0 : undefined} onClick={t.open} onKeyDown={keys}
          className={t.open ? 'outline-none hover:bg-muted focus-visible:bg-muted' : undefined} {...t.data}>
          <Item size="sm">
            <ItemMedia>{t.media}</ItemMedia>
            <ItemContent className="min-w-0">
              <ItemTitle className="max-w-full"><span className="truncate">{t.name}</span>{t.badges}</ItemTitle>
              {t.description && <ItemDescription>{t.description}</ItemDescription>}
            </ItemContent>
            <ItemActions className="max-w-full" onClick={(e) => e.stopPropagation()}>
              {t.control}
              <ButtonMenu end items={() => menu(t.key)}>
                <Button variant="ghost" size="icon-sm" disabled={menuDisabled} aria-label={`More for ${t.name}`}><EllipsisIcon /></Button>
              </ButtonMenu>
            </ItemActions>
            {t.open && <ChevronRightIcon className="size-4 text-muted-foreground" />}
          </Item>
          {t.details && <div className="px-3 pb-4">{t.details}</div>}
          {i < things.length - 1 && <div className="px-4"><ItemSeparator className="my-0" /></div>}
        </div>;
      })}
    </ItemGroup>
  </RightClickMenu>;
}

// What is added in place under a list (a name, an address): Enter takes it, Esc puts it away (not Settings); the
// refusal at its field.
export function AddInPlace({ label, description, placeholder, value, onChange, go, stop, ok, busy, error, name, type }: { label: string; description?: ReactNode;
  placeholder: string; value: string; onChange: (v: string) => void; go: () => void; stop: () => void; ok: string; busy?: boolean; error?: string; name?: boolean;
  type?: 'password' }) {
  const id = useId();
  return <Field data-invalid={error ? true : undefined}>
    <FieldLabel htmlFor={id}>{label}</FieldLabel>
    <div className="flex flex-wrap items-center gap-2">
      <Input id={id} aria-invalid={error ? true : undefined} className="min-w-0 flex-1 basis-full @sm/settings:basis-auto" autoFocus type={type} data-name={name || undefined} value={value} placeholder={placeholder} spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !busy) go(); if (e.key === 'Escape') { e.stopPropagation(); stop(); } }} />
      <Button variant="outline" onClick={stop}>Cancel</Button>
      <Button onClick={go} disabled={busy}>{busy && <Spinner data-icon="inline-start" />}{ok}</Button>
    </div>
    {description && <FieldDescription>{description}</FieldDescription>}
    {error && <FieldError><span data-selectable>{error}</span></FieldError>}
  </Field>;
}
