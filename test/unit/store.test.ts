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
import { drawing } from './drawing.ts';
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
  assert.deepEqual([store.projectOf('/work/shop/')?.id, store.projectOf('/work/shop-api')?.id, store.projectOf('/work/other')], [shop.id, shop.id, null]);
  store.updateProject(shop.id, { repos: null });
  const bounds = { x: 10, y: 20, width: 900, height: 700 };
  store.saveWindows([{ tabs: [`${blog.id}/1`, `${shop.id}/2`], shown: `${shop.id}/2`, bounds }, { tabs: ['gone/1'], shown: 'gone/1' }]);
  const later = new Store(path.join(root, 'fresh-data'));
  const [w, gone] = later.windows();
  assert.deepEqual(w.tabs, [`${blog.id}/1`, `${shop.id}/2`], 'later: the tabs open last, tasks by key');
  assert.deepEqual([w.shown, w.bounds], [`${shop.id}/2`, bounds], 'the one shown, where the window was');
  assert.deepEqual([gone.tabs, gone.shown], [['gone/1'], 'gone/1'], 'as saved: a task no longer there is left out when the windows open (app.ts)');
  // A project deleted: its tasks out of every window.
  later.removeProject(blog);
  assert.deepEqual(later.windows()[0].tabs, [`${shop.id}/2`]);
  later.saveSettings({ ...later.settings(), uiZoom: 1 });
  later.saveWindows([]);
  assert.deepEqual(later.settings(), { uiZoom: 1, windows: [] }, 'the other settings kept');
});
test('projects: made with the next free color and a first agent; settings change them, never the id or folder', async () => {
  const store = new Store(path.join(root, 'look-data'));
  const p = store.projectFor('/work/app', 'app', { agent: 'codex' }), id = p.id;
  assert.deepEqual(p, { id, name: 'app', folder: '/work/app', color: PROJECT_COLORS[0], agents: ['codex'] });
  assert.equal(store.nextColor(), PROJECT_COLORS[1], 'the next new one: the first color no project has');
  const changed = store.updateProject(id, { name: 'App-2', agents: null, id, folder: '/work/app' });
  assert.deepEqual(changed, { id, name: 'App-2', folder: '/work/app', color: PROJECT_COLORS[0] });
  assert.deepEqual(new Store(path.join(root, 'look-data')).projects(), [changed]);
  assert.equal(store.updateProject('gone', { name: 'x' }), null);
});

test("projects: an id is six random letters and digits, none a project's name, unique; any old id is read as it is", () => {
  const dir = path.join(root, 'ids-data'), store = new Store(dir);
  const ids = Array.from({ length: 50 }, (_, i) => store.projectFor(`/work/app-${i}`, 'app').id);
  for (const id of ids) assert.match(id, /^[a-z0-9]{6}$/);
  assert.equal(new Set(ids).size, ids.length, 'one each, though their names are the same');
  const [first] = store.projects();
  store.updateProject(first.id, { name: 'Renamed' });
  assert.equal(store.projectOf('/work/app-0').id, first.id, 'kept when the project is renamed');
  // A project of an earlier format, its id made from its name: an opaque string as any other.
  fs.writeFileSync(store.projectsFile, JSON.stringify({ list: [...store.projects(), { id: 'd', name: 'ddd', folder: '/work/d', color: PROJECT_COLORS[0] }] }));
  assert.equal(store.projectFor('/work/d').id, 'd');
  assert.equal(store.updateProject('d', { name: 'eee' }).id, 'd');
  assert.deepEqual(store.taskOf({ id: 'd' }, 1).dir, path.join(dir, 'projects', 'd', '1'));
});

test('store: a write cut short leaves the file as it was', async () => {
  const store = new Store(path.join(root, 'fresh-data'));
  const task = store.taskOf(store.projectFor('/work/shop'), 1);
  task.saveProfiles([{ id: 'sam' }]);
  const writeFileSync = fs.writeFileSync;
  fs.writeFileSync = ((f: number, data: string) => { writeFileSync(f, String(data).slice(0, 10)); throw new Error('the computer went off'); }) as typeof fs.writeFileSync;
  try { task.saveProfiles([{ id: 'ann' }]); } finally { fs.writeFileSync = writeFileSync; }
  assert.deepEqual(task.profiles().map((p) => p.id), ['sam']);
  assert.deepEqual(fs.readdirSync(task.dir).filter((f) => f.endsWith('.tmp')), [], 'no half-written file left');
});
test("store: a profile's tabs come back with the one in front; a bare list of addresses, another format, is not read", () => {
  const store = new Store(path.join(root, 'tabs-data'));
  const task = store.taskOf(store.projectFor('/work/shop'), 1);
  assert.deepEqual(task.tabs('k3x9ab'), { urls: [], active: 0 }, 'none saved');
  task.saveTabs('k3x9ab', { urls: ['https://a/', 'https://b/'], active: 1 });
  assert.deepEqual(task.tabs('k3x9ab'), { urls: ['https://a/', 'https://b/'], active: 1 });
  fs.writeFileSync(path.join(task.profileDir('k3x9ab'), 'Kulisa Tabs.json'), JSON.stringify(['https://a/']));
  assert.deepEqual(task.tabs('k3x9ab'), { urls: [], active: 0 }, 'one data format only (CLAUDE.md)');
});

// A profile store over a data folder with these projects, each its name as its id, to be read (store.ts: the
// projects list their profiles; ids are opaque).
const profileStore = (dir: string, ...projects: string[]) => {
  const store = new Store(dir);
  fs.writeFileSync(store.projectsFile, JSON.stringify({ list: projects.map((p, i) => ({ id: p, name: p, folder: `/work/${p}`, color: PROJECT_COLORS[i] })) }));
  return new ProfileStore(store);
};

test('profiles: one store, a profile in several projects or none, each project listing its own in order; it lives until deleted, its master with it', () => {
  const all = profileStore(path.join(root, 'profiles-data'), 'shop', 'blog');
  const ann = all.create('shop', { name: 'Ann', avatar: 'fox', description: 'seller' }) as StoredProfile, id = ann.id;
  assert.match(id, /^[a-z0-9]{6}$/);
  assert.deepEqual(ann, { id, name: 'Ann', avatar: 'fox', description: 'seller' });
  assert.deepEqual(all.store.projects().find((p) => p.id === 'shop').profiles, [id], 'the project lists it, by its id');
  assert.ok(fs.existsSync(all.masterDir(id)) && path.basename(all.masterDir(id)) === id, 'its master, empty, named by its id');
  const bo = all.create('blog', { name: 'Bo', avatar: 'owl' }) as StoredProfile;
  assert.notEqual(bo.id, id);
  all.addTo(id, 'blog');
  assert.deepEqual(all.projectsOf(all.get(id)), ['shop', 'blog']);
  assert.deepEqual(all.of('blog').map((p) => p.name), ['Bo', 'Ann'], "in the project's order");
  assert.match((all.addTo(id, 'nowhere') as { error: string }).error, /no project/);
  // Renamed: its id, master and place in every project stay.
  assert.deepEqual(all.rename(id, 'Anna'), { id });
  assert.deepEqual(all.of('shop').map((p) => [p.id, p.name]), [[id, 'Anna']]);
  assert.ok(fs.existsSync(all.masterDir(id)));
  all.removeFrom(id, 'shop');
  all.removeFrom(id, 'blog');
  assert.deepEqual(all.projectsOf(all.get(id)), [], 'in no project');
  assert.ok(fs.existsSync(all.masterDir(id)) && all.get(id), 'kept with its sign-ins: let go is not deleted');
  // Who it is, changed and checked in the store, for every handle (a task, Settings, the agent).
  assert.deepEqual(all.rename(id, 'Ann'), { id });
  assert.match(all.rename(id, '').error, /./);
  assert.match(all.describe(id, 'x'.repeat(501)).error, /at most 500/);
  assert.match(all.setAvatar(id, 'dragon').error, /no picture/);
  assert.deepEqual(all.setLogin(id, 'ann@shop.test', 'enc'), { id });
  assert.deepEqual(all.get(id).login, { user: 'ann@shop.test', secret: 'enc' });
  all.setLogin(id, 'ann@shop.test', undefined);
  assert.equal(all.get(id).login.secret, 'enc', 'the password kept when only the login is set again');
  all.setLogin(id, '', undefined);
  assert.equal(all.get(id).login, undefined, 'an empty login takes the pair away');
  assert.deepEqual(all.projectsOf(all.create(null, { name: 'Free', avatar: 'cat' }) as StoredProfile), [], 'made in no project (Settings → Profiles)');
  // Deleted: gone with its master, and from the projects listing it.
  all.addTo(id, 'blog');
  assert.equal((all.delete(id) as { profile: StoredProfile }).profile.id, id);
  assert.ok(!all.get(id) && !fs.existsSync(all.masterDir(id)) && all.store.deleted().includes(all.masterDir(id)), 'its master gone');
  assert.deepEqual(all.store.projects().find((p) => p.id === 'blog').profiles, [bo.id], 'no project lists it');
  // A new id is drawn again while a profile has it, its master is there, or a folder of that name waits for the next
  // start to go (a task's copy of a deleted profile, its session open: the new one would take it for its own).
  fs.mkdirSync(all.masterDir('aaaaaa'));
  all.store.markDeleted(path.join(all.dir, 'projects', 'shop', '1', 'bbbbbb'));
  const undraw = drawing(bo.id, id, 'aaaaaa', 'bbbbbb', 'cccccc');
  try { assert.equal((all.create('shop', { name: 'Ben', avatar: 'cat' }) as StoredProfile).id, 'cccccc'); } finally { undraw(); }
  // Checked where it is made, whoever makes it; its picture the next free one of its project's unless given.
  assert.match((all.create('shop', { name: 'Ann/admin' }) as { error: string }).error, /only/);
  assert.match((all.create('shop', { name: 'Cy', description: 'x'.repeat(501) }) as { error: string }).error, /at most 500/);
  const cy = all.create('shop', { name: ' Cy ' }) as StoredProfile;
  assert.notEqual(cy.avatar, 'cat', "not the project's taken one (Ben's)");
  assert.equal(cy.name, 'Cy', 'trimmed');
});

// The agent names a profile by its name (mcp-server.ts): two of one name in a project could not be told apart.
test('profiles: a name is unique within a project, whatever its case, on create, rename and adding it to a project', () => {
  const all = profileStore(path.join(root, 'unique-data'), 'shop', 'blog');
  const ann = all.create('shop', { name: 'ann@shop.com' }) as StoredProfile;
  assert.equal((all.create('shop', { name: 'Ann@Shop.com' }) as { error: string }).error, 'a profile Ann@Shop.com is in the project shop already');
  assert.deepEqual(all.of('shop').map((p) => p.id), [ann.id], 'not made');
  const other = all.create('blog', { name: 'ANN@shop.com' }) as StoredProfile;
  assert.ok(other.id, 'another project may have one of that name');
  assert.ok((all.create(null, { name: 'ann@shop.com' }) as StoredProfile).id, 'in no project: nothing to clash with');
  assert.match((all.addTo(other.id, 'shop') as { error: string }).error, /is in the project shop already/);
  assert.deepEqual(all.of('shop').map((p) => p.id), [ann.id], 'not added');
  const bob = all.create('shop', { name: 'bob' }) as StoredProfile;
  all.addTo(bob.id, 'blog');
  assert.match(all.rename(bob.id, 'Ann@shop.com').error, /is in the project shop already/, 'against every project that lists it');
  assert.equal(all.get(bob.id).name, 'bob');
  assert.deepEqual(all.rename(ann.id, 'ANN@SHOP.COM'), { id: ann.id }, 'its own name in another case');
  assert.equal(all.get(ann.id).name, 'ANN@SHOP.COM');
});

test('project profiles: a task has its own copy of each, made at its first open; who a profile is, the same in every task', async () => {
  const all = profileStore(path.join(root, 'pp-data'), 'shop');
  const ann = (all.create('shop', { name: 'Ann', avatar: 'fox' }) as StoredProfile).id;
  const bob = (all.create('shop', { name: 'Bob', avatar: 'owl' }) as StoredProfile).id;
  const task = (n: number) => {
    const dir = path.join(root, 'pp-data', 'task', String(n));
    let saved: TaskProfile[] = null;
    const copied: string[] = [];
    const store = { profiles: () => saved, saveProfiles: (l: TaskProfile[]) => { saved = l; }, tabs: (f: string) => ({ urls: f === bob ? ['https://b/'] : [], active: 0 }), saveTabs() {},
      profileDir: (f: string) => path.join(dir, f), markDeleted() {} } as unknown as TaskStore;
    const list = new ProjectProfiles(store, all, 'shop', { make: (cfg: ProfileConfig) => ({ ...cfg, siteZoom: cfg.zoom }) as unknown as Profile,
      copy: async (e) => { copied.push(e.cfg.id); fs.mkdirSync(e.cfg.dir, { recursive: true }); e.tabs = store.tabs(e.cfg.id); },
      start: async (p, tabs) => { (p as Fake).saved = tabs; }, unload: async () => {}, tabsOf: (p) => (p as Fake).saved, remove: async () => {}, changed() {}, everywhere() {} });
    return { list, copied, saved: () => saved };
  };
  // A task with nothing saved opens none (a new task has them all closed: projects.ts, createTask); opened, each
  // is a copy of its master made then.
  const a = task(1);
  a.list.load(); await a.list.started;
  assert.deepEqual([...a.list.profiles.keys()], []);
  assert.deepEqual([...a.list.closed.keys()], [ann, bob]);
  assert.deepEqual(a.copied, [], 'nothing copied before it is opened');
  await a.list.open(ann); await a.list.open(bob);
  assert.deepEqual(a.copied, [ann, bob]);
  assert.equal(path.basename(a.list.profiles.get(ann).dir), ann, 'its copy named by its id');
  assert.deepEqual((a.list.profiles.get(bob) as Fake).saved.urls, ['https://b/'], "the master's tabs");
  await a.list.close(ann);
  assert.match((await a.list.close(ann) as { error: string }).error, /Ann is not open/, 'named as the agent names it');
  await a.list.open(ann);
  assert.equal(a.copied.length, 2, 'opened again: its copy is there');
  assert.deepEqual(a.saved().map((p) => [p.id, !!p.closed]), [[ann, false], [bob, false]]);
  // The agent's name for it, whatever its case.
  assert.deepEqual(a.list.named('aNN'), { id: ann });
  assert.equal((a.list.named('nobody') as { error: string }).error, 'No profile "nobody". Profiles: Ann, Bob');
  // A task with its own state: closed ones stay closed, and copied only when opened.
  const b = task(2);
  b.list.store.saveProfiles([{ id: ann }, { id: bob, closed: true }]);
  b.list.load(); await b.list.started; // its copy made, then opened
  assert.deepEqual([[...b.list.profiles.keys()], [...b.list.closed.keys()], b.copied], [[ann], [bob], [ann]]);
  // Made in one task: closed in the other once it reads the store again; renamed, described, its picture: everywhere.
  const cid = (await a.list.create('Cid', 'admin') as { id: string }).id;
  assert.equal(a.list.profiles.get(cid).avatar, 'frog', 'the next picture free');
  assert.match((await a.list.create('cid') as { error: string }).error, /is in the project shop already/);
  assert.deepEqual(a.list.rename(ann, 'Anna'), { id: ann }, 'renamed, its id stays');
  assert.equal(a.list.profiles.get(ann).name, 'Anna');
  a.list.describe(bob, 'buyer');
  b.list.refresh();
  assert.deepEqual([[...b.list.profiles.keys()], [...b.list.closed.keys()]], [[ann], [bob, cid]]);
  assert.equal(b.list.profiles.get(ann).name, 'Anna', 'the other task shows the new name, the same copy and pane');
  assert.equal(b.list.closed.get(bob).cfg.description, 'buyer');
  assert.deepEqual(all.of('shop').map((p) => p.name), ['Anna', 'Bob', 'Cid']);
  // Let go: gone from the task.
  await b.list.drop(ann);
  assert.deepEqual([...b.list.profiles.keys(), ...b.list.closed.keys()], [bob, cid]);
  assert.match(a.list.setAvatar(bob, 'dragon').error, /no picture/);
  assert.match(a.list.describe(bob, 'x'.repeat(501)).error, /at most 500/);
  // Tabs saved while a profile is still opening (its session cookies restored before its tabs): the addresses it is
  // opening, not none: Kulisa quitting right then would lose every profile's tabs.
  const one = profileStore(path.join(root, 'pp-slow'), 'p');
  const dan = (one.create('p', { name: 'Dan', avatar: 'fox' }) as StoredProfile).id;
  const tabsSaved: Record<string, SavedTabs> = {};
  let opened: () => void;
  const slow = new ProjectProfiles({ profiles: () => [{ id: dan }], saveProfiles() {}, tabs: () => ({ urls: ['https://d/'], active: 0 }), saveTabs: (f: string, tabs: SavedTabs) => { tabsSaved[f] = tabs; },
    profileDir: () => root, markDeleted() {} } as unknown as TaskStore, one, 'p', {
    make: (cfg: ProfileConfig) => ({ ...cfg }) as unknown as Profile, start: (p, tabs) => new Promise<void>((r) => { opened = () => { (p as Fake).saved = tabs; r(); }; }), unload: async () => {},
    copy: async () => {}, tabsOf: (p) => (p as Fake).saved, remove: async () => {}, changed() {}, everywhere() {} });
  slow.load();
  await new Promise((r) => setImmediate(r));
  slow.saveTabs();
  assert.deepEqual(tabsSaved[dan].urls, ['https://d/'], 'while it opens');
  opened(); await slow.started;
  slow.saveTabs();
  assert.deepEqual(tabsSaved[dan].urls, ['https://d/'], 'once open');
  // More profiles than pictures: round again, nothing breaks.
  assert.equal(nextAvatar(AVATARS), 'fox');
  assert.equal(nextAvatar([...AVATARS, 'fox']), 'frog');
});
