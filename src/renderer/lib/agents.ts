// The agents Kulisa knows (main/agents.js), for a dialog that lists them with Install (AgentList.vue draws them):
// choosing a task's agent (AgentPicker.vue) and the Agents window (Agents.vue). The state lives with the dialog, not in
// the list: a closed dialog's content is unmounted (Modal.vue), and an install it started goes on and shows when it
// opens again.
//   const list = agentList({ choose, details, installed })   choose: a radio per row; details: each one's version, folder
//   and website; installed(agent): what to say once it is installed.
//   list.load(selected, show) the agents, then await show() (opens the dialog); reload(); chosen; state.installing …
import { computed, nextTick, reactive } from 'vue';

export interface Agent {
  id: string; name: string; maker?: string; needs?: string; site?: string; install?: string; installed?: boolean;
  account?: string; agent?: string; path?: string; onPath?: boolean; version?: string;
}

// The installer's output goes to the list that runs it.
let logTo: ((data: string) => void) | null = null;
kulisa.on<string>('agents:install-log', (data) => logTo?.(data));

export function agentList(opts: { choose?: boolean; details?: boolean; installed: (a: Agent) => string }) {
  const state = reactive({
    agents: [] as Agent[], selected: undefined as string | undefined, home: null as string | null,
    installing: false, looking: false, progress: '', log: '', error: '', showDetails: false, detailsOpen: false,
    el: null as HTMLElement | null, // the list's element, while its dialog is open
  });
  const chosen = computed(() => state.agents.find((a) => a.id === state.selected));
  const fetchAgents = async () => {
    const r = await kulisa.invoke<{ list: Agent[]; home: string }>('agents:list', opts.details ? { details: true } : { check: true });
    state.agents = r.list; state.home = r.home;
  };
  // Choosing: the arrows choose, Tab goes on to Install or Start.
  const focus = async () => {
    await nextTick();
    state.el?.querySelector<HTMLElement>(opts.choose ? '[role="radio"][data-state="checked"]' : '.install:not([hidden])')?.focus();
  };
  // The dialog opens with the list in it (finding the agents takes a few tenths of a second: the user's shell, their
  // --version), not with a line that flips to it at once; only when it takes longer, it opens saying so.
  async function load(sel: string | undefined, show: () => Promise<void>) {
    if (!state.installing) Object.assign(state, { showDetails: false, log: '', progress: '', error: '' });
    const waiting = setTimeout(() => { state.looking = true; state.agents = []; show(); }, 500);
    await fetchAgents();
    clearTimeout(waiting);
    state.looking = false;
    state.selected = sel ?? state.agents.find((a) => a.installed && a.install)?.id ?? state.agents.find((a) => a.install)?.id;
    await show();
    await focus();
  }
  async function install(id: string) {
    const a = state.agents.find((x) => x.id === id)!;
    state.selected = id;
    state.installing = true;
    logTo = (data) => {
      state.log += data;
      nextTick(() => { const pre = state.el?.querySelector('pre'); if (pre) pre.scrollTop = pre.scrollHeight; });
    };
    Object.assign(state, { showDetails: true, detailsOpen: false, log: '', error: '', progress: `Installing ${a.name}…` });
    const r = await kulisa.invoke<{ installed?: boolean; error?: string; code?: number }>('agents:install', { id });
    state.installing = false;
    logTo = null;
    a.installed = !!r.installed;
    state.progress = a.installed ? opts.installed(a) : '';
    if (!a.installed) {
      state.error = `${a.name} was not installed (${r.error || `the installer ended with code ${r.code}`}). What the installer said is under Details: try again, or choose another agent.`;
      state.detailsOpen = true;
    }
    // Where it went and its version.
    if (opts.details && a.installed) await fetchAgents();
    await focus();
  }
  return { ...opts, state, chosen, load, install };
}
export type AgentList = ReturnType<typeof agentList>;
