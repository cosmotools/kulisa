// What several parts of the window use (loaded first).
// A copy of a <template> of index.html.
const tpl = (id) => document.getElementById(id).content.firstElementChild.cloneNode(true);
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
// The profiles' pages are native views above the window's HTML: they stay hidden while a dialog is open or the grid
// is not laid out yet (html.loading).
const viewsCovered = () => document.querySelector('dialog[open]') !== null || document.documentElement.classList.contains('loading');
// A dialog over the pages: they are hidden while it is open. Its close event comes in a later task; another dialog
// may be open by then.
function coverWhileOpen(dialog) {
  dialog.addEventListener('close', () => kulisa.invoke('views:hidden', viewsCovered()));
  return () => { kulisa.invoke('views:hidden', true); dialog.showModal(); };
}
