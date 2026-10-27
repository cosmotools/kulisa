// A profile's page in Settings (docs/profiles.md): who it is, its test user, its sign-ins; each field saved on Enter or
// leaving it; Sign In… opens its master's window. Its picture: a grid of them in a popover beside it.
import { useState, type KeyboardEvent } from 'react';
import { Button, Card, CardContent, FieldGroup, Field, FieldContent, FieldDescription, FieldLabel, Input, Popover, PopoverContent, PopoverTrigger, Textarea } from '@ui';
import { ErrorBar } from '../ErrorBar';
import { Section, Setting } from './kit';
import { avatarSrc } from '../../lib/common';
import { AVATARS } from '../../../shared/avatars';
import { refused, type Result } from '../../../shared/result';
import type { SettingsProfile } from '../../../shared/types';

type Part = 'picture' | 'name' | 'about' | 'login' | 'password' | 'signins';
const COLUMNS = 8;

export function ProfilePage({ profile: p, onChanged }: { profile: SettingsProfile; onChanged: (r: { profiles: SettingsProfile[]; id?: string }) => void }) {
  const [name, setName] = useState(p.name), [about, setAbout] = useState(p.description), [login, setLogin] = useState(p.login);
  const [password, setPassword] = useState(''), [picking, setPicking] = useState(false);
  // The main process's refusal, at the field that was changed.
  const [error, setError] = useState<{ field: Part; text: string } | null>(null);
  async function change(field: Part, answer: Promise<Result<{ profiles: SettingsProfile[]; id: string }>>) {
    const r = await answer;
    setError(refused(r) ? { field, text: r.error } : null);
    if (!refused(r)) onChanged(r);
    return !refused(r);
  }
  const at = (field: Part) => (error?.field === field ? error.text : undefined);
  const rename = () => { if (name.trim() !== p.name) void change('name', kulisa.invoke('profiles:rename', { profile: p.id, name })); };
  const describe = () => { if (about.trim() !== p.description) void change('about', kulisa.invoke('profiles:describe', { profile: p.id, description: about })); };
  const saveLogin = () => { if (login.trim() !== p.login) void change('login', kulisa.invoke('profiles:login', { profile: p.id, user: login })); };
  const savePassword = async () => { if (password && await change('password', kulisa.invoke('profiles:login', { profile: p.id, user: login, password }))) setPassword(''); };
  const signIn = async () => {
    const e = (await kulisa.invoke('profiles:master', { profile: p.id }))?.error;
    setError(e ? { field: 'signins', text: e } : null);
  };
  const choose = async (avatar: string) => { setPicking(false); await change('picture', kulisa.invoke('profiles:avatar', { profile: p.id, avatar })); };
  const enter = (go: () => void) => (e: KeyboardEvent) => { if (e.key === 'Enter') go(); };
  const refusal = (field: Part) => at(field) && <ErrorBar>{at(field)}</ErrorBar>;
  const rows = Array.from({ length: Math.ceil(AVATARS.length / COLUMNS) }, (_, i) => AVATARS.slice(i * COLUMNS, (i + 1) * COLUMNS));

  return <>
    <Card><CardContent><FieldGroup>
      <Field orientation="horizontal">
        <FieldLabel>Picture</FieldLabel>
        <Popover open={picking} onOpenChange={setPicking}>
          {/* named for it and showing it: the tests' handle (its name and its img) */}
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon-lg" aria-label="Picture"><img src={avatarSrc(p.avatar)} alt="" className="size-6" /></Button>
          </PopoverTrigger>
          <PopoverContent align="end" aria-label="Pictures" className="w-auto">
            <div role="grid" aria-label="Pictures" className="flex flex-col gap-1">
              {rows.map((row, i) => <div key={i} role="row" className="flex gap-1">
                {row.map((a) => <div key={a} role="gridcell" aria-label={a} aria-selected={a === p.avatar}>
                  <Button variant={a === p.avatar ? 'secondary' : 'ghost'} size="icon-lg" aria-label={a} onClick={() => void choose(a)}>
                    <img src={avatarSrc(a)} alt="" className="size-6" /></Button>
                </div>)}
              </div>)}
            </div>
          </PopoverContent>
        </Popover>
      </Field>
      {refusal('picture')}
      <Setting label="Name" error={at('name')}>{(c) =>
        <Input {...c} value={name} data-name maxLength={64} spellCheck={false} onChange={(e) => setName(e.target.value)} onBlur={rename} onKeyDown={enter(rename)} />}
      </Setting>
      <Setting label="About" description="The agent reads it to choose the profile for a task, and asks you when it is empty" error={at('about')}>{(c) =>
        <Textarea {...c} value={about} rows={2} maxLength={500} placeholder="e.g. seller in the Acme shop; can approve refunds"
          onChange={(e) => setAbout(e.target.value)} onBlur={describe} />}
      </Setting>
    </FieldGroup></CardContent></Card>

    <Section title="Test user">
      <Setting label="Test login" description="A test user of your local app (optional)" error={at('login')}>{(c) =>
        <Input {...c} value={login} maxLength={200} spellCheck={false} autoComplete="off" placeholder="e.g. seller@shop.test"
          onChange={(e) => setLogin(e.target.value)} onBlur={saveLogin} onKeyDown={enter(saveLogin)} />}
      </Setting>
      <Setting label="Test password" description="Kulisa types it itself, on local addresses only; the agent never sees it" error={at('password')}>{(c) =>
        <Input {...c} type="password" value={password} maxLength={500} autoComplete="new-password" disabled={!p.login}
          placeholder={p.hasPassword ? 'Kept (type to change it)' : 'Test password'} onChange={(e) => setPassword(e.target.value)} onBlur={savePassword}
          onKeyDown={enter(() => void savePassword())} />}
      </Setting>
    </Section>

    <Section title="Sign-ins">
      <Field orientation="horizontal">
        <FieldContent><FieldLabel>Its sites</FieldLabel><FieldDescription>Signed in to in a window of its own, once for every task of its projects</FieldDescription></FieldContent>
        <Button variant="outline" onClick={() => void signIn()}>Sign In…</Button>
      </Field>
      {refusal('signins')}
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">Projects</span>
        <span className="text-muted-foreground">{p.projects.join(', ') || 'None: add it on a project\'s page'}</span>
      </div>
    </Section>
  </>;
}
