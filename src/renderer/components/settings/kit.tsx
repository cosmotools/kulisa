// What Settings' pages are built of (docs/window.md, Settings): a section, a list of things, a setting.
import { useId, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronRightIcon, EllipsisIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage, Button, Card, CardAction, CardContent, CardHeader, CardTitle, Field, FieldDescription, FieldError, FieldLabel, Input, Item, ItemActions, ItemContent,
  ItemDescription, ItemGroup, ItemMedia, ItemTitle, Spinner } from '@ui';
import { ButtonMenu, RightClickMenu, type Item as MenuItem } from '../Menus';
import { avatarSrc } from '../../lib/common';

// A section of a page: a Card named by its title (the tests' handle: a group by its name), its "Add …" at the title's end.
export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return <Card role="group" aria-label={title}>
    <CardHeader><CardTitle>{title}</CardTitle>{action && <CardAction>{action}</CardAction>}</CardHeader>
    <CardContent><div className="flex flex-col gap-3">{children}</div></CardContent>
  </Card>;
}

// A profile's picture in a list.
export const ProfileAvatar = ({ name, avatar }: { name: string; avatar: string }) =>
  <Avatar size="sm"><AvatarImage src={avatarSrc(avatar)} alt="" /><AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>;

// A thing in a list: its picture, name, badges, a line under it; a control of its own (a repository's account); open:
// a row going to its page (a chevron at its end).
export interface Thing {
  key: string; name: string; media: ReactNode; badges?: ReactNode; description?: string; data?: Record<string, string>; control?: ReactNode;
  open?: () => void;
}

// Things as rows, each one's actions behind its ⋯ and on its right-click. data-row, data-key, aria-label: the tests'
// handles (docs/testing.md).
export function Things({ label, things, menu, empty }: { label: string; things: Thing[]; menu: (key: string) => MenuItem[]; empty?: string }) {
  if (!things.length) return empty ? <p className="text-muted-foreground">{empty}</p> : null;
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

// A setting: its label, what it is for, the main process's refusal of it. children: its control, given its id and
// whether it is refused.
export function Setting({ label, description, error, children, ...rest }: { label: string; description?: ReactNode; error?: string;
  children: (control: { id: string; 'aria-invalid'?: true }) => ReactNode; 'data-folder'?: string }) {
  const id = useId();
  return <Field data-invalid={error ? true : undefined} {...rest}>
    <FieldLabel htmlFor={id}>{label}</FieldLabel>
    {children({ id, ...(error && { 'aria-invalid': true }) })}
    {description && <FieldDescription>{description}</FieldDescription>}
    {error && <FieldError><span data-selectable>{error}</span></FieldError>}
  </Field>;
}

// What is added in place under a list (a name, an address): Enter takes it, Esc puts it away (not Settings); the
// refusal at its field.
export function AddInPlace({ label, placeholder, value, onChange, go, stop, ok, busy, error, name }: { label: string; placeholder: string; value: string;
  onChange: (v: string) => void; go: () => void; stop: () => void; ok: string; busy?: boolean; error?: string; name?: boolean }) {
  return <Setting label={label} error={error}>{(c) =>
    <div className="flex items-center gap-2">
      <Input {...c} className="flex-1" autoFocus data-name={name || undefined} value={value} placeholder={placeholder} spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !busy) go(); if (e.key === 'Escape') { e.stopPropagation(); stop(); } }} />
      <Button variant="outline" onClick={stop}>Cancel</Button>
      <Button onClick={go} disabled={busy}>{busy && <Spinner data-icon="inline-start" />}{ok}</Button>
    </div>}
  </Setting>;
}
