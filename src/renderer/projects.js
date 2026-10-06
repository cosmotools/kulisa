// Projects: the project button (a menu of the projects, as in JetBrains), the Projects dialog (Manage Projects…), and
// the Welcome screen (no project open: at first start, or after closing main): what to open, as JetBrains' one.
// Removing a project is asked for from each of them (the main process asks the human and does it: removeProject).
// A project is a folder with its workspaces (workspaces.js); one is open at a time. Opening another one rebuilds the
// grid in place (renderer.js, grid:closing, then that project's state).
(() => {
  const dialog = document.getElementById('projects');
  const list = document.getElementById('projlist');
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
      const row = tpl('tpl-recent');
      row.querySelector('.label').textContent = p.name;
      row.querySelector('small').textContent = p.folder;
      row.style.setProperty('--color', p.color);
      row.dataset.project = p.id;
      return row;
    }));
    list.replaceChildren(...projects.map((p) => {
      const row = tpl('tpl-projrow');
      row.dataset.project = p.id;
      row.style.setProperty('--color', p.color);
      row.classList.toggle('current', p.id === current);
      row.querySelector('.name').textContent = p.name;
      const folder = row.querySelector('.folder');
      folder.textContent = folder.title = p.folder;
      row.querySelector('.open').onclick = () => kulisa.invoke('project:open', { id: p.id });
      row.querySelector('.remove').onclick = () => remove(p.id);
      return row;
    }));
  }
  kulisa.on('projects', showProjects);

  const showDialog = coverWhileOpen(dialog);
  async function manage() {
    showDialog(); // first: the closing menu shows the pages again unless a dialog is open
    showProjects(await kulisa.invoke('projects:list'));
  }
  button.onclick = async () => {
    const { current, projects } = await kulisa.invoke('projects:list');
    openMenu([
      ...projects.map((p) => (p.id === current ? { label: p.name, sub: p.folder, color: p.color, keys: '✓' }
        : { label: p.name, sub: p.folder, color: p.color, run: () => kulisa.invoke('project:open', { id: p.id }) })),
      '-',
      { label: 'New Project…', run: create },
      { label: 'Open Folder…', run: () => kulisa.invoke('project:open-folder') },
      { label: 'Manage Projects…', run: manage },
      ...(current === null ? [] : ['-', { label: 'Close Project', run: () => kulisa.invoke('project:close') },
        { label: 'Remove Project…', run: () => remove(current) }]),
    ], button);
  };
  // A recent project on the Welcome screen: a click opens it, its × (shown on hover) removes it.
  recent.onclick = (e) => {
    const id = e.target.closest('[data-project]')?.dataset.project;
    if (!id) return;
    if (e.target.closest('.remove')) remove(id); else if (e.target.closest('.item')) kulisa.invoke('project:open', { id });
  };
  // Right-click on a recent project of the Welcome screen.
  recent.addEventListener('contextmenu', (e) => {
    const id = e.target.closest('[data-project]')?.dataset.project;
    if (!id) return;
    e.preventDefault();
    openMenu([
      { label: 'Open', run: () => kulisa.invoke('project:open', { id }) },
      '-',
      { label: 'Remove Project…', run: () => remove(id) },
    ], e);
  });
  document.getElementById('openFolder').onclick = () => kulisa.invoke('project:open-folder');
  document.getElementById('welcome-open').onclick = () => kulisa.invoke('project:open-folder');
  // New Project…: its name and where its folder goes (a module of its own, loaded then).
  const create = async () => { dialog.close(); (await import('./new-project.js')).newProject(); };
  document.getElementById('welcome-new').onclick = create;
  document.getElementById('projectsNew').onclick = create;
})();
