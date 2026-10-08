// Projects: the projects' bar, under the grid or over it (☰), an island per open project as an app in a dock: its
// label (its icon, the curtain in its color, and its name), then its workspaces' tabs (workspaces.js), a click on one
// showing that project with it (the others keep running: their agents and pages). The label is no button: a
// right-click offers Close Project (asking first while its agent works; also the middle button), Move to New Window (a
// window of its own, e.g. for a second monitor; it keeps running), Move to Window (each other window; as a browser
// moves a tab) and Remove Project…. Dragging it does the same: within the bar it changes the order, onto another
// window's bar it moves the project there, let go outside every Kulisa window it opens a window there (the main
// process tells where the pointer is). The button after the islands opens the menu of the projects (as JetBrains':
// open one, remove one with its ×, New Project…, Open Folder…; one open in another window is shown there). With no
// project open: the Welcome screen, what to open, its recent projects acting as the menu's rows.
// Removing a project is asked for from either (the main process asks the human and does it: removeProject).
// A project is a folder with its workspaces (workspaces.js). Showing another one rebuilds the grid in place
// (renderer.js, grid:closing, then that project's state).
(() => {
  const tabs = document.getElementById('projectTabs');
  const workspacesNav = document.getElementById('workspaces'); // the shown project's workspaces, in its island
  const button = document.getElementById('openProjects');
  const recent = document.getElementById('welcome-list');
  let info = { current: null, projects: [], open: [], elsewhere: [] };
  const remove = (id) => kulisa.invoke('project:remove', { id });
  const openProject = (id) => kulisa.invoke('project:open', { id });
  const close = (id) => kulisa.invoke('project:close', { id });

  // The tabs, the shown project's color for the whole window (--project), and the Welcome screen's list.
  function showProjects(next) {
    info = next;
    const { current, projects, open } = info;
    const byId = new Map(projects.map((p) => [p.id, p]));
    tabs.replaceChildren(...open.filter((o) => byId.has(o.id)).map((o) => {
      const p = byId.get(o.id);
      const el = tpl('tpl-pisland');
      el.dataset.project = p.id;
      el.style.setProperty('--color', p.color);
      el.classList.toggle('active', p.id === current);
      el.title = p.folder || '';
      el.querySelector('.name').textContent = p.name;
      // The shown project's workspaces live (workspaces.js: + and git), its list from here at once (not the last
      // project's until the workspaces' news); another's as tabs to show it with.
      if (p.id === current) { workspaces.showList(o.workspaces || [], o.ws); el.append(workspacesNav); }
      else el.append(...(o.workspaces || []).map((w) => workspaces.tab(w, false, w.key === o.ws)));
      return el;
    }));
    if (!workspacesNav.isConnected) button.before(workspacesNav); // no project shown: kept in the bar, not shown
    tabs.querySelector('.active')?.scrollIntoView({ inline: 'nearest' });
    const shown = byId.get(current);
    if (shown) document.documentElement.style.setProperty('--project', shown.color);
    else document.documentElement.style.removeProperty('--project'); // no project: Kulisa's own colors
    recent.replaceChildren(...projects.map((p) => {
      const row = tpl('tpl-project');
      row.dataset.project = p.id;
      row.style.setProperty('--color', p.color);
      row.querySelector('.label').textContent = p.name;
      row.querySelector('small').textContent = row.querySelector('small').title = p.folder;
      return row;
    }));
  }
  // From the URL (app.js), before the first paint; later from the main process as projects open and close.
  const query = new URLSearchParams(location.search);
  if (query.get('projects')) showProjects(JSON.parse(query.get('projects')));
  document.getElementById('version').textContent = `Kulisa ${query.get('version')}`;
  kulisa.on('projects', showProjects);

  // A project's own events, not its workspaces' (workspaces.js handles those).
  const projectOf = (e) => (e.target.closest('#workspaces, .wstab') ? undefined : e.target.closest('[data-project]')?.dataset.project);
  // The label is not clicked to show its project: its workspaces are. The middle button closes it, as a browser's tab.
  tabs.onauxclick = (e) => {
    const id = e.button === 1 && projectOf(e);
    if (id) close(id);
  };
  tabs.addEventListener('contextmenu', async (e) => {
    const id = projectOf(e);
    if (!id) return;
    e.preventDefault();
    const { open, windows } = await kulisa.invoke('projects:list');
    const move = (to) => kulisa.invoke('project:move', { id, to, terminals: terminalsOf(id) });
    openMenu([{ label: 'Close Project', run: () => close(id) },
      // The only tab stays: a new window would be the same as this one.
      { label: 'Move to New Window', enabled: open.length > 1, run: () => move(null) },
      ...windows.map((w) => ({ label: `Move to Window: ${w.names.join(', ')}`, run: () => move(w.id) })),
      '-', { label: 'Show Data Folder', run: () => kulisa.invoke('project:show-data', { id }) },
      { label: 'Remove Project…', run: () => remove(id) }], e);
  });

  // HTML drag and drop, which also crosses windows. The tab carries its project and what its terminals show (the
  // window it goes to has neither), as a type of Kulisa's own: a page under the pointer takes nothing from it.
  const DRAG = 'application/x-kulisa-project';
  let dragged = null; // the tab dragged from this window
  const mark = (tab, side) => {
    for (const t of tabs.querySelectorAll('.drop-before, .drop-after')) t.classList.remove('drop-before', 'drop-after');
    tab?.classList.add(`drop-${side}`);
  };
  // Where a tab let go at e goes: before or after the tab under the pointer; the index among this window's tabs.
  const dropAt = (e) => {
    const tab = e.target.closest?.('[data-project]');
    if (!tab) return null;
    const r = tab.getBoundingClientRect(), side = e.clientX < r.x + r.width / 2 ? 'before' : 'after';
    return { tab, side, index: [...tabs.children].indexOf(tab) + (side === 'after') };
  };
  tabs.addEventListener('dragstart', (e) => {
    const tab = e.target.closest?.('[data-project]');
    if (!tab) return;
    dragged = tab;
    tab.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(DRAG, JSON.stringify({ id: tab.dataset.project, terminals: terminalsOf(tab.dataset.project) }));
  });
  tabs.addEventListener('dragover', (e) => {
    const at = e.dataTransfer.types.includes(DRAG) && dropAt(e);
    if (!at) return mark(null);
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    mark(at.tab, at.side);
  });
  tabs.addEventListener('dragleave', (e) => { if (!tabs.contains(e.relatedTarget)) mark(null); });
  tabs.addEventListener('drop', (e) => {
    const at = dropAt(e), data = e.dataTransfer.getData(DRAG);
    mark(null);
    if (!at || !data) return;
    e.preventDefault();
    const { id, terminals } = JSON.parse(data);
    kulisa.invoke('project:drop', { id, index: at.index, terminals });
  });
  // Let go where no Kulisa window took it: outside them all, it goes to a new window there (the main process checks).
  tabs.addEventListener('dragend', (e) => {
    dragged?.classList.remove('dragging');
    const id = dragged?.dataset.project;
    dragged = null;
    if (id && e.dataTransfer.dropEffect === 'none') kulisa.invoke('project:drag-out', { id, terminals: terminalsOf(id) });
  });

  button.onclick = async () => {
    const { current, projects, open, elsewhere } = await kulisa.invoke('projects:list');
    const isOpen = (id) => open.some((o) => o.id === id) || elsewhere.includes(id);
    openMenu([
      ...projects.map((p) => ({ label: p.name, sub: p.folder, color: p.color, ...(isOpen(p.id) ? { keys: '✓' } : {}),
        ...(p.id === current ? {} : { run: () => (isOpen(p.id) ? kulisa.invoke('project:show', { id: p.id }) : openProject(p.id)) }),
        remove: { title: 'Remove project…', run: () => remove(p.id) } })),
      '-',
      { label: 'New Project…', run: create },
      { label: 'Open Folder…', run: () => kulisa.invoke('project:open-folder') },
      ...(current === null ? [] : ['-', { label: 'Close Project', run: () => close(current) },
        { label: 'Remove Project…', run: () => remove(current) }]),
    ], button);
  };
  // A project on the Welcome screen: a click opens it, its × (shown on hover) removes it; a right-click offers the
  // same.
  recent.onclick = (e) => {
    const id = e.target.closest('[data-project]')?.dataset.project;
    if (!id) return;
    if (e.target.closest('.remove')) remove(id); else if (e.target.closest('.item')) openProject(id);
  };
  recent.addEventListener('contextmenu', (e) => {
    const id = e.target.closest('[data-project]')?.dataset.project;
    if (!id) return;
    e.preventDefault();
    openMenu([{ label: 'Open', run: () => openProject(id) }, '-', { label: 'Remove Project…', run: () => remove(id) }], e);
  });
  document.getElementById('welcome-open').onclick = () => kulisa.invoke('project:open-folder');
  // New Project…: its name and where its folder goes (a module of its own, loaded then).
  const create = async () => (await import('./new-project.js')).newProject();
  document.getElementById('welcome-new').onclick = create;
  // Agents…: what is installed, and installing one, before any project (agents.js, loaded then).
  document.getElementById('welcome-agents').onclick = async () => (await import('./agents.js')).showAgents();
})();
