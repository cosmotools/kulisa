// The Resources panel (docs/tasks.md, The Resources panel), a panel of the grid: the shown task's resources, a row
// each, opening its folder; what the task added (another repository's worktree) has a 🗑. Under them its artifacts, the
// files the agent's tools kept of its pages: a click opens one in the OS's app for it; their heading says what they take
// (Task.artifactsUsage).
import { useEffect } from 'react';
import { Button, Caption1, Caption1Strong, CompoundButton, Image, List, ListItem, Text } from '@fluentui/react-components';
import { BranchRegular, DeleteRegular, DocumentRegular, FolderRegular } from '@fluentui/react-icons';
import type { IDockviewPanelHeaderProps } from 'dockview-react';
import { useShallow } from 'zustand/react/shallow';
import { RightClickMenu } from '../Menus';
import { shownTask, useWindow } from '../../lib/store';
import type { MenuItem } from '../../lib/menu';
import { sizeText } from '../../../shared/bytes';
import css from './Resources.module.css';

const KINDS: Record<string, string> = { screenshot: 'Screenshot', snapshot: 'Snapshot', request: 'Request body', response: 'Response body' };
const kindOf = (kind: string) => KINDS[kind] ?? kind;
const day = (t: number) => new Date(t).toDateString();
const when = (t: number) => (day(t) === day(Date.now()) ? new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  : new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short' }));
const openFile = (file: string) => kulisa.invoke('file:open', file);
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
  return <aside id="resources" aria-label="The task's resources" className={css.panel}>
    <List aria-label="Folders">
      {task.resources.map((r) => <ListItem key={r.folder}><div className={css.item}>
        <CompoundButton appearance="subtle" size="small" aria-label={r.label} title={`Open Folder: ${r.folder}`}
          icon={r.kind === 'maintree' ? <FolderRegular /> : <BranchRegular />} secondaryContent={r.branch ? `branch ${r.branch}` : 'main working tree'}
          onClick={() => void open(r.folder)}>{r.label}</CompoundButton>
        {r.removable && <Button appearance="subtle" size="small" icon={<DeleteRegular />} aria-label="Remove Repository" title="Remove Repository"
          onClick={() => void remove(r.folder)} />}
      </div></ListItem>)}
    </List>
    {artifacts.length > 0 && <>
      <div className={css.heading}>
        <h3 className={css.title}><Caption1Strong>Artifacts</Caption1Strong></h3>
        <span className={css.size}><Caption1 data-testid="artifacts-size">{sizeText(bytes)}</Caption1></span>
        <Button appearance="subtle" size="small" icon={<DeleteRegular />} aria-label="Delete All Artifacts" title="Delete All Artifacts"
          onClick={() => void deleteArtifacts(null)} />
      </div>
      <RightClickMenu items={menu}>
        <List aria-label="Artifacts">
          {artifacts.map((a) => <ListItem key={a.file}><div className={css.item}>
            <CompoundButton appearance="subtle" size="small" data-file={a.file} aria-label={kindOf(a.kind)}
              title={`Open: ${a.file} (${sizeText(a.bytes)})`} onClick={() => void openFile(a.file)}
              icon={a.thumb ? <Image src={a.thumb} alt="" bordered shape="rounded" fit="cover" /> : <DocumentRegular />}
              secondaryContent={[names[a.profile], when(a.time)].filter(Boolean).join(' · ')}>{kindOf(a.kind)}</CompoundButton>
          </div></ListItem>)}
        </List>
      </RightClickMenu>
    </>}
  </aside>;
}

// Its header in the grid: its name; the panel is dragged by it.
export function ResourcesHeader({ api }: IDockviewPanelHeaderProps) {
  return <div data-panel={api.id} className={css.header}>
    <span className={css.name}><Text truncate wrap={false} block>{api.title}</Text></span>
  </div>;
}
