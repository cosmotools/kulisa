// Kulisa's own data in the user-data folder, laid out as Chrome lays out its own (Local State, then a folder per
// profile), so what is known about Chrome's storage applies:
//   settings.json            the Kulisa zoom, the theme, where the projects' bar is; the windows: the projects open
//                            in each (its tabs, in order), the one shown, where it was on screen
//   projects.json            the projects: { id, name, folder, color }; a project is a folder (a repository, or one
//                            Kulisa made); its color tints the window, to tell projects apart at a glance
//   projects/<id>/
//     workspaces.json        the project's workspaces: { next, current, list: [{ n, name, branch, worktree, folder,
//                            base, offset }] }; main is n 1, the project's own folder (ROADMAP, "Workspaces")
//     <n>/                   a workspace (WorkspaceStore): profiles.json (its profiles in order: folder, name, avatar,
//                            description, sites' zoom, closed; as Chrome's Local State), layout.json (the window's
//                            grid), agent.json (the agent's session, to resume it), and a folder per profile:
//       Profile <k>/         a Chromium profile (session.fromPath) with Kulisa's own files in it: Kulisa Tabs.json
//                            (its tabs' URLs), Kulisa Session Cookies.bin (session-cookies.js)
//   deleted-folders.json     folders of deleted profiles and workspaces, removed at the next start (a session keeps
//                            its files open while Kulisa runs)
// Nothing goes into the project's own folder: sign-ins must not end up in its git.
const fs = require('fs');
const path = require('path');
const { slugOf } = require('./names');

// Muted, to sit on the dark window; a new project takes the first one no project has.
const PROJECT_COLORS = ['#4a7bd0', '#3f9a7a', '#b4823a', '#9a5fc0', '#c0584f', '#3c9fb0', '#b0607f', '#7d9a3f'];
const TABS_FILE = 'Kulisa Tabs.json';
const SESSION_COOKIES_FILE = 'Kulisa Session Cookies.bin';
// Chromium's caches inside a profile: rebuilt by themselves, so a copy of a profile goes without them.
const CACHES = new Set(['Cache', 'Code Cache', 'GPUCache', 'DawnGraphiteCache', 'DawnWebGPUCache', 'GrShaderCache', 'ShaderCache']);

class Store {
  constructor(dir) {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
    this.projectsFile = path.join(dir, 'projects.json');
    this.deletedFile = path.join(dir, 'deleted-folders.json');
    this.settingsFile = path.join(dir, 'settings.json');
    this.purgeDeleted();
  }

  projects() { return readJSON(this.projectsFile) || []; }
  dirOf(p) { const d = path.join(this.dir, 'projects', p.id); fs.mkdirSync(d, { recursive: true }); return d; }
  // The project of a folder; a new one if no project has it.
  projectFor(folder, name = path.basename(folder) || folder) {
    const list = this.projects();
    const found = list.find((p) => samePath(p.folder, folder));
    if (found) return found;
    const base = slugOf(name, 'project');
    let id = base, n = 2;
    while (list.some((p) => p.id === id)) id = `${base}-${n++}`;
    const p = { id, name, folder, color: nextColor(list) };
    writeJSON(this.projectsFile, [...list, p]);
    return p;
  }
  // The windows open last: [{ tabs: [project], shown: project or null, bounds, maximized }], each with its project
  // tabs in order; none at first start. Before there were several windows, one window's were openProjects and
  // lastProject.
  windows() {
    const s = this.settings(), list = this.projects();
    const byId = (id) => list.find((p) => p.id === id) || null;
    const saved = s.windows || (s.openProjects || s.lastProject ? [{ tabs: s.openProjects || [s.lastProject], shown: s.lastProject }] : []);
    return saved.map((w) => ({ ...w, tabs: (w.tabs || []).map(byId).filter(Boolean), shown: byId(w.shown) }));
  }
  // windows: [{ tabs: [id], shown: id or null, bounds, maximized }].
  saveWindows(windows) {
    const { openProjects, lastProject, ...s } = this.settings();
    this.saveSettings({ ...s, windows });
  }

  // A project's workspaces (workspaces.json) and each one's data.
  workspacesOf(p) {
    return readJSON(path.join(this.dir, 'projects', p.id, 'workspaces.json')) || { next: 2, current: 1, list: [{ n: 1, name: 'main' }] };
  }
  saveWorkspacesOf(p, w) { writeJSON(path.join(this.dirOf(p), 'workspaces.json'), w); }
  workspaceOf(p, n) { return new WorkspaceStore(path.join(this.dir, 'projects', p.id, String(n)), this); }
  // A project gone from Kulisa: from the list, and its data (profiles with their sign-ins, workspaces); never its
  // folder. Its profiles' sessions may still be open: what cannot go now goes at the next start.
  removeProject(p) {
    writeJSON(this.projectsFile, this.projects().filter((x) => x.id !== p.id));
    this.saveWindows(this.windows().map((w) => ({ ...w, tabs: w.tabs.map((x) => x.id).filter((id) => id !== p.id),
      shown: w.shown && w.shown.id !== p.id ? w.shown.id : null })));
    const dir = path.join(this.dir, 'projects', p.id);
    this.markDeleted(dir);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { console.warn('[store]', e.message); }
  }

  // Folders to remove at the next start, before any session opens them; only inside the data folder.
  deleted() { return readJSON(this.deletedFile) || []; }
  markDeleted(folder) { writeJSON(this.deletedFile, [...new Set([...this.deleted(), folder])]); }
  purgeDeleted() {
    for (const d of this.deleted()) {
      const rel = path.relative(this.dir, d);
      if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) fs.rmSync(d, { recursive: true, force: true });
    }
    fs.rmSync(this.deletedFile, { force: true });
  }
  // Kulisa's own settings: { uiZoom, theme, bar, windows }.
  settings() { return readJSON(this.settingsFile) || {}; }
  saveSettings(s) { writeJSON(this.settingsFile, s); }
}

// One workspace's data: its profiles (each a folder), grid and agent session.
class WorkspaceStore {
  constructor(dir, store) { this.dir = dir; this.store = store; fs.mkdirSync(dir, { recursive: true }); }
  file(name) { return path.join(this.dir, name); }
  profileDir(folder) { return path.join(this.dir, folder); }
  // list: { folder, id, name, avatar, description, zoom, closed } (project-profiles.js); closed until opened again.
  profiles() { return readJSON(this.file('profiles.json')) || []; }
  saveProfiles(list) {
    writeJSON(this.file('profiles.json'), list.map(({ folder, id, name, avatar, description, zoom, closed }) =>
      ({ folder, id, name, avatar, ...(description && { description }), zoom, ...(closed && { closed }) })));
  }
  // A profile's tabs (their URLs), in its own folder.
  tabs(folder) { return readJSON(path.join(this.profileDir(folder), TABS_FILE)) || []; }
  saveTabs(folder, urls) {
    const json = JSON.stringify(urls);
    if ((this.saved ??= new Map()).get(folder) === json) return; // written after every change of the window's state
    this.saved.set(folder, json);
    fs.mkdirSync(this.profileDir(folder), { recursive: true });
    writeJSON(path.join(this.profileDir(folder), TABS_FILE), urls);
  }
  // A folder for a new profile, as Chrome numbers them: one no profile has, never one still on disk (a deleted
  // profile's folder stays until the next start, its session may still be open).
  freeFolder(taken = []) {
    const used = [...taken, ...this.profiles().map((p) => p.folder), ...(fs.existsSync(this.dir) ? fs.readdirSync(this.dir) : [])];
    const n = Math.max(0, ...used.map((f) => Number(/^Profile (\d+)$/.exec(f)?.[1] || 0))) + 1;
    return `Profile ${n}`;
  }
  markDeleted(folder) { this.store.markDeleted(this.profileDir(folder)); }
  // The window's grid as dockview serializes it (renderer.js).
  layout() { return readJSON(this.file('layout.json')); }
  saveLayout(layout) { writeJSON(this.file('layout.json'), layout); }
  // The workspace's agent session: { sessionId, transcript } as the agent's hooks report it (agent-hooks.js).
  agent() { return readJSON(this.file('agent.json')) || {}; }
  saveAgent(a) { writeJSON(this.file('agent.json'), a); }
}

// Copy a profile's folder without its caches. An open profile can be copied once its data is flushed
// (workspaces.js); a file that cannot be read (locked on Windows) is left out and logged.
async function copyProfile(from, to) {
  const walk = async (src, dst, top) => {
    await fs.promises.mkdir(dst, { recursive: true });
    for (const e of await fs.promises.readdir(src, { withFileTypes: true })) {
      if (top && CACHES.has(e.name)) continue;
      const s = path.join(src, e.name), d = path.join(dst, e.name);
      try {
        if (e.isDirectory()) await walk(s, d, false);
        else if (e.isFile()) await fs.promises.copyFile(s, d);
      } catch (err) { console.error('[store] not copied:', s, err.code || err.message); }
    }
  };
  await walk(from, to, true);
}

const nextColor = (list) => PROJECT_COLORS.find((c) => !list.some((p) => p.color === c)) || PROJECT_COLORS[list.length % PROJECT_COLORS.length];
const samePath = (a, b) => (process.platform === 'linux' ? path.resolve(a) === path.resolve(b) : path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase());
function readJSON(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } }
function writeJSON(f, v) { try { writeFileAtomic(f, JSON.stringify(v, null, 2)); } catch (e) { console.error('[store]', e.message); } }
// Written whole or not at all: to a file next to it, then renamed over it. Kulisa may be killed or the computer lose
// power while it writes (the tabs and session cookies are saved every few seconds); a half-written profiles.json
// would lose the list of the profiles, a half-written session cookies file the sign-ins. The data reaches the disk
// (fsync) before the rename: otherwise after a power loss the rename may be there and the data not (an empty file).
// Not the write-file-atomic package: it brings signal-exit, which hooks SIGINT and SIGTERM, and the app handles them.
function writeFileAtomic(file, data, options) {
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    const fd = fs.openSync(tmp, 'w', options?.mode);
    try { fs.writeFileSync(fd, data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(tmp, file);
  } catch (e) { fs.rmSync(tmp, { force: true }); throw e; }
}

module.exports = { Store, WorkspaceStore, copyProfile, writeFileAtomic, SESSION_COOKIES_FILE };
