// The About page of Settings (docs/window.md, Menus, About Kulisa): the versions, and the folders Kulisa writes in,
// each shown in the file manager. Asked again each time it is shown.
import { useEffect, useState } from 'react';
import { Button, Caption1, Card, CardHeader, Input, Link, makeStyles, Text, tokens, Tooltip } from '@fluentui/react-components';
import { FolderOpenRegular, FolderRegular } from '@fluentui/react-icons';
import { Row, Section } from './Row';
import { Logo } from '../ProjectIcon';
import type { AboutFolder, AboutInfo } from '../../../shared/types';

const FOLDERS: Record<AboutFolder, { label: string; hint: string }> = {
  data: { label: 'Data', hint: 'Profiles with their sign-ins, agents\' accounts, projects\' tasks, settings, the log.' },
  projects: { label: 'Projects', hint: 'New projects, and the copies of the code of tasks of a project of several repositories.' },
  program: { label: 'Program', hint: 'The program as installed, or the checkout it runs from. Uninstalling removes it; the folders above stay.' },
};

// The app icon's curtain (assets/icon.svg), in Fluent's palette.
const CURTAIN = tokens.colorPaletteRedBackground3;

const useStyles = makeStyles({
  page: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXS },
  // a heading keeps its own margins
  heading: { margin: 0 },
  path: { width: '300px' },
});

export function AboutPage() {
  const styles = useStyles();
  const [info, setInfo] = useState<AboutInfo | null>(null);
  useEffect(() => { void kulisa.invoke('about:get').then(setInfo); }, []);
  if (!info) return null;
  return <div className={styles.page}>
    <Card appearance="filled">
      <CardHeader image={<Logo color={CURTAIN} size={48} />}
        header={<Text as="h1" size={500} className={styles.heading}><Text size={500} weight="semibold">Kulisa</Text> {info.version}</Text>}
        description={<div><div><Caption1>Electron {info.electron} · Chromium {info.chrome}</Caption1></div>
          <div><Caption1><Link href="https://kulisa.app">kulisa.app</Link> · GPL-3.0-or-later</Caption1></div></div>} />
    </Card>
    <Section title="Where Kulisa keeps things">
      {info.folders.map((f) => <Row key={f.id} image={<FolderRegular />} title={FOLDERS[f.id].label} description={FOLDERS[f.id].hint} data={{ 'data-folder': f.id }}
        // a folder not made yet: disabled, as its button
        action={<Input readOnly disabled={!f.exists} value={f.path} title={f.path} aria-label={FOLDERS[f.id].label} className={styles.path}
          contentAfter={<Tooltip content={f.exists ? 'Show in your file manager' : 'Not made yet'} relationship="label">
            <Button appearance="transparent" size="small" icon={<FolderOpenRegular />} disabled={!f.exists} onClick={() => void kulisa.invoke('about:show-folder', f.id)} />
          </Tooltip>} />} />)}
    </Section>
  </div>;
}
