// The About page of Settings (docs/window.md, Menus, About Kulisa). Asked again each time it is shown.
import { useEffect } from 'react';
import { FolderOpenIcon } from 'lucide-react';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, Field, FieldDescription, FieldLabel, Spinner } from '@ui';
import { SettingsHeading, SettingsGroup, SettingsFields, SettingsLoading, SettingsError } from './kit';
import { Logo } from '../ProjectIcon';
import { useRead } from './read';
import { Tip } from '../Tip';
import type { AboutFolder, AboutInfo } from '../../../shared/types';

const FOLDERS: Record<AboutFolder, { label: string; hint: string }> = {
  data: { label: 'Data', hint: 'Profiles with their sign-ins, agents\' accounts, projects\' tasks, settings, the log' },
  projects: { label: 'Projects', hint: 'New projects, and the copies of the code of tasks of a project of several repositories' },
  program: { label: 'Program', hint: 'The program as installed, or the checkout it runs from. Uninstalling removes it; the folders above stay' },
};

// The app icon's curtain (assets/icon.svg), in the theme's red.
const CURTAIN = 'var(--destructive)';

export function AboutPage() {
  const [{ data: info, loading, error }, read] = useRead<AboutInfo>();
  useEffect(() => { void read(() => kulisa.invoke('about:get')); }, [read]);
  return <>
    <SettingsHeading title={info ? `Kulisa ${info.version}` : 'Kulisa'} media={<Logo color={CURTAIN} size={40} />}
      description={<>{info ? <>Electron {info.electron} · Chromium {info.chrome} · </> : !error && <span role="status" className="inline-flex items-center gap-2"><Spinner role={undefined} aria-hidden />Loading versions… </span>}
        <a className="underline underline-offset-4" href="https://kulisa.app" target="_blank" rel="noreferrer">kulisa.app</a> · GPL-3.0-or-later</>} />
    <SettingsError error={error} />
    <SettingsGroup title="Where Kulisa keeps things">
      {loading && <SettingsLoading>Loading folders…</SettingsLoading>}
      <SettingsFields>
      {/* data-folder: the tests' handle on a folder. One not made yet is disabled, its button too: a disabled button
          gets no tooltip, so its description says it. */}
      {(Object.keys(FOLDERS) as AboutFolder[]).map((id) => { const f = info?.folders.find((f) => f.id === id), exists = !!f?.exists;
        const show = exists ? 'Show in your file manager' : info ? 'Not made yet' : 'Loading…';
        const button = <InputGroupButton size="icon-xs" aria-label={show} disabled={!exists} onClick={() => void kulisa.invoke('about:show-folder', id)}><FolderOpenIcon /></InputGroupButton>;
        return <Field key={id} data-folder={id}>
          <FieldLabel htmlFor={`folder-${id}`}>{FOLDERS[id].label}</FieldLabel>
          <InputGroup>
            <InputGroupInput id={`folder-${id}`} readOnly disabled={!exists} value={f?.path ?? ''} placeholder="Loading…" title={f?.path} />
            <InputGroupAddon align="inline-end">{exists ? <Tip text={show}>{button}</Tip> : button}</InputGroupAddon>
          </InputGroup>
          <FieldDescription>{!info || exists ? FOLDERS[id].hint : `${FOLDERS[id].hint}. Not made yet.`}</FieldDescription>
        </Field>; })}
    </SettingsFields></SettingsGroup>
  </>;
}
