// Shared staged project draft (docs/tasks.md, Projects). Connections are saved globally; this draft only selects
// their project membership. Display names and destination folder names have separate validation and lifecycles.
import { createStore, useStore } from 'zustand';
import { agentList } from '../../lib/agents';
import { labelError, folderNameError, repoName, slugOf, MAX } from '../../../shared/names';
import { refused } from '../../../shared/result';
import type { Account, AccountsInfo, SignedIn } from '../../../shared/types';

export type From = 'new' | 'folder' | 'clone';
type Step = 'agents' | 'code' | 'finish';
export interface ProjectDraftState {
  ready: boolean; saving: boolean; checking: boolean; error: string; step: Step;
  from: From; folder: string; url: string; name: string; directoryName: string; place: string; sep: string;
  asked: { target: string; folder: string; state: string; project?: string; error: string | null } | null;
  accounts: Account[]; clis: string[]; selected: string; connecting: boolean;
  kind: 'web' | 'cli' | 'unsure';
}

export function projectDraft() {
  const initial: ProjectDraftState = { ready: false, saving: false, checking: false, error: '', step: 'agents', from: 'new',
    folder: '', url: '', name: '', directoryName: '', place: '', sep: '/', asked: null,
    accounts: [], clis: [], selected: '', connecting: false, kind: 'unsure' };
  const store = createStore<ProjectDraftState>()(() => initial), get = store.getState, set = store.setState;
  const installs = agentList({ details: true, installed: (a) => `${a.name} is installed` });
  let named = false, destinationEdited = false, version = 0;
  let destinations: Partial<Record<From, { name: string; edited: boolean }>> = {};
  const sourceName = () => { const s = get(); return s.from === 'new' ? s.directoryName : repoName(s.from === 'folder' ? s.folder : s.url); };
  const derive = () => {
    const s = get();
    const source = sourceName();
    if (!named) set({ name: displayName(source) });
    if (s.from === 'clone' && !destinationEdited) set({ directoryName: folderNameError(source) ? slugOf(source, '') : source });
  };
  const change = (patch: Partial<ProjectDraftState>) => {
    version++;
    if (patch.name !== undefined) named = true;
    if (patch.from && patch.from !== get().from) {
      destinations[get().from] = { name: get().directoryName, edited: destinationEdited };
      const previous = destinations[patch.from];
      destinationEdited = previous?.edited ?? false;
      set({ directoryName: previous?.name ?? '', asked: null, ...(!named && { name: '' }) });
    }
    if (patch.directoryName !== undefined) destinationEdited = true;
    set({ ...patch, error: '' }); derive(); void ask();
  };
  async function ask() {
    const s = get(), target = destination(s);
    if (s.from === 'folder' || !target || folderNameError(s.directoryName)) { set({ asked: null }); return; }
    try {
      const r = await kulisa.invoke('project:folder:state', { location: s.place, name: s.directoryName });
      if (target === destination(get()) && s.from === get().from) set({ asked: r && { ...r, target } });
      return r;
    } catch (e) { if (target === destination(get())) set({ error: String(e) }); }
  }
  async function browse(existing = false) {
    const picked = await kulisa.invoke('project:pick-location', { location: existing ? get().folder || get().place : get().place, existing });
    if (picked) change(existing ? { folder: picked } : { place: picked });
  }
  function choose(id: string) { set({ selected: id, error: '' }); }
  function connected(r: SignedIn | (AccountsInfo & { connected: string })) {
    const before = new Set(get().accounts.map((a) => a.id));
    if (r.accounts) set({ accounts: r.accounts });
    const selected = 'connected' in r ? r.connected : get().accounts.find((a) => !before.has(a.id))?.id;
    if (selected) choose(selected);
  }
  function agentsReady() {
    const installed = installs.store.getState().agents.filter((a) => a.installed).map((a) => a.id);
    if (get().accounts.some((a) => a.id === get().selected && installed.includes(a.agent))) return true;
    set({ step: 'agents', error: 'Choose a connected agent to continue.' }); return false;
  }
  async function codeReady() {
    const s = get();
    if (s.from !== 'folder') {
      if (s.from === 'clone' && (!s.url.trim() || !sourceName())) { set({ error: 'Enter the repository URL.' }); return false; }
      const bad = folderNameError(s.directoryName);
      if (bad) { set({ error: bad === 'no name' ? 'Enter a folder name.' : `Folder name: ${bad}` }); return false; }
      const r = await ask();
      const error = !r ? 'Enter the full path to the parent folder, or browse for it.' : refusalOf(get());
      if (error) { set({ error }); return false; }
      return true;
    }
    const r = await kulisa.invoke('project:folder:state', { from: 'folder', folder: s.folder });
    const error = !r ? 'Enter the full path to a folder, or browse for it.' : r.error;
    if (error) { set({ error }); return false; }
    set({ folder: r!.folder }); derive(); return true;
  }
  async function next() {
    if (get().checking || get().connecting || installs.store.getState().installing) return;
    set({ checking: true, error: '' });
    const current = version;
    try {
      if (get().step === 'agents') { if (agentsReady()) set({ step: 'code' }); }
      else if (await codeReady() && current === version) set({ step: 'finish' });
    } catch (e) { set({ error: String(e) }); }
    finally { set({ checking: false }); }
  }
  function back() { set({ step: get().step === 'finish' ? 'code' : 'agents', error: '' }); }
  async function create() {
    if (get().saving || get().connecting || installs.store.getState().installing) return false;
    set({ saving: true, error: '' });
    try {
      if (!agentsReady()) return false;
      if (!(await codeReady())) { set({ step: 'code' }); return false; }
      const s = get(), bad = labelError(s.name.trim());
      if (bad) { set({ error: bad === 'no name' ? 'Give your project a name.' : bad }); return false; }
      const r = await kulisa.invoke('project:new', { from: s.from, name: s.name.trim(), directoryName: s.directoryName, location: s.place,
        folders: s.from === 'folder' ? [s.folder] : [], urls: s.from === 'clone' ? [s.url.trim()] : [],
        agents: [s.selected] });
      if (refused(r)) { set({ error: r.error }); return false; }
      // Do not offer Create again if opening the task fails after the project was successfully stored.
      try { await kulisa.invoke('task:new', { project: r.id }); }
      catch { await kulisa.invoke('project:refresh'); }
      return true;
    } catch (e) { set({ error: String(e) }); return false; }
    finally { set({ saving: false }); }
  }
  async function reset() {
    try {
      const [c, a] = await Promise.all([kulisa.invoke('project:new-defaults'), kulisa.invoke('account:list')]);
      named = destinationEdited = false; destinations = {}; version++;
      set({ ...initial, place: c.location, sep: c.sep, accounts: a.accounts, clis: a.clis, ready: true });
      void installs.load(undefined, () => {}).catch((e: unknown) => set({ error: String(e) }));
    } catch (e) { set({ error: String(e), ready: true }); }
  }
  return { store, installs, change, browse, choose, connected, next, back, create, reset,
    set: (patch: Partial<ProjectDraftState>) => set(patch) };
}
export type ProjectDraft = ReturnType<typeof projectDraft>;
export const useProjectDraft = <T>(d: ProjectDraft, selector: (s: ProjectDraftState) => T) => useStore(d.store, selector);
const displayName = (source: string) => source.replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1 $2').replace(/[-_.]+/g, ' ')
  .replace(/\s+/g, ' ').trim().split(' ').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ').slice(0, MAX);
export const destination = (s: ProjectDraftState) => s.from === 'folder' ? s.folder : s.place.trim() && s.directoryName
  ? `${s.place.trim().replace(/[\\/]+$/, '')}${s.sep}${s.directoryName}` : '';
export function refusalOf(s: ProjectDraftState) {
  return s.asked?.target === destination(s) ? s.asked.error || '' : '';
}
