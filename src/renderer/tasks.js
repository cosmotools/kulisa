// Tasks (docs/tasks.md): a tab per task (main and its forks) with its agent's state (working, waiting
// for you, done), in its project's island in the projects' bar (projects.js puts them there; every open project's). A
// click shows one, of any project; × deletes a fork or, on main, closes the project (asking first); + makes a fork of
// main with a name asked in a dialog; the shown one's chip shows its profiles (profile-editor.js); a right-click
// shows them too, and its folder. Forks need git and a first commit: until then there is no + (docs/tasks.md
// says why).
//   tasks.current   the shown task's key ("<project id>/<n>"); null when no project is open (the Welcome
//                        screen)
const tasks = (() => {
  const list = document.getElementById('tasklist');
  const add = document.getElementById('taskadd');
  const dialog = document.getElementById('tasknew');
  const form = document.getElementById('taskform');
  const name = document.getElementById('taskname');
  const agent = document.getElementById('taskagent');
  const error = dialog.querySelector('.error');
  const create = document.getElementById('taskcreate');
  const task = { current: null };
  const profilesButton = document.getElementById('openProfiles');
  // A task's tab, the shown project's or another open one's (projects.js). active: the one on screen; selected:
  // the one its project shows (another project's: where it is when shown again).
  task.tab = (w, active, selected = active) => {
    const el = tpl('tpl-tasktab');
    el.dataset.task = w.key;
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
    el.querySelector('.close').title = w.main ? 'Close the project (asks first)' : 'Delete this task: its folder, branch, profile copies and conversation (asks first)';
    return el;
  };
  // The shown project's tabs: from the projects' news as a project is shown (projects.js), so its island has them at
  // once, not the last project's until the tasks' news; then from that.
  task.showList = (all, current) => list.replaceChildren(...all.map((w) => task.tab(w, w.key === current)));

  kulisa.on('tasks', ({ current, list: all, git }) => {
    // Its terminal once the grid on screen has gone.
    if (current !== null && (current !== task.current || !term)) Promise.resolve(leaving).then(() => showTerminal(current));
    task.current = current;
    document.documentElement.classList.toggle('noproject', current === null);
    task.showList(all, current);
    add.classList.toggle('off', git !== 'ok'); // its room kept: the island keeps its width
  });
  // Any project's task tab: another project's shows that project with it (app.js, task:show).
  document.getElementById('projectTabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.tasktab');
    if (!tab) return;
    const key = tab.dataset.task;
    if (e.target.closest('.close')) kulisa.invoke('task:close', key);
    else if (key !== task.current) kulisa.invoke('task:show', key);
  });
  // Its right-click menu: the shown one's profiles, as its chip's menu; the task's folder (main's is the
  // project's, a fork's its worktree) in the file manager.
  document.getElementById('projectTabs').addEventListener('contextmenu', (e) => {
    const key = e.target.closest('.tasktab')?.dataset.task;
    if (!key) return;
    e.preventDefault();
    openMenu([
      ...(key === task.current ? [{ heading: 'Profiles' }, ...profileEditor.menu(), '-'] : []),
      { label: 'Show Folder', run: () => kulisa.invoke('task:show-folder', key) },
    ], e);
  });
  // Whether forks are possible is checked again as the pointer comes (git init or a first commit in the terminal).
  document.getElementById('tasks').addEventListener('pointerenter', () => kulisa.invoke('tasks:get'));

  const showDialog = coverWhileOpen(dialog);
  // The new task's agent: main's unless the human picks another (asked and installed at its start if needed).
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
    const r = await kulisa.invoke('task:new', { name: name.value, agent: agent.value || null });
    create.disabled = false; create.textContent = 'Create';
    if (r?.error) { error.textContent = r.error; if (!dialog.open) showDialog(); } else dialog.close();
  };
  kulisa.invoke('tasks:get');
  // A task whose agent is not chosen or not installed: the window asks (a module of its own, loaded then), once
  // the grid it is for is on screen.
  kulisa.on('agent:choose', async (q) => {
    await leaving;
    (await import('./agent-picker.js')).chooseAgent(q);
  });
  return task;
})();

// The window's actions on the shown task's profiles and tabs name it, as the grid's layout does: one sent just as
// the human switches tasks or projects is refused, not done in the other one (app.js, onScreen).
const act = (channel, args = {}) => kulisa.invoke(channel, { ...args, task: tasks.current });
