// What Settings' pages are built of (docs/window.md, Settings): a list of things, what is added under it.
import { useId, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronRightIcon, EllipsisIcon } from 'lucide-react';
import { Button, Field, FieldDescription, FieldError, FieldLabel, Input, Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle,
  Spinner } from '@ui';
import { ButtonMenu, RightClickMenu } from '../Menus';
import type { MenuItem } from '../../lib/menu';

// A thing in a list: its picture, name, badges, a line under it; a control of its own (a repository's account); open:
// a row going to its page (a chevron at its end).
export interface Thing {
  key: string; name: string; media: ReactNode; badges?: ReactNode; description?: string; data?: Record<string, string>; control?: ReactNode;
  open?: () => void;
}

// Things as rows, each one's actions behind its ⋯ and on its right-click. data-row, data-key, aria-label: the tests'
// handles (docs/testing.md).
// empty: said instead of the rows (a line, or work under way).
export function Things({ label, things, menu, empty }: { label: string; things: Thing[]; menu: (key: string) => MenuItem[]; empty?: ReactNode }) {
  if (!things.length) return typeof empty === 'string' ? <p className="text-muted-foreground">{empty}</p> : empty ?? null;
  return <RightClickMenu items={(e) => { const k = (e.target as Element).closest<HTMLElement>('[data-row]')?.dataset.key; return k ? menu(k) : null; }}>
    <ItemGroup aria-label={label}>
      {things.map((t) => {
        const keys = t.open && ((e: KeyboardEvent) => { if (e.key === 'Enter' && e.target === e.currentTarget) t.open!(); });
        // title: what a cut line leaves out, whole
        return <div key={t.key} role="listitem" data-row="" data-key={t.key} aria-label={t.name} title={[t.name, t.description].filter(Boolean).join('\n')}
          tabIndex={t.open ? 0 : undefined} onClick={t.open} onKeyDown={keys}
          className={t.open ? 'rounded-lg outline-none hover:bg-muted focus-visible:bg-muted' : undefined} {...t.data}>
          <Item size="sm">
            <ItemMedia>{t.media}</ItemMedia>
            <ItemContent className="min-w-0">
              <ItemTitle className="max-w-full"><span className="truncate">{t.name}</span>{t.badges}</ItemTitle>
              {t.description && <ItemDescription>{t.description}</ItemDescription>}
            </ItemContent>
            <ItemActions onClick={(e) => e.stopPropagation()}>
              {t.control}
              <ButtonMenu end items={() => menu(t.key)}>
                <Button variant="ghost" size="icon-sm" aria-label={`More for ${t.name}`}><EllipsisIcon /></Button>
              </ButtonMenu>
            </ItemActions>
            {t.open && <ChevronRightIcon className="size-4 text-muted-foreground" />}
          </Item>
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
    <div className="flex items-center gap-2">
      <Input id={id} aria-invalid={error ? true : undefined} className="flex-1" autoFocus type={type} data-name={name || undefined} value={value} placeholder={placeholder} spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !busy) go(); if (e.key === 'Escape') { e.stopPropagation(); stop(); } }} />
      <Button variant="outline" onClick={stop}>Cancel</Button>
      <Button onClick={go} disabled={busy}>{busy && <Spinner data-icon="inline-start" />}{ok}</Button>
    </div>
    {description && <FieldDescription>{description}</FieldDescription>}
    {error && <FieldError><span data-selectable>{error}</span></FieldError>}
  </Field>;
}
