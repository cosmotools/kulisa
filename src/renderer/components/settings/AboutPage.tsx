// The About page of Settings (docs/window.md, Menus, About Kulisa). Asked again each time it is shown.
import { useEffect, useState } from 'react';
import { FolderOpenIcon } from 'lucide-react';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@ui';
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
    <Item variant="outline">
      <ItemMedia><Logo color={CURTAIN} size={48} /></ItemMedia>
      <ItemContent>
        <ItemTitle role="heading" aria-level={1}>Kulisa {info.version}</ItemTitle>
        <ItemDescription>Electron {info.electron} · Chromium {info.chrome} · <a href="https://kulisa.app" target="_blank" rel="noreferrer">kulisa.app</a> · GPL-3.0-or-later</ItemDescription>
      </ItemContent>
    </Item>
    <Section title="Where Kulisa keeps things">
      {/* data-folder: the tests' handle on a folder. One not made yet is disabled, its button too: a disabled button
          gets no tooltip, so its description says it. */}
      {info.folders.map((f) => { const show = f.exists ? 'Show in your file manager' : 'Not made yet';
        const button = <InputGroupButton size="icon-xs" aria-label={show} disabled={!f.exists} onClick={() => void kulisa.invoke('about:show-folder', f.id)}><FolderOpenIcon /></InputGroupButton>;
        return <Setting key={f.id} data-folder={f.id} label={FOLDERS[f.id].label} description={f.exists ? FOLDERS[f.id].hint : `${FOLDERS[f.id].hint}. Not made yet.`}>{(c) =>
          <InputGroup>
            <InputGroupInput {...c} readOnly disabled={!f.exists} value={f.path} title={f.path} />
            <InputGroupAddon align="inline-end">{f.exists ? <Tip text={show}>{button}</Tip> : button}</InputGroupAddon>
          </InputGroup>}
        </Setting>; })}
    </Section>
  </>;
}
