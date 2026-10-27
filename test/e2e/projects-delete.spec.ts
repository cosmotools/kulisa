// Projects (docs/tasks.md, Projects): Delete Project…, and New Project's ways to take the code.
import fs from 'fs';
import path from 'path';
import { test, expect } from './fixtures.ts';
import { choose, projectTabs, projectTabSel, fromSidebar, openSidebar, taskRow, closeSettings, invoke, typeIn, answer, notLoading, projectMenu, pageOf, removed, navRow, settingsMenu } from './helpers.ts';
import { git, committed, begin, bothOn, taskShown, taskTabs } from './tasks-helpers.ts';
import { createWorktree } from '../../src/main/worktrees.ts';

test("projects: Delete Project… (in Settings alone) asks, closes the project when open, deletes its data and its tasks' copies, never its folder; New Project takes its code from folders on the disk or clones it from URLs, one or several, making no other folder", async ({ core, ui, sui, files }) => {
  test.slow(); // git's work (worktrees, clones), five projects made and deleted, the project's tasks closed and opened again
  const root = files.root, home = await core((k) => k.shell.projectsHome);
  await removed(...['spare', 'gone', 'back', 'cloned.git', 'back.git', 'bad'].map((d) => path.join(root, d)), path.join(home, 'cloned'), path.join(home, 'fullstack'));
  await begin(core, ui, files, { featureX: true });
  const projects = async () => (await core((k) => k.shell.store.projects().map((p) => p.folders[0]))).map((f) => path.basename(f)); // each by its folder's name (pid)
  // A project that is not open, with a task that has a commit of its own, as Kulisa lays them out.
  const spare = path.join(root, 'spare');
  committed(spare);
  const wt = await createWorktree(spare, 'idea', null, []);
  fs.writeFileSync(path.join(wt.folder, 'b.txt'), 'b'); git(wt.folder, 'add', '-A'); git(wt.folder, 'commit', '-qm', 'b');
  // A profile of its own (in no other project): its master goes with it. An agent's account in no other project: it
  // stays, let go of (Settings → Agents deletes one).
  const made = await core((k, a) => {
    const s = k.shell, p = s.store.projectFor(a.spare);
    const own = s.profileStore.create(p.id, { name: 'Spare-user', avatar: 'fox' }) as { id: string };
    const account = s.accounts.create((s.accounts.prepare('fake') as { id: string }).id, 'fake', 'spare@shop.com');
    s.store.updateProject(p.id, { agents: [account.id] });
    return { id: p.id, own: own.id, account: account.id, accountDir: account.dir };
  }, { spare });
  const data = path.join(files.userData, 'projects', made.id);
  fs.mkdirSync(path.join(data, 'aaaaa1', made.own), { recursive: true });
  fs.mkdirSync(made.accountDir, { recursive: true });
  fs.writeFileSync(path.join(data, 'tasks.json'), JSON.stringify({ list: [{ id: 'aaaaa1', name: 'task-1', named: true, resources: [{ kind: 'maintree', folder: spare }] }, { id: 'aaaaa2', name: 'Idea', named: true, resources: [{ kind: 'worktree', ...wt }] }] }));
  await core((k) => k.shell.sendProjects()); // made behind the windows' back: they are told, as when a project is made

  // In Settings, its Delete Project…: the human is told what goes, says no, then yes.
  const removeRow = async (folder = 'spare', yes = true) => {
    const { id, name } = await core((k, i) => k.shell.store.projects().find((x) => x.id === i), files.pid(folder));
    if (!await ui.locator('#settings').count()) await ui.locator('#manageProjects').click();
    const s = await sui();
    await navRow(s, `p:${id}`).click();
    await pageOf(s, name);
    await s.getByRole('button', { name: 'More' }).click(); // ⋯ at its top
    await choose(s, 'Delete Project…', settingsMenu(s));
    return answer(s, yes);
  };
  const q = await removeRow('spare', false);
  expect(q.message).toBe('Delete the project spare?');
  expect(q.detail).not.toMatch(/Spare-user/);
  expect(q.detail).toMatch(/Its profiles stay, with their sign-ins/);
  expect(q.detail, 'its accounts stay').not.toMatch(/accounts/);
  expect(q.detail.includes(wt.worktree) && q.detail.includes('Idea: 1 commit of its own') && q.detail.includes(`Its folders stay as they are: ${spare}.`)).toBe(true);
  expect((await projects()).includes('spare') && fs.existsSync(data) && fs.existsSync(wt.worktree), 'kept when the human says no').toBe(true);
  await removeRow();
  await expect.poll(async () => (await projects()).includes('spare')).toBe(false);
  await expect.poll(() => !fs.existsSync(data) && !fs.existsSync(wt.worktree)).toBe(true);
  const master = await core((k, o) => k.shell.profileStore.projectsOf(k.shell.profileStore.get(o)).length === 0 && k.shell.profileStore.masterDir(o), made.own);
  expect(!!master && fs.existsSync(master), 'its profile kept, with its sign-ins, in no project (as its account)').toBe(true);
  await core((k, o) => { k.shell.profileStore.delete(o); }, made.own); // not needed after
  const logouts = path.join(root, 'logouts');
  expect(fs.existsSync(made.accountDir) && !(fs.existsSync(logouts) && fs.readFileSync(logouts, 'utf8').includes(made.accountDir)), 'its account kept, signed in').toBe(true);
  expect(await core((k, a) => k.shell.store.projectsWith('agents', a).map((p) => p.id), made.account)).toEqual([]);
  expect(git(spare, 'branch', '--list', wt.branch), "the task's branch").toBe('');
  expect(fs.readFileSync(path.join(spare, 'a.txt'), 'utf8'), "the project's own folder stays").toBe('a');
  expect(await core((k, i) => !!k.shell.task?.loaded && k.shell.current?.id === i, files.pid('project')), 'another project: the open one stays open').toBe(true);
  await expect(navRow(await sui(), `p:${made.id}`)).toHaveCount(0);
  await closeSettings(core, ui, sui);

  // New Project… asks for its code first (the code is often on the disk already). Folder on disk, a repository: taken
  // as it is, its files and its history kept, no git init, nothing made; named after its folder; Create opens its
  // first task, as for any new project.
  const goneDir = path.join(root, 'gone');
  committed(goneDir, 'a.txt', 'a', 'mine');
  // In a tasks' window (New Project… at the sidebar's foot, a dialog), Settings closed first.
  const np = ui.getByRole('dialog', { name: 'New Project' });
  const field = (name: string) => np.getByRole('textbox', { name, exact: true });
  const where = np.getByRole('status', { name: 'What will happen' });
  const newProject = async (from: string) => {
    if (await ui.locator('#settings').count()) await closeSettings(core, ui, sui);
    await openSidebar(ui);
    await ui.getByRole('button', { name: 'New Project…' }).click();
    await np.getByRole('tab', { name: from }).click();
    await expect(np.getByRole('tab', { name: from })).toHaveAttribute('aria-selected', 'true');
  };
  const submit = () => np.getByRole('button', { name: /^(Next|Create)$/ }).click();
  // Its steps gone through (no agent, no profile chosen), then Create: made, its first task opened in this window.
  const create = async (folder: string) => {
    for (const step of ['Agents', 'Profiles']) {
      await submit();
      await expect(np.getByRole('list', { name: 'Steps' }).locator('[aria-current="step"]')).toHaveText(new RegExp(`^.${step}$`));
    }
    await submit();
    await expect.poll(async () => {
      const c = await core((k) => k.shell.current && k.settled(true) && k.shell.current.id);
      return !!c && files.named(c) === folder;
    }, { timeout: 10000 }).toBe(true); // a clone takes a while
    await notLoading(ui);
  };
  await newProject('Folders on Disk');
  await expect(field('Location'), 'no location: nothing is made').toHaveCount(0);
  const source = np.getByRole('textbox', { name: /^A (folder|repository URL)$/ });
  const add = async (v: string) => { await typeIn(ui, source, v); await np.getByRole('button', { name: 'Add', exact: true }).click(); };
  await add(path.join(root, 'nowhere'));
  await expect(np.getByRole('alert')).toHaveText(`${path.join(root, 'nowhere')} is not there`);
  const sources = np.getByRole('option');
  await expect(sources, 'not in the list').toHaveCount(0);
  expect(fs.existsSync(path.join(root, 'nowhere')), 'not made').toBe(false);
  await core((k, f) => {
    const d = k.electron.dialog;
    k.stash.open = d.showOpenDialog;
    d.showOpenDialog = (async () => ({ canceled: false, filePaths: [f] }));
  }, goneDir);
  try {
    await typeIn(ui, source, '');
    await typeIn(ui, field('Name'), ''); // typed by the human: kept; emptied, it follows the first folder again
    await np.getByRole('button', { name: 'Add Folder…' }).click();
    await expect(field('Name')).toHaveValue('gone');
  } finally { await core((k) => { k.electron.dialog.showOpenDialog = k.stash.open; }); }
  await expect(sources).toHaveText(new RegExp(`^${RegExp.escape(goneDir)}git$`));
  await create('gone');
  expect(await core((k) => k.shell.current.folder)).toBe(goneDir);
  expect(git(goneDir, 'log', '--format=%s'), 'its history as it was').toBe('mine');
  expect(fs.readFileSync(path.join(goneDir, 'a.txt'), 'utf8')).toBe('a');
  await expect(ui.getByRole('alertdialog'), 'its task in this window, nothing asked').toHaveCount(0);
  // The open one: closed, then deleted; the tab next to it shown.
  const goneData = path.join(files.userData, 'projects', files.pid('gone'));
  await removeRow('gone');
  await expect.poll(async () => (await projects()).includes('gone')).toBe(false);
  // Settings stays over the window as its grid changes underneath (lib/cover.ts, 'page').
  await expect(ui.locator('#settings')).toHaveCount(1);
  if (await ui.locator('#settings').count()) await closeSettings(core, ui, sui);
  await expect.poll(() => core((k, f) => k.shell.current?.folder === f && !!k.shell.task?.loaded, files.project)).toBe(true);
  expect(await projectTabs(ui, files), 'the tab next to it shown').toEqual(['project', 'project *']);
  expect(fs.existsSync(goneDir) && !fs.existsSync(goneData)).toBe(true);
  await expect.poll(() => files.savedWindows()).toEqual([{ tabs: ['project/1', 'project/2'], shown: 'project/2' }]);

  // Folder on disk, several (a frontend and a backend): taken as they are, the first the default and the project's
  // folder; the one without git left so.
  const back = path.join(root, 'back');
  fs.mkdirSync(back); fs.writeFileSync(path.join(back, 'b.txt'), 'b');
  await newProject('Folders on Disk');
  await add(goneDir);
  await add(back);
  await expect(sources).toHaveCount(2);
  await expect(sources.nth(0)).toHaveAttribute('data-source', goneDir);
  await expect(sources.nth(0)).toHaveText(new RegExp(`^${RegExp.escape(goneDir)}gitdefault$`));
  await expect(sources.nth(1)).toHaveAttribute('data-source', back);
  await expect(sources.nth(1)).toHaveText(new RegExp(`^${RegExp.escape(back)}no git$`));
  await create('gone');
  expect(await core((k, i) => k.shell.store.projects().find((x) => x.id === i).folders, files.pid('gone'))).toEqual([goneDir, back]);
  expect(fs.existsSync(path.join(back, '.git')), 'the one without git left so').toBe(false);
  expect(git(goneDir, 'log', '--format=%s'), 'the repository as it was').toBe('mine');
  await removeRow('gone');
  await expect.poll(async () => (await projects()).includes('gone')).toBe(false);

  // Clone from URL (a local one here): cloned into <location>/<name>, named after the repository, and that clone is
  // the project's folder: no empty one beside it, no git init. A folder with files there is refused.
  const bare = path.join(root, 'cloned.git'), backBare = path.join(root, 'back.git');
  git(back, 'init', '-q'); git(back, 'add', '-A'); git(back, 'commit', '-qm', 'back');
  git(root, 'clone', '-q', '--bare', goneDir, bare);
  git(root, 'clone', '-q', '--bare', back, backBare);
  await newProject('Clone from URL');
  await add(bare);
  await expect(field('Name')).toHaveValue('cloned');
  const into = path.join(home, 'cloned');
  await expect(where).toHaveText(`The repository will be cloned into ${into}`);
  await typeIn(ui, field('Location'), root);
  await typeIn(ui, field('Name'), 'gone');
  await expect(field('Location'), 'refused at its field').toHaveAccessibleDescription(`${goneDir} is there already: choose another name or location`);
  await typeIn(ui, field('Location'), home);
  await typeIn(ui, field('Name'), 'cloned');
  await create('cloned');
  expect(await core((k, i) => k.shell.store.projects().find((x) => x.id === i).folders, files.pid('cloned'))).toEqual([into]);
  expect(git(into, 'log', '--format=%s'), 'its history').toBe('mine');
  await removeRow('cloned');
  await expect.poll(async () => (await projects()).includes('cloned')).toBe(false);
  // Several: each repository cloned into a folder named after the project, the first the default; that folder is
  // none of the project's. A URL typed and not yet added counts.
  await newProject('Clone from URL');
  await add(bare);
  await typeIn(ui, field('Name'), 'fullstack');
  await typeIn(ui, source, backBare);
  const stack = path.join(home, 'fullstack');
  await create('cloned'); // named by its first folder (data.ts, pid)
  const full = await core((k, i) => k.shell.store.projects().find((x) => x.id === i), files.pid('cloned'));
  expect([full.name, full.folders]).toEqual(['fullstack', [path.join(stack, 'cloned'), path.join(stack, 'back')]]);
  await removeRow('cloned');
  await expect.poll(async () => (await projects()).includes('cloned')).toBe(false);
  if (await ui.locator('#settings').count()) await closeSettings(core, ui, sui);
  // A URL git cannot clone: git's own words, nothing left behind, the clones before it neither.
  expect((await invoke(ui, 'project:new', { from: 'clone', name: 'bad', location: root, urls: [bare, path.join(root, 'none.git')] })).error).toBeTruthy();
  expect(!fs.existsSync(path.join(root, 'bad')) && !(await projects()).includes('bad')).toBe(true);

  // Close All Tasks in its submenu: the last tasks, so the empty window; its tasks closed.
  await notLoading(ui);
  await choose(ui, 'Close All Tasks', await projectMenu(ui, projectTabSel(files, 'project')));
  await expect.poll(() => core((k) => k.shell.task === null && k.shell.open.size === 0)).toBe(true);
  await expect(ui.locator('html')).toHaveAttribute('data-empty');
  expect(await core((k, i) => k.shell.store.tasksOf({ id: i }).list.every((e) => e.closed), files.pid('project')), 'its tasks closed').toBe(true);

  // A closed task opened again from the sidebar (the empty window's), a tab at the end; another from it over the grid after.
  const first = files.tkey('project', 1);
  await taskRow(ui, 'project', 'task-1').click();
  await taskShown(core, first);
  expect(await core((k) => !k.shell.task.entry.closed), 'open again').toBe(true);
  await notLoading(ui);
  await fromSidebar(ui, 'project', 'Feature-X');
  await expect.poll(() => core((k) => k.shell.task?.name === 'Feature-X' && k.settled(true))).toBe(true);
  await ui.locator(`#projectTabs [data-task="${first}"]`).click();
  await taskShown(core, first);
  expect(await projectTabs(ui, files), 'a tab each').toEqual(['project *', 'project']);
  expect(await taskTabs(ui)).toEqual(['task-1 *', 'Feature-X']);
  await core((k) => k.watchPty(k.shell.pty));
  await expect(ui.locator('html')).not.toHaveAttribute('data-empty');
  await notLoading(ui);
  await bothOn(core, ui, files);
  await core((k, a) => { const acc = k.shell.accounts; acc.drop(a.account); acc.remove(a.dir); }, { account: made.account, dir: made.accountDir });
});
