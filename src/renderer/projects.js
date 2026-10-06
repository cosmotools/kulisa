// Projects: the project button (a menu of the projects, as in JetBrains: open one, remove one with its ×, New
// Project…, Open Folder…, Close Project) and the Welcome screen (no project open: at first start, or after closing
// main): what to open, as JetBrains' one, its recent projects acting as the menu's rows.
// Removing a project is asked for from either (the main process asks the human and does it: removeProject).
// A project is a folder with its workspaces (workspaces.js); one is open at a time. Opening another one rebuilds the
// grid in place (renderer.js, grid:closing, then that project's state).
(() => {
  const button = document.getElementById('openProjects');
  // The open project in the title bar: its name, and its color for the whole window (--project).
  const showProject = ({ name, color }) => {
    document.getElementById('projectName').textContent = name;
    document.documentElement.style.setProperty('--project', color);
  };
  // From the URL (app.js), before the first paint; later from the main process when a project opens.
  const query = new URLSearchParams(location.search);
  const fromUrl = query.get('project');
  if (fromUrl) showProject(JSON.parse(fromUrl));
  document.getElementById('version').textContent = `Kulisa ${query.get('version')}`;
  const recent = document.getElementById('welcome-list');
  const remove = (id) => kulisa.invoke('project:remove', { id });
  function showProjects({ current, projects }) {
    const open = projects.find((p) => p.id === current);
    if (open) showProject(open);
    else if (current === null) { // the window with no project: Kulisa's own colors
      document.getElementById('projectName').textContent = 'No project';
      document.documentElement.style.removeProperty('--project');
    }
    recent.replaceChildren(...projects.map((p) => {
      const row = tpl('tpl-project');
      row.dataset.project = p.id;
      row.style.setProperty('--color', p.color);
      row.querySelector('.label').textContent = p.name;
      row.querySelector('small').textContent = row.querySelector('small').title = p.folder;
      return row;
    }));
  }
  kulisa.on('projects', showProjects);

  button.onclick = async () => {
    const { current, projects } = await kulisa.invoke('projects:list');
    openMenu([
      ...projects.map((p) => ({ label: p.name, sub: p.folder, color: p.color, ...(p.id === current ? { keys: '✓' } : { run: () => openProject(p.id) }),
        remove: { title: 'Remove project…', run: () => remove(p.id) } })),
      '-',
      { label: 'New Project…', run: create },
      { label: 'Open Folder…', run: () => kulisa.invoke('project:open-folder') },
      ...(current === null ? [] : ['-', { label: 'Close Project', run: () => kulisa.invoke('project:close') },
        { label: 'Remove Project…', run: () => remove(current) }]),
    ], button);
  };
  // A project in the menu or on the Welcome screen: a click opens it, its × (shown on hover) removes it; on the Welcome
  // screen a right-click offers the same.
  const openProject = (id) => kulisa.invoke('project:open', { id });
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
})();
