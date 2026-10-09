// What several parts of the window use (loaded first).
// Kulisa's keyboard shortcuts (main/keys.js), as this OS shows them, from the URL (window.js): each { id, group,
// label, keys }. keyText(id): a command's first key, for menus.
const shortcuts = JSON.parse(new URLSearchParams(location.search).get('keys') || '[]');
const keyText = (id) => shortcuts.find((s) => s.id === id)?.keys[0] || '';
// A button with data-keys="<command>" says its key in its tooltip ("Reload (Ctrl+R)"), as Chrome's toolbar does.
function showKeys(root) {
  for (const el of root.querySelectorAll('[data-keys]')) if (keyText(el.dataset.keys)) el.title = `${el.title} (${keyText(el.dataset.keys)})`;
  return root;
}
showKeys(document);
// A copy of a <template> of index.html.
const tpl = (id) => showKeys(document.getElementById(id).content.firstElementChild.cloneNode(true));
// A profile's picture (avatars.js): its file.
const avatarSrc = (a) => `avatars/${a}.svg`;
// Name fields (data-name: projects, workspaces, profiles) take only the characters names may have (names.js in the
// main process, which checks them again): others are left out as they are typed or pasted.
document.addEventListener('beforeinput', (e) => {
  const input = e.target;
  if (!input.matches?.('input[data-name]')) return;
  const text = e.data ?? e.dataTransfer?.getData('text/plain');
  if (!text) return;
  const ok = [...text].filter((c) => kulisa.nameChar(c)).join('');
  if (ok === text) return;
  e.preventDefault();
  if (ok) { input.setRangeText(ok, input.selectionStart, input.selectionEnd, 'end'); input.dispatchEvent(new Event('input', { bubbles: true })); }
});
// An agent's state on its workspace's tab (components.css .state): its icon, and words for the tooltip. Nothing when
// unknown.
const AGENT_STATES = { working: 'is working', waiting: 'waits for you', done: 'is done' };
function showAgentState(el, state) {
  el.dataset.state = state || '';
  el.querySelector('use').setAttribute('href', `#i-${state || 'done'}`);
  el.title = state ? `The agent ${AGENT_STATES[state]}` : '';
}
// The profiles' pages are native views above the window's HTML: they stay hidden while a dialog is open or the grid
// is not laid out yet (html.loading).
const viewsCovered = () => document.querySelector('dialog[open]') !== null || document.documentElement.classList.contains('loading');
// A dialog over the pages: they are hidden while it is open. Its close event comes in a later task; another dialog
// may be open by then.
function coverWhileOpen(dialog) {
  dialog.addEventListener('close', () => kulisa.invoke('views:hidden', viewsCovered()));
  return () => { kulisa.invoke('views:hidden', true); dialog.showModal(); };
}
// A question from the main process before something that cannot be undone (shell.ask in app.js): the window asks it
// (ask.js, loaded when needed) and sends back the answer.
kulisa.on('ask', async ({ id, ...q }) => kulisa.send('ask:answer', { id, answer: await (await import('./ask.js')).ask(q) }));
