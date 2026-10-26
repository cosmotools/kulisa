// Several agents in a task (tasks.ts; docs/tasks.md, "Several agents"): a tab and a conversation each; the task handed
// from one to another. The test agent (custom) and the fake one (two accounts) are two CLIs, their transcripts both in
// Claude Code's format (app.ts).
import { execFileSync } from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures.ts';
import type { Core, Call } from './fixtures.ts';
import type { data } from './data.ts';
import { WIN, menuRows, choose, rightClick, focusWindow, renamed } from './helpers.ts';

type Files = ReturnType<typeof data>;

const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=Kulisa test', '-c', 'user.email=test@example.invalid', ...args], { cwd, encoding: 'utf8' }).trim();
const invoke = (page: Page, channel: string, arg?: unknown) => page.evaluate(([c, a]) => (window as any).kulisa.invoke(c, a), [channel, arg] as const);
const act = (page: Page, channel: string, arg: unknown) => page.evaluate(([c, a]) => (window as any).act(c, a), [channel, arg] as const);
// The fake agent's program once installed (app.ts): on Windows its .cmd, which Kulisa finds and runs.
const fakeBin = (files: Files) => path.join(files.root, 'bin', WIN ? 'kulisa-fake-agent.cmd' : 'kulisa-fake-agent');
// The fake agent installed, as its installer leaves it (app.ts; installing is tested in agents.spec.ts), and looked
// for again.
async function installFake(ui: Page, files: Files) {
  const bin = path.join(files.root, 'bin'), program = path.join(bin, 'kulisa-fake-agent');
  if (!fs.existsSync(fakeBin(files))) {
    fs.mkdirSync(bin, { recursive: true });
    fs.copyFileSync(path.join(import.meta.dirname, '..', 'fixtures', 'fake-agent.sh'), program);
    fs.chmodSync(program, 0o755);
    if (WIN) fs.writeFileSync(`${program}.cmd`, '@bash "%~dp0kulisa-fake-agent" %*');
  }
  await invoke(ui, 'agents:list', { details: true, cached: false });
}
// A new task of the project (its + : task:new; the menu is tested elsewhere), shown once its agent started; its key.
// Named task-<its place among its project's tasks> when named, for its branch and what goes along with it.
async function newTask(core: Core, ui: Page, files: Files, named = false) {
  const before = await core((k) => k.shell.task.key);
  await invoke(ui, 'task:new', { project: files.pid('project') });
  await expect.poll(() => core((k, b) => { const t = k.shell.task; return t.key !== b && t.loaded && [...t.terminals.values()].some((x) => !!x.pty) && !k.shell.windows[0].switching; }, before), { timeout: 20000 }).toBe(true);
  return core(async (k, n) => {
    const t = k.shell.task;
    if (n) await t.rename(`task-${[...t.project.tasks.values()].indexOf(t) + 1}`);
    k.watchPty(k.shell.pty); k.asked.length = 0;
    return t.key;
  }, named);
}
// The project as the tasks' tests leave it: in git, its profiles Sam.admin, Elon.buyer and Dora, and a task with a
// worktree of its own (Feature-X) beside its first: made through the core, git and the agent's tools where it is not
// (they are tested elsewhere).
async function begin(core: Core, ui: Page, call: Call, files: Files) {
  if (!fs.existsSync(path.join(files.project, '.git'))) {
    git(files.project, 'init', '-q');
    fs.writeFileSync(path.join(files.project, 'README.md'), '# shop\n');
    git(files.project, 'add', '-A');
    git(files.project, 'commit', '-qm', 'first');
  }
  await core(async (k) => {
    const t = k.shell.task;
    for (const name of ['Sam.admin', 'Elon.buyer', 'Dora']) {
      if (![...k.shell.profiles.values(), ...[...t.closed.values()].map((c) => c.cfg)].some((p) => p.name === name)) await t.createProfile(name);
    }
  });
  if (!(await core(async (k) => {
    const { worktreesOf } = await k.import('src/main/store.ts');
    return k.shell.store.tasksOf(k.shell.current.entry).list.some((e: any) => worktreesOf(e).length);
  }))) {
    const key = await newTask(core, ui, files);
    await call('task_worktree', { name: 'Feature-X' }, { task: key }); // as its agent makes it
    await invoke(ui, 'task:show', files.tkey('project', 1));
    await expect.poll(() => core((k, t) => k.shell.task?.key === t && !k.shell.windows[0].switching, files.tkey('project', 1))).toBe(true);
  }
}

test("+ opens any of the project's accounts, a new conversation in a tab of its own; each reports its own state, the task's tab the most urgent, and names its own tab; the task handed to another agent by its icon or Change agent…: a new tab told to go on with that conversation, the old one stays; New Conversation; deleting the task forgets every conversation", async ({ core, ui, call, files }) => {
  await installFake(ui, files);
  await begin(core, ui, call, files);
  const key = await newTask(core, ui, files, true), taskId = key.split('/')[1], where = (terminal?: number) => ({ task: key, terminal });
  await call('task_worktree', {}, where()); // its own worktree (copies), for the cross-copy trust below
  const [a, b] = await core((k) => ['a', 'b'].map((x) => {
    const r = k.shell.accounts.prepare('fake') as { id: string; dir: string; error?: string };
    if (r.error !== undefined) throw new Error(r.error);
    k.shell.accounts.create(r.id, 'fake', `${x}@switch.test`);
    return { id: r.id, dir: r.dir };
  }));
  for (const x of [a, b]) await invoke(ui, 'project:agent-add', { id: files.pid('project'), agent: x.id });
  const tabs = () => ui.locator('.termtab').evaluateAll((ts) => ts.map((t) => t.querySelector('.title').textContent + (t.classList.contains('active') ? ' *' : '')));
  const tabState = (id: number) => ui.locator(`.termtab[data-id="${id}"] .state`).getAttribute('data-state');
  const taskState = () => ui.locator(`#projectTabs .tasktab[data-task="${key}"] .state`).getAttribute('data-state');
  const conversations = () => JSON.parse(fs.readFileSync(files.pfile('agent.json', taskId), 'utf8')).conversations;
  type Term = { id: number; agent: string | undefined; pty: boolean };
  const terms = () => core((k, t) => [...k.shell.taskByKey(t).terminals.values()].map((x): Term => ({ id: x.id, agent: x.agent?.id, pty: !!x.pty })), key);
  const newest = async () => (await terms()).at(-1);
  const target = () => core((k, t) => k.shell.taskByKey(t).promptTarget()?.id, key);
  await expect.poll(tabs).toEqual(['bash *']);
  const bash = await target();
  // The human trusted the project's code in another task's copy (a's config, as Claude Code keeps it): an agent of
  // that account opened here finds this copy trusted too, and does not ask (agents/, extendTrust).
  const { copy, other } = await core(async (k, t) => {
    const { worktreesOf } = await k.import('src/main/store.ts');
    const task = k.shell.taskByKey(t);
    const e = k.shell.store.tasksOf(task.project.entry).list.find((x: any) => x.id !== task.id && worktreesOf(x).length);
    return { copy: task.worktrees[0].folder, other: worktreesOf(e)[0].folder as string };
  }, key);
  fs.writeFileSync(path.join(a.dir, '.claude.json'), JSON.stringify({ projects: { [other]: { hasTrustDialogAccepted: true } } }));

  // +: the project's accounts, then Terminal; one chosen opens in a tab of its own, in front, a new conversation.
  await ui.locator('#termAdd').click();
  const rows = await menuRows(ui);
  expect(rows.slice(-4)).toEqual(['Fake agent · a@switch.test', 'Fake agent · b@switch.test', '-', 'Terminal']);
  await choose(ui, 'Fake agent · a@switch.test');
  await expect.poll(async () => JSON.stringify(await tabs()) === '["bash","Fake agent *"]' && (await newest()).pty, { timeout: 20000 }).toBe(true);
  expect(JSON.parse(fs.readFileSync(path.join(a.dir, '.claude.json'), 'utf8')).projects[copy]?.hasTrustDialogAccepted).toBe(true);
  expect(fs.existsSync(path.join(a.dir, 'skills', 'kulisa-profiles', 'SKILL.md')), "Kulisa's skill in the account's folder").toBe(true);
  const fake = (await newest()).id;
  await expect(ui.locator(`.termtab[data-id="${fake}"] .handover use`), 'an agent without a mark of its own: the generic one').toHaveAttribute('href', '#i-agent');
  expect(conversations().map((c: { agent: string; terminal: number }) => [c.agent, c.terminal])).toEqual([['custom', bash], [a.id, fake]]);
  expect(await target(), 'a pick goes to the agent shown').toBe(fake);

  // Each its own state, from its own hooks; the task's tab shows the most urgent: waiting, then working.
  const hook = async (terminal: number, event: string, body = '{}') => {
    const url = await core((k, w) => { const t = k.shell.taskByKey(w.key); return t.env(t.terminals.get(w.terminal)).KULISA_URL; }, { key, terminal });
    await new Promise((r) => http.request(`${url}/hooks/${event}`, { method: 'POST' }, (res) => { res.resume(); res.on('end', r); }).end(body));
  };
  await hook(fake, 'prompt');
  await expect.poll(async () => (await tabState(fake)) === 'working' && (await taskState()) === 'working').toBe(true);
  expect(await tabState(bash)).toBe('');
  await hook(bash, 'waiting');
  await expect.poll(async () => (await tabState(bash)) === 'waiting' && (await taskState()) === 'waiting').toBe(true);
  // A tool finished: the human answered, it works again (no agent says so itself); one working or done stays so.
  await hook(bash, 'tool-done');
  await expect.poll(async () => (await tabState(bash)) === 'working' && (await taskState()) === 'working').toBe(true);
  await hook(bash, 'waiting');
  await expect.poll(() => tabState(bash)).toBe('waiting');
  await hook(bash, 'stop'); await hook(fake, 'stop');
  // Done in a tab behind: shown until the human brings it to the front.
  await expect.poll(async () => (await tabState(bash)) === 'done' && (await tabState(fake)) === '').toBe(true);
  await hook(bash, 'tool-done');
  expect(await core((k, w) => k.shell.taskByKey(w.key).terminals.get(w.bash).state, { key, bash }), 'a tool finished after the turn ended changes nothing').toBe('done');
  await ui.locator(`.termtab[data-id="${bash}"]`).click();
  await expect.poll(async () => (await tabState(bash)) === '' && (await taskState()) === '').toBe(true);
  expect(await target()).toBe(bash);

  // Each names its own tab, in 1 to 3 words; at the task's own URL there is no tab to name.
  expect((await call('conversation_rename', { name: ' Pay   with cards ' }, where(fake))).text).toMatch(/^Your conversation is now "Pay with cards"\.$/);
  await expect.poll(tabs).toEqual(['bash *', 'Pay with cards']);
  await expect(call('conversation_rename', { name: 'one two three four' }, where(fake))).rejects.toThrow(/1 to 3 words/);
  await expect(call('conversation_rename', { name: 'x' }, where())).rejects.toThrow(/conversation_rename/);
  // Its conversation as Claude Code keeps it, reported at its session's start: read by the others in task_history.
  const folder = (await core((k, t) => k.shell.taskByKey(t).folder, key)).replace(/[^A-Za-z0-9]/g, '-'), file = path.join(a.dir, 'projects', folder, 'f-1.jsonl');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, [{ type: 'user', message: { role: 'user', content: 'Pay with cards' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'On it' }] } }].map((r) => JSON.stringify(r)).join('\n'));
  await hook(fake, 'session-start', JSON.stringify({ session_id: 'f-1', transcript_path: file }));
  await expect.poll(() => conversations()[1].sessionId).toBe('f-1');
  expect((await call('task_history', {}, where(bash))).text).toMatch(/2\. "Pay with cards": Fake agent · a@switch\.test, open in its tab, from [^\n]+\n {3}First request: "Pay with cards"/);

  // Its icon (Change Agent) hands the task to an agent of the project (this one too): what goes along shown, and the
  // one chosen opens in a new tab, told to go on with this conversation. The dialog stays over it while it reads,
  // and goes once it has read the last part of it.
  const dialog = ui.locator('#handover'), progress = ui.locator('#handover .progress');
  await ui.locator(`.termtab[data-id="${fake}"] .handover`).click();
  await expect(ui.locator('#handover .choose .label').first()).toBeAttached();
  expect(await ui.locator('#handover .choose .label').allTextContents()).toEqual(rows.slice(0, -2));
  await expect(ui.locator('#handover .baton')).toHaveText(/^task-\d+.*the whole conversation$/s);
  await ui.locator(`#handover [data-agent="${b.id}"] [role="radio"]`).click();
  await ui.locator('#handoverstart').click();
  await expect.poll(async () => JSON.stringify(await tabs()) === '["bash","Pay with cards","Fake agent *"]' && (await newest()).pty, { timeout: 20000 }).toBe(true);
  const handed = (await newest()).id;
  const pty = await core((k, w) => { const t = k.shell.taskByKey(w.key).terminals.get(w.id); return { agent: t.agent.id, cols: t.pty.spawnSize.cols, last: t.pty.spawnArgs.at(-1) }; }, { key, id: handed });
  // In front under the dialog from its start, as + opens one: a tab behind has no size, and its xterm would lay out what
  // the agent drew for the island's size in 80 columns, broken.
  await expect.poll(() => ui.evaluate(() => (window as any).__term?.cols)).toBe(pty.cols);
  expect(pty.agent).toBe(b.id);
  expect(pty.last).toBe('Go on with the work of conversation 2 of this task ("Pay with cards"). Read it whole with the kulisa task_history tool (conversation 2) before anything else. Then tell me in a few lines what is done and what is next, and go on with it.');
  await expect(progress).toHaveText('Fake agent is starting…');
  await call('task_history', {}, where(handed));
  await expect(dialog, 'the overview is not the conversation').toHaveCount(1);
  await call('task_history', { conversation: 2 }, where(handed));
  await expect(dialog).toHaveCount(0);
  await expect.poll(tabs).toEqual(['bash', 'Pay with cards', 'Fake agent *']);
  expect(await core((k, w) => !!k.shell.taskByKey(w.key).terminals.get(w.fake)?.pty, { key, fake }), 'the tab it came from stays').toBe(true);
  // Change agent… (a tab's or a terminal's menu) opens it too. An agent that waits for the human (its hooks: a
  // permission, a sign-in, a limit) is shown at once; Show now shows it before it has read. Closing an agent's tab
  // asks: answered yes.
  for (const how of ['waiting', 'show']) {
    await rightClick(ui, `.termtab[data-id="${fake}"] .title`);
    expect(await menuRows(ui)).toEqual(['Change agent…', 'New Conversation', '-', 'Close']);
    await choose(ui, 'Change agent…');
    await expect(ui.locator('#handover .choose .label').first()).toBeAttached();
    await ui.locator(`#handover [data-agent="${b.id}"] [role="radio"]`).click();
    await ui.locator('#handoverstart').click();
    await expect.poll(async () => (await tabs()).length === 4 && (await newest()).pty && (await progress.textContent()) !== '', { timeout: 20000 }).toBe(true);
    const next = (await newest()).id;
    if (how === 'waiting') await hook(next, 'waiting'); else await ui.locator('#handovershow').click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(async () => (await tabs()).at(-1).endsWith(' *')).toBe(true);
    await act(ui, 'terminal:close', { id: next });
    await expect.poll(async () => (await tabs()).length).toBe(3);
  }
  // New Conversation: the same agent from nothing, in a tab of its own.
  await rightClick(ui, `.termtab[data-id="${bash}"] .title`);
  await menuRows(ui);
  await choose(ui, 'New Conversation');
  await expect.poll(async () => JSON.stringify(await tabs()) === '["bash","Pay with cards","Fake agent","bash 2 *"]' && (await newest()).pty, { timeout: 20000 }).toBe(true);
  expect(conversations().map((c: { agent: string }) => c.agent)).toEqual(['custom', a.id, b.id, b.id, b.id, 'custom']);
  // Its program not found: its tab came at once, starting, and the human is asked for another; none chosen, it goes.
  const bin = fakeBin(files);
  await renamed(bin, `${bin}.away`);
  try {
    await ui.evaluate((id) => { void (window as any).act('terminal:open', { agent: id }); }, a.id); // it answers once the human has chosen
    await expect(ui.locator('.terminals .starting'), "numbered: a's other tab is open").toHaveText('Starting Fake agent 2…');
    await expect(ui.locator('#agentcancel')).toBeVisible();
    await ui.locator('#agentcancel').click();
    await expect.poll(tabs).toEqual(['bash', 'Pay with cards', 'Fake agent', 'bash 2 *']);
    await expect(ui.locator('.terminals .starting')).toHaveCount(0);
  } finally { await renamed(`${bin}.away`, bin); }
  // All closed, no profile open: the big buttons, an account's email under its agent's name, no keys; the first has
  // the keyboard, Tab moves to the next, Enter opens it.
  for (const t of await terms()) await act(ui, 'terminal:close', { id: t.id });
  const launchers = ui.locator('.launch .agents .launcher');
  await expect(launchers).toHaveCount(3);
  expect(await launchers.evaluateAll((ls) => ls.map((l) => [l.querySelector('.name').textContent, l.querySelector('small')?.textContent ?? '', (l as HTMLElement).title]))).toEqual(
    [['Fake agent', 'a@switch.test', 'Fake agent · a@switch.test'], ['Fake agent', 'b@switch.test', 'Fake agent · b@switch.test'], ['Terminal', '', 'Terminal']]);
  // Under them the project's profiles, a tile each.
  expect(await ui.locator('.launch .profiles .name').allTextContents()).toEqual(['Sam.admin', 'Elon.buyer', 'Dora']);
  await expect(ui.locator('.launcher').first()).toBeFocused();
  await focusWindow(core, ui);
  await core((k) => k.press(k.shell.win.webContents, 'Tab'));
  await expect(ui.locator('.launcher').nth(1)).toBeFocused();
  await core((k) => { for (const type of ['keyDown', 'char', 'keyUp'] as const) k.shell.win.webContents.sendInputEvent({ type, keyCode: type === 'char' ? '\r' : 'Enter' }); });
  await expect.poll(async () => { const ts = await terms(); return ts.length === 1 && ts[0].agent === b.id; }, { timeout: 20000 }).toBe(true);

  // Deleting the task forgets every conversation, each in its account's folder.
  await invoke(ui, 'task:delete', key);
  await expect.poll(() => core((k, t) => !k.shell.taskByKey(t), key)).toBe(true);
  expect(fs.existsSync(file), "the fake agent's, in its account").toBe(false);
  for (const x of [a, b]) await invoke(ui, 'project:agent-remove', { id: files.pid('project'), agent: x.id });
  await core(async (k, ids) => {
    const { removeTree } = await k.import('src/main/remove.ts');
    for (const x of ids) { k.shell.accounts.drop(x.id); removeTree(x.dir); }
    k.asked.length = 0;
  }, [a, b]);
});
