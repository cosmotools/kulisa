// Choosing a workspace's agent (workspaces.md, "Choosing the agent"): the agents with Install (agent-list.js); Start
// starts the chosen one in the workspace's terminal, and on its first start the agent asks the human to sign in.
// An ES module loaded when needed (workspaces.js), CLAUDE.md "Window UI".
//   chooseAgent({ ws, selected, cancel })   ask for workspace ws; the answer goes to the main process (agent:chosen).
//                                           cancel: it can be left as it is (changing the agent)
import { agentList } from './agent-list.js';

const dialog = document.getElementById('agentpick');
const start = document.getElementById('agentstart');
const cancelButton = document.getElementById('agentcancel');
let asking = null; // the workspace asked for

const list = agentList(dialog.querySelector('.body'), { choose: true, onChange: update,
  installed: (a) => `${a.name} is installed. Start it; it asks you to sign in.` });
function update() {
  start.disabled = list.installing || !list.chosen()?.installed;
  cancelButton.disabled = list.installing;
}
const showDialog = coverWhileOpen(dialog);
// Closed without a choice (another workspace or project was shown): it is asked again when this one is shown again.
dialog.addEventListener('close', () => { if (asking !== null) answer(null); });
const answer = (id) => { const ws = asking; asking = null; kulisa.send('agent:chosen', { ws, id }); };

export async function chooseAgent({ ws, selected, cancel }) {
  asking = ws;
  cancelButton.hidden = !cancel;
  await list.load(selected, () => { if (!dialog.open) showDialog(); });
}

cancelButton.onclick = () => dialog.close(); // answers null (the close listener)
start.onclick = () => {
  const a = list.chosen();
  if (!a?.installed) return;
  answer(a.id);
  dialog.close();
};
