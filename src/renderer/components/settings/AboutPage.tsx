// The About page of Settings (docs/window.md, Menus, About Kulisa): the versions, and the folders Kulisa writes in,
// each shown in the file manager. Asked again each time it is shown.
import { useEffect, useState } from 'react';
import { FolderOpenIcon } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle, InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@ui';
import { Logo } from '../ProjectIcon';
import { Tip } from '../Tip';
import { Section, Setting } from './kit';
import type { AboutFolder, AboutInfo } from '../../../shared/types';

const FOLDERS: Record<AboutFolder, { label: string; hint: string }> = {
  data: { label: 'Data', hint: 'Profiles with their sign-ins, agents\' accounts, projects\' tasks, settings, the log' },
  projects: { label: 'Projects', hint: 'New projects, and the copies of the code of tasks of a project of several repositories' },
  program: { label: 'Program', hint: 'The program as installed, or the checkout it runs from. Uninstalling removes it; the folders above stay' },
};

// The app icon's curtain (assets/icon.svg), in the theme's red.
const CURTAIN = 'var(--destructive)';

export function AboutPage() {
  const [info, setInfo] = useState<AboutInfo | null>(null);
  useEffect(() => { void kulisa.invoke('about:get').then(setInfo); }, []);
  if (!info) return null;
  return <>
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Logo color={CURTAIN} size={48} />
          <div className="flex flex-col gap-1">
            <CardTitle role="heading" aria-level={1}>Kulisa {info.version}</CardTitle>
            <CardDescription>Electron {info.electron} · Chromium {info.chrome} · <a href="https://kulisa.app" target="_blank" rel="noreferrer"
              className="underline underline-offset-4">kulisa.app</a> · GPL-3.0-or-later</CardDescription>
          </div>
        </div>
      </CardHeader>
    </Card>
    <Section title="Where Kulisa keeps things">
      {/* data-folder: the tests' handle on a folder; one not made yet disabled, as its button */}
      {info.folders.map((f) => { const show = f.exists ? 'Show in your file manager' : 'Not made yet';
        return <Setting key={f.id} data-folder={f.id} label={FOLDERS[f.id].label} description={FOLDERS[f.id].hint}>{(c) =>
          <InputGroup>
            <InputGroupInput {...c} readOnly disabled={!f.exists} value={f.path} title={f.path} />
            <InputGroupAddon align="inline-end">
              <Tip text={show}>
                <InputGroupButton size="icon-xs" aria-label={show} disabled={!f.exists} onClick={() => void kulisa.invoke('about:show-folder', f.id)}><FolderOpenIcon /></InputGroupButton>
              </Tip>
            </InputGroupAddon>
          </InputGroup>}
        </Setting>; })}
    </Section>
  </>;
}
