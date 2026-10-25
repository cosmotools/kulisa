// The profiles, one flat store (profiles.md, "What a profile is"): each a person with their sign-ins, in the projects
// that list it (projects.json's profiles: store.ts). Its master is a Chromium profile folder in Kulisa's data
// (profiles/<id>/) that the human signs in to and no one works in; each task of its projects works in a copy of it,
// made when the profile is first opened there (project-profiles.ts). Who it is (name, picture, description) is the
// store's, the same in every project and task; what a task has of it (open or closed, its tabs, sites' zoom) is the
// task's. Inside Kulisa a profile is its id; the agent names it by its name, unique within a project (nameTaken). A
// profile lives until the human deletes it (Settings → Profiles, as an agent's account): a project letting it go keeps
// it, in no project then. Who it is changes here, checked here, for every handle (a task, Settings, the agent). Plain
// Node (no Electron): unit-tested.
//   profiles.json         { list: [{ id, name, avatar, description, login }] }: id, six random characters, made once;
//                         login: a test user's pair, { user, secret } (the password encrypted with the OS keyring:
//                         safeStorage; never in the clear, never logged)
//   profiles/<id>/        its master
import fs from 'fs';
import path from 'path';
import { removeTree } from './remove.ts';
import { nameError } from '../shared/names.ts';
import { newId, writeFileAtomic } from './store.ts';
import { log } from './log.ts';
import type { Store } from './store.ts';
import { AVATARS, nextAvatar } from '../shared/avatars.ts';
import type { Result } from '../shared/result.ts';

// A profile as the store keeps it.
interface StoredProfile {
  id: string; name: string; avatar: string; description?: string;
  login?: { user: string; secret?: string };
}

// A profile's description: who it is in the app under test, for agents to choose profiles by (profiles.md). The
// human's words, optional.
const ABOUT_MAX = 500;
const aboutError = (d: unknown) => (typeof d !== 'string' ? 'a description is text'
  : d.trim().length > ABOUT_MAX ? `a description is at most ${ABOUT_MAX} characters` : null);

class ProfileStore {
  dir: string; store: Store; file: string;
  // store: Kulisa's data (store.ts): its folder, the projects that list the profiles, the folders the next start removes.
  constructor(store: Store) {
    this.dir = store.dir; this.store = store;
    this.file = path.join(this.dir, 'profiles.json');
  }
  all(): StoredProfile[] { try { return JSON.parse(fs.readFileSync(this.file, 'utf8')).list || []; } catch { return []; } }
  save(list: StoredProfile[]) { writeFileAtomic(this.file, JSON.stringify({ list }, null, 2)); }
  get(id: string): StoredProfile | null { return this.all().find((p) => p.id === id) || null; }
  // A project's profiles, in its order.
  of(project: string) {
    const all = this.all();
    return (this.store.projects().find((p) => p.id === project)?.profiles || []).flatMap((id): StoredProfile[] => all.filter((p) => p.id === id));
  }
  // The ids of the projects that list it.
  projectsOf(p: StoredProfile) { return this.store.projectsWith('profiles', p.id).map((x) => x.id); }
  masterDir(id: string) { return path.join(this.dir, 'profiles', id); }
  // Who an id is, beside it in the log: its id says nothing, and the log is read after it is gone.
  label(id: string) { const p = this.get(id); return p ? `${id} (${p.name})` : id; }
  // At start, each once a run, so that an id in any line after is found.
  logAll() { for (const p of this.all()) log.info(`[profiles] ${this.label(p.id)}`); }
  // A new profile, in a project or in none (Settings → Profiles), whoever makes it (a task, the agent, Settings, New
  // Project): its fields checked, its picture the next one free among its project's (among all, in none) unless one is
  // given; its master folder, empty, named by its id, random: one no profile, master or folder waiting to be removed
  // has (a task's copy of a deleted profile, named by its id, stays on disk while its session is open, and a new
  // profile must not find it).
  create(project: string | null, { name, avatar, description = '' }: { name: string; avatar?: string; description?: string }): Result<StoredProfile> {
    const bad = this.check({ name, description, avatar }) || (project && this.nameTaken(name.trim(), [project]));
    if (bad) return { error: bad };
    name = name.trim(); description = description.trim();
    avatar ||= nextAvatar((project ? this.of(project) : this.all()).map((p) => p.avatar));
    const list = this.all(), deleted = this.store.deleted().map((d) => path.basename(d));
    const id = newId((f) => list.some((p) => p.id === f) || deleted.includes(f) || fs.existsSync(this.masterDir(f)));
    const p: StoredProfile = { id, name, avatar, ...(description && { description }) };
    fs.mkdirSync(this.masterDir(id), { recursive: true });
    this.save([...list, p]);
    log.info(`[profiles] made ${this.label(id)}`);
    return project ? this.addTo(p.id, project) : p;
  }
  // A name is unique within a project, whatever its case: the agent names a profile by it (kulisa-plugin/tools/). Why a name
  // cannot be in these projects (but for the profile except), or null.
  nameTaken(name: string, projects: string[], except?: string) {
    const lower = name.toLowerCase();
    for (const id of projects) {
      if (this.of(id).some((p) => p.id !== except && p.name.toLowerCase() === lower)) {
        return `a profile ${name} is in the project ${this.store.projects().find((x) => x.id === id)?.name ?? id} already`;
      }
    }
    return null;
  }
  // A new profile's fields, or why not.
  private check({ name, description = '', avatar }: { name?: string; description?: unknown; avatar?: string }) {
    return nameError(name?.trim()) || aboutError(description) || (avatar && !AVATARS.includes(avatar) && `no picture ${avatar}`) || null;
  }
  // Who it is changed, for every project and task at once: its name, what it is in the app, its picture, a test user's
  // pair (its password as the caller encrypted it; an empty login takes the pair away). Its id stays. { id }, or
  // { error } saying why not.
  rename(id: string, name: string | undefined): Result<{ id: string }> {
    const p = this.get(id);
    if (!p) return { error: `no profile ${id}` };
    const now = name?.trim();
    const bad = nameError(now) || this.nameTaken(now!, this.projectsOf(p), id);
    if (bad) return { error: bad };
    this.update(id, { name: now });
    if (now !== p.name) log.info(`[profiles] ${id} renamed: ${now}`);
    return { id };
  }
  describe(id: string, description: unknown): Result<{ id: string }> {
    const bad = aboutError(description);
    return bad ? { error: bad } : this._set(id, { description: (description as string).trim() });
  }
  setAvatar(id: string, avatar: string): Result<{ id: string }> { return AVATARS.includes(avatar) ? this._set(id, { avatar }) : { error: `no picture ${avatar}` }; }
  setLogin(id: string, user: string | undefined, secret: string | undefined): Result<{ id: string }> {
    const p = this.get(id);
    if (!p) return { error: `no profile ${id}` };
    user = user?.trim() || '';
    if (user.length > 200) return { error: 'a login is at most 200 characters' };
    const login: StoredProfile['login'] = user ? { user, secret: secret ?? (p.login?.user ? p.login.secret : undefined) } : undefined;
    if (login && !login.secret) delete login.secret;
    return this._set(id, { login });
  }
  _set(id: string, fields: Partial<StoredProfile>): Result<{ id: string }> {
    return this.update(id, fields) ? { id } : { error: `no profile ${id}` };
  }
  // Who it is changed (name, picture, description): everywhere at once.
  update(id: string, fields: Partial<StoredProfile>) {
    const list = this.all(), p = list.find((x) => x.id === id);
    if (!p) return null;
    Object.assign(p, fields);
    if (!p.description) delete p.description;
    if (!p.login) delete p.login;
    this.save(list);
    return p;
  }
  // Listed in another project too (Project Settings…, From another project), unless one of its profiles has its name.
  addTo(id: string, project: string): Result<StoredProfile> {
    const p = this.get(id), x = this.store.projects().find((e) => e.id === project);
    if (!p) return { error: `no profile ${id}` };
    if (!x) return { error: `no project ${project}` };
    if (x.profiles?.includes(id)) return p;
    const bad = this.nameTaken(p.name, [project]);
    if (bad) return { error: bad };
    this.store.updateProject(project, { profiles: [...(x.profiles || []), id] });
    return p;
  }
  // Let go by a project: it stays, with its master (its sign-ins), in no project when that was its last.
  removeFrom(id: string, project: string): Result<{ profile: StoredProfile }> {
    const p = this.get(id), x = this.store.projects().find((e) => e.id === project);
    if (!p) return { error: `no profile ${id}` };
    if (x?.profiles?.includes(id)) this.store.updateProject(project, { profiles: x.profiles.filter((f) => f !== id) });
    return { profile: p };
  }
  // Deleted (Settings → Profiles, after a question): gone with its master. Its copies in tasks are the caller's
  // (projects.ts, deleteProfile).
  delete(id: string): Result<{ profile: StoredProfile }> {
    const list = this.all(), p = list.find((x) => x.id === id);
    if (!p) return { error: `no profile ${id}` };
    log.info(`[profiles] deleted ${this.label(id)}`);
    for (const x of this.store.projectsWith('profiles', id)) this.removeFrom(id, x.id);
    this.save(list.filter((x) => x !== p));
    const dir = this.masterDir(id);
    this.store.markDeleted(dir);
    try { removeTree(dir); } catch (e) { console.warn('[profiles]', (e as Error).message); }
    return { profile: p };
  }
}

export type { StoredProfile };
export { ProfileStore };
