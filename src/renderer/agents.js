// The Agents window (☰, the Welcome screen; workspaces.md, "Choosing the agent"): at any time, the agents with
// Install (agent-list.js), each with its version, folder and its maker's website. Nothing is chosen or started here:
// the agent is chosen for a workspace when one is made, or with Change agent….
// An ES module loaded when needed (renderer.js, projects.js), CLAUDE.md "Window UI".
//   showAgents()   open it
import { agentList } from './agent-list.js';

const dialog = document.getElementById('agents');
const closeButtons = dialog.querySelectorAll('[command="close"]');
const list = agentList(dialog.querySelector('.body'), { details: true, onChange: update,
  installed: (a) => `${a.name} is installed. Choose it for a workspace; on its first start it asks you to sign in.` });
function update() { for (const b of closeButtons) b.disabled = list.installing; }
const showDialog = coverWhileOpen(dialog);
dialog.addEventListener('cancel', (e) => { if (list.installing) e.preventDefault(); }); // Esc or a click outside while installing

export async function showAgents() {
  await list.load(undefined, () => { if (!dialog.open) showDialog(); });
}
