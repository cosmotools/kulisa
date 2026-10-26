// Several agents in a task (tasks.ts; docs/tasks.md, "Several agents"): a tab and a conversation each; the task handed
// from one to another. The test agent (custom) and the fake one (two accounts) are two CLIs, their transcripts both in
// Claude Code's format (app.ts).
import fs from 'fs';
import http from 'http';
import path from 'path';
import { test, expect } from './fixtures.ts';
import { termTabs, menu, choose, rightClick, focusWindow, renamed, invoke, act, answer } from './helpers.ts';
import { begin, newTask } from './tasks-helpers.ts';
import { fakeAgent, fakeBin } from './agent-helpers.ts';

test("+ opens any of the project's accounts, a new conversation in a tab of its own; each reports its own state, the task's tab the most urgent, and names its own tab; the task handed to another agent by its icon or Change agent…: a new tab told to go on with that conversation, the old one stays; New Conversation; deleting the task forgets every conversation", async ({ core, ui, call, files }) => {
  await fakeAgent(ui, files);
  // The project as the tasks' tests leave it: in git, Feature-X in a worktree of its own beside its first task; its
  // profiles Sam.admin, Elon.buyer and Dora.
  await begin(core, ui, files, { featureX: call });
  await core(async (k) => {
    const t = k.shell.task;
    if (![...k.shell.profiles.values(), ...[...t.closed.values()].map((c) => c.cfg)].some((p) => p.name === 'Dora')) await t.createProfile('Dora');
  });
  const key = await newTask(core, ui, undefined, files.pid('project')), taskId = key.split('/')[1], where = (terminal?: number) => ({ task: key, terminal });
  await call('task_worktree', {}, where()); // its own worktree (copies), for the cross-copy trust below
  const [a, b] = await core((k) => ['a', 'b'].map((x) => {
    const r = k.shell.accounts.prepare('fake') as { id: string; dir: string; error?: string };
    if (r.error !== undefined) throw new Error(r.error);
    k.shell.accounts.create(r.id, 'fake', `${x}@switch.test`);
    return { id: r.id, dir: r.dir };
  }));
  for (const x of [a, b]) await invoke(ui, 'project:agent-add', { id: files.pid('project'), agent: x.id });
  const tabs = () => termTabs(ui);
  // A terminal's tab's state, and the task's tab's.
  const tabIs = (id: number, state: string) => expect(ui.locator(`nav[aria-label="Terminals"] [data-id="${id}"] [data-state]`)).toHaveAttribute('data-state', state);
  const taskIs = (state: string) => expect(ui.locator(`#projectTabs [data-task="${key}"] [data-state]`)).toHaveAttribute('data-state', state);
  const conversations = () => files.json(files.pfile('agent.json', taskId)).conversations;
  type Term = { id: number; agent: string | undefined; pty: boolean };
  const terms = () => core((k, t) => [...k.shell.taskByKey(t).terminals.values()].map((x): Term => ({ id: x.id, agent: x.agent?.id, pty: !!x.pty })), key);
  const newest = async () => (await terms()).at(-1);
  const target = () => core((k, t) => k.shell.taskByKey(t).promptTarget()?.id, key);
  await expect.poll(tabs).toEqual(['bash *']);
  const bash = await target();
  // The human trusted the project's code in another task's copy (a's config, as Claude Code keeps it): an agent of
  // that account opened here finds this copy trusted too, and does not ask (agents/, extendTrust).
  const { copy, other } = await core((k, t) => {
    const task = k.shell.taskByKey(t);
    const e = k.shell.store.tasksOf(task.project.entry).list.find((x) => x.id !== task.id && k.worktreesOf(x).length);
    return { copy: task.worktrees[0].folder, other: k.worktreesOf(e)[0].folder };
  }, key);
  fs.writeFileSync(path.join(a.dir, '.claude.json'), JSON.stringify({ projects: { [other]: { hasTrustDialogAccepted: true } } }));

  // +: the project's accounts, then Terminal; one chosen opens in a tab of its own, in front, a new conversation.
  const AGENTS = ['Fake agent · a@switch.test', 'Fake agent · b@switch.test'];
  await ui.locator('#termAdd').click();
  await expect(menu(ui)).toMatchAriaSnapshot(`
    - menu:
      - menuitem "Fake agent · a@switch.test"
      - menuitem "Fake agent · b@switch.test"
      - separator
      - menuitem "Terminal"
  `);
  await choose(ui, 'Fake agent · a@switch.test');
  await expect.poll(async () => JSON.stringify(await tabs()) === '["bash","Fake agent *"]' && (await newest()).pty, { timeout: 20000 }).toBe(true);
  expect(JSON.parse(fs.readFileSync(path.join(a.dir, '.claude.json'), 'utf8')).projects[copy]?.hasTrustDialogAccepted).toBe(true);
  expect(fs.existsSync(path.join(a.dir, 'skills', 'kulisa-profiles', 'SKILL.md')), "Kulisa's skill in the account's folder").toBe(true);
  const fake = (await newest()).id;
  await expect(ui.locator(`nav[aria-label="Terminals"] [data-id="${fake}"] button use`), 'an agent without a mark of its own: the generic one').toHaveAttribute('href', '#i-agent');
  expect(conversations().map((c: { agent: string; terminal: number }) => [c.agent, c.terminal])).toEqual([['custom', bash], [a.id, fake]]);
  expect(await target(), 'a pick goes to the agent shown').toBe(fake);

  // Each its own state, from its own hooks; the task's tab shows the most urgent: waiting, then working.
  const hook = async (terminal: number, event: string, body = '{}') => {
    const url = await core((k, w) => { const t = k.shell.taskByKey(w.key); return t.env(t.terminals.get(w.terminal)).KULISA_URL; }, { key, terminal });
    await new Promise((r) => http.request(`${url}/hooks/${event}`, { method: 'POST' }, (res) => { res.resume(); res.on('end', r); }).end(body));
  };
  await hook(fake, 'prompt');
  await tabIs(fake, 'working');
  await taskIs('working');
  await tabIs(bash, '');
  await hook(bash, 'waiting');
  await tabIs(bash, 'waiting');
  await taskIs('waiting');
  // A tool finished: the human answered, it works again (no agent says so itself); one working or done stays so.
  await hook(bash, 'tool-done');
  await tabIs(bash, 'working');
  await taskIs('working');
  await hook(bash, 'waiting');
  await tabIs(bash, 'waiting');
  await hook(bash, 'stop'); await hook(fake, 'stop');
  // Done in a tab behind: shown until the human brings it to the front.
  await tabIs(bash, 'done');
  await tabIs(fake, '');
  await hook(bash, 'tool-done');
  expect(await core((k, w) => k.shell.taskByKey(w.key).terminals.get(w.bash).state, { key, bash }), 'a tool finished after the turn ended changes nothing').toBe('done');
  await ui.locator(`nav[aria-label="Terminals"] [data-id="${bash}"]`).click();
  await tabIs(bash, '');
  await taskIs('');
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
  const dialog = ui.locator('#handover'), progress = ui.locator('#handover').getByRole('status');
  await ui.locator(`nav[aria-label="Terminals"] [data-id="${fake}"]`).getByRole('button', { name: /change agent/ }).click();
  // The project's agents, as in +.
  const radios = ui.locator('#handover').getByRole('radio');
  await expect(radios).toHaveCount(AGENTS.length);
  for (const [i, name] of AGENTS.entries()) await expect(radios.nth(i)).toHaveAccessibleName(name);

  await expect(ui.locator('#handover').getByRole('list', { name: 'Goes along' })).toHaveText(/^task-\d+.*the whole conversation$/s);
  await ui.locator(`#handover [data-agent="${b.id}"] [role="radio"]`).click();
  await ui.locator('#handoverstart').click();
  await expect.poll(async () => JSON.stringify(await tabs()) === '["bash","Pay with cards","Fake agent *"]' && (await newest()).pty, { timeout: 20000 }).toBe(true);
  const handed = (await newest()).id;
  const pty = await core((k, w) => { const t = k.shell.taskByKey(w.key).terminals.get(w.id); return { agent: t.agent.id, cols: t.pty.spawnSize.cols, last: t.pty.spawnArgs.at(-1) }; }, { key, id: handed });
  // In front under the dialog from its start, as + opens one: a tab behind has no size, and its xterm would lay out what
  // the agent drew for the island's size in 80 columns, broken.
  await expect.poll(() => ui.evaluate(() => (window as any).__term?.cols)).toBe(pty.cols); // xterm's own: its canvas has no text to read
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
    await rightClick(ui, `nav[aria-label="Terminals"] [data-id="${fake}"]`);
    await expect(menu(ui)).toMatchAriaSnapshot(`
      - menu:
        - menuitem "Change agent…"
        - menuitem "New Conversation"
        - separator
        - menuitem "Close"
    `);
    await choose(ui, 'Change agent…');
    await expect(ui.locator('#handover').getByRole('radio').first()).toBeAttached();
    await ui.locator(`#handover [data-agent="${b.id}"] [role="radio"]`).click();
    await ui.locator('#handoverstart').click();
    await expect.poll(async () => (await tabs()).length === 4 && (await newest()).pty, { timeout: 20000 }).toBe(true);
    await expect(progress).not.toHaveText('');
    const next = (await newest()).id;
    if (how === 'waiting') await hook(next, 'waiting'); else await ui.locator('#handovershow').click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(async () => (await tabs()).at(-1).endsWith(' *')).toBe(true);
    const closed = act(ui, 'terminal:close', { id: next });
    await answer(ui);
    await closed;
    await expect.poll(async () => (await tabs()).length).toBe(3);
  }
  // New Conversation: the same agent from nothing, in a tab of its own.
  await rightClick(ui, `nav[aria-label="Terminals"] [data-id="${bash}"]`);
  await choose(ui, 'New Conversation');
  await expect.poll(async () => JSON.stringify(await tabs()) === '["bash","Pay with cards","Fake agent","bash 2 *"]' && (await newest()).pty, { timeout: 20000 }).toBe(true);
  expect(conversations().map((c: { agent: string }) => c.agent)).toEqual(['custom', a.id, b.id, b.id, b.id, 'custom']);
  // Its program not found: its tab came at once, starting, and the human is asked for another; none chosen, it goes.
  const bin = fakeBin(files);
  await renamed(bin, `${bin}.away`);
  try {
    const opened = act(ui, 'terminal:open', { agent: a.id }); // it answers once the human has chosen
    await expect(ui.getByRole('status').filter({ hasText: /^Starting / }), "numbered: a's other tab is open").toHaveText('Starting Fake agent 2…');
    await expect(ui.locator('#agentcancel')).toBeVisible();
    await ui.locator('#agentcancel').click();
    await opened;
    await expect.poll(tabs).toEqual(['bash', 'Pay with cards', 'Fake agent', 'bash 2 *']);
    await expect(ui.getByRole('status').filter({ hasText: /^Starting / })).toHaveCount(0);
  } finally { await renamed(`${bin}.away`, bin); }
  // All closed, no profile open: the big buttons, an account's email under its agent's name, no keys; the first has
  // the keyboard, Tab moves to the next, Enter opens it.
  // Each an agent's: asked first.
  for (const t of await terms()) {
    const closed = act(ui, 'terminal:close', { id: t.id });
    await answer(ui);
    await closed;
  }
  const launchers = ui.getByRole('navigation', { name: 'New terminal' }).getByRole('button');
  await expect(launchers).toHaveCount(3);
  for (const [i, [name, email, title]] of [['Fake agent', 'a@switch.test', 'Fake agent · a@switch.test'], ['Fake agent', 'b@switch.test', 'Fake agent · b@switch.test'], ['Terminal', '', 'Terminal']].entries()) {
    await expect(launchers.nth(i)).toHaveAccessibleName(name);
    await (email ? expect(launchers.nth(i).locator('small')).toHaveText(email) : expect(launchers.nth(i).locator('small')).toHaveCount(0));
    await expect(launchers.nth(i)).toHaveAttribute('title', title);
  }
  // Under them the project's profiles, a tile each.
  await expect(ui.locator('#dock').getByRole('navigation', { name: 'Open a profile' }).getByRole('button')).toHaveText(['Sam.admin', 'Elon.buyer', 'Dora']);
  await expect(launchers.first()).toBeFocused();
  await focusWindow(core, ui);
  await ui.keyboard.press('Tab');
  await expect(launchers.nth(1)).toBeFocused();
  await ui.keyboard.press('Enter');
  await expect.poll(async () => { const ts = await terms(); return ts.length === 1 && ts[0].agent === b.id; }, { timeout: 20000 }).toBe(true);

  // Deleting the task forgets every conversation, each in its account's folder.
  const deleted = invoke(ui, 'task:delete', key);
  await answer(ui);
  await deleted;
  await expect.poll(() => core((k, t) => !k.shell.taskByKey(t), key)).toBe(true);
  expect(fs.existsSync(file), "the fake agent's, in its account").toBe(false);
  for (const x of [a, b]) await invoke(ui, 'project:agent-remove', { id: files.pid('project'), agent: x.id });
  await core(async (k, ids) => {
    for (const x of ids) { k.shell.accounts.drop(x.id); k.removeTree(x.dir); }
  }, [a, b]);
});
