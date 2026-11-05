// The About page of Settings (docs/window.md, Menus, About Kulisa). Asked again each time it is shown.
import { useEffect, useState } from 'react';
import { FolderOpenIcon } from 'lucide-react';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, Field, FieldDescription, FieldLabel, Spinner } from '@ui';
import { SettingsHeading, SettingsGroup, SettingsFields, SettingsLoading, SettingsError } from './kit';
import { Logo } from '../ProjectIcon';
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
  const [info, setInfo] = useState<AboutInfo | null>(null), [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    void kulisa.invoke('about:get').then((r) => { if (live) setInfo(r); }).catch((e: unknown) => { if (live) setError(String(e)); });
    return () => { live = false; };
  }, []);
  return <>
    <SettingsHeading title={info ? `Kulisa ${info.version}` : 'Kulisa'} media={<Logo color={CURTAIN} size={40} />}
      description={<>{info ? <>Electron {info.electron} · Chromium {info.chrome} · </> : !error && <span role="status" className="inline-flex items-center gap-2"><Spinner role={undefined} aria-hidden />Loading versions… </span>}
        <a className="underline underline-offset-4" href="https://kulisa.app" target="_blank" rel="noreferrer">kulisa.app</a> · GPL-3.0-or-later</>} />
    <SettingsError error={error} />
    {!info && <SettingsGroup title="Where Kulisa keeps things">
      {!error && <SettingsLoading>Loading folders…</SettingsLoading>}
      <SettingsFields>{Object.entries(FOLDERS).map(([id, f]) => <Field key={id}><FieldLabel>{f.label}</FieldLabel><FieldDescription>{f.hint}</FieldDescription></Field>)}</SettingsFields>
    </SettingsGroup>}
    {info &&
    <SettingsGroup title="Where Kulisa keeps things"><SettingsFields>
      {/* data-folder: the tests' handle on a folder. One not made yet is disabled, its button too: a disabled button
          gets no tooltip, so its description says it. */}
      {info.folders.map((f) => { const show = f.exists ? 'Show in your file manager' : 'Not made yet';
        const button = <InputGroupButton size="icon-xs" aria-label={show} disabled={!f.exists} onClick={() => void kulisa.invoke('about:show-folder', f.id)}><FolderOpenIcon /></InputGroupButton>;
        return <Field key={f.id} data-folder={f.id}>
          <FieldLabel htmlFor={`folder-${f.id}`}>{FOLDERS[f.id].label}</FieldLabel>
          <InputGroup>
            <InputGroupInput id={`folder-${f.id}`} readOnly disabled={!f.exists} value={f.path} title={f.path} />
            <InputGroupAddon align="inline-end">{f.exists ? <Tip text={show}>{button}</Tip> : button}</InputGroupAddon>
          </InputGroup>
          <FieldDescription>{f.exists ? FOLDERS[f.id].hint : `${FOLDERS[f.id].hint}. Not made yet.`}</FieldDescription>
        </Field>; })}
    </SettingsFields></SettingsGroup>}
  </>;
}
