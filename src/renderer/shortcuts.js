// Keyboard Shortcuts (☰, or its key): every key of Kulisa, as this OS shows it, from the same table that takes them
// (main/keys.js), so it is never out of date. A module loaded when needed (renderer's keys.js).
const GROUPS = [
  ['global', 'Everywhere', 'In the window, the pages and the terminal.'],
  ['page', 'In a profile\'s page', 'Chrome\'s keys, for that profile\'s pane: also in its address bar.'],
  ['terminal', 'In the terminal', 'Every other key goes to the agent.'],
];
const dialog = document.getElementById('shortcuts');
const show = coverWhileOpen(dialog);

export function showShortcuts() {
  dialog.querySelector('.body').replaceChildren(...GROUPS.map(([group, title, hint]) => {
    const el = tpl('tpl-keygroup');
    el.querySelector('h3').textContent = title;
    el.querySelector('.hint').textContent = hint;
    el.querySelector('dl').append(...shortcuts.filter((s) => s.group === group).flatMap(({ label, keys }) => {
      const dt = Object.assign(document.createElement('dt'), { textContent: label });
      const dd = document.createElement('dd');
      dd.append(...keys.map((k) => Object.assign(document.createElement('kbd'), { textContent: k })));
      return [dt, dd];
    }));
    return el;
  }));
  if (!dialog.open) show();
}
