// Profiles: the Profiles button (a menu of the project's profiles, as the project button's) and the profile editor
// (Manage Profiles…: add, rename, describe, change the picture, open a closed one, delete).
//   profileEditor.update(open)   the open profiles, from each state (renderer.js)
//   profileEditor.about(key)     the editor, in that profile's description (a pane's menu)
//   profileEditor.showPane       set by renderer.js: bring an open profile's pane to the front (key)
//   deleteProfile(p)             the main process asks the human first (workspaces.js); also from a pane's menu
const profileEditor = (() => {
  const dialog = document.getElementById('profiles');
  const plist = document.getElementById('plist');
  const newProfile = document.getElementById('newProfile');
  const newAbout = document.getElementById('newAbout');
  const padd = document.getElementById('padd');
  const button = document.getElementById('openProfiles');
  const rows = new Map(); // profile key -> row element
  let open = [];
  let closed = []; // closed by the human: { key, id, name, avatar, description, tabs (how many) }
  const editor = {
    update(list) { open = list; if (dialog.open) render(); },
    about(key) { manage(); rows.get(key)?.querySelector('.about').focus(); },
    showPane: () => {},
  };

  const showDialog = coverWhileOpen(dialog);
  const manage = () => { render(); showDialog(); newProfile.focus(); };
  // The pictures (avatars.js), as Chrome's avatar grid, the one it has lit. With a picture (pic: a profile's row) they
  // are shown by a click on it and go once one is chosen; without (a new profile), always shown. current(): the
  // picture now.
  function pictures(pic, pics, current, choose) {
    pics.append(...kulisa.avatars.map((a) => {
      const b = Object.assign(document.createElement('button'), { type: 'button', className: 'icon small', title: a, ariaLabel: a });
      b.dataset.avatar = a;
      b.append(Object.assign(document.createElement('img'), { className: 'avatar', alt: '', src: avatarSrc(a) }));
      return b;
    }));
    const show = (on) => { if (pic) { pics.hidden = !on; pic.ariaExpanded = String(on); } };
    if (pic) pic.onclick = () => show(pics.hidden);
    pics.onclick = (e) => {
      const a = e.target.closest('button')?.dataset.avatar;
      if (!a) return;
      show(false);
      if (a !== current()) choose(a);
    };
    return (a) => { // shows a
      if (pic) pic.querySelector('.avatar').src = avatarSrc(a);
      for (const b of pics.children) b.ariaPressed = String(b.dataset.avatar === a);
    };
  }
  // The new profile's picture: the one it would get, until the human picks another.
  let picked = null;
  const used = () => [...open, ...closed].map((p) => p.avatar);
  const newPicture = () => picked || kulisa.nextAvatar(used());
  const showNew = pictures(null, padd.querySelector('.pics'), newPicture, (a) => { picked = a; showNew(a); });
  // An open profile: its pane comes to the front (it may be stacked behind another); a closed one opens. Each with who
  // it is, when said.
  const tabs = (n) => `${n} tab${n === 1 ? '' : 's'}`;
  button.onclick = () => openMenu([
    ...open.map((p) => ({ label: p.name, sub: p.description || tabs(p.tabs.length), avatar: p.avatar,
      run: () => editor.showPane(p.key) })),
    ...closed.map((p) => ({ label: p.name, sub: `closed · click to open${p.description ? ` · ${p.description}` : ''}`, avatar: p.avatar,
      run: () => act('profile:open', { profile: p.id }) })),
    ...(open.length || closed.length ? ['-'] : []),
    { label: 'Manage Profiles…', run: manage },
  ], button);
  kulisa.on('closed-profiles', (list) => { closed = list; if (dialog.open) render(); });
  // Enter adds the profile from its description too; Shift+Enter starts a new line.
  newAbout.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.target.form.requestSubmit(); } });
  padd.onsubmit = async (e) => {
    e.preventDefault();
    const name = newProfile.value.trim();
    if (!name) return newProfile.focus();
    const description = newAbout.value.trim(), avatar = newPicture();
    newProfile.value = ''; newAbout.value = ''; picked = null;
    await act('profile:new', { name, description, avatar });
    newProfile.focus();
  };

  function render() {
    showNew(newPicture());
    const all = [...open, ...closed.map((p) => ({ ...p, closed: true }))];
    for (const [key, row] of rows) if (!all.some((p) => p.key === key)) { row.remove(); rows.delete(key); }
    for (const p of all) {
      const row = rows.get(p.key) || createRow(p);
      row.profile = p;
      row.show(p.avatar);
      const name = row.querySelector('.name');
      if (document.activeElement !== name) name.value = p.name;
      const about = row.querySelector('.about');
      if (document.activeElement !== about) about.value = p.description || '';
      row.querySelector('.pid').textContent = p.id;
      const n = p.closed ? p.tabs : p.tabs.length;
      row.querySelector('.ntabs').textContent = `${p.closed ? 'closed · ' : ''}${tabs(n)}`;
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
      if (v && v !== row.profile.name) act('profile:rename', { profile: row.profile.id, name: v });
      else name.value = row.profile.name;
    });
    name.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); name.blur(); }
      if (e.key === 'Escape') { e.preventDefault(); name.value = row.profile.name; name.blur(); }
    });
    // Who it is: saved when the field is left (or Enter; Shift+Enter starts a new line); Esc puts back what was saved.
    const about = row.querySelector('.about');
    about.addEventListener('change', () => {
      if (about.value.trim() !== (row.profile.description || '')) act('profile:describe', { profile: row.profile.id, description: about.value });
    });
    about.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); about.blur(); }
      if (e.key === 'Escape') { e.preventDefault(); about.value = row.profile.description || ''; about.blur(); }
    });
    row.show = pictures(row.querySelector('.pic'), row.querySelector('.pics'), () => row.profile.avatar,
      (avatar) => act('profile:avatar', { profile: row.profile.id, avatar }));
    row.querySelector('.open').onclick = () => act('profile:open', { profile: row.profile.id });
    row.querySelector('.del').onclick = () => deleteProfile(row.profile);
    return row;
  }
  return editor;
})();
function deleteProfile(p) { act('profile:delete', { profile: p.id }); }
