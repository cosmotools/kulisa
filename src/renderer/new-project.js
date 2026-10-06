// New Project… (projects.js), as JetBrains': a name, and the location its folder goes in (the home folder unless the
// human types or browses to another); the dialog shows the folder it makes, so the human knows where the agent's
// files are. Create Git repository (on by default): workspaces need git. The main process makes the folder and opens
// the project (project:new). An ES module loaded when needed, CLAUDE.md "Window UI".
//   newProject()   show the dialog
const dialog = document.getElementById('newproject');
const form = document.getElementById('npform');
const name = document.getElementById('npname');
const place = document.getElementById('nplocation');
const where = document.getElementById('npwhere');
const git = document.getElementById('npgit');
const create = document.getElementById('npcreate');
const error = dialog.querySelector('.error');
const showDialog = coverWhileOpen(dialog);
let sep = '/';

const folder = () => `${place.value.trim().replace(/[\\/]+$/, '')}${sep}${name.value.trim()}`;
const update = () => {
  where.textContent = name.value.trim() && place.value.trim() ? `The project will be created in ${folder()}` : '';
  error.textContent = '';
};
name.oninput = place.oninput = update;

export async function newProject() {
  const defaults = await kulisa.invoke('project:new-defaults');
  sep = defaults.sep;
  name.value = ''; place.value = defaults.location; git.checked = true; create.disabled = false;
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
  const r = await kulisa.invoke('project:new', { name: name.value, location: place.value, git: git.checked });
  create.disabled = false;
  if (r?.error) error.textContent = r.error; else dialog.close();
};
