// The data folder (store.ts) and a task's profiles in order (project-profiles.ts).
// Plain Node (npm run test:unit), no Electron: logic that needs no window, in a temporary folder of its own.
import { test, after } from 'node:test';
import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Store, PROJECT_COLORS } from '../../src/main/store.ts';
import { ProfileStore } from '../../src/main/profile-store.ts';
import { ProjectProfiles } from '../../src/main/project-profiles.ts';
import { AVATARS, nextAvatar } from '../../src/shared/avatars.ts';
import type { StoredProfile } from '../../src/main/profile-store.ts';
import type { Profile, ProfileConfig } from '../../src/main/profiles.ts';
import type { SavedTabs, TaskProfile, TaskStore } from '../../src/main/store.ts';

// What the tests make for a profile instead of a Profile (no Electron here): its settings and the tabs it opened.
type Fake = Profile & { saved: SavedTabs };

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kulisa-unit-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));

test('projects: at first start none is opened; each gets its own color', async () => {
  const store = new Store(path.join(root, 'fresh-data'));
  assert.deepEqual(store.windows(), []);
  const shop = store.projectFor('/work/shop'), blog = store.projectFor('/work/blog');
  assert.notEqual(shop.color, blog.color);
  // The project a folder is: its own, or one of its repositories (New Project… refuses a folder a project has).
  store.updateProject(shop.id, { repos: ['/work/shop-api'] });
  assert.deepEqual([store.projectOf('/work/shop/')?.id, store.projectOf('/work/shop-api')?.id, store.projectOf('/work/other')], ['shop', 'shop', null]);
  store.updateProject(shop.id, { repos: null });
  const bounds = { x: 10, y: 20, width: 900, height: 700 };
  store.saveWindows([{ tabs: ['blog/1', 'shop/2'], shown: 'shop/2', bounds }, { tabs: ['gone/1'], shown: 'gone/1' }]);
  const later = new Store(path.join(root, 'fresh-data'));
  const [w, gone] = later.windows();
  assert.deepEqual(w.tabs, ['blog/1', 'shop/2'], 'later: the tabs open last, tasks by key');
  assert.deepEqual([w.shown, w.bounds], ['shop/2', bounds], 'the one shown, where the window was');
  assert.deepEqual([gone.tabs, gone.shown], [['gone/1'], 'gone/1'], 'as saved: a task no longer there is left out when the windows open (app.ts)');
  // A project deleted: its tasks out of every window.
  later.removeProject(blog);
  assert.deepEqual(later.windows()[0].tabs, ['shop/2']);
  later.saveSettings({ ...later.settings(), uiZoom: 1 });
  later.saveWindows([]);
  assert.deepEqual(later.settings(), { uiZoom: 1, windows: [] }, 'the other settings kept');
});
test('projects: made with the next free color and a first agent; settings change them, never the id or folder', async () => {
  const store = new Store(path.join(root, 'look-data'));
  const p = store.projectFor('/work/app', 'app', { agent: 'codex' });
  assert.deepEqual(p, { id: 'app', name: 'app', folder: '/work/app', color: PROJECT_COLORS[0], agents: ['codex'] });
  assert.equal(store.nextColor(), PROJECT_COLORS[1], 'the next new one: the first color no project has');
  const changed = store.updateProject('app', { name: 'App-2', agents: null, id: 'app', folder: '/work/app' });
  assert.deepEqual(changed, { id: 'app', name: 'App-2', folder: '/work/app', color: PROJECT_COLORS[0] });
  assert.deepEqual(new Store(path.join(root, 'look-data')).projects(), [changed]);
  assert.equal(store.updateProject('gone', { name: 'x' }), null);
});

test('store: a write cut short leaves the file as it was', async () => {
  const store = new Store(path.join(root, 'fresh-data'));
  const task = store.taskOf(store.projectFor('/work/shop'), 1);
  task.saveProfiles([{ folder: 'Profile 1', id: 'sam' }]);
  const writeFileSync = fs.writeFileSync;
  fs.writeFileSync = ((f: number, data: string) => { writeFileSync(f, String(data).slice(0, 10)); throw new Error('the computer went off'); }) as typeof fs.writeFileSync;
  try { task.saveProfiles([{ folder: 'Profile 2', id: 'ann' }]); } finally { fs.writeFileSync = writeFileSync; }
  assert.deepEqual(task.profiles().map((p) => p.id), ['sam']);
  assert.deepEqual(fs.readdirSync(task.dir).filter((f) => f.endsWith('.tmp')), [], 'no half-written file left');
});
test("store: a profile's tabs come back with the one in front; the list saved before 2026-10-19 is not read", () => {
  const store = new Store(path.join(root, 'tabs-data'));
  const task = store.taskOf(store.projectFor('/work/shop'), 1);
  assert.deepEqual(task.tabs('Profile 1'), { urls: [], active: 0 }, 'none saved');
  task.saveTabs('Profile 1', { urls: ['https://a/', 'https://b/'], active: 1 });
  assert.deepEqual(task.tabs('Profile 1'), { urls: ['https://a/', 'https://b/'], active: 1 });
  fs.writeFileSync(path.join(task.profileDir('Profile 1'), 'Kulisa Tabs.json'), JSON.stringify(['https://a/']));
  assert.deepEqual(task.tabs('Profile 1'), { urls: [], active: 0 }, 'one data format only (CLAUDE.md)');
});

// A profile store over a data folder with these projects (store.ts: the projects list their profiles).
const profileStore = (dir: string, ...projects: string[]) => {
  const store = new Store(dir);
  for (const p of projects) store.projectFor(`/work/${p}`, p);
  return new ProfileStore(store);
};

test('profiles: one store, a profile in several projects or none, each project listing its own in order; it lives until deleted, its master with it', () => {
  const all = profileStore(path.join(root, 'profiles-data'), 'shop', 'blog');
  const ann = all.create('shop', { name: 'Ann', avatar: 'fox', description: 'seller' });
  assert.deepEqual(ann, { id: 'ann', name: 'Ann', avatar: 'fox', description: 'seller', folder: 'Profile 1' });
  assert.deepEqual(all.store.projects().find((p) => p.id === 'shop').profiles, ['Profile 1'], 'the project lists it, by its folder');
  assert.ok(fs.existsSync(all.masterDir('Profile 1')), 'its master, empty');
  assert.equal((all.create('blog', { name: 'Ann', avatar: 'owl' }) as StoredProfile).id, 'ann-2', 'ids unique across projects');
  all.addTo('ann', 'blog');
  assert.deepEqual(all.projectsOf(all.get('ann')), ['shop', 'blog']);
  assert.deepEqual(all.of('blog').map((p) => p.id), ['ann-2', 'ann'], "in the project's order");
  assert.match((all.addTo('ann', 'nowhere') as { error: string }).error, /no project/);
  assert.equal(all.idFor('Ann', 'ann'), 'ann', 'its own id is free for it');
  assert.deepEqual(all.update('Profile 1', { id: 'anna', name: 'Anna', description: '' }), { id: 'anna', name: 'Anna', avatar: 'fox', folder: 'Profile 1' });
  assert.deepEqual(all.of('shop').map((p) => p.id), ['anna'], 'renamed, still listed: by its folder, fixed');
  all.removeFrom('anna', 'shop');
  all.removeFrom('anna', 'blog');
  assert.deepEqual(all.projectsOf(all.get('anna')), [], 'in no project');
  assert.ok(fs.existsSync(all.masterDir('Profile 1')) && all.get('anna'), 'kept with its sign-ins: let go is not deleted');
  // Who it is, changed and checked in the store, for every handle (a task, Settings, the agent).
  assert.deepEqual(all.rename('anna', 'Ann'), { id: 'ann' });
  assert.match(all.rename('ann', '').error, /./);
  assert.match(all.describe('ann', 'x'.repeat(501)).error, /at most 500/);
  assert.match(all.setAvatar('ann', 'dragon').error, /no picture/);
  assert.deepEqual(all.setLogin('ann', 'ann@shop.test', 'enc'), { id: 'ann' });
  assert.deepEqual(all.get('ann').login, { user: 'ann@shop.test', secret: 'enc' });
  all.setLogin('ann', 'ann@shop.test', undefined);
  assert.equal(all.get('ann').login.secret, 'enc', 'the password kept when only the login is set again');
  all.setLogin('ann', '', undefined);
  assert.equal(all.get('ann').login, undefined, 'an empty login takes the pair away');
  assert.deepEqual(all.projectsOf(all.create(null, { name: 'Free', avatar: 'cat' }) as StoredProfile), [], 'made in no project (Settings → Profiles)');
  // Deleted: gone with its master, and from the projects listing it.
  all.addTo('ann', 'blog');
  assert.equal((all.delete('ann') as { profile: StoredProfile }).profile.folder, 'Profile 1');
  assert.ok(!all.get('ann') && !fs.existsSync(all.masterDir('Profile 1')) && all.store.deleted().includes(all.masterDir('Profile 1')), 'its master gone');
  assert.deepEqual(all.store.projects().find((p) => p.id === 'blog').profiles, ['Profile 2'], 'no project lists it');
  assert.equal((all.create('shop', { name: 'Bo', avatar: 'cat' }) as StoredProfile).folder, 'Profile 4', 'never a folder number used before');
  // Checked where it is made, whoever makes it; its picture the next free one of its project's unless given.
  assert.match((all.create('shop', { name: 'Ann admin' }) as { error: string }).error, /only/);
  assert.match((all.create('shop', { name: 'Cy', description: 'x'.repeat(501) }) as { error: string }).error, /at most 500/);
  assert.notEqual((all.create('shop', { name: ' Cy ' }) as StoredProfile).avatar, 'cat', "not the project's taken one (Bo's)");
  assert.equal(all.get('cy').name, 'Cy', 'trimmed');
});

test('project profiles: a task has its own copy of each, made at its first open; who a profile is, the same in every task', async () => {
  const all = profileStore(path.join(root, 'pp-data'), 'shop');
  all.create('shop', { name: 'Ann', avatar: 'fox' });
  all.create('shop', { name: 'Bob', avatar: 'owl' });
  const task = (n: number) => {
    const dir = path.join(root, 'pp-data', 'task', String(n));
    let saved: TaskProfile[] = null;
    const copied: string[] = [];
    const store = { profiles: () => saved, saveProfiles: (l: TaskProfile[]) => { saved = l; }, tabs: (f: string) => ({ urls: f === 'Profile 2' ? ['https://b/'] : [], active: 0 }), saveTabs() {},
      profileDir: (f: string) => path.join(dir, f), markDeleted() {} } as unknown as TaskStore;
    const list = new ProjectProfiles(store, all, 'shop', { make: (cfg: ProfileConfig) => ({ ...cfg, siteZoom: cfg.zoom }) as unknown as Profile,
      copy: async (e) => { copied.push(e.cfg.folder); fs.mkdirSync(e.cfg.dir, { recursive: true }); e.tabs = store.tabs(e.cfg.folder); },
      start: async (p, tabs) => { (p as Fake).saved = tabs; }, unload: async () => {}, tabsOf: (p) => (p as Fake).saved, renamed() {}, remove: async () => {}, changed() {}, everywhere() {} });
    return { list, copied, saved: () => saved };
  };
  // A task with nothing saved opens none (a new task has them all closed: projects.ts, createTask); opened, each
  // is a copy of its master made then.
  const a = task(1);
  a.list.load(); await a.list.started;
  assert.deepEqual([...a.list.profiles.keys()], []);
  assert.deepEqual([...a.list.closed.keys()], ['ann', 'bob']);
  assert.deepEqual(a.copied, [], 'nothing copied before it is opened');
  await a.list.open('ann'); await a.list.open('bob');
  assert.deepEqual(a.copied, ['Profile 1', 'Profile 2']);
  assert.deepEqual((a.list.profiles.get('bob') as Fake).saved.urls, ['https://b/'], "the master's tabs");
  await a.list.close('ann');
  await a.list.open('ann');
  assert.equal(a.copied.length, 2, 'opened again: its copy is there');
  assert.deepEqual(a.saved().map((p) => [p.id, !!p.closed]), [['ann', false], ['bob', false]]);
  // A task with its own state: closed ones stay closed, and copied only when opened.
  const b = task(2);
  b.list.store.saveProfiles([{ folder: 'Profile 1', id: 'ann' }, { folder: 'Profile 2', id: 'bob', closed: true }]);
  b.list.load(); await b.list.started; // its copy made, then opened
  assert.deepEqual([[...b.list.profiles.keys()], [...b.list.closed.keys()], b.copied], [['ann'], ['bob'], ['Profile 1']]);
  // Made in one task: closed in the other once it reads the store again; renamed, described, its picture: everywhere.
  assert.equal((await a.list.create('Cid', 'admin') as { id: string }).id, 'cid');
  assert.equal(a.list.profiles.get('cid').avatar, 'frog', 'the next picture free');
  assert.equal((a.list.rename('ann', 'Anna') as { id: string }).id, 'anna');
  a.list.describe('bob', 'buyer');
  b.list.refresh();
  assert.deepEqual([[...b.list.profiles.keys()], [...b.list.closed.keys()]], [['anna'], ['bob', 'cid']]);
  assert.equal(b.list.closed.get('bob').cfg.description, 'buyer');
  assert.deepEqual(all.of('shop').map((p) => p.id), ['anna', 'bob', 'cid']);
  // Let go: gone from the task.
  await b.list.drop('Profile 1');
  assert.deepEqual([...b.list.profiles.keys(), ...b.list.closed.keys()], ['bob', 'cid']);
  assert.match(a.list.setAvatar('bob', 'dragon').error, /no picture/);
  assert.match(a.list.describe('bob', 'x'.repeat(501)).error, /at most 500/);
  // Tabs saved while a profile is still opening (its session cookies restored before its tabs): the addresses it is
  // opening, not none. Kulisa quit right then lost every profile's tabs (2026-10-08).
  const one = profileStore(path.join(root, 'pp-slow'), 'p');
  one.create('p', { name: 'Dan', avatar: 'fox' });
  const tabsSaved: Record<string, SavedTabs> = {};
  let opened: () => void;
  const slow = new ProjectProfiles({ profiles: () => [{ folder: 'Profile 1', id: 'dan' }], saveProfiles() {}, tabs: () => ({ urls: ['https://d/'], active: 0 }), saveTabs: (f: string, tabs: SavedTabs) => { tabsSaved[f] = tabs; },
    profileDir: () => root, markDeleted() {} } as unknown as TaskStore, one, 'p', {
    make: (cfg: ProfileConfig) => ({ ...cfg }) as unknown as Profile, start: (p, tabs) => new Promise<void>((r) => { opened = () => { (p as Fake).saved = tabs; r(); }; }), unload: async () => {},
    copy: async () => {}, tabsOf: (p) => (p as Fake).saved, renamed() {}, remove: async () => {}, changed() {}, everywhere() {} });
  slow.load();
  await new Promise((r) => setImmediate(r));
  slow.saveTabs();
  assert.deepEqual(tabsSaved['Profile 1'].urls, ['https://d/'], 'while it opens');
  opened(); await slow.started;
  slow.saveTabs();
  assert.deepEqual(tabsSaved['Profile 1'].urls, ['https://d/'], 'once open');
  // More profiles than pictures: round again, nothing breaks.
  assert.equal(nextAvatar(AVATARS), 'fox');
  assert.equal(nextAvatar([...AVATARS, 'fox']), 'frog');
});
