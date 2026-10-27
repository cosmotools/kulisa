// A profile's page in Settings (docs/profiles.md): who it is, its test user, its sign-ins; each field saved on Enter or
// leaving it; Sign In… opens its master's window. Its picture: a panel of them beside it.
import { useState, type KeyboardEvent } from 'react';
import { Avatar, Button, Caption1, Card, CardHeader, Field, ImageSwatch, Input, MenuButton, Popover, PopoverSurface, PopoverTrigger, Subtitle2,
  SwatchPicker, Text, Textarea, renderSwatchPickerGrid } from '@fluentui/react-components';
import { ErrorBar } from '../ErrorBar';
import { avatarSrc } from '../../lib/common';
import { AVATARS } from '../../../shared/avatars';
import { refused, type Result } from '../../../shared/result';
import type { SettingsProfile } from '../../../shared/types';

type Setting = 'picture' | 'name' | 'about' | 'login' | 'password' | 'signins';

export function ProfilePage({ profile: p, onChanged }: { profile: SettingsProfile; onChanged: (r: { profiles: SettingsProfile[]; id?: string }) => void }) {
  const [name, setName] = useState(p.name), [about, setAbout] = useState(p.description), [login, setLogin] = useState(p.login);
  const [password, setPassword] = useState(''), [picking, setPicking] = useState(false);
  // The main process's refusal, at the field that was changed (docs/ui.md, Dialogs).
  const [error, setError] = useState<{ field: Setting; text: string } | null>(null);
  async function change(field: Setting, answer: Promise<Result<{ profiles: SettingsProfile[]; id: string }>>) {
    const r = await answer;
    setError(refused(r) ? { field, text: r.error } : null);
    if (!refused(r)) onChanged(r);
    return !refused(r);
  }
  const at = (field: Setting) => (error?.field === field ? error.text : undefined);
  const rename = () => { if (name.trim() !== p.name) void change('name', kulisa.invoke('profiles:rename', { profile: p.id, name })); };
  const describe = () => { if (about.trim() !== p.description) void change('about', kulisa.invoke('profiles:describe', { profile: p.id, description: about })); };
  const saveLogin = () => { if (login.trim() !== p.login) void change('login', kulisa.invoke('profiles:login', { profile: p.id, user: login })); };
  const savePassword = async () => { if (password && await change('password', kulisa.invoke('profiles:login', { profile: p.id, user: login, password }))) setPassword(''); };
  const signIn = async () => {
    const e = (await kulisa.invoke('profiles:master', { profile: p.id }))?.error;
    setError(e ? { field: 'signins', text: e } : null);
  };
  const enter = (go: () => void) => (e: KeyboardEvent) => { if (e.key === 'Enter') go(); };

  const refusal = (field: Setting) => at(field) && <ErrorBar>{at(field)}</ErrorBar>;

  return <Card appearance="subtle">
    <Card>
      {/* The button shows the picture and is named for it: the tests' handle (its name and its img). */}
      <CardHeader header={<Text weight="semibold">Picture</Text>}
        action={<Popover open={picking} onOpenChange={(_, d) => setPicking(d.open)} positioning="below-end" trapFocus>
          <PopoverTrigger disableButtonEnhancement>
            <MenuButton aria-label="Picture"><Avatar size={32} image={{ src: avatarSrc(p.avatar) }} /></MenuButton>
          </PopoverTrigger>
          <PopoverSurface aria-label="Pictures">
            <SwatchPicker layout="grid" shape="circular" aria-label="Pictures" selectedValue={p.avatar}
              onSelectionChange={async (_, d) => { setPicking(false); await change('picture', kulisa.invoke('profiles:avatar', { profile: p.id, avatar: d.selectedValue })); }}>
              {renderSwatchPickerGrid({ columnCount: 8, items: AVATARS.map((a) => ({ value: a, src: avatarSrc(a), 'aria-label': a })),
                renderSwatch: (s) => <ImageSwatch key={s.value} {...(s as { value: string; src: string })} /> })}
            </SwatchPicker>
          </PopoverSurface>
        </Popover>} />
      {refusal('picture')}
      <Field label="Name" validationMessage={at('name')}>
        <Input value={name} data-name maxLength={64} spellCheck={false} onChange={(_, d) => setName(d.value)} onBlur={rename} onKeyDown={enter(rename)} />
      </Field>
      <Field label="About" hint="The agent reads it to choose the profile for a task, and asks you when it is empty" validationMessage={at('about')}>
        <Textarea value={about} rows={2} resize="vertical" maxLength={500} placeholder="e.g. seller in the Acme shop; can approve refunds"
          onChange={(_, d) => setAbout(d.value)} onBlur={describe} />
      </Field>
    </Card>

    <Card role="group" aria-label="Test user">
      <CardHeader header={<Subtitle2>Test user</Subtitle2>} />
      <Field label="Test login" hint="A test user of your local app (optional)" validationMessage={at('login')}>
        <Input value={login} maxLength={200} spellCheck={false} autoComplete="off" placeholder="e.g. seller@shop.test"
          onChange={(_, d) => setLogin(d.value)} onBlur={saveLogin} onKeyDown={enter(saveLogin)} />
      </Field>
      <Field label="Test password" hint="Kulisa types it itself, on local addresses only; the agent never sees it" validationMessage={at('password')}>
        <Input type="password" value={password} maxLength={500} autoComplete="new-password" disabled={!p.login}
          placeholder={p.hasPassword ? 'Kept (type to change it)' : 'Test password'} onChange={(_, d) => setPassword(d.value)} onBlur={savePassword} onKeyDown={enter(() => void savePassword())} />
      </Field>
    </Card>

    <Card role="group" aria-label="Sign-ins">
      <CardHeader header={<Subtitle2>Sign-ins</Subtitle2>} />
      <CardHeader header={<Text weight="semibold">Its sites</Text>} description={<Caption1>Signed in to in a window of its own, once for every task of its projects</Caption1>}
        action={<Button onClick={() => void signIn()}>Sign In…</Button>} />
      {refusal('signins')}
      <Field label="Projects">
        <Text>{p.projects.join(', ') || 'None: add it on a project\'s page'}</Text>
      </Field>
    </Card>
  </Card>;
}
