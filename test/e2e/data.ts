// The test's folders and what Kulisa saved in them, read as the files are (store.ts, profile-store.ts): ids are random,
// so a test names a project by the name of a folder of it ('project', 'other'), a task by its place among its project's
// tasks as made, a profile by its name.
import fs from 'fs';
import path from 'path';
import { expect } from '@playwright/test';

export type Files = ReturnType<typeof data>;
export function data(root: string) {
  const userData = path.join(root, 'data'), project = path.join(root, 'project');
  // A JSON file Kulisa saved, by its path in the data folder (or a whole path).
  const json = (...f: string[]) => JSON.parse(fs.readFileSync(path.isAbsolute(f[0]) ? path.join(...f) : path.join(userData, ...f), 'utf8'));
  const projectsSaved = (): { id: string; folders: string[] }[] => json(path.join(userData, 'projects.json')).list;
  const folderName = (p: { folders: string[] }) => path.basename(p.folders[0]).toLowerCase();
  // A project's id by the name of a folder of it.
  const pid = (folder: string) => {
    const found = projectsSaved().filter((p) => p.folders.some((r) => path.basename(r).toLowerCase() === folder));
    expect(found, `one project in a folder named ${folder}`).toHaveLength(1);
    return found[0].id;
  };
  // A project's tasks as tasks.json keeps them.
  const tasksOf = (id: string): { id: string; name: string; named?: boolean; closedAt?: number }[] => json('projects', id, 'tasks.json').list;
  // A task's id by its place (from 1) among its project's tasks, as made; its key (`<project>/<task>`, as the core
  // knows it).
  const tid = (folder: string, i: number) => {
    const t = tasksOf(pid(folder))[i - 1];
    expect(t, `a task ${i} of ${folder}`).toBeTruthy();
    return t.id;
  };
  const tkey = (folder: string, i: number) => `${pid(folder)}/${tid(folder, i)}`;
  // A key or an id named back by its project's folder (and its task's place), to compare.
  const named = (key: string) => key.replace(/^([^/ ]+)(?:\/([^/ ]+))?/, (all, id: string, task?: string) => {
    const p = projectsSaved().find((x) => x.id === id);
    if (!p) return all;
    if (!task) return folderName(p);
    const at = tasksOf(id).findIndex((e) => e.id === task);
    return `${folderName(p)}/${at < 0 ? task : at + 1}`;
  });
  // A file of the test project's own data, of its first task (or of its task by place, or by id).
  const pfile = (f: string, task: number | string = 1) => path.join(userData, 'projects', pid('project'), typeof task === 'string' ? task : tid('project', task), f);
  // A profile's id by its name (any case, as the agent names it): by it the window and the core know it.
  const idOf = (name: string): string => {
    const found = json(path.join(userData, 'profiles.json')).list.filter((p: { name: string }) => p.name.toLowerCase() === name.toLowerCase());
    expect(found, `one profile named ${name}`).toHaveLength(1);
    return found[0].id;
  };
  // A profile by its name, or its id as it is.
  const idFor = (profile: string) => (json('profiles.json').list.some((p: { id: string }) => p.id === profile) ? profile : idOf(profile));
  const savedFile = (profile: string, task: number) => json(pfile(path.join(idFor(profile), 'Kulisa Tabs.json'), task));
  // The windows as settings.json keeps them for the next start: each one's tabs and the one shown, by their projects'
  // folders (named).
  const savedWindows = () => json(path.join(userData, 'settings.json')).windows.map(({ tabs, shown }: { tabs: string[]; shown: string | null }) => ({ tabs: tabs.map(named), shown: shown && named(shown) }));
  type GridNode = { type: string; size: number; data: { views: string[] } & GridNode[] };
  return {
    root, userData, project, json, projectsSaved, tasksOf, pid, tid, tkey, named, pfile, idOf, savedWindows,
    // Kulisa's log as it is now.
    log: () => fs.readFileSync(path.join(userData, 'logs', 'kulisa.log'), 'utf8'),
    // The tabs saved for a profile (in its folder; by its name or id), and the place of the one saved in front.
    savedTabs: (profile: string, task = 1): string[] => savedFile(profile, task).urls,
    savedActive: (profile: string, task = 1): number => savedFile(profile, task).active,
    // The id of a profile's panel in the grid.
    panel: (name: string) => `profile:${idOf(name)}`,
    // The Resources panel's height as the task's grid is saved (dockview keeps a panel's size along its column).
    savedResourcesHeight: () => {
      const leaf = (n: GridNode): GridNode | undefined => (n.type === 'leaf' ? (n.data.views.includes('resources') ? n : undefined) : n.data.map(leaf).find(Boolean));
      return leaf(json(pfile('task.json')).workspace.developmentLayout.grid.root)?.size;
    },
  };
}
