// The About page of Settings (docs/window.md, Menus, About Kulisa): the versions, and the folders Kulisa writes in,
// each shown in the file manager. Asked again each time it is shown.
import { useEffect, useState } from 'react';
import { Button, Link, Text, Tooltip } from '@fluentui/react-components';
import { FolderOpenIcon } from 'lucide-react';
import type { AboutFolder, AboutInfo } from '../../shared/types';

const FOLDERS: Record<AboutFolder, { label: string; hint: string }> = {
  data: { label: 'Data', hint: 'Profiles with their sign-ins, agents\' accounts, projects\' tasks, settings, the log.' },
  projects: { label: 'Projects', hint: 'New projects, and the copies of the code of tasks of a project of several repositories.' },
  program: { label: 'Program', hint: 'The program as installed, or the checkout it runs from. Uninstalling removes it; the folders above stay.' },
};

export function AboutPage() {
  const [info, setInfo] = useState<AboutInfo | null>(null);
  useEffect(() => { void kulisa.invoke('about:get').then(setInfo); }, []);
  if (!info) return null;
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>
    <div>
      <Text size={500} weight="semibold">Kulisa </Text><Text size={500}>{info.version}</Text>
      <div><Text size={200}>Electron {info.electron} · Chromium {info.chrome}</Text></div>
      <div><Text size={200}><Link href="https://kulisa.app">kulisa.app</Link> · GPL-3.0-or-later</Text></div>
    </div>
    <Text weight="semibold">Where Kulisa keeps things</Text>
    {info.folders.map((f) => <div key={f.id} data-folder={f.id} style={{ display: 'grid', gridTemplateColumns: '88px 1fr auto', gap: 8, alignItems: 'center' }}>
      <Text size={200}>{FOLDERS[f.id].label}</Text>
      <Text style={{ userSelect: 'text', overflowWrap: 'anywhere', opacity: f.exists ? 1 : 0.6 }}>{f.path}</Text>
      <Tooltip content={f.exists ? 'Show in your file manager' : 'Not made yet'} relationship="label">
        <Button appearance="subtle" size="small" icon={<FolderOpenIcon />} disabled={!f.exists} onClick={() => void kulisa.invoke('about:show-folder', f.id)} />
      </Tooltip>
      <Text size={200} style={{ gridColumn: '2 / -1', opacity: 0.7 }}>{FOLDERS[f.id].hint}</Text>
    </div>)}
  </div>;
}
