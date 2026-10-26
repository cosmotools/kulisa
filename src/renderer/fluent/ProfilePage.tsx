// A profile's page in Settings (docs/profiles.md): who it is, each field saved on Enter or leaving it; Sign In… opens its
// master's window. Its picture: a panel of them beside it.
import { useState, type KeyboardEvent } from 'react';
import { Avatar, Button, Field, Input, Popover, PopoverSurface, PopoverTrigger, Text, Textarea, ToggleButton } from '@fluentui/react-components';
import { ChevronDownIcon } from 'lucide-react';
import { avatarSrc } from './avatar';
import { AVATARS } from '../../shared/avatars';
import { refused, type Result } from '../../shared/result';
import type { SettingsProfile } from '../../shared/types';

export function ProfilePage({ profile: p, onChanged }: { profile: SettingsProfile; onChanged: (r: { profiles: SettingsProfile[]; id?: string }) => void }) {
  const [name, setName] = useState(p.name), [about, setAbout] = useState(p.description), [login, setLogin] = useState(p.login);
  const [password, setPassword] = useState(''), [error, setError] = useState(''), [picking, setPicking] = useState(false);
  async function change(answer: Promise<Result<{ profiles: SettingsProfile[]; id: string }>>) {
    const r = await answer;
    setError(refused(r) ? r.error : '');
    if (!refused(r)) onChanged(r);
    return !refused(r);
  }
  const rename = () => { if (name.trim() !== p.name) void change(kulisa.invoke('profiles:rename', { profile: p.id, name })); };
  const describe = () => { if (about.trim() !== p.description) void change(kulisa.invoke('profiles:describe', { profile: p.id, description: about })); };
  const saveLogin = () => { if (login.trim() !== p.login) void change(kulisa.invoke('profiles:login', { profile: p.id, user: login })); };
  const savePassword = async () => { if (password && await change(kulisa.invoke('profiles:login', { profile: p.id, user: login, password }))) setPassword(''); };
  const enter = (go: () => void) => (e: KeyboardEvent) => { if (e.key === 'Enter') go(); };

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>
    <Field label="Picture">
      <Popover open={picking} onOpenChange={(_, d) => setPicking(d.open)} positioning="below-start" trapFocus>
        <PopoverTrigger disableButtonEnhancement>
          <Button style={{ width: 'fit-content' }} icon={<ChevronDownIcon />} iconPosition="after" aria-label="Picture"><Avatar size={20} image={{ src: avatarSrc(p.avatar) }} /></Button>
        </PopoverTrigger>
        <PopoverSurface aria-label="Pictures" style={{ display: 'grid', gridTemplateColumns: 'repeat(8, auto)', gap: 4, maxWidth: 340 }}>
          {AVATARS.map((a) => <ToggleButton key={a} appearance="subtle" size="small" checked={a === p.avatar} title={a} aria-label={a}
            icon={<Avatar size={20} image={{ src: avatarSrc(a) }} />}
            onClick={async () => { setPicking(false); await change(kulisa.invoke('profiles:avatar', { profile: p.id, avatar: a })); }} />)}
        </PopoverSurface>
      </Popover>
    </Field>
    <Field label="Name"><Input value={name} maxLength={64} spellCheck={false} onChange={(_, d) => setName(d.value)} onBlur={rename} onKeyDown={enter(rename)} /></Field>
    <Field label="About" hint="The agent reads this to choose the profile for a task, and asks you when it is empty.">
      <Textarea value={about} rows={2} maxLength={500} placeholder="e.g. seller in the Acme shop; can approve refunds" onChange={(_, d) => setAbout(d.value)} onBlur={describe} />
    </Field>
    <Field label="Test login"><Input value={login} maxLength={200} spellCheck={false} autoComplete="off" placeholder="A test user of your local app (optional)"
      onChange={(_, d) => setLogin(d.value)} onBlur={saveLogin} onKeyDown={enter(saveLogin)} /></Field>
    <Field label="Test password" hint="Kulisa types them itself, on local addresses only; the agent never sees the password.">
      <Input type="password" value={password} maxLength={500} autoComplete="new-password" disabled={!p.login}
        placeholder={p.hasPassword ? 'Kept (type to change it)' : 'Test password'} onChange={(_, d) => setPassword(d.value)} onBlur={savePassword} onKeyDown={enter(() => void savePassword())} />
    </Field>
    <Field label="Sign-ins" hint="In a window of its own, once for every task of its projects.">
      <Button style={{ width: 'fit-content' }} onClick={async () => setError((await kulisa.invoke('profiles:master', { profile: p.id }))?.error || '')}>Sign In…</Button>
    </Field>
    <Field label="Projects"><Text>{p.projects.join(', ') || 'none: add it on a project\'s page'}</Text></Field>
    {error && <Text style={{ color: 'var(--colorPaletteRedForeground1)' }}>{error}</Text>}
  </div>;
}
