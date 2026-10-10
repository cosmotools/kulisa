// New Project… and Project Settings… (projects.js), one dialog. New Project…, as JetBrains': a name, and the location
// its folder goes in (~/Kulisa unless the human types or browses to another); the dialog shows the folder it makes, so
// the human knows where the agent's files are; Create Git repository (on by default: each task gets a copy of its
// own). Both: its color (a dot each), its icon (its site's favicon when it has one, Kulisa's set, or the app's
// curtain in its color) and the agent its new tasks run. Settings show the folder, which stays. The main process
// checks and saves (project:new, project:settings). An ES module loaded when needed, CLAUDE.md "Window UI".
//   newProject()       show the dialog for a new project
//   editProject(id)    show it for that project
const dialog = document.getElementById('newproject');
const form = document.getElementById('npform');
const title = dialog.querySelector('h2');
const name = document.getElementById('npname');
const place = document.getElementById('nplocation');
const where = document.getElementById('npwhere');
const git = document.getElementById('npgit');
const colors = document.getElementById('npcolors');
const icons = document.getElementById('npicons');
const agent = document.getElementById('npagent');
const create = document.getElementById('npcreate');
const error = dialog.querySelector('.error');
const showDialog = coverWhileOpen(dialog);
let sep = '/', editing = null, folder = '';

const target = () => (editing ? folder : `${place.value.trim().replace(/[\\/]+$/, '')}${sep}${name.value.trim()}`);
const update = () => {
  where.textContent = editing ? `Its folder: ${folder}` : name.value.trim() && place.value.trim() ? `The project will be created in ${target()}` : '';
  error.textContent = '';
};
name.oninput = place.oninput = update;

// The buttons to choose from, the chosen one pressed; a click presses another.
const chosen = (group) => group.querySelector('[aria-pressed="true"]')?.dataset.value;
function choices(group, values, current, draw) {
  group.replaceChildren(...values.map((v) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'icon'; b.dataset.value = v; b.ariaPressed = String(v === current);
    draw(b, v);
    return b;
  }));
  group.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    for (const x of group.children) x.ariaPressed = String(x === b);
    if (group === colors) icons.style.setProperty('--color', b.dataset.value);
  };
}
// Its choices and values: { colors, icons, agents, favicon } from the main process; values: { color, icon, agent }.
function fill(c, { color, icon, agent: a }) {
  choices(colors, c.colors, color, (b, v) => {
    b.title = b.ariaLabel = v;
    b.append(Object.assign(document.createElement('span'), { className: 'dot' }));
    b.style.setProperty('--color', v);
  });
  icons.style.setProperty('--color', color);
  choices(icons, [...(c.favicon ? ['favicon'] : []), ...c.icons], icon, (b, v) => {
    b.title = b.ariaLabel = v === 'favicon' ? "The site's favicon" : v === 'logo' ? "Kulisa's curtain" : v;
    if (v === 'favicon') b.append(Object.assign(document.createElement('img'), { src: c.favicon, alt: '' }));
    else b.append(projectIcon(v));
  });
  agent.replaceChildren(new Option('Ask when a task starts', ''), ...c.agents.map((x) => new Option(x.name, x.id, false, x.id === a)));
  agent.value = a || '';
}

export async function newProject() {
  const c = await kulisa.invoke('project:new-defaults');
  editing = null; sep = c.sep;
  title.textContent = 'New Project'; create.textContent = 'Create';
  name.value = ''; place.value = c.location; git.checked = true; create.disabled = false;
  document.getElementById('nplocationrow').hidden = document.getElementById('npgitrow').hidden = false;
  fill(c, { color: c.color, icon: 'logo', agent: c.agents[0]?.id });
  update();
  showDialog();
  name.focus();
}
export async function editProject(id) {
  const c = await kulisa.invoke('project:settings-get', { id });
  if (c.error) return;
  editing = id; folder = c.folder;
  title.textContent = 'Project Settings'; create.textContent = 'Save';
  name.value = c.name; create.disabled = false;
  document.getElementById('nplocationrow').hidden = document.getElementById('npgitrow').hidden = true;
  fill(c, c);
  update();
  showDialog();
  name.focus();
}
document.getElementById('npbrowse').onclick = async () => {
  const picked = await kulisa.invoke('project:pick-location', { location: place.value.trim() });
  if (picked) { place.value = picked; update(); }
};
form.onsubmit = async (e) => {
  e.preventDefault();
  if (!name.value.trim()) return name.focus();
  create.disabled = true;
  const look = { name: name.value, color: chosen(colors), icon: chosen(icons), agent: agent.value || null };
  const r = editing ? await kulisa.invoke('project:settings', { id: editing, ...look })
    : await kulisa.invoke('project:new', { ...look, location: place.value, git: git.checked });
  create.disabled = false;
  if (r?.error) error.textContent = r.error; else dialog.close();
};
