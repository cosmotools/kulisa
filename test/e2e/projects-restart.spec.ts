// Projects (docs/tasks.md, Projects): what the projects' tabs and windows are after a restart.
import path from 'path';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures.ts';
import type { Core } from './fixtures.ts';
import type { Files } from './data.ts';
import { termTabs, projectTabs, showProject, invoke, notLoading, otherPage } from './helpers.ts';
import { begin, openFolder, projectShown } from './tasks-helpers.ts';

// A project the window has no task of shown again as the human does it (its tab), once it is.
async function backTo(core: Core, ui: Page, files: Files, folder: string) {
  await showProject(ui, files, folder);
  await projectShown(core, files.pid(folder));
  await notLoading(ui);
}
test("projects: another tab left in the background, with a terminal its agent ran something in: after a restart the open tasks are as they were left, the one in the background loads when shown, its terminals back in their tabs (its agent's conversation resumed, a shell with nothing running)", async ({ core, ui, call, files, restart }) => {
  await begin(core, ui, files, { featureX: true });
  const other = path.join(files.root, 'other');
  await openFolder(core, ui, other);
  await call('terminal_run', { name: 'dev server', command: 'echo "served before"; sleep 60' });
  await expect.poll(async () => (await call('terminal_read', { name: 'dev server' })).text).toMatch(/^served before$/m);
  await backTo(core, ui, files, 'project');
  expect(await projectTabs(ui, files)).toEqual(['project *', 'project', 'other']);

  const ui2 = await restart();
  await expect.poll(() => projectTabs(ui2, files)).toEqual(['project *', 'project', 'other']);
  expect(await core((k, id) => [...k.shell.open.get(id).tasks.values()][0].loaded, files.pid('other'))).toBe(false);
  await showProject(ui2, files, 'other');
  await expect.poll(() => core((k, id) => k.shell.current?.id === id && !!k.shell.task?.loaded, files.pid('other'))).toBe(true);
  const key = await core((k) => k.shell.task.key);
  const terminals = () => core((k, t) => k.shell.taskByKey(t).terminalsInfo().list.map(({ name, by, command, agent }) => ({ name, by, command, agent: agent?.account ?? null })), key);
  await expect.poll(terminals, { timeout: 10000 }).toEqual([{ name: 'bash', by: 'human', command: '', agent: 'custom' }, { name: 'dev server', by: 'agent', command: '', agent: null }]);
  await expect.poll(() => termTabs(ui2))
    .toEqual(['bash *', 'dev server']);
  await expect.poll(() => core((k, t) => { const task = k.shell.taskByKey(t), dev = task.terminal('dev server') as { pty?: unknown }; return !!dev.pty && !!task.promptTarget()?.pty; }, key)).toBe(true);
  expect(await core((k, t) => (k.shell.taskByKey(t).terminal('dev server') as { by: string }).by, key)).toBe('agent');
  // A command typed into its shell runs after anything typed there before it: what it prints says the shell got
  // nothing else first (the one before it, sleeping a minute, would hold it).
  await core((k, t) => (k.shell.taskByKey(t).terminal('dev server') as { pty: { write(s: string): void } }).pty.write('echo kl-shell-free\r'), key);
  await expect.poll(async () => (await call('terminal_read', { name: 'dev server' })).text).toMatch(/^kl-shell-free$/m);
  expect((await call('terminal_read', { name: 'dev server' })).text, 'nothing runs there').not.toContain('served before');
});

test('projects: one left in a window of its own comes back after a restart where it was, with its project shown; saved smaller than the minimum, at the minimum', async ({ core, ui, files, restart }) => {
  await begin(core, ui, files, { featureX: true });
  const third = path.join(files.root, 'third');
  await openFolder(core, ui, third);
  const key = files.tkey('third', 1);
  await invoke(ui, 'task:move', { key, terminals: {} });
  await expect.poll(() => core((k, t) => k.shell.windows[1]?.current?.key === t && k.settled(false, k.shell.windows[1]), key)).toBe(true);
  // Smaller than the window's minimum (setBounds passes below it, the human's drag does not): it comes back at it.
  await core((k) => k.shell.windows[1].win.setBounds({ x: 40, y: 50, width: 10, height: 10 }));
  await backTo(core, ui, files, 'project');
  expect(await projectTabs(ui, files)).toEqual(['project *', 'project']);

  const ui2 = await restart();
  await expect.poll(() => core((k, id) => k.shell.windows.length === 2 && k.shell.windows[1].current?.project.id === id && !!k.shell.windows[1].task?.loaded, files.pid('third'))).toBe(true);
  expect(await core((k) => k.shell.windows[1].tabs.map((t) => t.key))).toEqual([key]);
  expect(await core((k) => { const { width, height } = k.shell.windows[1].win.getNormalBounds(); return { width, height }; })).toEqual({ width: 640, height: 400 });
  expect(await core((k) => k.shell.windows[1].win.getMinimumSize())).toEqual([640, 400]);
  // Its page: the second window's (ui is the first's).
  const second = await otherPage(ui2, `#projectTabs [data-task="${key}"]`);
  await expect.poll(() => projectTabs(second, files)).toEqual(['third *']);
});
