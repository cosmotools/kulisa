// The projects' manager (projects.js; the title bar's button): every project on the left, open or not, and + New
// Project; on the right one project's configuration, which its tasks are made from (tasks.md, Projects). New Project,
// as JetBrains': a name, and the location its folder goes in (~/Kulisa unless the human types or browses to another);
// it shows the folder it makes, so the human knows where the agent's files are; Create Git repository (on by default:
// each task gets a copy of its own); its first agent. A project's configuration: its folder, which stays; its code,
// the repositories or folders its tasks copy (the radio makes one the default: its agents start in its copy; × removes
// one; Add Folder… and Clone add one); its agents (the radio makes one the default: + runs it, the others are in +'s
// right-click menu; Add Agent…, ×); its profiles (New, From Another Project…, ×); these at once, not on Save. Both: its
// color (a dot each), its icon (its site's favicon when it has one, Kulisa's set, or the app's curtain in its color);
// its local addresses. The main process checks and saves (project:new, project:settings, project:repo-*,
// project:agent-*, project:profile-*). An ES module loaded when needed, CLAUDE.md "Window UI".
//   openProjects(id)   show the manager at that project (else the shown one, else the first; none: a new one)
//   newProject()       show it with a new project
const dialog = document.getElementById('projects');
const form = document.getElementById('npform');
const list = document.getElementById('pjlist');
const title = document.getElementById('pjtitle');
const name = document.getElementById('npname');
const place = document.getElementById('nplocation');
const where = document.getElementById('npwhere');
const git = document.getElementById('npgit');
const colors = document.getElementById('npcolors');
const icons = document.getElementById('npicons');
const agent = document.getElementById('npagent');
const create = document.getElementById('npcreate');
const hint = document.getElementById('nphint');
const error = document.getElementById('nperror');
const repos = document.getElementById('nprepos');
const url = document.getElementById('npurl');
const former = document.getElementById('npformer');
const showDialog = coverWhileOpen(dialog);
const newRows = ['nplocationrow', 'npgitrow', 'npagentrow'].map((id) => document.getElementById(id));
const configRows = ['npreposrow', 'npreposadd', 'npagentsrow', 'npagentsadd', 'npprofilesrow', 'npprofilesadd', 'nplocalrow'].map((id) => document.getElementById(id));
let sep = '/', editing = null, folder = '';

const target = () => (editing ? folder : `${place.value.trim().replace(/[\\/]+$/, '')}${sep}${name.value.trim()}`);
const update = () => {
  where.textContent = !editing && name.value.trim() && place.value.trim() ? `The project will be created in ${target()}` : '';
  error.textContent = '';
};
name.oninput = place.oninput = update;

// The projects, the one on the right chosen; open ones (in any window) marked.
async function showList() {
  const { projects, open, elsewhere } = await kulisa.invoke('projects:list');
  list.replaceChildren(...projects.map((p) => {
    const b = tpl('tpl-pjrow');
    b.dataset.project = p.id;
    b.style.setProperty('--color', p.color);
    b.querySelector('.label').textContent = p.name;
    b.querySelector('small').textContent = b.querySelector('small').title = p.folder;
    b.querySelector('kbd').textContent = open.some((o) => o.id === p.id) || elsewhere.includes(p.id) ? 'open' : '';
    b.ariaCurrent = String(p.id === editing);
    return b;
  }));
  return projects;
}
list.onclick = (e) => {
  const id = e.target.closest('[data-project]')?.dataset.project;
  if (id && id !== editing) edit(id);
};
document.getElementById('pjnew').onclick = () => fresh();

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
// Its choices: { colors, icons, agents, favicon } from the main process; values: { color, icon }.
let accounts = [];
function fill(c, { color, icon }) {
  accounts = c.agents;
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
}
function mode(isNew) {
  for (const r of newRows) r.hidden = !isNew;
  for (const r of configRows) r.hidden = isNew;
  former.hidden = true;
  create.textContent = isNew ? 'Create' : 'Save';
  create.disabled = false;
  hint.textContent = isNew ? 'The agent its tasks run; add more in its configuration.'
    : '+ makes a task from this configuration: copies of its code, its default agent, its profiles closed until needed.';
}

async function fresh() {
  const c = await kulisa.invoke('project:new-defaults');
  editing = null; sep = c.sep;
  title.textContent = 'New Project';
  mode(true);
  name.value = ''; place.value = c.location; git.checked = true;
  fill(c, { color: c.color, icon: 'logo' });
  agent.replaceChildren(new Option('Ask when a task starts', ''), ...c.agents.map((x) => new Option(x.name, x.id)));
  agent.value = c.agents[0]?.id || '';
  update();
  await showList();
  name.focus();
}
async function edit(id) {
  const c = await kulisa.invoke('project:settings-get', { id });
  if (c.error) return fresh();
  editing = id; folder = c.folder;
  title.textContent = c.name;
  mode(false);
  name.value = c.name;
  url.value = ''; codeError.textContent = ''; agentError.textContent = ''; newProfile.value = ''; profileError.textContent = '';
  fill(c, c);
  document.getElementById('nplocal').value = (c.local || []).join(' ');
  showCode(c);
  showAgents(c);
  showProfiles(c);
  update();
  await showList();
  name.focus();
}
export async function openProjects(id) {
  const { current, projects } = await kulisa.invoke('projects:list');
  const at = id || current || projects[0]?.id;
  await (at ? edit(at) : fresh());
  if (!dialog.open) showDialog();
}
export async function newProject() {
  await fresh();
  if (!dialog.open) showDialog();
}

document.getElementById('npbrowse').onclick = async () => {
  const picked = await kulisa.invoke('project:pick-location', { location: place.value.trim() });
  if (picked) { place.value = picked; update(); }
};
form.onsubmit = async (e) => {
  e.preventDefault();
  if (!name.value.trim()) return name.focus();
  create.disabled = true;
  const look = { name: name.value, color: chosen(colors), icon: chosen(icons) };
  const r = editing ? await kulisa.invoke('project:settings', { id: editing, ...look, local: document.getElementById('nplocal').value.split(/[\s,]+/).filter(Boolean) })
    : await kulisa.invoke('project:new', { ...look, agent: agent.value || null, location: place.value, git: git.checked });
  create.disabled = false;
  if (r?.error) error.textContent = r.error; else dialog.close();
};

// Its repositories or folders, the default first, and its former folder (no git: tasks no longer work in it).
let shownCode = null; // as shown last: drawn again when a change is refused, its radio back on the default
function showCode(c) {
  shownCode = c;
  const { repos: rows, former: old } = c;
  repos.replaceChildren(...rows.map(({ folder: f, git: g }, i) => {
    const row = tpl('tpl-repo');
    row.dataset.folder = f;
    row.querySelector('.label').textContent = f.split(/[\\/]/).pop();
    row.querySelector('small').textContent = row.querySelector('small').title = f;
    row.querySelector('kbd').textContent = g === 'ok' ? '' : g === 'none' ? 'no git' : 'no commit';
    const radio = row.querySelector('input');
    radio.checked = i === 0;
    radio.ariaLabel = `${f.split(/[\\/]/).pop()}: the default`;
    row.querySelector('.item').title = 'The default: new tasks\' agents start in its copy';
    return row;
  }));
  former.hidden = !old;
  former.querySelector('span').textContent = old ? `Former folder ${old}: tasks no longer work in it; move its files into a repository.` : '';
}
// A change to them: the settings as they are then, or why not.
const codeError = document.getElementById('npcodeerror');
async function code(channel, args) {
  codeError.textContent = '';
  const r = await kulisa.invoke(channel, { id: editing, ...args });
  if (r?.error) { codeError.textContent = r.error; showCode(shownCode); } else if (r?.repos) showCode({ ...shownCode, ...r });
  return r;
}
repos.onclick = (e) => {
  const f = e.target.closest('.remove') && e.target.closest('[data-folder]')?.dataset.folder;
  if (f) code('project:repo-remove', { folder: f });
};
repos.onchange = (e) => {
  const f = e.target.closest('[data-folder]')?.dataset.folder;
  if (f) code('project:repo-default', { folder: f });
};
document.getElementById('npaddrepo').onclick = () => code('project:repo-add', {});
// Cloning takes a while (the repository comes over the network): the button says so meanwhile.
document.getElementById('npclone').onclick = async (e) => {
  if (!url.value.trim()) return url.focus();
  const b = e.currentTarget;
  b.disabled = true; b.textContent = 'Cloning…';
  if (!(await code('project:repo-clone', { url: url.value })).error) url.value = '';
  b.disabled = false; b.textContent = 'Clone';
};
document.getElementById('npshowformer').onclick = () => kulisa.invoke('project:show-former', { id: editing });
// Enter in the URL clones, not saves the dialog.
url.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('npclone').click(); } };

// Its agents (the agents' accounts, Agents…), the default first: + runs it.
const agentRows = document.getElementById('npagents');
const agentError = document.getElementById('npagenterror');
let mine = [];
function showAgents({ projectAgents }) {
  mine = projectAgents;
  agentRows.replaceChildren(...mine.map((a, i) => {
    const row = tpl('tpl-projagent');
    row.dataset.agent = a.id;
    row.querySelector('.label').textContent = a.name;
    const radio = row.querySelector('input');
    radio.checked = i === 0;
    radio.ariaLabel = `${a.name}: the default`;
    row.querySelector('.item').title = 'The default: + makes a task with it';
    return row;
  }));
  document.getElementById('npagentadd').disabled = !accounts.some((x) => !mine.some((m) => m.id === x.id));
}
async function agents(channel, args) {
  agentError.textContent = '';
  const r = await kulisa.invoke(channel, { id: editing, ...args });
  showAgents({ projectAgents: r?.agents || mine }); // refused: as it was, its radio back on the default
  if (r?.error) agentError.textContent = r.error;
  return r;
}
agentRows.onclick = (e) => {
  const id = e.target.closest('.remove') && e.target.closest('[data-agent]')?.dataset.agent;
  if (id) agents('project:agent-remove', { agent: id });
};
agentRows.onchange = (e) => {
  const id = e.target.closest('[data-agent]')?.dataset.agent;
  if (id) agents('project:agent-default', { agent: id });
};
document.getElementById('npagentadd').onclick = (e) => openMenu(accounts.filter((x) => !mine.some((m) => m.id === x.id))
  .map((x) => ({ label: x.name, run: () => agents('project:agent-add', { agent: x.id }) })), e.currentTarget);

// Its profiles (profile-store.js): who each is, and the other projects that have it too. New makes one (closed in its
// tasks: opened in a task, a copy of its master is made there); From Another Project… takes one another project has;
// × lets go of one (the main process asks first). At once, not on Save.
const profileRows = document.getElementById('npprofiles');
const newProfile = document.getElementById('npnewprofile');
const profileError = document.getElementById('npprofileerror');
let others = [];
function showProfiles({ profiles, others: rest }) {
  others = rest;
  profileRows.replaceChildren(...profiles.map((p) => {
    const row = tpl('tpl-projprofile');
    row.dataset.profile = p.id;
    row.querySelector('.avatar').src = avatarSrc(p.avatar);
    row.querySelector('.label').textContent = p.name;
    row.querySelector('small').textContent = [p.description, p.also.length && `also in ${p.also.join(', ')}`].filter(Boolean).join(' · ');
    return row;
  }));
  document.getElementById('npprofilefrom').disabled = !others.length;
}
async function profiles(channel, args) {
  profileError.textContent = '';
  const r = await kulisa.invoke(channel, { id: editing, ...args });
  if (r?.error) profileError.textContent = r.error; else if (r?.profiles) showProfiles(r);
  return r;
}
profileRows.onclick = (e) => {
  const id = e.target.closest('.remove') && e.target.closest('[data-profile]')?.dataset.profile;
  if (id) profiles('project:profile-remove', { profile: id });
};
document.getElementById('npprofilenew').onclick = async () => {
  if (!newProfile.value.trim()) return newProfile.focus();
  if (!(await profiles('project:profile-new', { name: newProfile.value })).error) newProfile.value = '';
};
newProfile.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('npprofilenew').click(); } };
document.getElementById('npprofilefrom').onclick = (e) => openMenu(others.map((p) => ({ label: p.name, sub: p.also.join(', '), avatar: p.avatar,
  run: () => profiles('project:profile-add', { profile: p.id }) })), e.currentTarget);
