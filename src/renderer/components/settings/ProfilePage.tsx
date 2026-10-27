// A profile's page in Settings (docs/profiles.md): who it is, its test user, its sign-ins; each field saved on Enter or
// leaving it; Sign In… opens its master's window. Its picture: a panel of them beside it.
import { useState, type KeyboardEvent, type ReactElement } from 'react';
import { Avatar, Button, Field, ImageSwatch, Input, MenuButton, Popover, PopoverSurface, PopoverTrigger, SwatchPicker, Textarea,
  makeStyles, renderSwatchPickerGrid, tokens } from '@fluentui/react-components';
import { FolderRegular, GlobeRegular, InfoRegular, PasswordRegular, PersonRegular, RenameRegular } from '@fluentui/react-icons';
import { Row, Section } from './Row';
import { avatarSrc } from '../../lib/common';
import { AVATARS } from '../../../shared/avatars';
import { refused, type Result } from '../../../shared/result';
import type { SettingsProfile } from '../../../shared/types';
import { useCommonStyles } from '../theme';

type Fields = 'picture' | 'name' | 'about' | 'login' | 'password' | 'signins';

const useStyles = makeStyles({
  page: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXS },
  field: { width: '300px' },
});

export function ProfilePage({ profile: p, onChanged }: { profile: SettingsProfile; onChanged: (r: { profiles: SettingsProfile[]; id?: string }) => void }) {
  const [name, setName] = useState(p.name), [about, setAbout] = useState(p.description), [login, setLogin] = useState(p.login);
  const [password, setPassword] = useState(''), [picking, setPicking] = useState(false), styles = useStyles(), common = useCommonStyles();
  // The main process's refusal, at the field that was changed (docs/ui.md, Dialogs).
  const [error, setError] = useState<{ field: Fields; text: string } | null>(null);
  async function change(field: Fields, answer: Promise<Result<{ profiles: SettingsProfile[]; id: string }>>) {
    const r = await answer;
    setError(refused(r) ? { field, text: r.error } : null);
    if (!refused(r)) onChanged(r);
    return !refused(r);
  }
  const at = (field: Fields) => (error?.field === field ? { children: error.text, className: common.selectable } : undefined);
  const rename = () => { if (name.trim() !== p.name) void change('name', kulisa.invoke('profiles:rename', { profile: p.id, name })); };
  const describe = () => { if (about.trim() !== p.description) void change('about', kulisa.invoke('profiles:describe', { profile: p.id, description: about })); };
  const saveLogin = () => { if (login.trim() !== p.login) void change('login', kulisa.invoke('profiles:login', { profile: p.id, user: login })); };
  const savePassword = async () => { if (password && await change('password', kulisa.invoke('profiles:login', { profile: p.id, user: login, password }))) setPassword(''); };
  const signIn = async () => {
    const e = (await kulisa.invoke('profiles:master', { profile: p.id }))?.error;
    setError(e ? { field: 'signins', text: e } : null);
  };
  const enter = (go: () => void) => (e: KeyboardEvent) => { if (e.key === 'Enter') go(); };

  // A control at a row's end, the main process's refusal under it; a text field of one width.
  const field = (f: Fields, control: ReactElement, text = true) => <Field validationMessage={at(f)} className={text ? styles.field : undefined}>{control}</Field>;

  return <div className={styles.page}>
    <Row image={<Avatar size={32} image={{ src: avatarSrc(p.avatar) }} />} title="Picture" action={field('picture',
      <Popover open={picking} onOpenChange={(_, d) => setPicking(d.open)} positioning="below-end" trapFocus>
        <PopoverTrigger disableButtonEnhancement>
          <MenuButton aria-label="Picture"><Avatar size={20} image={{ src: avatarSrc(p.avatar) }} /></MenuButton>
        </PopoverTrigger>
        <PopoverSurface aria-label="Pictures">
          <SwatchPicker layout="grid" shape="circular" aria-label="Pictures" selectedValue={p.avatar}
            onSelectionChange={async (_, d) => { setPicking(false); await change('picture', kulisa.invoke('profiles:avatar', { profile: p.id, avatar: d.selectedValue })); }}>
            {renderSwatchPickerGrid({ columnCount: 8, items: AVATARS.map((a) => ({ value: a, src: avatarSrc(a), 'aria-label': a })),
              renderSwatch: (s) => <ImageSwatch key={s.value} {...(s as { value: string; src: string })} /> })}
          </SwatchPicker>
        </PopoverSurface>
      </Popover>, false)} />
    <Row image={<RenameRegular />} title="Name" action={field('name',
      <Input value={name} aria-label="Name" data-name maxLength={64} spellCheck={false} onChange={(_, d) => setName(d.value)} onBlur={rename} onKeyDown={enter(rename)} />)} />
    <Row image={<InfoRegular />} title="About" description="The agent reads it to choose the profile for a task, and asks you when it is empty" action={field('about',
      <Textarea value={about} aria-label="About" rows={2} resize="vertical" maxLength={500} placeholder="e.g. seller in the Acme shop; can approve refunds"
        onChange={(_, d) => setAbout(d.value)} onBlur={describe} />)} />

    <Section title="Test user">
      <Row image={<PersonRegular />} title="Test login" description="A test user of your local app (optional)" action={field('login',
        <Input value={login} aria-label="Test login" maxLength={200} spellCheck={false} autoComplete="off" placeholder="e.g. seller@shop.test"
          onChange={(_, d) => setLogin(d.value)} onBlur={saveLogin} onKeyDown={enter(saveLogin)} />)} />
      <Row image={<PasswordRegular />} title="Test password" description="Kulisa types it itself, on local addresses only; the agent never sees it" action={field('password',
        <Input type="password" aria-label="Test password" value={password} maxLength={500} autoComplete="new-password" disabled={!p.login}
          placeholder={p.hasPassword ? 'Kept (type to change it)' : 'Test password'} onChange={(_, d) => setPassword(d.value)} onBlur={savePassword} onKeyDown={enter(() => void savePassword())} />)} />
    </Section>

    <Section title="Sign-ins">
      <Row image={<GlobeRegular />} title="Its sites" description="Signed in to in a window of its own, once for every task of its projects"
        action={field('signins', <Button onClick={() => void signIn()}>Sign In…</Button>, false)} />
      <Row image={<FolderRegular />} title="Projects" description={p.projects.join(', ') || 'None: add it on a project\'s page'} />
    </Section>
  </div>;
}
