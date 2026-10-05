// Kulisa's own data in the user-data folder.
//   settings.json            the Kulisa zoom, the last project
//   projects.json            the projects: { id, name, folder, color }; a project is a folder (a repository, or one
//                            Kulisa made); its color tints the window, to tell projects apart at a glance
//   projects/<id>/           per project: profiles.json (who, sites zoomed in each, closed ones), tabs.json (open URLs
//                            per profile, closed ones too), layout.json (the window's grid), agent.json (the agent's session, to resume it)
// Browser profiles themselves live in Electron's Partitions/ next to them, one folder per partition, unique across
// projects. Nothing goes into the project's own folder: sign-ins must not end up in its git.
const fs = require('fs');
const path = require('path');

const PROJECT_FILES = ['profiles.json', 'tabs.json', 'layout.json'];
// Muted, to sit on the dark window; a new project takes the first one no project has.
const PROJECT_COLORS = ['#4a7bd0', '#3f9a7a', '#b4823a', '#9a5fc0', '#c0584f', '#3c9fb0', '#b0607f', '#7d9a3f'];

class Store {
  // defaultFolder: the project to put the data of a single-project Kulisa (before projects) into.
  constructor(dir, { defaultFolder } = {}) {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
    this.projectsFile = path.join(dir, 'projects.json');
    this.deletedFile = path.join(dir, 'deleted-partitions.json');
    this.settingsFile = path.join(dir, 'settings.json');
    this.project = null; this.projectDir = null;
    if (defaultFolder) this.migrate(defaultFolder);
    this.purgeDeleted();
  }

  // Kulisa before projects kept profiles.json, tabs.json and layout.json here: they become the first project's,
  // copied (the originals stay, and count as live for purgeDeleted).
  migrate(folder) {
    if (fs.existsSync(this.projectsFile) || !PROJECT_FILES.some((f) => fs.existsSync(path.join(this.dir, f)))) return;
    const p = this.projectFor(folder);
    for (const f of PROJECT_FILES) if (fs.existsSync(path.join(this.dir, f))) fs.copyFileSync(path.join(this.dir, f), path.join(this.dirOf(p), f));
  }

  projects() {
    const list = readJSON(this.projectsFile) || [];
    // Projects made before colors get one now, each its own.
    if (list.some((p) => !p.color)) {
      for (const p of list) if (!p.color) p.color = nextColor(list);
      writeJSON(this.projectsFile, list);
    }
    return list;
  }
  dirOf(p) { const d = path.join(this.dir, 'projects', p.id); fs.mkdirSync(d, { recursive: true }); return d; }
  // The project of a folder; a new one if no project has it.
  projectFor(folder, name = path.basename(folder) || folder) {
    const list = this.projects();
    const found = list.find((p) => samePath(p.folder, folder));
    if (found) return found;
    const base = name.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-|-$/g, '') || 'project';
    let id = base, n = 2;
    while (list.some((p) => p.id === id)) id = `${base}-${n++}`;
    const p = { id, name, folder, color: nextColor(list) };
    writeJSON(this.projectsFile, [...list, p]);
    return p;
  }
  // The project opened last, if it is still in the list.
  lastProject() { const id = this.settings().lastProject; return this.projects().find((p) => p.id === id) || null; }
  // From now on profiles(), tabs(), layout() and agent() are this project's.
  openProject(p) {
    this.project = p; this.projectDir = this.dirOf(p);
    this.saveSettings({ ...this.settings(), lastProject: p.id });
  }
  file(name) { if (!this.projectDir) throw new Error('no project open'); return path.join(this.projectDir, name); }

  // Folder of a persist: partition, or null for anything that would not land inside Partitions/.
  partitionDir(partition) {
    const name = partition.replace(/^persist:/, '');
    if (!partition.startsWith('persist:') || !name || /[\\/]|^\.\.?$/.test(name)) return null;
    return path.join(this.dir, 'Partitions', name);
  }
  // Partitions of every project's profiles (and of the files from before projects).
  livePartitions() {
    const files = [path.join(this.dir, 'profiles.json'), ...this.projects().map((p) => path.join(this.dir, 'projects', p.id, 'profiles.json'))];
    return new Set(files.flatMap((f) => (readJSON(f) || []).map(withPartition).map((p) => p.partition)));
  }
  // A partition for a new profile that no profile of any project, pending deletion or leftover folder uses.
  freePartition(id) {
    const inUse = this.livePartitions();
    const taken = (p) => inUse.has(p) || this.deleted().includes(p) || fs.existsSync(this.partitionDir(p) || '');
    let p = `persist:${id}`, n = 2;
    while (taken(p)) p = `persist:${id}-${n++}`;
    return p;
  }
  deleted() { return readJSON(this.deletedFile) || []; }
  markDeleted(partition) { writeJSON(this.deletedFile, [...new Set([...this.deleted(), partition])]); }
  // Remove folders of profiles deleted in an earlier run, before any session opens them.
  purgeDeleted() {
    const live = this.livePartitions();
    for (const p of this.deleted()) {
      const dir = !live.has(p) && this.partitionDir(p);
      if (dir) fs.rmSync(dir, { recursive: true, force: true });
    }
    fs.rmSync(this.deletedFile, { force: true });
  }
  profiles() { return (readJSON(this.file('profiles.json')) || []).map(withPartition); }
  // closed: the human closed it (app.js); it stays closed until opened again.
  saveProfiles(list) {
    writeJSON(this.file('profiles.json'), list.map(({ id, name, color, partition, siteZoom, closed }) =>
      ({ id, name, color, partition, zoom: siteZoom, ...(closed && { closed }) })));
  }
  // Kulisa's own settings: { uiZoom, lastProject }.
  settings() { return readJSON(this.settingsFile) || {}; }
  saveSettings(s) { writeJSON(this.settingsFile, s); }
  tabs() { return readJSON(this.file('tabs.json')) || {}; }
  saveTabs(byProfile) { writeJSON(this.file('tabs.json'), byProfile); }
  // The window's grid as dockview serializes it (renderer.js).
  layout() { return readJSON(this.file('layout.json')); }
  saveLayout(layout) { writeJSON(this.file('layout.json'), layout); }
  // The project's agent session: { sessionId, transcript } as the agent's hooks report it (agent-hooks.js).
  agent() { return readJSON(this.file('agent.json')) || {}; }
  saveAgent(a) { writeJSON(this.file('agent.json'), a); }
}

const nextColor = (list) => PROJECT_COLORS.find((c) => !list.some((p) => p.color === c)) || PROJECT_COLORS[list.length % PROJECT_COLORS.length];
// Profiles saved before partitions were stored use persist:<id>.
const withPartition = (p) => ({ partition: `persist:${p.id}`, ...p });
const samePath = (a, b) => (process.platform === 'linux' ? path.resolve(a) === path.resolve(b) : path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase());
function readJSON(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } }
function writeJSON(f, v) { try { fs.writeFileSync(f, JSON.stringify(v, null, 2)); } catch (e) { console.error('[store]', e.message); } }

module.exports = { Store };
