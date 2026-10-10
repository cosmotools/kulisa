// Tasks (docs/tasks.md): a tab per open task with its agent's state (working, waiting for you, done), in its
// project's group in the projects' bar (projects.js puts them there, with the group's +; every open project's). A
// click shows one, of any project; × closes it (its agent stops, it stays in its project's group menu; the last one
// closes the project); the shown one's chip shows its profiles (profile-editor.js). Its right-click menu: those
// profiles, Rename… (a dialog: its name and branch), Show Folder, Delete Task….
//   tasks.current   the shown task's key ("<project id>/<n>"); null when no project is open (the Welcome screen)
//   tasks.tab(info, active, selected)   a task's tab
//   tasks.showList(list, current)       the shown project's tabs
const tasks = (() => {
  const list = document.getElementById('tasklist');
  const dialog = document.getElementById('taskrename');
  const form = document.getElementById('taskform');
  const name = document.getElementById('taskname');
  const error = dialog.querySelector('.error');
  const bar = { current: null };
  const profilesButton = document.getElementById('openProfiles');
  // A task's tab, the shown project's or another open one's (projects.js). active: the one on screen; selected:
  // the one its project shows (another project's: where it is when shown again).
  bar.tab = (t, active, selected = active) => {
    const el = tpl('tpl-tasktab');
    el.dataset.task = t.key;
    el.classList.toggle('active', active);
    el.classList.toggle('selected', selected);
    el.querySelector('.name').textContent = t.name;
    showAgentState(el.querySelector('.state'), t.state);
    // How many profiles are open there, on every tab (their widths stay as the shown one changes); on the shown one a
    // button with the menu of them (profile-editor.js).
    const chip = el.querySelector('.chip');
    chip.querySelector('.count').textContent = t.profiles;
    if (active) chip.replaceWith(profilesButton);
    else chip.title = `${t.profiles} profile${t.profiles === 1 ? '' : 's'} open`;
    el.title = t.branch ? `branch ${t.branch} in ${t.folder}; the app's ports + ${t.offset}` : `in the project's folder ${t.folder} (no git: no copy of its own)`;
    el.querySelector('.close').title = 'Close the task: its agent stops, all else stays (open it again from its project\'s menu)';
    return el;
  };
  // The shown project's tabs: from the projects' news as a project is shown (projects.js), so its group has them at
  // once, not the last project's until the tasks' news; then from that.
  bar.showList = (all, current) => list.replaceChildren(...all.map((t) => bar.tab(t, t.key === current)));

  kulisa.on('tasks', ({ current, list: all }) => {
    // Its terminal once the grid on screen has gone.
    if (current !== null && (current !== bar.current || !term)) Promise.resolve(leaving).then(() => showTerminal(current));
    bar.current = current;
    document.documentElement.classList.toggle('noproject', current === null);
    bar.showList(all, current);
  });
  // Any project's task tab: another project's shows that project with it (app.js, task:show).
  document.getElementById('projectTabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.tasktab');
    if (!tab) return;
    const key = tab.dataset.task;
    if (e.target.closest('.close')) kulisa.invoke('task:close', key);
    else if (key !== bar.current) kulisa.invoke('task:show', key);
  });
  // Its right-click menu: the shown one's profiles, as its chip's menu; renaming it; its folder (a copy of the
  // project's, or the project's own without git) in the file manager; deleting it, after a question.
  document.getElementById('projectTabs').addEventListener('contextmenu', (e) => {
    const tab = e.target.closest('.tasktab');
    if (!tab) return;
    e.preventDefault();
    const key = tab.dataset.task;
    openMenu([
      ...(key === bar.current ? [{ heading: 'Profiles' }, ...profileEditor.menu(), '-'] : []),
      { label: 'Rename…', run: () => rename(key, tab.querySelector('.name').textContent) },
      { label: 'Show Folder', run: () => kulisa.invoke('task:show-folder', key) },
      '-', { label: 'Delete Task…', run: () => kulisa.invoke('task:delete', key) },
    ], e);
  });

  const showDialog = coverWhileOpen(dialog);
  let renaming = null;
  function rename(key, current) {
    renaming = key;
    name.value = current; error.textContent = '';
    showDialog(); name.select();
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!name.value.trim()) return name.focus();
    const r = await kulisa.invoke('task:rename', { key: renaming, name: name.value });
    if (r?.error) error.textContent = r.error; else dialog.close();
  };
  kulisa.invoke('tasks:get');
  // A task whose agent is not chosen or not installed: the window asks (a module of its own, loaded then), once
  // the grid it is for is on screen.
  kulisa.on('agent:choose', async (q) => {
    await leaving;
    (await import('./agent-picker.js')).chooseAgent(q);
  });
  return bar;
})();

// The window's actions on the shown task's profiles and tabs name it, as the grid's layout does: one sent just as
// the human switches tasks or projects is refused, not done in the other one (app.js, onScreen).
const act = (channel, args = {}) => kulisa.invoke(channel, { ...args, task: tasks.current });
