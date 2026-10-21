// After a restart, what window.ts, grid.ts and tasks.ts left: the tasks open and closed, the projects and windows,
// the grid, the terminals.
import fs from 'fs';
import path from 'path';
import { assert, userData, project, SITE, sleep, waitFor, who, viewOn, projectTabs, showProject, click } from './helpers.ts';
import type { Test } from './run.ts';
import type { TaskTerminal } from '../src/main/tasks.ts';

export default (test: Test) => {
  test('after a restart: the other task waits in the bar with its tabs, loads when shown, still signed in; a closed one stays closed', async (ctx) => {
    const { shell, ui } = ctx;
    await waitFor(async () => (await ui(`[...document.querySelectorAll('#projectTabs .tasktab[data-project="project"]')].map((t) => t.querySelector('.name').textContent).join()`)) === 'task-1,Feature-X');
    assert.equal(shell.current.tasks.get(5).entry.closed, true);
    const second = shell.current.tasks.get(2);
    assert.equal(second.loaded, false);
    // Left loaded in the background: its tabs saved as Kulisa quit, not again as they closed (none left at last).
    const secondDir = path.join(userData, 'projects', 'project', '2');
    const saved = fs.readdirSync(secondDir).filter((d) => d.startsWith('Profile '))
      .map((d) => JSON.parse(fs.readFileSync(path.join(secondDir, d, 'Kulisa Tabs.json'), 'utf8')).urls);
    assert.ok(saved.some((urls) => urls.length), `its tabs kept: ${JSON.stringify(saved)}`);
    // Once the first has loaded: a click while the window still builds it is not taken.
    await waitFor(() => shell.task?.loaded && !shell.windows[0].switching);
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    await click(ui, `document.querySelector('#projectTabs .tasktab[data-task="project/2"]')`);
    await waitFor(() => shell.task === second && second.loaded && second.pty);
    assert.equal(second.folder, `${project}@task-2`);
    assert.deepEqual([...shell.profiles.keys()], ['sam-admin', 'elon-buyer']);
    await ctx.call('browser_navigate', { profile: 'sam-admin', url: `${SITE}/app` });
    assert.equal(await who(ctx, 'sam-admin'), 'Signed in as master'); // its master's, brought by Refresh from Master…
    await click(ui, `document.querySelector('#projectTabs .tasktab[data-task="project/1"]')`);
    await waitFor(() => shell.task.n === 1);
    await waitFor(async () => (await viewOn(shell, ui, 'sam-admin')) && viewOn(shell, ui, 'elon-buyer'));
  });
  test('after a restart: the open tasks are as they were left; one in the background loads when shown', async ({ shell, ui }) => {
    await waitFor(async () => JSON.stringify(await projectTabs(ui)) === '["project *","project","other"]');
    assert.equal(shell.open.get('other').tasks.get(1).loaded, false);
  });
  test('after a restart: a window of its own comes back where it was, with its project shown; saved smaller than the minimum, at the minimum', async ({ shell }) => {
    await waitFor(() => shell.windows.length === 2 && shell.windows[1].current?.project.id === 'third' && shell.windows[1].task.loaded);
    const second = shell.windows[1];
    assert.deepEqual(second.tabs.map((t) => t.key), ['third/1']);
    const { width, height } = second.win.getNormalBounds();
    assert.deepEqual({ width, height }, { width: 640, height: 400 });
    assert.deepEqual(second.win.getMinimumSize(), [640, 400]);
    await waitFor(async () => JSON.stringify(await projectTabs((js) => second.win.webContents.executeJavaScript(js))) === '["third *"]');
  });
  test('after a restart: the grid is as it was left (preset "grid")', async ({ ui }) => {
    const box = (sel: string) => ui(`(() => { const r = document.querySelector(${JSON.stringify(sel)})?.getBoundingClientRect(); return r ? { x: r.x, width: r.width } : { x: -1, width: 0 }; })()`);
    // Once the grid is laid out: the test before may end while the second's panes (the same profile ids) are still going.
    const columns = async () => {
      if (!(await ui(`document.querySelectorAll('.pane[data-profile="sam-admin"], .pane[data-profile="elon-buyer"]').length === 2`))) return false;
      const sam = await box('.pane[data-profile="sam-admin"] .content'), elon = await box('.pane[data-profile="elon-buyer"] .content');
      const term = await box('.term:not([hidden])');
      return sam.width > 0 && sam.x < elon.x && term.x > elon.x + elon.width - 1;
    };
    await waitFor(columns, 10000); // as long as the next test's after a restart: a loaded machine takes over 3 s
  });
  test("after a restart: a task's terminals come back in their tabs when it loads, the one in front too: its agent's conversation resumed, a shell with nothing running", async ({ shell, ui, call }) => {
    await showProject(ui, 'other');
    await waitFor(() => shell.current?.id === 'other' && shell.task.loaded);
    const task = shell.task;
    const tabs = () => JSON.stringify(task.terminalsInfo().list.map(({ name, by, command, agent }) => ({ name, by, command, agent: agent?.account ?? null })));
    await waitFor(() => tabs() === JSON.stringify([{ name: 'bash', by: 'human', command: '', agent: 'custom' }, { name: 'dev server', by: 'agent', command: '', agent: null }]), 10000);
    const { id } = task.terminal('dev server') as TaskTerminal;
    await waitFor(async () => JSON.stringify(await ui(`[...document.querySelectorAll('.termtab')].map((t) => t.querySelector('.name').textContent + (t.classList.contains('active') ? ' *' : ''))`)) === '["bash *","dev server"]');
    await waitFor(() => (task.terminal('dev server') as TaskTerminal).pty && task.promptTarget()?.pty);
    assert.equal(task.terminals.get(id).by, 'agent');
    await sleep(500); // nothing to wait for: that nothing runs
    assert.ok(!(await call('terminal_read', { name: 'dev server' })).text.includes('served before'), 'nothing runs there');
  });
};
