// The agents Kulisa knows (main/agents/), for a dialog that lists them with Install (AgentList.vue). The state lives
// with the dialog, not in the list: a closed dialog's content is unmounted (Modal.vue), and an install it started goes
// on and shows when it opens again.
//   const list = agentList({ choose, details, installed })   choose: a radio per row; details: each one's version, folder
//   and website; installed(agent): what to say once it is installed.
//   list.load(selected, show) the agents, then await show() (opens the dialog); reload(); chosen; state.installing …
import { computed, nextTick, reactive } from 'vue';
import { refused } from '../../shared/result';
import { tilde } from '../../shared/paths';
import type { AgentInfo } from '../../shared/types';

export type Agent = AgentInfo;

// An agent's mark in the sprite, by its id (cli); an agent new to Kulisa may have none: the generic one, or none.
export const agentMark = (cli: string, fallback: string | null = 'i-agent') => (document.getElementById(`i-agent-${cli}`) ? `i-agent-${cli}` : fallback);

// A folder with the home folder as ~ (home: the main process's, state.home).
export const shortPath = (p: string, home: string | null) => (home ? tilde(p, home, kulisa.platform === 'win32' ? '\\' : '/') : p);

// The installer's output goes to the list that runs it.
let logTo: ((data: string) => void) | null = null;
kulisa.on('agents:install-log', (data) => logTo?.(data));

export function agentList(opts: { choose?: boolean; details?: boolean; installed: (a: Agent) => string }) {
  const state = reactive({
    agents: [] as Agent[], selected: undefined as string | undefined, home: null as string | null,
    installing: false, looking: false, progress: '', log: '', error: '', showDetails: false, detailsOpen: false,
    el: null as HTMLElement | null, // the list's element, while its dialog is open
  });
  const chosen = computed(() => state.agents.find((a) => a.id === state.selected));
  // cached: what the main process found last time, if it has looked yet (main/ipc/agents.ts, agents:list).
  // again: a look behind a list already shown, dropped when an install began meanwhile (it marks its own row).
  const fetchAgents = async (cached = false, again = false) => {
    const r = await kulisa.invoke('agents:list', { ...(opts.details ? { details: true } : { check: true }), cached });
    if (!r.list || (again && state.installing)) return false;
    state.agents = r.list; state.home = r.home;
    return true;
  };
  // Choosing: the arrows choose, Tab goes on to Install or Start. Settings' list keeps the keyboard in its tree.
  const focus = async () => {
    if (!opts.choose) return;
    await nextTick();
    state.el?.querySelector<HTMLElement>('[role="radio"][data-state="checked"]')?.focus();
  };
  // The dialog opens with the list in it, not with a line that flips to it at once: what was found last time, then
  // looked for again (an agent installed, updated or removed meanwhile), the rows changed where it differs. The first
  // time (the user's shell, their --version: a few tenths of a second) it waits, and only when it takes longer it opens
  // saying so.
  async function load(sel: string | undefined, show: () => Promise<void>) {
    if (!state.installing) Object.assign(state, { showDetails: false, log: '', progress: '', error: '' });
    const choose = () => { state.selected = sel ?? state.agents.find((a) => a.installed && a.install)?.id ?? state.agents.find((a) => a.install)?.id; };
    if (await fetchAgents(true)) {
      choose();
      await show();
      await focus();
      const picked = state.selected;
      if (state.installing || !(await fetchAgents(false, true))) return;
      if (state.selected === picked && !state.agents.some((a) => a.id === picked)) choose();
      return;
    }
    const waiting = setTimeout(() => { state.looking = true; state.agents = []; void show(); }, 500);
    await fetchAgents();
    clearTimeout(waiting);
    state.looking = false;
    choose();
    await show();
    await focus();
  }
  async function install(id: string) {
    const a = state.agents.find((x) => x.id === id)!;
    state.selected = id;
    state.installing = true;
    logTo = (data) => {
      state.log += data;
      void nextTick(() => { const pre = state.el?.querySelector('pre'); if (pre) pre.scrollTop = pre.scrollHeight; });
    };
    Object.assign(state, { showDetails: true, detailsOpen: false, log: '', error: '', progress: `Installing ${a.name}…` });
    const r = await kulisa.invoke('agents:install', { id });
    state.installing = false;
    logTo = null;
    if (!refused(r)) state.log = r.log; // the whole of it: a piece streamed may arrive after the answer
    a.installed = !refused(r) && r.installed;
    state.progress = a.installed ? opts.installed(a) : '';
    if (!a.installed) {
      state.error = `${a.name} was not installed (${refused(r) ? r.error : `the installer ended with code ${r.code}`}). What the installer said is under Details: try again, or choose another agent.`;
      state.detailsOpen = true;
    }
    // Where it went and its version.
    if (opts.details && a.installed) await fetchAgents();
    await focus();
  }
  const openDetails = (open: boolean) => { state.detailsOpen = open; };
  return { ...opts, state, chosen, load, install, openDetails };
}
export type AgentList = ReturnType<typeof agentList>;
