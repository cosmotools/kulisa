// Kulisa's menus, drawn in HTML as Chrome draws its own: a popover (#menu in index.html) with rows that may hold
// buttons (the zoom row), colored dots and a second line. Esc, a click outside, a chosen item, the same button
// again or leaving the window closes it. Up and down move between the rows' buttons; Enter or Space chooses.
//   openMenu(items, at)   items: { label, sub, keys, color, enabled, run } (no run: shown only), '-', { heading },
//                         { element } (a row of its own). at: the button to open it under, or the mouse event to
//                         open it at.
//   menuCover             { cover, uncover }: what else has to happen while a menu is open. The window sets it:
//                         the pages are native views above its HTML and would hide the menu (renderer.js).
const menuCover = { cover: async () => {}, uncover: () => {} };
const openMenu = (() => {
  const el = document.getElementById('menu');
  const point = document.getElementById('menuPoint');
  const row = () => document.getElementById('tpl-menuitem').content.firstElementChild.cloneNode(true);
  let items = [], source = null;
  const isOpen = () => el.matches(':popover-open');
  const close = () => { if (isOpen()) el.hidePopover(); };

  // A hide and a show in one go (another menu right away) may come as one toggle event, or the hide's after the show.
  el.addEventListener('toggle', () => { if (!isOpen()) { source = null; menuCover.uncover(); } });
  el.onclick = (e) => {
    const b = e.target.closest('.item');
    if (!b) return;
    close();
    items[b.dataset.i].run?.();
  };
  el.onkeydown = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const rows = [...el.querySelectorAll('button:not(:disabled)')];
    const i = rows.indexOf(document.activeElement), down = e.key === 'ArrowDown';
    rows.at(i < 0 ? (down ? 0 : -1) : (i + (down ? 1 : -1)) % rows.length)?.focus();
  };
  addEventListener('blur', close);

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
      return b;
    }));
    source = at;
    // At the pointer: a point the popover is anchored to, as to a button (styles.css keeps it in the window).
    if (at instanceof MouseEvent) point.style.translate = `${at.clientX}px ${at.clientY}px`;
    await menuCover.cover();
    el.showPopover({ source: at instanceof MouseEvent ? point : at });
    el.focus();
  };
})();
