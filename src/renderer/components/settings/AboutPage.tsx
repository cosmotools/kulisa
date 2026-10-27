// The About page of Settings (docs/window.md, Menus, About Kulisa): the versions, and the folders Kulisa writes in,
// each shown in the file manager. Asked again each time it is shown.
import { useEffect, useState } from 'react';
import { Button, Field, Input, Link, makeStyles, Text, tokens, Tooltip } from '@fluentui/react-components';
import { FolderOpenRegular } from '@fluentui/react-icons';
import type { AboutFolder, AboutInfo } from '../../../shared/types';

const FOLDERS: Record<AboutFolder, { label: string; hint: string }> = {
  data: { label: 'Data', hint: 'Profiles with their sign-ins, agents\' accounts, projects\' tasks, settings, the log.' },
  projects: { label: 'Projects', hint: 'New projects, and the copies of the code of tasks of a project of several repositories.' },
  program: { label: 'Program', hint: 'The program as installed, or the checkout it runs from. Uninstalling removes it; the folders above stay.' },
};

const useStyles = makeStyles({
  page: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalL },
  // a flex item's heading keeps its own margins: the gap spaces them
  heading: { margin: 0 },
});

export function AboutPage() {
  const styles = useStyles();
  const [info, setInfo] = useState<AboutInfo | null>(null);
  useEffect(() => { void kulisa.invoke('about:get').then(setInfo); }, []);
  if (!info) return null;
  return <div className={styles.page}>
    <div>
      <div><Text as="h1" size={500}><Text size={500} weight="semibold">Kulisa</Text> {info.version}</Text></div>
      <div><Text size={200}>Electron {info.electron} · Chromium {info.chrome}</Text></div>
      <div><Text size={200}><Link href="https://kulisa.app">kulisa.app</Link> · GPL-3.0-or-later</Text></div>
    </div>
    <Text as="h2" weight="semibold" className={styles.heading}>Where Kulisa keeps things</Text>
    {info.folders.map((f) => <Field key={f.id} data-folder={f.id} label={FOLDERS[f.id].label} hint={FOLDERS[f.id].hint}>
      {/* a folder not made yet: disabled, as its button */}
      <Input readOnly disabled={!f.exists} value={f.path}
        contentAfter={<Tooltip content={f.exists ? 'Show in your file manager' : 'Not made yet'} relationship="label">
          <Button appearance="transparent" size="small" icon={<FolderOpenRegular />} disabled={!f.exists} onClick={() => void kulisa.invoke('about:show-folder', f.id)} />
        </Tooltip>} />
    </Field>)}
  </div>;
}
