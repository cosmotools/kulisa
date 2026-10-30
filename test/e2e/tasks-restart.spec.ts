// What a project's tasks are after a restart (docs/tasks.md, Tasks; docs/window.md, The grid): the open ones back in the
// bar, the one in the background loaded when shown, still signed in; a closed one closed; the grid as it was left.
import fs from 'fs';
import path from 'path';
import { test, expect } from './fixtures.ts';
import { SITE, who, box, resourcesHeight, invoke, notLoading, arrange } from './helpers.ts';
import { SAM, ELON, committed, begin, bothOn, newTask, showTask } from './tasks-helpers.ts';

test('after a restart: the other task waits in the bar with its tabs, loads when shown, still signed in; a closed one stays closed', async ({ core, ui, call, files, restart }) => {
  test.slow(); // a worktree made, a task opened and closed, Kulisa started again
  const project = files.project;
  if (!fs.existsSync(path.join(project, '.git'))) committed(project, 'README.md', '# shop\n', 'first');
  await begin(core, ui, files, { featureX: true });
  const pid = files.pid('project'), first = files.tkey('project', 1), second = files.tkey('project', 2);
  const samId = files.idOf(SAM), elonId = files.idOf(ELON);
  // Feature-X in a worktree of its own (named so by its agent), Sam signed in there as another user than in task-1,
  // its tabs loaded in the background as Kulisa quits.
  await showTask(core, ui, second);
  await notLoading(ui);
  await call('task_worktree', { name: 'Feature-X' });
  expect(await core((k) => k.shell.task.folder)).toBe(`${project}@feature-x`);
  await core(async (k, ids) => { for (const id of ids) if (!k.shell.profiles.has(id)) await k.shell.task.openProfile(id); }, [samId, elonId]);
  await expect.poll(() => core((k, ids) => ids.every((id) => k.shell.profiles.has(id)), [samId, elonId])).toBe(true);
  await call('browser_navigate', { profile: SAM, url: `${SITE}/app/login?name=second` });
  expect(await who(call, SAM)).toBe('Signed in as second');
  // A third task, closed.
  const third = await newTask(core, ui, undefined, pid);
  await invoke(ui, 'task:close', third);
  await expect.poll(() => core((k, key) => !!k.shell.store.tasksOf({ id: key.split('/')[0] }).list.find((e) => key.endsWith(`/${e.id}`))?.closed, third)).toBe(true);
  await showTask(core, ui, first);
  await notLoading(ui);

  const ui2 = await restart();
  await expect(ui2.locator(`#taskTabs [data-project="${pid}"]`)).toHaveText(['task-1', 'Feature-X']);
  expect(await core((k, id) => [...k.shell.taskByKey(id).project.tasks.values()][2].entry.closed, first)).toBe(true);
  expect(await core((k, key) => k.shell.taskByKey(key).loaded, second)).toBe(false);
  // Left loaded in the background: its tabs saved as Kulisa quit, not again as they closed (none left at last).
  const secondDir = path.join(files.userData, 'projects', pid, files.tid('project', 2));
  const saved = fs.readdirSync(secondDir).filter((d) => fs.existsSync(path.join(secondDir, d, 'Kulisa Tabs.json')))
    .map((d) => JSON.parse(fs.readFileSync(path.join(secondDir, d, 'Kulisa Tabs.json'), 'utf8')).urls as string[]);
  expect(saved.some((urls) => urls.length), `its tabs kept: ${JSON.stringify(saved)}`).toBe(true);
  // Once the first has loaded: a click while the window still builds it is not taken.
  await expect.poll(() => core((k) => k.settled())).toBe(true);
  await notLoading(ui2);
  await ui2.locator(`#taskTabs [data-task="${second}"]`).click();
  await expect.poll(() => core((k, key) => k.shell.task?.key === key && k.shell.task.loaded && !!k.shell.task.pty, second)).toBe(true);
  expect(await core((k) => k.shell.task.folder)).toBe(`${project}@feature-x`);
  expect(await core((k) => [...k.shell.profiles.keys()])).toEqual([samId, elonId]);
  await call('browser_navigate', { profile: SAM, url: `${SITE}/app` });
  expect(await who(call, SAM), 'its own sign-in to the local app').toBe('Signed in as second');
  await ui2.locator(`#taskTabs [data-task="${first}"]`).click();
  await expect.poll(() => core((k, key) => k.shell.task?.key === key, first)).toBe(true);
  await bothOn(core, ui2, files);
});

test('after a restart: Stage stays left and both grids keep their saved sizes', async ({ core, ui, files, restart }) => {
  await begin(core, ui, files, { featureX: true });
  await arrange(ui, 'left');
  // Saved as laid out (the task's layout.json, 300 ms after the grid's last change: lib/grid.ts), before the restart;
  // the grid's shape from dockview's API.
  await expect.poll(async () => {
    const now = JSON.stringify(await ui.evaluate(() => (window as any).__dock.toJSON().grid));
    try { const saved = files.json(files.pfile('layout.json')); return saved.stagePosition === 'left' && JSON.stringify(saved.workspace.grid) === now; } catch { return false; }
  }).toBe(true);

  const saved = await resourcesHeight(ui);
  const ui2 = await restart();
  const at = async (sel: string) => (await box(ui2, sel)) ?? { x: -1, width: 0 };
  const sam = `[role="region"][data-profile="${files.idOf(SAM)}"]`, elon = `[role="region"][data-profile="${files.idOf(ELON)}"]`;
  // Once the grid is laid out: Sam's column, Elon's, the terminal right of them.
  await expect.poll(async () => {
    if (await ui2.locator(`${sam}, ${elon}`).count() !== 2) return false;
    const s = await at(`${sam} [data-testid="page"]`), e = await at(`${elon} [data-testid="page"]`), term = await at('[data-testid="terminal"]');
    return s.width > 0 && s.x < e.x && term.x > e.x + e.width - 1;
  }, { timeout: 10000 }).toBe(true); // a loaded machine takes over 3 s
  expect(Math.abs((await resourcesHeight(ui2)) - saved), 'the Resources panel as tall as it was left (dockview rounds its panels as it restores them)').toBeLessThanOrEqual(3);
});
