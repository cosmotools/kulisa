// A profile's page in Settings (docs/profiles.md): each field saved on Enter or leaving it.
import { useState, type KeyboardEvent } from 'react';
import { Button, Card, CardContent, FieldGroup, Field, FieldContent, FieldDescription, FieldLabel, Input, Popover, PopoverContent, PopoverTrigger, Textarea,
  ToggleGroup, ToggleGroupItem } from '@ui';
import { ErrorBar } from '../ErrorBar';
import { Fact, Section, Setting } from './kit';
import { avatarSrc } from '../../lib/common';
import { AVATARS } from '../../../shared/avatars';
import { refused, type Result } from '../../../shared/result';
import type { SettingsProfile } from '../../../shared/types';

type Part = 'picture' | 'name' | 'about' | 'login' | 'password' | 'signins';
type Text = 'name' | 'about' | 'login';
type Answer = Promise<Result<{ profiles: SettingsProfile[]; id: string }>>;

export function ProfilePage({ profile: p, onChanged }: { profile: SettingsProfile; onChanged: (r: { profiles: SettingsProfile[]; id?: string }) => void }) {
  // What is typed in a field until it is saved; else the field shows the profile as it is now (saved here, or changed
  // elsewhere).
  const [typed, setTyped] = useState<Partial<Record<Text, string>>>({});
  const saved = (f: Text) => (f === 'about' ? p.description : p[f]);
  const value = (f: Text) => typed[f] ?? saved(f);
  const type = (f: Text) => (e: { target: { value: string } }) => setTyped((t) => ({ ...t, [f]: e.target.value }));
  const [password, setPassword] = useState(''), [picking, setPicking] = useState(false);
  // The main process's refusal, at the field that was changed.
  const [error, setError] = useState<{ field: Part; text: string } | null>(null);
  async function change(field: Part, answer: Answer) {
    const r = await answer;
    setError(refused(r) ? { field, text: r.error } : null);
    if (!refused(r)) onChanged(r);
    return !refused(r);
  }
  // A field saved: what was typed goes once the profile has it (not what was typed since); refused, it stays.
  async function save(f: Text, answer: (v: string) => Answer) {
    const v = typed[f];
    if (v === undefined) return;
    if (v.trim() === saved(f) || await change(f, answer(v))) setTyped(({ [f]: now, ...t }) => (now === v ? t : { ...t, [f]: now }));
  }
  const at = (field: Part) => (error?.field === field ? error.text : undefined);
  const rename = () => void save('name', (name) => kulisa.invoke('profiles:rename', { profile: p.id, name }));
  const describe = () => void save('about', (description) => kulisa.invoke('profiles:describe', { profile: p.id, description }));
  const saveLogin = () => void save('login', (user) => kulisa.invoke('profiles:login', { profile: p.id, user }));
  const savePassword = async () => { if (password && await change('password', kulisa.invoke('profiles:login', { profile: p.id, user: value('login'), password }))) setPassword(''); };
  const signIn = async () => {
    const e = (await kulisa.invoke('profiles:master', { profile: p.id }))?.error;
    setError(e ? { field: 'signins', text: e } : null);
  };
  const choose = async (avatar: string) => { setPicking(false); await change('picture', kulisa.invoke('profiles:avatar', { profile: p.id, avatar })); };
  const enter = (go: () => void) => (e: KeyboardEvent) => { if (e.key === 'Enter') go(); };
  const refusal = (field: Part) => at(field) && <ErrorBar>{at(field)}</ErrorBar>;

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
            {/* in rows: our box inside the group, as a class on it would be a look of our own */}
            <ToggleGroup type="single" size="lg" aria-label="Pictures" value={p.avatar} onValueChange={(a) => { if (a) void choose(a); }}>
              <div className="grid grid-cols-8 gap-1">
                {AVATARS.map((a) => <ToggleGroupItem key={a} value={a} aria-label={a}><img src={avatarSrc(a)} alt="" className="size-6" /></ToggleGroupItem>)}
              </div>
            </ToggleGroup>
          </PopoverContent>
        </Popover>
      </Field>
      {refusal('picture')}
      <Setting label="Name" error={at('name')}>{(c) =>
        <Input {...c} value={value('name')} data-name maxLength={64} spellCheck={false} onChange={type('name')} onBlur={rename} onKeyDown={enter(rename)} />}
      </Setting>
      <Setting label="About" description="The agent reads it to choose the profile for a task, and asks you when it is empty" error={at('about')}>{(c) =>
        <Textarea {...c} value={value('about')} rows={2} maxLength={500} placeholder="e.g. seller in the Acme shop; can approve refunds"
          onChange={type('about')} onBlur={describe} />}
      </Setting>
    </FieldGroup></CardContent></Card>

    <Section title="Test user">
      <Setting label="Test login" description="A test user of your local app (optional)" error={at('login')}>{(c) =>
        <Input {...c} value={value('login')} maxLength={200} spellCheck={false} autoComplete="off" placeholder="e.g. seller@shop.test"
          onChange={type('login')} onBlur={saveLogin} onKeyDown={enter(saveLogin)} />}
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
      <Fact label="Projects">{p.projects.join(', ') || 'None: add it on a project\'s page'}</Fact>
    </Section>
  </>;
}
