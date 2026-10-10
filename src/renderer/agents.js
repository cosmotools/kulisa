// The Agents window (☰, the Welcome screen; tasks.md, "Choosing the agent"): at any time, the agents with
// Install (agent-list.js), each with its version, folder and its maker's website. Nothing is chosen or started here:
// the agent is chosen for a task when one is made, or with Change agent….
// An ES module loaded when needed (renderer.js, projects.js), CLAUDE.md "Window UI".
//   showAgents()   open it
import { agentList } from './agent-list.js';

const dialog = document.getElementById('agents');
const closeButtons = dialog.querySelectorAll('[command="close"]');
const list = agentList(dialog.querySelector('.body'), { details: true, onChange: update,
  installed: (a) => `${a.name} is installed. Choose it for a task; on its first start it asks you to sign in.` });
function update() { for (const b of closeButtons) b.disabled = list.installing; }
const showDialog = coverWhileOpen(dialog);
dialog.addEventListener('cancel', (e) => { if (list.installing) e.preventDefault(); }); // Esc or a click outside while installing

export async function showAgents() {
  await list.load(undefined, () => { if (!dialog.open) showDialog(); });
  accounts();
}
// Add Account: for an agent that has accounts (Claude Code, Codex), a name; its folder is made, and it asks to sign
// in at its first start in a task.
const form = document.getElementById('accountadd');
const agentSelect = document.getElementById('accountagent');
const name = document.getElementById('accountname');
const error = document.getElementById('accounterror');
dialog.querySelector('.body').append(form, error); // under the list
function accounts() {
  const own = list.agents().filter((a) => a.accounts && !a.account);
  agentSelect.replaceChildren(...own.map((a) => new Option(a.name, a.agent)));
  form.hidden = !own.length;
  name.value = ''; error.textContent = '';
}
form.onsubmit = async (e) => {
  e.preventDefault();
  if (!name.value.trim()) return name.focus();
  const r = await kulisa.invoke('accounts:add', { agent: agentSelect.value, name: name.value });
  if (r?.error) { error.textContent = r.error; return; }
  name.value = ''; error.textContent = '';
  await list.reload();
};
