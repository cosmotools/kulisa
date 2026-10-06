// Workspaces (ROADMAP, "Workspaces"): the strip under the grid, as a browser's tab strip. A tab per workspace of the
// open project (main and its forks) with its agent's state (working, waiting for you, done); a click shows one, ×
// closes it (a fork is deleted, asking first when it has changes; main closes the project), + makes a fork of main
// with a name asked in a dialog. Forks need git: without it + is off, and "Initialize git…" offers git init.
//   workspaces.current   the shown workspace's number; null when no project is open (the window offers to open one)
const workspaces = (() => {
  const list = document.getElementById('wslist');
  const add = document.getElementById('wsadd');
  const init = document.getElementById('wsinit');
  const dialog = document.getElementById('wsnew');
  const form = document.getElementById('wsform');
  const name = document.getElementById('wsname');
  const agent = document.getElementById('wsagent');
  const error = dialog.querySelector('.error');
  const create = form.querySelector('button');
  const ws = { current: null };
  const STATES = { working: 'The agent is working', waiting: 'The agent waits for you', done: 'The agent is done' };

  kulisa.on('workspaces', ({ current, list: all, git }) => {
    // Its terminal once the grid on screen has gone (another project: the terminals were reset).
    if (current !== null && (current !== ws.current || !term)) Promise.resolve(leaving).then(() => showTerminal(current));
    ws.current = current;
    document.documentElement.classList.toggle('noproject', current === null);
    list.replaceChildren(...all.map((w) => {
      const el = tpl('tpl-wstab');
      el.dataset.ws = w.n;
      el.classList.toggle('active', w.n === current);
      el.querySelector('.name').textContent = w.name;
      const state = el.querySelector('.state');
      state.dataset.state = w.state || '';
      state.title = STATES[w.state] || '';
      el.title = w.main ? `main: the project itself, ${w.folder}` : `branch ${w.branch} in ${w.folder}; the app's ports + ${w.offset}`;
      el.querySelector('.close').title = w.main ? 'Close the project' : 'Delete this workspace: its folder, branch, profile copies and conversation (asks first)';
      return el;
    }));
    add.disabled = git !== 'ok';
    add.title = git === 'ok' ? 'New workspace: a fork of main with its own branch, folder, agent and copies of the profiles'
      : git === 'no-commit' ? 'Workspaces need a first commit in git' : 'Workspaces need git';
    init.hidden = git !== 'none';
  });
  list.onclick = (e) => {
    const tab = e.target.closest('.wstab');
    if (!tab) return;
    const n = Number(tab.dataset.ws);
    if (e.target.closest('.close')) kulisa.invoke('ws:close', n);
    else if (n !== ws.current) kulisa.invoke('ws:show', n);
  };
  init.onclick = () => kulisa.invoke('ws:git-init');
  // Whether forks are possible is checked again as the pointer comes (git init or a first commit in the terminal).
  document.getElementById('workspaces').addEventListener('pointerenter', () => kulisa.invoke('workspaces:get'));

  const showDialog = coverWhileOpen(dialog);
  // The new workspace's agent: main's unless the human picks another (asked and installed at its start if needed).
  add.onclick = async () => {
    name.value = ''; error.textContent = ''; create.disabled = false; create.textContent = 'Create';
    showDialog(); name.focus();
    const { list: all, main } = await kulisa.invoke('agents:list');
    agent.replaceChildren(...all.map((a) => Object.assign(document.createElement('option'), { value: a.id, textContent: a.name, selected: a.id === main })));
  };
  // Making one takes a moment (git, copies of the profiles); the dialog says so meanwhile.
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!name.value.trim()) return name.focus();
    create.disabled = true; create.textContent = 'Creating…'; error.textContent = '';
    const r = await kulisa.invoke('ws:new', { name: name.value, agent: agent.value || null });
    create.disabled = false; create.textContent = 'Create';
    if (r?.error) { error.textContent = r.error; if (!dialog.open) showDialog(); } else dialog.close();
  };
  kulisa.invoke('workspaces:get');
  // A workspace whose agent is not chosen or not installed: the window asks (a module of its own, loaded then), once
  // the grid it is for is on screen.
  kulisa.on('agent:choose', async (q) => {
    await leaving;
    (await import('./agent-picker.js')).chooseAgent(q);
  });
  return ws;
})();
