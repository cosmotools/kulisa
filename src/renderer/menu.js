// Kulisa's menus, drawn in HTML as Chrome draws its own: a popover (#menu in index.html) with rows that may hold
// buttons (the zoom row; a row's ×), colored dots and a second line. Esc, a click outside, a chosen item, the same
// button again or leaving the window closes it. Up and down move between the rows' buttons; Enter or Space chooses.
//   openMenu(items, at)   items: { label, sub, keys, color, enabled, run, remove } (no run: shown only), '-',
//                         { heading }, { element } (a row of its own). remove: { title, run }, a × at the row's end,
//                         shown on hover (as JetBrains' recent projects). at: the button to open it under, or the
//                         mouse event to open it at. A button with data-menu-end (⋮, ☰: at the end of a bar)
//                         gets the menu under it toward the start, its end edge at the button's, as Chrome's ⋮.
//   menuCover             { cover, uncover }: what else has to happen while a menu is open. The window sets it:
//                         the pages are native views above its HTML and would hide the menu (renderer.js).
const menuCover = { cover: async () => {}, uncover: () => {} };
const openMenu = (() => {
  const el = document.getElementById('menu');
  const point = document.getElementById('menuPoint');
  const row = () => tpl('tpl-menuitem');
  let items = [], source = null;
  const isOpen = () => el.matches(':popover-open');
  const close = () => { if (isOpen()) el.hidePopover(); };

  // A hide and a show in one go (another menu right away) may come as one toggle event, or the hide's after the show.
  el.addEventListener('toggle', () => { if (!isOpen()) { source = null; menuCover.uncover(); } });
  el.onclick = (e) => {
    const b = e.target.closest('.item, .remove');
    if (!b) return;
    close();
    const it = items[b.closest('[data-i]').dataset.i];
    (b.matches('.remove') ? it.remove : it).run?.();
  };
  el.addEventListener('contextmenu', (e) => e.preventDefault()); // no menu over a menu
  el.onkeydown = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const rows = [...el.querySelectorAll('button:not(:disabled)')];
    const i = rows.indexOf(document.activeElement), down = e.key === 'ArrowDown';
    rows.at(i < 0 ? (down ? 0 : -1) : (i + (down ? 1 : -1)) % rows.length)?.focus();
  };
  addEventListener('blur', close);
  // A manual popover, closed here: by a press outside it (its own button's press is left to the button, which toggles
  // it) and by Esc. The platform's light dismiss would also take the release of the right-click that opened it: on
  // Linux a menu opens on the press, just below the pointer, so the release comes outside and closed it at once.
  document.addEventListener('pointerdown', (e) => {
    if (isOpen() && !el.contains(e.target) && !(source instanceof Element && source.contains(e.target))) close();
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) { e.preventDefault(); close(); } }, true);

  return async (list, at) => {
    const again = isOpen() && source === at;
    close();
    if (again) return;
    items = list;
    el.replaceChildren(...list.map((it, i) => {
      if (it === '-') return document.createElement('hr');
      if (it.heading) return Object.assign(document.createElement('div'), { className: 'heading', textContent: it.heading });
      if (it.element) return it.element;
      const b = row();
      b.dataset.i = i;
      b.disabled = it.enabled === false;
      b.querySelector('.label').textContent = it.label;
      b.querySelector('small').textContent = it.sub || '';
      b.querySelector('kbd').textContent = it.keys || '';
      if (it.color) { b.querySelector('.dot').hidden = false; b.style.setProperty('--color', it.color); }
      if (!it.remove) return b;
      const r = tpl('tpl-menuremovable');
      r.dataset.i = i;
      r.querySelector('.remove').title = it.remove.title;
      r.prepend(b);
      return r;
    }));
    source = at;
    el.classList.toggle('end', at instanceof Element && 'menuEnd' in at.dataset);
    // At the pointer: a point the popover is anchored to, as to a button (components.css keeps it in the window).
    if (at instanceof MouseEvent) point.style.translate = `${at.clientX}px ${at.clientY}px`;
    await menuCover.cover();
    el.showPopover({ source: at instanceof MouseEvent ? point : at });
    el.focus();
  };
})();
