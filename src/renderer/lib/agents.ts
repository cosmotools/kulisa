// The agents Kulisa knows (main/agents/), for a list of them with Install in a tasks' window: choosing a task's agent
// (components/AgentPicker.tsx: the project's accounts and the terminal only), New Project's agents and Settings' (the
// agents alone, details). The state lives in the list, not in its dialog or page: a closed dialog's content is
// unmounted, and an install it started goes on and shows when it opens again.
//   const list = agentList({ details, installed })   installed(agent): what to say once it is installed
//   list.load(selected, show) the agents, then await show() (opens its dialog); list.look(cached) without one
//   useAgentList(list, selector) in a component
import { createStore, useStore } from 'zustand';
import { refused } from '../../shared/result';
import { tilde } from '../../shared/paths';
import type { AgentInfo } from '../../shared/types';

export interface AgentListState {
  agents: AgentInfo[]; selected: string | undefined; home: string | null;
  installing: boolean; looking: boolean; progress: string; log: string; error: string;
  showDetails: boolean; detailsOpen: boolean; // the installer's output: there, and open
}

// A folder with the home folder as ~ (home: the main process's).
export const shortPath = (p: string, home: string | null) => (home ? tilde(p, home, kulisa.platform === 'win32' ? '\\' : '/') : p);

// The installer's output goes to the list that runs it.
let logTo: ((data: string) => void) | null = null;
kulisa.on('agents:install-log', (data) => logTo?.(data));

export function agentList(opts: { details?: boolean; installed: (a: AgentInfo) => string }) {
  const store = createStore<AgentListState>()(() => ({ agents: [], selected: undefined, home: null, installing: false, looking: false,
    progress: '', log: '', error: '', showDetails: false, detailsOpen: false }));
  const get = store.getState, set = store.setState;
  // cached: what the main process found last time, if it has looked yet (main/ipc/agents.ts, agents:list).
  // again: a look behind a list already shown, dropped when an install began meanwhile (it marks its own row).
  const fetchAgents = async (cached = false, again = false) => {
    const r = await kulisa.invoke('agents:list', { ...(opts.details ? { details: true } : { check: true }), cached });
    if (!r.list || (again && get().installing)) return false;
    // As found before (most looks), the store kept: its lists are not drawn again.
    if (r.home !== get().home || JSON.stringify(r.list) !== JSON.stringify(get().agents)) set({ agents: r.list, home: r.home });
    return true;
  };
  // The dialog opens with the list in it, not with a line that flips to it at once: what was found last time, then
  // looked for again (an agent installed, updated or removed meanwhile), the rows changed where it differs. The first
  // time (the user's shell, their --version: a few tenths of a second) it waits, and only when it takes longer it opens
  // saying so.
  async function load(sel: string | undefined, show: () => unknown) {
    if (!get().installing) set({ showDetails: false, log: '', progress: '', error: '' });
    const choose = () => { const a = get().agents; set({ selected: sel ?? a.find((x) => x.installed && x.install)?.id ?? a.find((x) => x.install)?.id }); };
    if (await fetchAgents(true)) {
      choose();
      await show();
      const picked = get().selected;
      if (get().installing || !(await fetchAgents(false, true))) return;
      if (get().selected === picked && !get().agents.some((a) => a.id === picked)) choose();
      return;
    }
    const waiting = setTimeout(() => { set({ looking: true, agents: [] }); void show(); }, 500);
    await fetchAgents();
    clearTimeout(waiting);
    set({ looking: false });
    choose();
    await show();
  }
  // The list with no dialog to open (Settings): cached, as the last look found it, at once; else looked for again,
  // `looking` while there is no list yet. Whether a list came.
  async function look(cached: boolean) {
    if (!cached && !get().agents.length) set({ looking: true });
    const found = await fetchAgents(cached, !cached);
    if (!cached) set({ looking: false });
    return found;
  }
  // Install: its maker's installer, its output under Details (opened by itself when it fails).
  async function install(id: string) {
    const a = get().agents.find((x) => x.id === id);
    if (!a || get().installing) return false;
    set({ selected: id, installing: true, showDetails: true, detailsOpen: false, log: '', error: '', progress: `Installing ${a.name}…` });
    logTo = (data) => set({ log: get().log + data });
    const r = await kulisa.invoke('agents:install', { id });
    logTo = null;
    const installed = !refused(r) && r.installed;
    set({ installing: false, agents: get().agents.map((x) => (x.id === id ? { ...x, installed } : x)),
      ...(!refused(r) && { log: r.log }), // the whole of it: a piece streamed may arrive after the answer
      progress: installed ? opts.installed(a) : '',
      ...(!installed && { detailsOpen: true, error: `${a.name} was not installed (${refused(r) ? r.error : `the installer ended with code ${r.code}`}). What the installer said is under Details: try again, or choose another agent.` }) });
    if (opts.details && installed) await fetchAgents(); // where it went and its version
    return installed;
  }
  return {
    store, details: !!opts.details, load, look, install,
    chosen: () => get().agents.find((a) => a.id === get().selected),
    select: (id: string) => set({ selected: id }),
    openDetails: (open: boolean) => set({ detailsOpen: open }),
    hideProgress: () => set({ progress: '', showDetails: false }),
  };
}
export type AgentList = ReturnType<typeof agentList>;
export const useAgentList = <T>(list: AgentList, selector: (s: AgentListState) => T) => useStore(list.store, selector);
