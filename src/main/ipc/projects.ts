// The windows' handles on projects (docs/tasks.md, Projects): New Project, and a project's page in Settings: its
// name, local addresses, code, agents and profiles (projects.ts).
import { BrowserWindow, dialog, shell as electronShell } from 'electron';
import path from 'path';
import { reposOf, addRepo, cloneRepo, defaultRepo, removeRepo, reposInfo, chooseGithub, askDropProfile, dropProfile, branchesOf, teamInfo, addRole, updateRole, defaultRole, removeRole, useRepoTeam, repoTeamOf, createProject, folderStateOf } from '../projects.ts';
import { nameError } from '../../shared/names.ts';
import { elsewhere } from '../partners.ts';
import { refused } from '../../shared/result.ts';
import { handle } from '../ipc.ts';
import type { Ipc } from '../ipc.ts';
import type { ProjectEntry } from '../store.ts';
import type { TaskElsewhere } from '../../shared/types.ts';
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
  // The branches a new task can work on (New Task from a Branch…), fetched first.
  handle('project:branches', (_e, { id }) => branchesOf(shell, id));
  handle('project:settings-get', async (_e, { id }) => {
    const p = store.projects().find((x) => x.id === id);
    if (!p) return { error: `no project ${id}` };
    const r = await reposInfo(shell, p);
    await lookForFavicon(p);
    sendProjects();
    return { name: p.name, folder: p.folder, team: teamInfo(shell, p), repoTeam: await repoTeamOf(p), local: p.local || [], ...r, ...profilesOf(id), ...choices() };
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
  const settingsOf = async (id: string, r: Result) => (refused(r) ? r : { ...(await reposInfo(shell, store.projects().find((x) => x.id === id)!)) });
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
  handle('project:repo-github', (_e, { id, folder, account }) => settingsOf(id, chooseGithub(shell, id, folder, account)));
  // Its former folder (no git; tasks no longer work in it), in the OS's file manager: the human moves its files.
  handle('project:show-former', (_e, { id }) => { const p = store.projects().find((x) => x.id === id); return p && electronShell.openPath(p.folder); });
  // Its team (projects.ts): a role added, its words, who plays it or its place changed, made the default (a new task
  // starts it), removed; the repository's team used or not. At once, not on Save. With the file as it is then (a role
  // moved into it makes it).
  const withFile = async (id: string, r: Awaited<ReturnType<typeof defaultRole>>) => {
    const p = store.projects().find((x) => x.id === id);
    return refused(r) || !p ? r : { ...r, repoTeam: await repoTeamOf(p) };
  };
  handle('project:role-add', async (_e, { id, ...role }) => withFile(id, await addRole(shell, id, role)));
  handle('project:role-update', async (_e, { id, role, name, about, model, os, account, place }) => withFile(id, await updateRole(shell, id, role, { role: name, about, model, os, account, place })));
  handle('project:role-default', (_e, { id, role }) => withFile(id, defaultRole(shell, id, role)));
  handle('project:role-remove', (_e, { id, role }) => withFile(id, removeRole(shell, id, role)));
  // Its tasks on the human's other computers (the board's On Your Other Computers: partners.ts), from its default
  // repository's remote; none without git or a remote, or offline.
  handle('project:elsewhere', async (_e, { id }): Promise<TaskElsewhere[]> => {
    const p = store.projects().find((x) => x.id === id), repo = p && reposOf(p)[0];
    return repo ? elsewhere(shell, p, repo).catch((): TaskElsewhere[] => []) : [];
  });
  handle('project:repo-team', (_e, { id, use }) => withFile(id, useRepoTeam(shell, id, use)));
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
