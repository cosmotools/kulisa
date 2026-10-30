// New Project's state, shared by its steps (docs/tasks.md, Projects): what the code comes from, the agents' accounts,
// the profiles; checked step by step, nothing made before Create (main: project:new, setUpProject), which then opens
// its first task. One per wizard (components/NewProject.tsx makes it as it is shown; its steps read it with useWizard).
import { createStore, useStore } from 'zustand';
import { agentList } from './agents';
import { MAX, nameChar, repoName } from '../../shared/names';
import { refused } from '../../shared/result';
import type { Account, NewProjectSetup, SettingsProfile, SignedIn } from '../../shared/types';

export const STEPS = ['Code', 'Agents', 'Profiles'] as const;
export type From = 'new' | 'folder' | 'clone';
type Source = { folder: string; state: string };

export interface WizardState {
  step: number; saving: boolean; error: string;
  errorAt: 'source' | 'name' | ''; // the field the error is of; none: Create's refusal (a clone failing), over the buttons
  ready: boolean; // its defaults there: shown only then, or a choice made at once is undone by them
  // 1. Its code: a new folder, folders on the disk (nothing made), or repositories cloned from URLs.
  from: From; name: string; place: string; sep: string; sources: Source[]; urls: string[]; typed: string;
  asked: { folder: string; state: string; project?: string } | null; // what the folder of a new or cloned one is
  nameTrouble: boolean; // its name's field shown in the welcome's: it will not do
  // 2. Its agents: accounts, one the default (main; none: the first chosen).
  accounts: Account[]; clis: string[]; chosen: string[]; main: string; signing: { id: string; name: string } | null;
  // 3. Its profiles: those there are, taken; new ones.
  others: SettingsProfile[]; taken: string[]; fresh: { name: string; description: string }[];
}

// single: one folder or one URL, in a field of its own, not a list (the welcome's: a first project made simply; more are
// added in Settings).
export function wizard(single: boolean) {
  const store = createStore<WizardState>()(() => ({ step: 0, saving: false, error: '', errorAt: '', ready: false,
    from: 'new', name: '', place: '', sep: '/', sources: [], urls: [], typed: '', asked: null, nameTrouble: false,
    accounts: [], clis: [], chosen: [], main: '', signing: null, others: [], taken: [], fresh: [] }));
  const get = store.getState, set = store.setState;
  // details: the agents themselves, as Settings → Agents
  const installs = agentList({ details: true, installed: (a) => `${a.name} is installed` });

  // Its name follows the first folder's or repository's until the human types one.
  let named = '';
  const nameOf = (s = '') => [...repoName(s)].filter(nameChar).join('').replace(/^[^\p{L}\p{N}]+/u, '').slice(0, MAX);
  const follow = () => {
    const s = get();
    if (s.from === 'new' || (s.name.trim() && s.name !== named)) return;
    set({ name: named = nameOf(s.from === 'folder' ? s.sources[0]?.folder : s.urls[0]) });
  };
  // A new or cloned project's folder, and what it is (main/ipc/projects.ts, project:folder-state), asked again as it
  // is typed. What it is is kept with the folder it was asked for: until the answer for the folder typed comes, the one
  // before is not said of it (Shop "is a file, not a folder" for a moment, after a file named note).
  async function ask() {
    const s = get(), folder = thereOf(s).t;
    const r = !folder ? null : await kulisa.invoke('project:folder-state', { location: s.place, name: s.name });
    if (folder === thereOf(get()).t) set({ asked: r && { ...r, folder } });
  }
  const change = (c: Partial<WizardState>) => { set({ ...c, error: '' }); follow(); void ask(); };

  // One more folder or URL (Enter in its field, Add, Browse…): a folder that is not there, or a project's, is refused.
  // One after another, in the order they were added: each folder is asked about first, and the first is the default.
  let queue: Promise<boolean> = Promise.resolve(true);
  function addSource(given?: string) {
    const v = (given ?? get().typed).trim();
    if (single) set({ typed: v }); // its field shows the one there is
    else if (get().typed.trim() === v) set({ typed: '' });
    return (queue = queue.then(() => addOne(v)));
  }
  async function addOne(v: string) {
    if (single) set({ sources: [], urls: [] }); // the one typed now in place of the one before
    if (!v) { follow(); return true; }
    set({ error: '' });
    if (get().from === 'clone') { if (!get().urls.includes(v)) set({ urls: [...get().urls, v] }); follow(); void ask(); return true; }
    const r = await kulisa.invoke('project:folder-state', { from: 'folder', folder: v });
    const why = !r ? `${v}: a full path, please` : r.state === 'new' ? `${r.folder} is not there` : folderIs[r.state]?.(r.folder, r.project);
    if (why) { set({ error: why, errorAt: 'source', ...(!get().typed && { typed: v }) }); return false; } // left to correct
    if (single && v !== get().typed.trim()) return true; // another typed meanwhile: its own answer comes
    if (!get().sources.some((x) => x.folder === r!.folder)) set({ sources: [...get().sources, { folder: r!.folder, state: r!.state }] });
    follow();
    return true;
  }
  function removeSource(source: string | undefined) {
    if (get().from === 'folder') set({ sources: get().sources.filter((x) => x.folder !== source) });
    else set({ urls: get().urls.filter((u) => u !== source) });
  }
  async function browse(existing = false) {
    const picked = await kulisa.invoke('project:pick-location', { location: get().place.trim(), existing });
    if (picked && existing) await addSource(picked); else if (picked) change({ place: picked });
  }
  // The code's step is checked as Create would check it, nothing made.
  async function codeReady() {
    const s0 = get();
    if (s0.from !== 'new' && !(await addSource())) return false;
    const s = get(), refusal = refusalOf(s);
    if (s.from === 'folder' && !s.sources.length) { set({ error: 'Add a folder', errorAt: 'source' }); return false; }
    if (s.from === 'clone' && !s.urls.length) { set({ error: 'Add a repository URL', errorAt: 'source' }); return false; }
    if (!s.name.trim()) { set({ error: 'Its name, please', errorAt: 'name', nameTrouble: true }); return false; }
    if (refusal) { set({ nameTrouble: true }); return false; } // said at its field as it is typed (refusalOf)
    return true;
  }

  // 2. A new account's agent not on the computer is installed first, by itself (Details shows the installer at work).
  function choose(id: string, on: boolean) {
    const chosen = on ? [...get().chosen.filter((x) => x !== id), id] : get().chosen.filter((x) => x !== id);
    set({ chosen, ...(!chosen.includes(get().main) && { main: '' }) });
  }
  async function addAccount(a: { id: string; name: string; installed?: boolean }) {
    if (!a.installed) {
      if (!(await installs.install(a.id))) return; // its error says why, Details what the installer said
      installs.hideProgress();
    }
    set({ signing: { id: a.id, name: a.name } });
  }
  // Signed in: the new account is chosen.
  function signedIn(r: SignedIn) {
    const before = new Set(get().accounts.map((a) => a.id));
    if (r.accounts) set({ accounts: r.accounts });
    const made = get().accounts.find((a) => !before.has(a.id))?.id;
    if (made) choose(made, true);
    set({ signing: null });
  }

  async function next() {
    set({ error: '' });
    const s = get();
    if (s.step === 0 && !(await codeReady())) return false;
    if (s.step === 1 && (s.signing || installs.store.getState().installing)) return false; // finished or cancelled first
    if (s.step < STEPS.length - 1) { set({ step: s.step + 1 }); return false; }
    return create();
  }
  const back = () => set({ error: '', step: Math.max(0, get().step - 1) });
  // Create: one call (a clone takes a while), then its first task opened in this window.
  async function create() {
    const s = get(), first = s.chosen.find((x) => isDefault(s, x));
    const setup: NewProjectSetup = { agents: [...(first ? [first] : []), ...s.chosen.filter((x) => x !== first)],
      profiles: [...s.taken.map((id) => ({ id })), ...s.fresh.filter((f) => f.name.trim()).map(({ name, description }) => ({ name, description }))] };
    set({ saving: true });
    try {
      const r = await kulisa.invoke('project:new', { from: s.from, name: s.name, location: s.place, folders: s.sources.map((x) => x.folder), urls: s.urls, ...setup });
      // Not at a field: the main process's refusal does not say which (the code's step checked them all before).
      if (refused(r)) { set({ error: r.error, errorAt: '', step: 0, nameTrouble: true }); return false; }
      await kulisa.invoke('task:new', { project: r.id });
      return true;
    } finally { set({ saving: false }); }
  }
  // Its defaults, and the accounts and profiles there are (as it is made).
  async function reset() {
    const [c, a, p] = await Promise.all([kulisa.invoke('project:new-defaults'), kulisa.invoke('accounts:list'), kulisa.invoke('profiles:list')]);
    named = '';
    set({ from: 'new', name: '', place: c.location, sep: c.sep, sources: [], urls: [], typed: '', asked: null, step: 0, error: '', errorAt: '', nameTrouble: false,
      accounts: a.accounts, clis: a.clis, chosen: [], main: '', signing: null, others: p.profiles, taken: [], fresh: [], ready: true });
    void ask();
    // The agents behind it: looking for them runs the user's login shell and each one's --version (seconds with a heavy
    // .bashrc), and only the second step needs them; waited for, the first start's window is empty meanwhile.
    void installs.load(undefined, () => {});
  }

  return { single, store, installs, change, addSource, removeSource, browse, choose, addAccount, signedIn, next, back, reset,
    set: (c: Partial<WizardState>) => set(c) };
}
export type Wizard = ReturnType<typeof wizard>;
export const useWizard = <T>(w: Wizard, selector: (s: WizardState) => T) => useStore(w.store, selector);

// What a folder is that will not do, said of it (one added; a new or cloned one's).
const folderIs: Record<string, (folder: string, project?: string) => string> = {
  file: (folder) => `${folder} is a file, not a folder`,
  project: (folder, project) => `${folder} is the project ${project}'s already`,
};
// What is said of the code as it is typed, from the state alone.
export const isDefault = (s: WizardState, id: string) => (s.main || s.chosen[0]) === id;
const thereOf = (s: WizardState) => {
  const t = s.from === 'folder' ? '' : `${s.place.trim().replace(/[\\/]+$/, '')}${s.sep}${s.name.trim()}`;
  return { t, there: s.asked?.folder === t ? s.asked : null };
};
export function refusalOf(s: WizardState) {
  const { t, there } = thereOf(s), state = there?.state ?? '';
  return folderIs[state]?.(t, there?.project)
    ?? (s.from === 'clone' && ['files', 'repo'].includes(state) ? `${t} is there already: choose another name or location` : '');
}
// The welcome's asks no name for code that has one (the folder's, the repository's), only when it will not do: then its
// field, to correct it.
export const askName = (s: WizardState, single: boolean) => !single || s.from === 'new' || s.nameTrouble || !!refusalOf(s);
export function whereOf(s: WizardState, single: boolean) {
  const name = s.name.trim();
  if (s.from === 'folder' && single && s.sources[0] && name) return `The project ${name} takes ${s.sources[0].folder} as it is`;
  if (s.from === 'folder') return s.sources.length > 1 ? 'The project takes these folders as they are; the first is the default' : '';
  if (!name || !s.place.trim()) return '';
  const { t, there } = thereOf(s), state = there?.state ?? '', refusal = refusalOf(s);
  if (refusal) return refusal;
  if (s.from === 'clone' && single) return `The project ${name}: the repository will be cloned into ${t}`;
  if (s.from === 'clone') return s.urls.length > 1 ? `The repositories will be cloned into ${t}, each in a folder of its own` : `The repository will be cloned into ${t}`;
  return ({ files: `${t} is there already: the project takes it as it is, its files kept`,
    repo: `${t} is a git repository: the project takes it as it is` } as Record<string, string>)[state] ?? `The project will be created in ${t}`;
}
