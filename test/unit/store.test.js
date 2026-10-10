// The data folder (store.js) and a task's profiles in order (project-profiles.js).
// Plain Node (npm run test:unit), no Electron: logic that needs no window, in a temporary folder of its own.
const { test, after } = require('node:test');
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kulisa-unit-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));

test('projects: at first start none is opened; each gets its own color', async () => {
  const { Store } = require('../../src/main/store');
  const store = new Store(path.join(root, 'fresh-data'));
  assert.deepEqual(store.windows(), []);
  const shop = store.projectFor('/work/shop'), blog = store.projectFor('/work/blog');
  assert.notEqual(shop.color, blog.color);
  const bounds = { x: 10, y: 20, width: 900, height: 700 };
  store.saveWindows([{ tabs: [blog.id, shop.id], shown: shop.id, bounds }, { tabs: ['gone'], shown: 'gone' }]);
  const later = new Store(path.join(root, 'fresh-data'));
  const [w, gone] = later.windows();
  assert.deepEqual(w.tabs.map((p) => p.id), ['blog', 'shop'], 'later: the tabs open last');
  assert.deepEqual([w.shown.id, w.bounds], ['shop', bounds], 'the one shown, where the window was');
  assert.deepEqual([gone.tabs, gone.shown], [[], null], 'projects no longer there are left out');
  later.saveSettings({ ...later.settings(), uiZoom: 1 });
  later.saveWindows([]);
  assert.deepEqual(later.settings(), { uiZoom: 1, windows: [] }, 'the other settings kept');
});
test('projects: made with a color, icon and a first agent chosen; settings change them, never the id or folder', async () => {
  const { Store, PROJECT_COLORS } = require('../../src/main/store');
  const store = new Store(path.join(root, 'look-data'));
  const p = store.projectFor('/work/app', 'app', { color: PROJECT_COLORS[4], icon: 'rocket', agent: 'codex' });
  assert.deepEqual(p, { id: 'app', name: 'app', folder: '/work/app', color: PROJECT_COLORS[4], icon: 'rocket', agents: ['codex'] });
  assert.equal(store.nextColor(), PROJECT_COLORS[0], 'the next new one: the first color no project has');
  const changed = store.updateProject('app', { name: 'App-2', icon: null, agents: null, id: 'app', folder: '/work/app' });
  assert.deepEqual(changed, { id: 'app', name: 'App-2', folder: '/work/app', color: PROJECT_COLORS[4] }, 'none: back to the curtain, the window asks');
  assert.deepEqual(new Store(path.join(root, 'look-data')).projects(), [changed]);
  assert.equal(store.updateProject('gone', { name: 'x' }), null);
});

test('store: a write cut short leaves the file as it was', async () => {
  const { Store } = require('../../src/main/store');
  const store = new Store(path.join(root, 'fresh-data'));
  const task = store.taskOf(store.projectFor('/work/shop'), 1);
  task.saveProfiles([{ folder: 'Profile 1', id: 'sam', name: 'Sam', avatar: 'fox' }]);
  const writeFileSync = fs.writeFileSync;
  fs.writeFileSync = (f, data, ...rest) => { writeFileSync(f, String(data).slice(0, 10), ...rest); throw new Error('the computer went off'); };
  try { task.saveProfiles([{ folder: 'Profile 2', id: 'ann', name: 'Ann', avatar: 'frog' }]); } finally { fs.writeFileSync = writeFileSync; }
  assert.deepEqual(task.profiles().map((p) => p.id), ['sam']);
  assert.deepEqual(fs.readdirSync(task.dir).filter((f) => f.endsWith('.tmp')), [], 'no half-written file left');
});
test('profiles: one store, a profile in several projects; its master goes with its last project', () => {
  const { ProfileStore } = require('../../src/main/profile-store');
  const marked = [];
  const all = new ProfileStore(path.join(root, 'profiles-data'), (d) => marked.push(d));
  const ann = all.create('shop', { name: 'Ann', avatar: 'fox', description: 'seller' });
  assert.deepEqual(ann, { id: 'ann', name: 'Ann', avatar: 'fox', description: 'seller', folder: 'Profile 1', projects: ['shop'] });
  assert.ok(fs.existsSync(all.masterDir('Profile 1')), 'its master, empty');
  assert.equal(all.create('blog', { name: 'Ann', avatar: 'owl' }).id, 'ann-2', 'ids unique across projects');
  assert.deepEqual(all.addTo('ann', 'blog').projects, ['shop', 'blog']);
  assert.deepEqual(all.of('blog').map((p) => p.id), ['ann', 'ann-2']);
  assert.equal(all.idFor('Ann', 'ann'), 'ann', 'its own id is free for it');
  assert.deepEqual(all.update('Profile 1', { id: 'anna', name: 'Anna', description: '' }), { id: 'anna', name: 'Anna', avatar: 'fox', folder: 'Profile 1', projects: ['shop', 'blog'] });
  assert.equal(all.removeFrom('anna', 'shop').gone, false);
  assert.ok(fs.existsSync(all.masterDir('Profile 1')), 'still in blog');
  assert.equal(all.removeFrom('anna', 'blog').gone, true);
  assert.ok(!fs.existsSync(all.masterDir('Profile 1')) && marked.includes(all.masterDir('Profile 1')), 'gone with its last project');
  assert.equal(all.create('shop', { name: 'Bo', avatar: 'cat' }).folder, 'Profile 3', 'never a folder number used before');
});

test('project profiles: a task has its own copy of each, made at its first open; who a profile is, the same in every task', async () => {
  const { ProfileStore } = require('../../src/main/profile-store');
  const { ProjectProfiles } = require('../../src/main/project-profiles');
  const all = new ProfileStore(path.join(root, 'pp-data'));
  all.create('shop', { name: 'Ann', avatar: 'fox' });
  all.create('shop', { name: 'Bob', avatar: 'owl' });
  const task = (n) => {
    const dir = path.join(root, 'pp-data', 'task', String(n));
    let saved = null;
    const copied = [];
    const store = { profiles: () => saved, saveProfiles: (l) => { saved = l; }, tabs: (f) => (f === 'Profile 2' ? ['https://b/'] : []), saveTabs() {},
      profileDir: (f) => path.join(dir, f), markDeleted() {} };
    const list = new ProjectProfiles(store, all, 'shop', { make: (cfg) => ({ ...cfg, siteZoom: cfg.zoom, urls: [] }),
      copy: async (e) => { copied.push(e.cfg.folder); fs.mkdirSync(e.cfg.dir, { recursive: true }); e.urls = store.tabs(e.cfg.folder); },
      start: async (p, urls) => { p.urls = urls; }, unload: async () => {}, urlsOf: (p) => p.urls, renamed() {}, remove: async () => {}, changed() {}, everywhere() {} });
    return { list, copied, saved: () => saved };
  };
  // A task with nothing saved opens none (a new task has them all closed: projects.js, createTask); opened, each
  // is a copy of its master made then.
  const a = task(1);
  await a.list.load();
  assert.deepEqual([...a.list.profiles.keys()], []);
  assert.deepEqual([...a.list.closed.keys()], ['ann', 'bob']);
  assert.deepEqual(a.copied, [], 'nothing copied before it is opened');
  await a.list.open('ann'); await a.list.open('bob');
  assert.deepEqual(a.copied, ['Profile 1', 'Profile 2']);
  assert.deepEqual(a.list.profiles.get('bob').urls, ['https://b/'], "the master's tabs");
  await a.list.close('ann');
  await a.list.open('ann');
  assert.equal(a.copied.length, 2, 'opened again: its copy is there');
  assert.deepEqual(a.saved().map((p) => [p.id, !!p.closed]), [['ann', false], ['bob', false]]);
  // A task with its own state: closed ones stay closed, and copied only when opened.
  const b = task(2);
  b.list.store.saveProfiles([{ folder: 'Profile 1', id: 'ann' }, { folder: 'Profile 2', id: 'bob', closed: true }]);
  await b.list.load();
  assert.deepEqual([[...b.list.profiles.keys()], [...b.list.closed.keys()], b.copied], [['ann'], ['bob'], ['Profile 1']]);
  // Made in one task: closed in the other once it reads the store again; renamed, described, its picture: everywhere.
  assert.equal((await a.list.create('Cid', 'admin')).id, 'cid');
  assert.equal(a.list.profiles.get('cid').avatar, 'frog', 'the next picture free');
  assert.equal(a.list.rename('ann', 'Anna').id, 'anna');
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
  const one = new ProfileStore(path.join(root, 'pp-slow'));
  one.create('p', { name: 'Dan', avatar: 'fox' });
  const tabsSaved = {};
  let opened;
  const slow = new ProjectProfiles({ profiles: () => [{ folder: 'Profile 1', id: 'dan' }], saveProfiles() {}, tabs: () => ['https://d/'], saveTabs: (f, urls) => { tabsSaved[f] = urls; },
    profileDir: () => root, markDeleted() {} }, one, 'p', {
    make: (cfg) => ({ ...cfg, urls: [] }), start: (p, urls) => new Promise((r) => { opened = () => { p.urls = urls; r(); }; }), unload: async () => {},
    urlsOf: (p) => p.urls, renamed() {}, remove: async () => {}, changed() {}, everywhere() {} });
  const loading = slow.load();
  await new Promise((r) => setImmediate(r));
  slow.saveTabs();
  assert.deepEqual(tabsSaved['Profile 1'], ['https://d/'], 'while it opens');
  opened(); await loading;
  slow.saveTabs();
  assert.deepEqual(tabsSaved['Profile 1'], ['https://d/'], 'once open');
  // More profiles than pictures: round again, nothing breaks.
  const { AVATARS, nextAvatar } = require('../../src/main/avatars');
  assert.equal(nextAvatar(AVATARS), 'fox');
  assert.equal(nextAvatar([...AVATARS, 'fox']), 'frog');
});
