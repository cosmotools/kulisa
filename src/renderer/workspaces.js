// Workspaces (docs/workspaces.md): a tab per workspace (main and its forks) with its agent's state (working, waiting
// for you, done), in its project's island in the projects' bar (projects.js puts them there; every open project's). A
// click shows one, of any project; × deletes a fork or, on main, closes the project (asking first); + makes a fork of
// main with a name asked in a dialog; the shown one's chip shows its profiles (profile-editor.js); a right-click
// shows them too, and its folder. Forks need git and a first commit: until then there is no + (docs/workspaces.md
// says why).
//   workspaces.current   the shown workspace's key ("<project id>/<n>"); null when no project is open (the Welcome
//                        screen)
const workspaces = (() => {
  const list = document.getElementById('wslist');
  const add = document.getElementById('wsadd');
  const dialog = document.getElementById('wsnew');
  const form = document.getElementById('wsform');
  const name = document.getElementById('wsname');
  const agent = document.getElementById('wsagent');
  const error = dialog.querySelector('.error');
  const create = document.getElementById('wscreate');
  const ws = { current: null };
  const profilesButton = document.getElementById('openProfiles');
  // A workspace's tab, the shown project's or another open one's (projects.js). active: the one on screen; selected:
  // the one its project shows (another project's: where it is when shown again).
  ws.tab = (w, active, selected = active) => {
    const el = tpl('tpl-wstab');
    el.dataset.ws = w.key;
    el.classList.toggle('active', active);
    el.classList.toggle('selected', selected);
    el.querySelector('.name').textContent = w.name;
    showAgentState(el.querySelector('.state'), w.state);
    // How many profiles are open there, on every tab (their widths stay as the shown one changes); on the shown one a
    // button with the menu of them (profile-editor.js).
    const chip = el.querySelector('.chip');
    chip.querySelector('.count').textContent = w.profiles;
    if (active) chip.replaceWith(profilesButton);
    else chip.title = `${w.profiles} profile${w.profiles === 1 ? '' : 's'} open`;
    el.title = w.main ? `main: the project itself, ${w.folder}` : `branch ${w.branch} in ${w.folder}; the app's ports + ${w.offset}`;
    el.querySelector('.close').title = w.main ? 'Close the project (asks first)' : 'Delete this workspace: its folder, branch, profile copies and conversation (asks first)';
    return el;
  };
  // The shown project's tabs: from the projects' news as a project is shown (projects.js), so its island has them at
  // once, not the last project's until the workspaces' news; then from that.
  ws.showList = (all, current) => list.replaceChildren(...all.map((w) => ws.tab(w, w.key === current)));

  kulisa.on('workspaces', ({ current, list: all, git }) => {
    // Its terminal once the grid on screen has gone.
    if (current !== null && (current !== ws.current || !term)) Promise.resolve(leaving).then(() => showTerminal(current));
    ws.current = current;
    document.documentElement.classList.toggle('noproject', current === null);
    ws.showList(all, current);
    add.classList.toggle('off', git !== 'ok'); // its room kept: the island keeps its width
  });
  // Any project's workspace tab: another project's shows that project with it (app.js, ws:show).
  document.getElementById('projectTabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.wstab');
    if (!tab) return;
    const key = tab.dataset.ws;
    if (e.target.closest('.close')) kulisa.invoke('ws:close', key);
    else if (key !== ws.current) kulisa.invoke('ws:show', key);
  });
  // Its right-click menu: the shown one's profiles, as its chip's menu; the workspace's folder (main's is the
  // project's, a fork's its worktree) in the file manager.
  document.getElementById('projectTabs').addEventListener('contextmenu', (e) => {
    const key = e.target.closest('.wstab')?.dataset.ws;
    if (!key) return;
    e.preventDefault();
    openMenu([
      ...(key === ws.current ? [{ heading: 'Profiles' }, ...profileEditor.menu(), '-'] : []),
      { label: 'Show Folder', run: () => kulisa.invoke('ws:show-folder', key) },
    ], e);
  });
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

// The window's actions on the shown workspace's profiles and tabs name it, as the grid's layout does: one sent just as
// the human switches workspaces or projects is refused, not done in the other one (app.js, wsOf).
const act = (channel, args = {}) => kulisa.invoke(channel, { ...args, ws: workspaces.current });
