// Choosing a workspace's agent (ROADMAP, "Choosing the agent"): a dialog of the agents Kulisa knows (agents.js in the
// main process), each with who makes it and what it needs, and whether it is on this computer. One that is not has
// an Install button: Kulisa runs its maker's installer (the command line is shown before). Meanwhile the dialog says
// only that it is installing: the installer's own output (written for programmers: "open a new terminal and run …")
// is under Details, opened by itself when the installation fails.
// Start starts the chosen one in the workspace's terminal; on its first start the agent asks the human to sign in.
// An ES module loaded when needed (workspaces.js), CLAUDE.md "Window UI".
//   chooseAgent({ ws, selected, cancel })   ask for workspace ws; the answer goes to the main process (agent:chosen).
//                                           cancel: it can be left as it is (changing the agent)
const dialog = document.getElementById('agents');
const list = document.getElementById('agentlist');
const log = document.getElementById('agentlog');
const details = document.getElementById('agentdetails');
const progress = document.getElementById('agentprogress');
const error = dialog.querySelector('.error');
const start = document.getElementById('agentstart');
const cancelButton = document.getElementById('agentcancel');
let asking = null; // the workspace asked for
let agents = []; // { id, name, maker, needs, install, installed }
let installing = false;

const showDialog = coverWhileOpen(dialog);
kulisa.on('agents:install-log', (data) => { log.textContent += data; log.scrollTop = log.scrollHeight; });
// Closed without a choice (another workspace or project was shown): it is asked again when this one is shown again.
dialog.addEventListener('close', () => { if (asking !== null) answer(null); });
const answer = (id) => { const ws = asking; asking = null; kulisa.send('agent:chosen', { ws, id }); };
const chosen = () => agents.find((a) => a.id === list.querySelector('input:checked')?.value);

export async function chooseAgent({ ws, selected, cancel }) {
  asking = ws;
  cancelButton.hidden = !cancel;
  details.hidden = true; log.textContent = ''; progress.textContent = ''; error.textContent = '';
  list.replaceChildren(Object.assign(document.createElement('p'), { className: 'hint', textContent: 'Looking for agents on this computer…' }));
  start.disabled = true;
  if (!dialog.open) showDialog();
  ({ list: agents } = await kulisa.invoke('agents:list', { check: true }));
  render(selected ?? agents.find((a) => a.installed && a.install)?.id ?? agents.find((a) => a.install)?.id);
}

function render(selected) {
  list.replaceChildren(...agents.map((a) => {
    const row = tpl('tpl-agent');
    const radio = row.querySelector('input');
    radio.value = a.id;
    radio.checked = a.id === selected;
    row.querySelector('.name').textContent = a.maker ? `${a.name} · ${a.maker}` : a.name;
    row.querySelector('.needs').textContent = a.needs || '';
    row.querySelector('.install-line').textContent = a.install && !a.installed ? `Install runs ${a.maker || 'its maker'}'s installer: ${a.install}` : '';
    row.querySelector('.status').textContent = a.installed ? (a.install ? 'Installed' : '') : 'Not installed';
    row.querySelector('.install').hidden = a.installed || !a.install;
    return row;
  }));
  update();
  list.querySelector('input:checked')?.focus(); // the arrows choose, Tab goes on to Install or Start
}
function update() {
  start.disabled = installing || !chosen()?.installed;
  cancelButton.disabled = installing;
  for (const b of list.querySelectorAll('button, input')) b.disabled = installing;
}
list.onchange = update;
list.onclick = (e) => {
  const button = e.target.closest('.install');
  if (!button) return;
  e.preventDefault();
  const radio = button.closest('.agentrow').querySelector('input');
  radio.checked = true;
  install(radio.value);
};
async function install(id) {
  const a = agents.find((x) => x.id === id);
  installing = true;
  details.hidden = false; details.open = false; log.textContent = ''; error.textContent = '';
  progress.textContent = `Installing ${a.name}…`;
  update();
  const r = await kulisa.invoke('agents:install', { id });
  installing = false;
  a.installed = !!r.installed;
  progress.textContent = a.installed ? `${a.name} is installed. Start it; it asks you to sign in.` : '';
  if (!a.installed) {
    error.textContent = `${a.name} was not installed (${r.error || `the installer ended with code ${r.code}`}). What the installer said is under Details: try again, or choose another agent.`;
    details.open = true;
  }
  render(id);
}
cancelButton.onclick = () => dialog.close(); // answers null (the close listener)
start.onclick = () => {
  const a = chosen();
  if (!a?.installed) return;
  answer(a.id);
  dialog.close();
};
