// The About page of Settings (docs/window.md, Menus, About Kulisa): the versions, and the folders Kulisa writes in,
// each shown in the file manager. Asked again each time it is shown.
import { useEffect, useState } from 'react';
import { Button, Caption1, Card, CardHeader, Field, Input, Link, Subtitle2, Text, Title3, tokens, Tooltip } from '@fluentui/react-components';
import { FolderOpenRegular } from '@fluentui/react-icons';
import { Logo } from '../ProjectIcon';
import type { AboutFolder, AboutInfo } from '../../../shared/types';

const FOLDERS: Record<AboutFolder, { label: string; hint: string }> = {
  data: { label: 'Data', hint: 'Profiles with their sign-ins, agents\' accounts, projects\' tasks, settings, the log' },
  projects: { label: 'Projects', hint: 'New projects, and the copies of the code of tasks of a project of several repositories' },
  program: { label: 'Program', hint: 'The program as installed, or the checkout it runs from. Uninstalling removes it; the folders above stay' },
};

// The app icon's curtain (assets/icon.svg), in Fluent's palette.
const CURTAIN = tokens.colorPaletteRedBackground3;

export function AboutPage() {
  const [info, setInfo] = useState<AboutInfo | null>(null);
  useEffect(() => { void kulisa.invoke('about:get').then(setInfo); }, []);
  if (!info) return null;
  return <Card appearance="subtle">
    <Card>
      <CardHeader image={<Logo color={CURTAIN} size={48} />} header={<Title3 role="heading" aria-level={1}>Kulisa <Text size={500}>{info.version}</Text></Title3>}
        description={<Caption1>Electron {info.electron} · Chromium {info.chrome} · <Link href="https://kulisa.app">kulisa.app</Link> · GPL-3.0-or-later</Caption1>} />
    </Card>
    <Card role="group" aria-label="Where Kulisa keeps things">
      <CardHeader header={<Subtitle2>Where Kulisa keeps things</Subtitle2>} />
      {/* data-folder: the tests' handle on a folder */}
      {info.folders.map((f) => <Field key={f.id} data-folder={f.id} label={FOLDERS[f.id].label} hint={FOLDERS[f.id].hint}>
        {/* a folder not made yet: disabled, as its button */}
        <Input readOnly disabled={!f.exists} value={f.path} title={f.path}
          contentAfter={<Tooltip content={f.exists ? 'Show in your file manager' : 'Not made yet'} relationship="label">
            <Button appearance="transparent" size="small" icon={<FolderOpenRegular />} disabled={!f.exists} onClick={() => void kulisa.invoke('about:show-folder', f.id)} />
          </Tooltip>} />
      </Field>)}
    </Card>
  </Card>;
}
