// New Project's state, shared by its steps (docs/tasks.md, Projects): what the code comes from, the agents' accounts,
// the profiles; checked step by step, nothing made before Create (main: project:new, setUpProject), which then opens
// its first task. One per wizard (Wizard.vue provides it, its steps inject it).
import { computed, inject, provide, reactive, ref, watch, type InjectionKey } from 'vue';
import { agentList } from '../../lib/agents';
import { MAX, nameChar, repoName } from '../../../shared/names';
import { refused } from '../../../shared/result';
import type { Account, NewProjectSetup, SettingsProfile, SignedIn } from '../../../shared/types';

export const STEPS = ['Code', 'Agents', 'Profiles'] as const;
type From = 'new' | 'folder' | 'clone';

// single: one folder or one URL, in a field of its own, not a list (the welcome's: a first project made simply; more are
// added in Settings, the author, 2026-10-17).
function wizard(single: boolean) {
  const step = ref(0), saving = ref(false), error = ref('');
  const ready = ref(false); // its defaults there: shown only then, or a choice made at once was undone by them
  const last = computed(() => step.value === STEPS.length - 1);

  // 1. Its code, asked first (the author, 2026-10-11): a new folder, folders on the disk (nothing made), or
  // repositories cloned from URLs; several for a project of several (a frontend and a backend). Its name follows the
  // first folder's or repository's until the human types one.
  const code = reactive({ from: 'new' as From, name: '', place: '', sep: '/', git: true,
    sources: [] as { folder: string; state: string }[], urls: [] as string[], typed: '' });
  let named = '';
  const nameOf = (s = '') => [...repoName(s)].filter(nameChar).join('').replace(/^[^\p{L}\p{N}]+/u, '').slice(0, MAX);
  watch(() => [code.from, code.sources.length, code.urls.length], () => {
    if (code.from === 'new' || (code.name.trim() && code.name !== named)) return;
    code.name = named = nameOf(code.from === 'folder' ? code.sources[0]?.folder : code.urls[0]);
  });
  // One more folder or URL (Enter in its field, Add, Browse…): a folder that is not there, or a project's, is refused.
  // One after another, in the order they were added: each folder is asked about first, and the first is the default.
  let queue: Promise<boolean> = Promise.resolve(true);
  function addSource(given?: string) {
    const v = (given ?? code.typed).trim();
    if (single) code.typed = v; // its field shows the one there is
    else if (code.typed.trim() === v) code.typed = '';
    return (queue = queue.then(() => addOne(v)));
  }
  async function addOne(v: string) {
    if (single) { code.sources = []; code.urls = []; } // the one typed now in place of the one before
    if (!v) return true;
    error.value = '';
    if (code.from === 'clone') { if (!code.urls.includes(v)) code.urls.push(v); return true; }
    const r = await kulisa.invoke('project:folder-state', { from: 'folder', folder: v });
    const why = !r ? `${v}: a full path, please` : ({ new: `${r.folder} is not there`, file: `${r.folder} is a file, not a folder`,
      project: `${r.folder} is the project ${r.project}'s already` } as Record<string, string>)[r.state];
    if (why) { error.value = why; if (!code.typed) code.typed = v; return false; } // left to correct
    if (single && v !== code.typed.trim()) return true; // another typed meanwhile: its own answer comes
    if (!code.sources.some((x) => x.folder === r!.folder)) code.sources.push({ folder: r!.folder, state: r!.state });
    return true;
  }
  function removeSource(source: string | undefined) {
    if (code.from === 'folder') code.sources = code.sources.filter((x) => x.folder !== source);
    else code.urls = code.urls.filter((u) => u !== source);
  }
  // A new or cloned project's folder, and what it is (main/ipc/projects.ts, project:folder-state), asked again as it
  // is typed. What it is is kept with the folder it was asked for: until the answer for the folder typed comes, the one
  // before is not said of it (Shop "is a file, not a folder" for a moment, after a file named note: GitHub's runner, 2026-10-16).
  const target = computed(() => (code.from === 'folder' ? '' : `${code.place.trim().replace(/[\\/]+$/, '')}${code.sep}${code.name.trim()}`));
  const asked = ref<{ folder: string; state: string; project?: string } | null>(null);
  const there = computed(() => (asked.value?.folder === target.value ? asked.value : null));
  watch(() => [code.name, code.place, code.from], async () => {
    const folder = target.value;
    const r = !folder ? null : await kulisa.invoke('project:folder-state', { location: code.place, name: code.name });
    if (folder === target.value) asked.value = r && { ...r, folder };
  });
  const refusal = computed(() => {
    const t = target.value, state = there.value?.state ?? '';
    return ({ project: `${t} is the project ${there.value?.project}'s already`, file: `${t} is a file, not a folder` } as Record<string, string>)[state]
      ?? (code.from === 'clone' && ['files', 'repo'].includes(state) ? `${t} is there already: choose another name or location` : '');
  });
  // The welcome's asks no name for code that has one (the folder's, the repository's: the author, 2026-10-17), only
  // when it will not do: then its field, to correct it.
  const nameTrouble = ref(false);
  const askName = computed(() => !single || code.from === 'new' || nameTrouble.value || !!refusal.value);
  const where = computed(() => {
    if (code.from === 'folder' && single && code.sources[0] && code.name.trim()) return `The project ${code.name.trim()} takes ${code.sources[0].folder} as it is`;
    if (code.from === 'folder') return code.sources.length > 1 ? 'The project takes these folders as they are; the first is the default' : '';
    if (!code.name.trim() || !code.place.trim()) return '';
    const t = target.value, state = there.value?.state ?? '';
    if (refusal.value) return refusal.value;
    if (code.from === 'clone' && single) return `The project ${code.name.trim()}: the repository will be cloned into ${t}`;
    if (code.from === 'clone') return code.urls.length > 1 ? `The repositories will be cloned into ${t}, each in a folder of its own` : `The repository will be cloned into ${t}`;
    return ({ files: `${t} is there already: the project takes it as it is, its files kept`,
      repo: `${t} is a git repository: the project takes it as it is` } as Record<string, string>)[state] ?? `The project will be created in ${t}`;
  });
  // Create Git repository: not for a repository or a clone; on the disk, in the folders that are none.
  const askGit = computed(() => (code.from === 'folder' ? code.sources.some((x) => x.state !== 'repo')
    : code.from === 'new' && there.value?.state !== 'repo'));
  async function browse(existing = false) {
    const picked = await kulisa.invoke('project:pick-location', { location: code.place.trim(), existing });
    if (picked && existing) await addSource(picked); else if (picked) code.place = picked;
  }
  // The code's step is checked as Create would check it, nothing made.
  async function codeReady() {
    if (code.from !== 'new' && !(await addSource())) return false;
    if (code.from === 'folder' && !code.sources.length) { error.value = 'Add a folder'; return false; }
    if (code.from === 'clone' && !code.urls.length) { error.value = 'Add a repository URL'; return false; }
    if (!code.name.trim()) { error.value = 'Its name, please'; nameTrouble.value = true; return false; }
    if (refusal.value) { error.value = refusal.value; nameTrouble.value = true; return false; }
    return true;
  }

  // 2. Its agents: any of the accounts (signed in to before, or a new one, here), one the default, which its tasks
  // start with (as on the project's page: tasks.md, Choosing the agent). None: its tasks start with a terminal, which
  // every project has, so it is no choice here (the author, 2026-10-17). A new account's agent not on the computer is
  // installed first, by itself (the author, 2026-10-17: seamless; Details shows the installer at work).
  const accounts = ref<Account[]>([]), clis = ref<string[]>([]);
  const chosen = ref<string[]>([]), main = ref('');
  const installs = agentList({ details: true, installed: (a) => `${a.name} is installed` }); // details: the agents themselves, as Settings → Agents
  const signing = ref<{ id: string; name: string } | null>(null);
  const addable = computed(() => installs.state.agents.filter((a) => clis.value.includes(a.id)));
  const isDefault = (id: string) => (main.value || chosen.value[0]) === id;
  function choose(id: string, on: boolean) {
    chosen.value = on ? [...chosen.value.filter((x) => x !== id), id] : chosen.value.filter((x) => x !== id);
    if (!chosen.value.includes(main.value)) main.value = '';
  }
  async function addAccount(a: { id: string; name: string; installed?: boolean }) {
    if (!a.installed) {
      await installs.install(a.id);
      if (!installs.state.agents.find((x) => x.id === a.id)?.installed) return; // its error says why, Details what the installer said
      Object.assign(installs.state, { progress: '', showDetails: false });
    }
    signing.value = { id: a.id, name: a.name };
  }
  // Signed in: the new account is chosen.
  function signedIn(r: SignedIn) {
    const before = new Set(accounts.value.map((a) => a.id));
    if (r.accounts) accounts.value = r.accounts;
    const made = accounts.value.find((a) => !before.has(a.id))?.id;
    if (made) choose(made, true);
    signing.value = null;
  }

  // 3. Its profiles: new ones (a name, who it is: the agent chooses by it), and any of those there are already.
  const others = ref<SettingsProfile[]>([]), taken = reactive(new Set<string>());
  const fresh = ref<{ name: string; description: string }[]>([]);

  async function next() {
    error.value = '';
    if (step.value === 0 && !(await codeReady())) return false;
    if (step.value === 1 && (signing.value || installs.state.installing)) return false; // finished or cancelled first
    if (!last.value) { step.value++; return false; }
    return create();
  }
  const back = () => { error.value = ''; if (step.value) step.value--; };
  // Create: one call (a clone takes a while), then its first task opened in this window.
  async function create() {
    const first = chosen.value.find(isDefault);
    const setup: NewProjectSetup = { agents: [...(first ? [first] : []), ...chosen.value.filter((x) => x !== first)],
      // plain objects: IPC does not take Vue's proxies
      profiles: [...[...taken].map((id) => ({ id })), ...fresh.value.filter((f) => f.name.trim()).map(({ name, description }) => ({ name, description }))] };
    saving.value = true;
    try {
      const r = await kulisa.invoke('project:new', { from: code.from, name: code.name, location: code.place,
        folders: code.sources.map((x) => x.folder), urls: [...code.urls], git: code.git && askGit.value, ...setup });
      if (refused(r)) { error.value = r.error; step.value = 0; nameTrouble.value = true; return false; }
      await kulisa.invoke('project:open', { id: r.id });
      return true;
    } finally { saving.value = false; }
  }
  // Its defaults, and the accounts and profiles there are (Wizard.vue, as it is made).
  async function reset() {
    const [c, a, p] = await Promise.all([kulisa.invoke('project:new-defaults'), kulisa.invoke('accounts:list'), kulisa.invoke('profiles:list')]);
    Object.assign(code, { from: 'new', name: '', place: c.location, sep: c.sep, git: true, sources: [], urls: [], typed: '' });
    named = ''; step.value = 0; error.value = ''; nameTrouble.value = false;
    accounts.value = a.accounts; clis.value = a.clis; chosen.value = []; main.value = ''; signing.value = null;
    others.value = p.profiles; taken.clear(); fresh.value = [];
    ready.value = true;
    // The agents behind it: looking for them runs the user's login shell and each one's --version (seconds with a heavy
    // .bashrc), and only the second step needs them; the first start's window was empty meanwhile.
    void installs.load(undefined, async () => {});
  }

  return { single, step, last, saving, error, ready, next, back, reset,
    code, addSource, removeSource, where, askGit, askName, browse,
    accounts, chosen, main, isDefault, choose, installs, signing, addable, addAccount, signedIn,
    others, taken, fresh };
}

export type Wizard = ReturnType<typeof wizard>;
const KEY: InjectionKey<Wizard> = Symbol('new project');
export const provideWizard = (single = false) => { const w = wizard(single); provide(KEY, w); return w; };
export const useWizard = () => inject(KEY)!;
