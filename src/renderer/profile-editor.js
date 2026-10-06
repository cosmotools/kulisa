// Profiles: the Profiles button (a menu of the project's profiles, as the project button's) and the profile editor
// (Manage Profiles…: add, rename, open a closed one, delete).
//   profileEditor.update(open)   the open profiles, from each state (renderer.js)
//   profileEditor.showPane       set by renderer.js: bring an open profile's pane to the front (key)
//   deleteProfile(p)             after the human confirms in a native question; also from a pane's menu
const profileEditor = (() => {
  const dialog = document.getElementById('profiles');
  const plist = document.getElementById('plist');
  const newProfile = document.getElementById('newProfile');
  const button = document.getElementById('openProfiles');
  const rows = new Map(); // profile key -> row element
  let open = [];
  let closed = []; // closed by the human: { key, id, name, color, tabs (how many) }
  const editor = { update(list) { open = list; if (dialog.open) render(); }, showPane: () => {} };

  const showDialog = coverWhileOpen(dialog);
  const manage = () => { render(); showDialog(); newProfile.focus(); };
  // An open profile: its pane comes to the front (it may be stacked behind another); a closed one opens.
  button.onclick = () => openMenu([
    ...open.map((p) => ({ label: p.name, sub: `${p.tabs.length} tab${p.tabs.length === 1 ? '' : 's'}`, color: p.color,
      run: () => editor.showPane(p.key) })),
    ...closed.map((p) => ({ label: p.name, sub: 'closed · click to open', color: p.color,
      run: () => kulisa.invoke('profile:open', { profile: p.id }) })),
    ...(open.length || closed.length ? ['-'] : []),
    { label: 'Manage Profiles…', run: manage },
  ], button);
  kulisa.on('closed-profiles', (list) => { closed = list; if (dialog.open) render(); });
  document.getElementById('padd').onsubmit = async (e) => {
    e.preventDefault();
    const name = newProfile.value.trim();
    if (!name) return newProfile.focus();
    newProfile.value = '';
    await kulisa.invoke('profile:new', { name });
    newProfile.focus();
  };

  function render() {
    const all = [...open, ...closed.map((p) => ({ ...p, closed: true }))];
    for (const [key, row] of rows) if (!all.some((p) => p.key === key)) { row.remove(); rows.delete(key); }
    for (const p of all) {
      const row = rows.get(p.key) || createRow(p);
      row.profile = p;
      row.style.setProperty('--color', p.color);
      const name = row.querySelector('.name');
      if (document.activeElement !== name) name.value = p.name;
      row.querySelector('.pid').textContent = p.id;
      const n = p.closed ? p.tabs : p.tabs.length;
      row.querySelector('.ntabs').textContent = `${p.closed ? 'closed · ' : ''}${n} tab${n === 1 ? '' : 's'}`;
      row.querySelector('.open').hidden = !p.closed;
      plist.append(row); // keeps the order
    }
  }
  function createRow(p) {
    const row = tpl('tpl-prow');
    rows.set(p.key, row);
    const name = row.querySelector('.name');
    name.addEventListener('change', () => {
      const v = name.value.trim();
      if (v && v !== row.profile.name) kulisa.invoke('profile:rename', { profile: row.profile.id, name: v });
      else name.value = row.profile.name;
    });
    name.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); name.blur(); }
      if (e.key === 'Escape') { e.preventDefault(); name.value = row.profile.name; name.blur(); }
    });
    row.querySelector('.open').onclick = () => kulisa.invoke('profile:open', { profile: row.profile.id });
    row.querySelector('.del').onclick = () => deleteProfile(row.profile);
    return row;
  }
  return editor;
})();
async function deleteProfile(p) {
  const ok = await kulisa.invoke('confirm', { message: `Delete the profile ${p.name}?`, ok: 'Delete',
    detail: 'Its sign-ins, cookies, storage and tabs are removed for good.' });
  if (ok) kulisa.invoke('profile:delete', { profile: p.id });
}
