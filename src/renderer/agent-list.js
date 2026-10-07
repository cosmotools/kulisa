// The agents Kulisa knows (agents.js in the main process) as a list with Install, in both dialogs that show them:
// choosing a workspace's agent (agent-picker.js) and the Agents window (agents.js). Each row: who makes it and what
// it needs, whether it is on this computer. One that is not has an Install button: Kulisa runs its maker's installer
// (the command line is shown before). Meanwhile the list says only that it is installing: the installer's own output
// (written for programmers: "open a new terminal and run …") is under Details, opened by itself when it fails.
// An ES module, loaded with the dialogs (CLAUDE.md "Window UI").
//   const list = agentList(body, { choose, details, onChange, installed })   the list, at the end of a dialog's body
//     choose     a radio per row (choosing); details: each one's version, folder and website (the Agents window)
//     onChange   the choice changed, or an installation started or ended
//     installed  (agent) => what to say once it is installed
//   await list.load(selected, show)   the agents from the main process, then show() (opens the dialog);
//                                     list.chosen(), list.installing
let logTo = null; // the installer's output goes to the list that runs it
kulisa.on('agents:install-log', (data) => logTo?.(data));

export function agentList(body, { choose = false, details = false, onChange = () => {}, installed }) {
  const el = tpl('tpl-agentlist');
  body.append(el);
  const rows = el.querySelector('.rows');
  const progress = el.querySelector('.progress');
  const more = el.querySelector('details');
  const log = el.querySelector('pre');
  const error = el.querySelector('.error');
  let agents = []; // { id, name, maker, needs, site, install, installed; with details path, onPath, version }
  let home = null;
  const list = {
    installing: false,
    chosen: () => agents.find((a) => a.id === rows.querySelector('input:checked')?.value),
    // The dialog opens with the list in it (finding the agents takes a few tenths of a second: the user's shell, their
    // --version), not with a line that flips to it at once; only when it takes longer, it opens saying so.
    async load(selected, show) {
      more.hidden = true; log.textContent = ''; progress.textContent = ''; error.textContent = '';
      const waiting = setTimeout(() => {
        rows.replaceChildren(Object.assign(document.createElement('p'), { className: 'hint', textContent: 'Looking for agents on this computer…' }));
        onChange();
        show();
      }, 500);
      await fetch();
      clearTimeout(waiting);
      render(selected ?? agents.find((a) => a.installed && a.install)?.id ?? agents.find((a) => a.install)?.id);
      show();
      focus();
    },
  };
  const fetch = async () => ({ list: agents, home } = await kulisa.invoke('agents:list', details ? { details: true } : { check: true }));
  // ~ for the home folder, as a terminal shows it.
  const short = (p) => (home && p.startsWith(home + '/') ? '~' + p.slice(home.length) : p);

  function render(selected) {
    rows.replaceChildren(...agents.map((a) => {
      const row = tpl('tpl-agent');
      row.dataset.agent = a.id;
      const radio = row.querySelector('input');
      if (choose) { radio.value = a.id; radio.checked = a.id === selected; } else radio.remove();
      row.querySelector('.name').textContent = a.maker ? `${a.name} · ${a.maker}` : a.name;
      row.querySelector('.needs').textContent = a.needs || '';
      if (details && a.path) {
        row.querySelector('.where').textContent = [a.version, short(a.path),
          a.onPath === false && 'not on your PATH: Kulisa runs it from here'].filter(Boolean).join(' · ');
      }
      if (details && a.site) row.querySelector('.site').href = a.site;
      row.querySelector('.install-line').textContent = a.install && !a.installed ? `Install runs ${a.maker || 'its maker'}'s installer: ${a.install}` : '';
      row.querySelector('.status').textContent = a.installed ? (a.install ? 'Installed' : '') : 'Not installed';
      row.querySelector('.install').hidden = a.installed || !a.install;
      return row;
    }));
    update();
  }
  // Choosing: the arrows choose, Tab goes on to Install or Start.
  const focus = () => (choose ? rows.querySelector('input:checked') : rows.querySelector('.install:not([hidden])'))?.focus();
  function update() {
    for (const b of rows.querySelectorAll('button, input')) b.disabled = list.installing;
    onChange();
  }
  rows.onchange = update;
  rows.onclick = (e) => {
    const row = e.target.closest('.install')?.closest('.agentrow');
    if (!row) return;
    e.preventDefault();
    const radio = row.querySelector('input');
    if (radio) radio.checked = true;
    install(row.dataset.agent);
  };
  async function install(id) {
    const a = agents.find((x) => x.id === id);
    list.installing = true;
    logTo = (data) => { log.textContent += data; log.scrollTop = log.scrollHeight; };
    more.hidden = false; more.open = false; log.textContent = ''; error.textContent = '';
    progress.textContent = `Installing ${a.name}…`;
    update();
    const r = await kulisa.invoke('agents:install', { id });
    list.installing = false;
    logTo = null;
    a.installed = !!r.installed;
    progress.textContent = a.installed ? installed(a) : '';
    if (!a.installed) {
      error.textContent = `${a.name} was not installed (${r.error || `the installer ended with code ${r.code}`}). What the installer said is under Details: try again, or choose another agent.`;
      more.open = true;
    }
    // Where it went and its version.
    if (details && a.installed) await fetch();
    render(id);
    focus();
  }
  return list;
}
