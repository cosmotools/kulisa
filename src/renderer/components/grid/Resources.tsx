// The Resources panel (docs/tasks.md, The Resources panel), a panel of the grid: the shown task's resources, a row
// each, opening its folder; what the task added (another repository's worktree) has a 🗑. Under them its artifacts, the
// files the agent's tools kept of its pages: a click opens one in the OS's app for it; their heading says what they take
// (Task.artifactsUsage).
import { useEffect } from 'react';
import { Button, CompoundButton, Image, List, ListItem, Text, tokens } from '@fluentui/react-components';
import { FileIcon, FolderIcon, GitBranchIcon, Trash2Icon } from 'lucide-react';
import type { IDockviewPanelHeaderProps } from 'dockview-react';
import { useShallow } from 'zustand/react/shallow';
import { RightClickMenu } from '../Menus';
import { shownTask, useWindow } from '../../lib/store';
import type { MenuItem } from '../../lib/menu';
import { sizeText } from '../../../shared/bytes';

const KINDS: Record<string, string> = { screenshot: 'Screenshot', snapshot: 'Snapshot', request: 'Request body', response: 'Response body' };
const kindOf = (kind: string) => KINDS[kind] ?? kind;
const day = (t: number) => new Date(t).toDateString();
const when = (t: number) => (day(t) === day(Date.now()) ? new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  : new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short' }));
const openFile = (file: string) => kulisa.invoke('file:open', file);
// A row: the whole width, its icon, its name over its line.
const rowStyle = { width: '100%', justifyContent: 'start', minWidth: 0, textAlign: 'start' } as const;
// A Lucide icon in a compound button's icon slot, at a row's size (the slot is a picture's).
const ICON = { fontSize: 20, width: 20, height: 20 } as const;

export function Resources() {
  const task = useWindow((s) => shownTask(s));
  const key = task?.key;
  const artifacts = useWindow((s) => (s.artifacts.task === key ? s.artifacts.list : null)) ?? [];
  const bytes = useWindow((s) => s.artifacts.bytes);
  const names = useWindow(useShallow((s) => Object.fromEntries([...s.profiles, ...s.closedProfiles].map((p) => [p.id, p.name]))));
  // The list comes when the task is shown and whenever its agent keeps one (window.ts, sendArtifacts).
  useEffect(() => { if (key) void kulisa.invoke('task:artifacts', key); }, [key]);
  if (!task) return null;
  const open = (folder: string) => kulisa.invoke('task:open-folder', { key: task.key, folder });
  const remove = (folder: string) => kulisa.invoke('task:remove-repo', { key: task.key, repo: folder });
  const deleteArtifacts = (files: string[] | null) => kulisa.invoke('task:artifacts-delete', { key: task.key, files });
  const menu = (e: MouseEvent): MenuItem[] | null => {
    const file = (e.target as Element).closest<HTMLElement>('[data-file]')?.dataset.file;
    return file ? [{ label: 'Open', run: () => openFile(file) }, { label: 'Show in Folder', run: () => kulisa.invoke('file:show', file) }, '-',
      { label: 'Delete', run: () => deleteArtifacts([file]) }] : null;
  };
  return <aside id="resources" aria-label="The task's resources"
    style={{ height: '100%', overflowY: 'auto', padding: `0 ${tokens.spacingHorizontalS} ${tokens.spacingVerticalS}`, boxSizing: 'border-box' }}>
    <List aria-label="Folders">
      {task.resources.map((r) => <ListItem key={r.folder} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <CompoundButton appearance="subtle" size="small" style={rowStyle} aria-label={r.label} title={`Open Folder: ${r.folder}`}
          icon={{ children: r.kind === 'maintree' ? <FolderIcon /> : <GitBranchIcon />, style: ICON }} secondaryContent={r.branch ? `branch ${r.branch}` : 'main working tree'}
          onClick={() => void open(r.folder)}><Text truncate wrap={false}>{r.label}</Text></CompoundButton>
        {r.removable && <Button appearance="subtle" size="small" icon={<Trash2Icon />} aria-label="Remove Repository" title="Remove Repository"
          onClick={() => void remove(r.folder)} />}
      </ListItem>)}
    </List>
    {artifacts.length > 0 && <>
      <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS, marginBlock: `${tokens.spacingVerticalS} 2px` }}>
        <Text as="h3" weight="semibold" size={200} style={{ margin: 0 }}>Artifacts</Text>
        <Text size={200} data-testid="artifacts-size" style={{ color: tokens.colorNeutralForeground3, marginInlineStart: 'auto' }}>{sizeText(bytes)}</Text>
        <Button appearance="subtle" size="small" icon={<Trash2Icon />} aria-label="Delete All Artifacts" title="Delete All Artifacts"
          onClick={() => void deleteArtifacts(null)} />
      </div>
      <RightClickMenu items={menu}>
        <List aria-label="Artifacts">
          {artifacts.map((a) => <ListItem key={a.file}>
            <CompoundButton appearance="subtle" size="small" style={rowStyle} data-file={a.file} aria-label={kindOf(a.kind)}
              title={`Open: ${a.file} (${sizeText(a.bytes)})`} onClick={() => void openFile(a.file)}
              // A screenshot's picture in the icon's place: its top, where a page's head is
              icon={a.thumb ? { children: <Image src={a.thumb} alt="" bordered shape="rounded" fit="cover" style={{ width: 64, height: 40, objectPosition: 'top' }} />,
                style: { width: 64, height: 40 } } : { children: <FileIcon />, style: ICON }}
              secondaryContent={[names[a.profile], when(a.time)].filter(Boolean).join(' · ')}>{kindOf(a.kind)}</CompoundButton>
          </ListItem>)}
        </List>
      </RightClickMenu>
    </>}
  </aside>;
}

// Its header in the grid: its name; the panel is dragged by it.
export function ResourcesHeader({ api }: IDockviewPanelHeaderProps) {
  return <div data-panel={api.id} style={{ padding: '0 8px', display: 'flex', alignItems: 'center', height: '100%', minWidth: 0 }}>
    <Text truncate wrap={false} style={{ color: tokens.colorNeutralForeground2 }}>{api.title}</Text>
  </div>;
}
