// Name fields (data-name: projects, tasks, profiles) take only the characters names may have (main/names.ts, which
// checks them again): others are left out as they are typed or pasted.
document.addEventListener('beforeinput', (e) => {
  const input = e.target as HTMLInputElement;
  if (!input.matches?.('input[data-name]')) return;
  const text = e.data ?? e.dataTransfer?.getData('text/plain');
  if (!text) return;
  const ok = [...text].filter((c) => kulisa.nameChar(c)).join('');
  if (ok === text) return;
  e.preventDefault();
  if (ok) { input.setRangeText(ok, input.selectionStart!, input.selectionEnd!, 'end'); input.dispatchEvent(new Event('input', { bubbles: true })); }
});
