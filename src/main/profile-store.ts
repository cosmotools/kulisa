// The profiles, one flat store (profiles.md, "What a profile is"): each a person with their sign-ins, in the projects
// that list it (projects.json's profiles: store.ts). Its master is a Chromium profile folder in Kulisa's data
// (profiles/Profile <k>/) that the human signs in to and no one works in; each task of its projects works in a copy of
// it, made when the profile is first opened there (project-profiles.ts). Who it is (name, id, picture, description) is
// the store's, the same in every project and task; what a task has of it (open or closed, its tabs, sites' zoom) is the
// task's. A profile lives until the human deletes it (Settings → Profiles, as an agent's
// account): a project letting it go keeps it, in no project then. Who it is changes here, checked here, for every
// handle (a task, Settings, the agent). Plain Node (no Electron): unit-tested.
//   profiles.json         { next, list: [{ id, name, avatar, description, folder, login }] }:
//                         login: a test user's pair, { user, secret } (the password encrypted with the OS keyring:
//                         safeStorage; never in the clear, never logged); next,
//                         the number of the next folder, never one used before (a task's copy of a deleted profile
//                         stays on disk while its session is open, and a new profile must not find it)
//   profiles/Profile <k>/ its master
import fs from 'fs';
import path from 'path';
import { slugOf, nameError } from '../shared/names.ts';
import { writeFileAtomic } from './store.ts';
import type { Store } from './store.ts';
import { AVATARS, nextAvatar } from '../shared/avatars.ts';
import type { Result } from '../shared/result.ts';

// A profile as the store keeps it.
interface StoredProfile {
  id: string; name: string; avatar: string; description?: string; folder: string;
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
  read(): { next: number; list: StoredProfile[] } { try { return JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { return { next: 1, list: [] }; } }
  all() { return this.read().list; }
  save(list: StoredProfile[], next = this.read().next) { writeFileAtomic(this.file, JSON.stringify({ next, list }, null, 2)); }
  get(id: string): StoredProfile | null { return this.all().find((p) => p.id === id) || null; }
  byFolder(folder: string): StoredProfile | null { return this.all().find((p) => p.folder === folder) || null; }
  // A project's profiles, in its order.
  of(project: string) {
    const all = this.all();
    return (this.store.projects().find((p) => p.id === project)?.profiles || []).flatMap((f): StoredProfile[] => all.filter((p) => p.folder === f));
  }
  // The ids of the projects that list it.
  projectsOf(p: StoredProfile) { return this.store.projectsWith('profiles', p.folder).map((x) => x.id); }
  masterDir(folder: string) { return path.join(this.dir, 'profiles', folder); }
  // A new profile, in a project or in none (Settings → Profiles), whoever makes it (a task, the agent, Settings, New
  // Project): its fields checked, its picture the next one free among its project's (among all, in none) unless one is
  // given; its master folder, empty, numbered as Chrome numbers its profiles, never a number used before.
  create(project: string | null, { name, avatar, description = '' }: { name: string; avatar?: string; description?: string }): Result<StoredProfile> {
    const bad = this.check({ name, description, avatar });
    if (bad) return { error: bad };
    name = name.trim(); description = description.trim();
    avatar ||= nextAvatar((project ? this.of(project) : this.all()).map((p) => p.avatar));
    const { next, list } = this.read();
    let n = next;
    while (fs.existsSync(this.masterDir(`Profile ${n}`))) n++;
    const folder = `Profile ${n}`;
    const p: StoredProfile = { id: this.idFor(name), name, avatar, ...(description && { description }), folder };
    fs.mkdirSync(this.masterDir(folder), { recursive: true });
    this.save([...list, p], n + 1);
    return project ? this.addTo(p.id, project) : p;
  }
  // An id from a name, one no other profile has (except: the profile being renamed).
  idFor(name: string, except?: string) {
    const list = this.all(), base = slugOf(name, 'profile');
    let id = base, n = 2;
    while (list.some((p) => p.id === id && p.id !== except)) id = `${base}-${n++}`;
    return id;
  }
  // A new profile's fields, or why not.
  private check({ name, description = '', avatar }: { name?: string; description?: unknown; avatar?: string }) {
    return nameError(name?.trim()) || aboutError(description) || (avatar && !AVATARS.includes(avatar) && `no picture ${avatar}`) || null;
  }
  // Who it is changed, for every project and task at once: its name (and id, from it), what it is in the app, its
  // picture, a test user's pair (its password as the caller encrypted it; an empty login takes the pair away). { id }
  // (its id now), or { error } saying why not.
  rename(id: string, name: string | undefined): Result<{ id: string }> {
    const p = this.get(id);
    if (!p) return { error: `no profile ${id}` };
    const bad = nameError(name?.trim());
    if (bad) return { error: bad };
    const now = this.idFor(name!, id);
    this.update(p.folder, { id: now, name: name!.trim() });
    return { id: now };
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
    const p = this.get(id);
    if (!p) return { error: `no profile ${id}` };
    this.update(p.folder, fields);
    return { id };
  }
  // Who it is changed (name and id, picture, description): everywhere at once.
  update(folder: string, fields: Partial<StoredProfile>) {
    const list = this.all(), p = list.find((x) => x.folder === folder);
    if (!p) return null;
    Object.assign(p, fields);
    if (!p.description) delete p.description;
    if (!p.login) delete p.login;
    this.save(list);
    return p;
  }
  // Listed in another project too (Project Settings…, From another project).
  addTo(id: string, project: string): Result<StoredProfile> {
    const p = this.get(id), x = this.store.projects().find((e) => e.id === project);
    if (!p) return { error: `no profile ${id}` };
    if (!x) return { error: `no project ${project}` };
    if (!x.profiles?.includes(p.folder)) this.store.updateProject(project, { profiles: [...(x.profiles || []), p.folder] });
    return p;
  }
  // Let go by a project: it stays, with its master (its sign-ins), in no project when that was its last.
  removeFrom(id: string, project: string): Result<{ profile: StoredProfile }> {
    const p = this.get(id), x = this.store.projects().find((e) => e.id === project);
    if (!p) return { error: `no profile ${id}` };
    if (x?.profiles?.includes(p.folder)) this.store.updateProject(project, { profiles: x.profiles.filter((f) => f !== p.folder) });
    return { profile: p };
  }
  // Deleted (Settings → Profiles, after a question): gone with its master. Its copies in tasks are the caller's
  // (projects.ts, deleteProfile).
  delete(id: string): Result<{ profile: StoredProfile }> {
    const list = this.all(), p = list.find((x) => x.id === id);
    if (!p) return { error: `no profile ${id}` };
    for (const x of this.store.projectsWith('profiles', p.folder)) this.removeFrom(id, x.id);
    this.save(list.filter((x) => x !== p));
    const dir = this.masterDir(p.folder);
    this.store.markDeleted(dir);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { console.warn('[profiles]', (e as Error).message); }
    return { profile: p };
  }
}

export type { StoredProfile };
export { ProfileStore };
