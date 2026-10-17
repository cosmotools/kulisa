// The windows' handles on projects (docs/tasks.md, Projects): New Project, and a project's page in Settings: its
// name, local addresses, code, agents and profiles (projects.ts).
import { BrowserWindow, dialog, shell as electronShell } from 'electron';
import path from 'path';
import { addRepo, cloneRepo, defaultRepo, removeRepo, reposInfo, askDropProfile, dropProfile, agentsInfo, addAgent, defaultAgent, removeAgent, createProject, folderStateOf } from '../projects.ts';
import { nameError } from '../../shared/names.ts';
import { refused } from '../../shared/result.ts';
import { handle } from '../ipc.ts';
import type { Ipc } from '../ipc.ts';
import type { ProjectEntry } from '../store.ts';
import type { Result } from '../../shared/result.ts';

export function registerProjects(ipc: Ipc, { lookForFavicon }: { lookForFavicon: (p: ProjectEntry) => Promise<void> }) {
  const { shell, at, asker, serial } = ipc;
  const store = shell.store;
  const sendProjects = () => shell.sendProjects();
  // New Project (projects.ts, createProject); the window then opens its first task (project:open).
  // agents: every account, the agents' own first; clis: the agents a new account can be made of (New Account…).
  const choices = () => {
    const all = shell.accounts.all().filter((a) => !a.agent.custom);
    return { agents: all.filter((a) => a.choosable).map(({ id, name }) => ({ id, name })),
      clis: all.filter((a) => a.own && a.agent.config?.login).map(({ id, name }) => ({ id, name })) };
  };
  handle('project:new-defaults', () => ({ location: shell.projectsHome, sep: path.sep, ...choices() }));
  // Browse…: where a new or cloned project's folder goes, or (existing) the folder that is the project.
  handle('project:pick-location', async (e, { location, existing }) => {
    const r = await dialog.showOpenDialog(at(e)!.win, { title: existing ? "The project's folder" : 'Where to create the project', defaultPath: location,
      properties: existing ? ['openDirectory'] : ['openDirectory', 'createDirectory'] });
    return r.canceled ? null : r.filePaths[0] || null;
  });
  handle('project:folder-state', (_e, args) => folderStateOf(shell, args));
  handle('project:new', async (_e, spec) => {
    const r = await createProject(shell, spec);
    if (!refused(r)) sendProjects(); // the board lists it
    return r;
  });
  // A project's configuration in the projects' manager (ProjectEditor.vue): its name, agents,
  // repositories, profiles and local addresses; its folder is shown, not changed (its tasks' copies are made from it).
  // Open or not.
  handle('project:settings-get', async (_e, { id }) => {
    const p = store.projects().find((x) => x.id === id);
    if (!p) return { error: `no project ${id}` };
    const r = await reposInfo(p);
    await lookForFavicon(p);
    sendProjects();
    return { name: p.name, folder: p.folder, projectAgents: agentsInfo(shell, p), local: p.local || [], ...r, ...profilesOf(id), ...choices() };
  });
  // Its profiles (profile-store.ts): those it has, and those of other projects it can take. A new one comes closed in
  // its tasks (opened in a task, a copy of its master is made there); one let go asks first (projects.ts).
  const profilesOf = (id: string) => {
    const names = (ids: string[]) => ids.filter((x) => x !== id).map((x) => store.projects().find((p) => p.id === x)?.name || x);
    const view = (g: import('../profile-store.ts').StoredProfile) => ({ id: g.id, name: g.name, avatar: g.avatar, description: g.description || '', also: names(g.projects) });
    const all = shell.profileStore.all();
    return { profiles: all.filter((g) => g.projects.includes(id)).map(view), others: all.filter((g) => !g.projects.includes(id)).map(view) };
  };
  handle('project:profile-new', (_e, { id, name }) => {
    const g = shell.profileStore.create(id, { name: name ?? '' });
    if (refused(g)) return g;
    shell.profilesChanged();
    return profilesOf(id);
  });
  handle('project:profile-add', (_e, { id, profile }) => {
    const r = shell.profileStore.addTo(profile, id);
    if (refused(r)) return r;
    shell.profilesChanged();
    return profilesOf(id);
  });
  // The project open or not (projects.ts, dropProfile); asked in the manager's window.
  handle('project:profile-remove', (e, { id, profile }) => serial(async () => {
    const entry = store.projects().find((x) => x.id === id), g = shell.profileStore.get(profile);
    if (!entry || !g) return { error: entry ? `no profile ${profile}` : `no project ${id}` };
    if (!await askDropProfile(shell, entry, g, 'human', asker(e))) return { error: 'the human said no' };
    await dropProfile(shell, entry, g.folder);
    return profilesOf(id);
  }));
  // Its repositories or folders (projects.ts): one picked in the OS's dialog (or given: the tests), cloned from a URL,
  // made the default, removed. Each answers with the project's settings as they are then.
  const settingsOf = async (id: string, r: Result) => (refused(r) ? r : { ...(await reposInfo(store.projects().find((x) => x.id === id)!)) });
  handle('project:repo-add', async (e, { id, folder }) => {
    if (!folder) {
      const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender)!, { title: 'Add a repository or folder to the project', properties: ['openDirectory'] });
      if (r.canceled || !r.filePaths[0]) return {};
      folder = r.filePaths[0];
    }
    return serial(async () => settingsOf(id, await addRepo(shell, id, folder)));
  });
  handle('project:repo-clone', (_e, { id, url }) => serial(async () => settingsOf(id, await cloneRepo(shell, id, url))));
  handle('project:repo-default', (_e, { id, folder }) => serial(async () => settingsOf(id, await defaultRepo(shell, id, folder))));
  handle('project:repo-remove', (_e, { id, folder }) => serial(async () => settingsOf(id, await removeRepo(shell, id, folder))));
  // Its former folder (no git; tasks no longer work in it), in the OS's file manager: the human moves its files.
  handle('project:show-former', (_e, { id }) => { const p = store.projects().find((x) => x.id === id); return p && electronShell.openPath(p.folder); });
  // Its agents (projects.ts): one added, made the default (+ runs it), removed. At once, not on Save.
  handle('project:agent-add', (_e, { id, agent }) => addAgent(shell, id, agent));
  handle('project:agent-default', (_e, { id, agent }) => defaultAgent(shell, id, agent));
  handle('project:agent-remove', (_e, { id, agent }) => removeAgent(shell, id, agent));
  // Its name and local addresses.
  handle('project:settings', (_e, { id, name, local = store.projects().find((p) => p.id === id)?.local }) => {
    name = name?.trim();
    // Its own local addresses (local.ts): hosts, each with its subdomains (a tunnel, its dev domains).
    local = [...new Set((local || []).map((h) => String(h).trim().toLowerCase().replace(/^\*\./, '')).filter(Boolean))];
    const bad = nameError(name) || local.find((h) => !/^[a-z0-9.-]+$/.test(h) || !h.includes('.')) && `not a host name: ${local.find((h) => !/^[a-z0-9.-]+$/.test(h) || !h.includes('.'))}`;
    if (bad) return { error: bad };
    const entry = store.updateProject(id, { name: name!, local: local.length ? local : null });
    if (!entry) return { error: `no project ${id}` };
    lookChanged(entry);
    return { id };
  });
  // A project's look changed: its tasks' tabs and the windows' titles, the bars.
  function lookChanged(entry: ProjectEntry) {
    const open = shell.open.get(entry.id);
    if (open) {
      open.update(entry);
      for (const w of shell.windows) if (w.current?.project === open) w.win.setTitle(`${w.current.name} · ${entry.name} — Kulisa`);
    }
    sendProjects();
  }
  // Kulisa's data of an open project (its profiles, tasks), in the OS's file manager: for the human who wants to
  // know where it is or what takes the disk. Opened, not changed.
  handle('project:show-data', (_e, { id }) => {
    const p = shell.open.get(id);
    return p && electronShell.openPath(store.dirOf(p.entry));
  });
}
