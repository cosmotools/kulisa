// The profiles, one flat store (profiles.md, "What a profile is"): each a person with their sign-ins, in the projects
// it is listed in. Its master is a Chromium profile folder in Kulisa's data (profiles/Profile <k>/) that the human
// signs in to and no one works in; each task of its projects works in a copy of it, made when the profile is first
// opened there (project-profiles.js). Who it is (name, id, picture, description) is the store's, the same in every
// project and task; what a task has of it (open or closed, its tabs, sites' zoom) is the task's. A profile goes when its
// last project lets it go, after a question. Plain Node (no Electron): unit-tested.
//   profiles.json         { next, list: [{ id, name, avatar, description, folder, projects: [project id] }] }: next,
//                         the number of the next folder, never one used before (a task's copy of a deleted profile
//                         stays on disk while its session is open, and a new profile must not find it)
//   profiles/Profile <k>/ its master
const fs = require('fs');
const path = require('path');
const { slugOf } = require('./names');
const { writeFileAtomic } = require('./store');

class ProfileStore {
  // dir: Kulisa's data folder; markDeleted: a folder for the next start to remove when it cannot go now (store.js).
  constructor(dir, markDeleted = () => {}) {
    this.dir = dir; this.markDeleted = markDeleted;
    this.file = path.join(dir, 'profiles.json');
  }
  read() { try { return JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { return { next: 1, list: [] }; } }
  all() { return this.read().list; }
  save(list, next = this.read().next) { writeFileAtomic(this.file, JSON.stringify({ next, list }, null, 2)); }
  get(id) { return this.all().find((p) => p.id === id) || null; }
  byFolder(folder) { return this.all().find((p) => p.folder === folder) || null; }
  // A project's profiles, in the order they were made.
  of(project) { return this.all().filter((p) => p.projects.includes(project)); }
  masterDir(folder) { return path.join(this.dir, 'profiles', folder); }
  // A new profile in a project: its master folder, empty, numbered as Chrome numbers its profiles, never a number used
  // before. The fields are checked by the caller (project-profiles.js).
  create(project, { name, avatar, description = '' }) {
    const { next, list } = this.read();
    let n = next;
    while (fs.existsSync(this.masterDir(`Profile ${n}`))) n++;
    const folder = `Profile ${n}`;
    const p = { id: this.idFor(name), name, avatar, ...(description && { description }), folder, projects: [project] };
    fs.mkdirSync(this.masterDir(folder), { recursive: true });
    this.save([...list, p], n + 1);
    return p;
  }
  // An id from a name, one no other profile has (except: the profile being renamed).
  idFor(name, except) {
    const list = this.all(), base = slugOf(name, 'profile');
    let id = base, n = 2;
    while (list.some((p) => p.id === id && p.id !== except)) id = `${base}-${n++}`;
    return id;
  }
  // Who it is changed (name and id, picture, description): everywhere at once.
  update(folder, fields) {
    const list = this.all(), p = list.find((x) => x.folder === folder);
    if (!p) return null;
    Object.assign(p, fields);
    if (!p.description) delete p.description;
    this.save(list);
    return p;
  }
  // Listed in another project too (Project Settings…, From another project).
  addTo(id, project) {
    const list = this.all(), p = list.find((x) => x.id === id);
    if (!p) return { error: `no profile ${id}` };
    if (!p.projects.includes(project)) p.projects.push(project);
    this.save(list);
    return p;
  }
  // Let go by a project; a profile in no project any more goes with its master (its sign-ins). { gone: true } then.
  removeFrom(id, project) {
    const list = this.all(), p = list.find((x) => x.id === id);
    if (!p) return { error: `no profile ${id}` };
    p.projects = p.projects.filter((x) => x !== project);
    if (p.projects.length) { this.save(list); return { gone: false, profile: p }; }
    this.save(list.filter((x) => x !== p));
    const dir = this.masterDir(p.folder);
    this.markDeleted(dir);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { console.warn('[profiles]', e.message); }
    return { gone: true, profile: p };
  }
}

module.exports = { ProfileStore };
