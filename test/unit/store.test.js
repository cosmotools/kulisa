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
  // Before there were several windows: one window's tabs.
  later.saveSettings({ uiZoom: 1, openProjects: [shop.id], lastProject: shop.id });
  assert.deepEqual(later.windows().map((x) => [x.tabs.map((p) => p.id), x.shown.id]), [[['shop'], 'shop']]);
  later.saveWindows([]);
  assert.deepEqual(later.settings(), { uiZoom: 1, windows: [] });
});
test('projects: made with a color, icon and agent chosen; settings change them, never the id or folder', async () => {
  const { Store, PROJECT_COLORS } = require('../../src/main/store');
  const store = new Store(path.join(root, 'look-data'));
  const p = store.projectFor('/work/app', 'app', { color: PROJECT_COLORS[4], icon: 'rocket', agent: 'codex' });
  assert.deepEqual(p, { id: 'app', name: 'app', folder: '/work/app', color: PROJECT_COLORS[4], icon: 'rocket', agent: 'codex' });
  assert.equal(store.nextColor(), PROJECT_COLORS[0], 'the next new one: the first color no project has');
  const changed = store.updateProject('app', { name: 'App-2', icon: null, agent: null, id: 'app', folder: '/work/app' });
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
test('project profiles: closing and opening keeps a profile\'s place; ids and pictures stay unique with closed ones', async () => {
  const { ProjectProfiles } = require('../../src/main/project-profiles');
  // Made before pictures: Ann and Bob had colors only.
  let saved = [{ id: 'ann', name: 'Ann', color: '#e5534b', folder: 'Profile 1' }, { id: 'bob', name: 'Bob', color: '#57ab5a', folder: 'Profile 2', closed: true },
    { id: 'cid', name: 'Cid', avatar: 'fox', description: 'admin', folder: 'Profile 3' }];
  const store = { profiles: () => saved, tabs: (f) => (f === 'Profile 2' ? ['https://b/'] : []), saveProfiles: (l) => { saved = l; }, saveTabs() {},
    profileDir: (f) => `/data/${f}`, freeFolder: (taken) => `Profile ${taken.length + 1}`, markDeleted() {} };
  const fake = (cfg) => ({ ...cfg, siteZoom: cfg.zoom, urls: [] });
  const list = new ProjectProfiles(store, { make: fake, start: async (p, urls) => { p.urls = urls; }, unload: async () => {}, urlsOf: (p) => p.urls,
    renamed() {}, remove: async () => {}, changed() {} });
  await list.load();
  assert.deepEqual([...list.profiles.keys()], ['ann', 'cid']);
  assert.deepEqual(list.entries.map((e) => e.cfg.avatar), ['frog', 'panda', 'fox'], 'pictures given in place of colors, none twice');
  assert.deepEqual([...list.closed.keys()], ['bob']);
  await list.close('ann');
  await list.open('bob');
  assert.deepEqual(list.profiles.get('bob').urls, ['https://b/'], 'its tabs come back');
  assert.deepEqual(saved.map((p) => `${p.id}${p.closed ? ' (closed)' : ''}`), ['ann (closed)', 'bob', 'cid'], 'each keeps its place');
  assert.equal((await list.create('Ann')).id, 'ann-2', 'a closed profile keeps its id');
  assert.equal(saved.at(-1).folder, 'Profile 4');
  assert.equal(saved.at(-1).avatar, 'owl', 'and its picture');
  assert.ok(saved.every((p) => !('color' in p)), 'colors are gone once written');
  assert.equal(saved.find((p) => p.id === 'cid').description, 'admin');
  assert.equal(list.rename('ann', 'Bob').id, 'bob-2');
  // Who it is and the picture: on an open profile and a closed one alike; the rest stays.
  assert.deepEqual(list.describe('bob', '  buyer '), { id: 'bob' });
  assert.equal(list.profiles.get('bob').description, 'buyer');
  await list.close('bob');
  assert.deepEqual(list.setAvatar('bob', 'cat'), { id: 'bob' });
  const bob = saved.find((p) => p.id === 'bob');
  assert.deepEqual([bob.name, bob.avatar, bob.description, bob.folder, bob.closed], ['Bob', 'cat', 'buyer', 'Profile 2', true]);
  await list.open('bob');
  assert.equal(list.profiles.get('bob').avatar, 'cat');
  assert.match(list.setAvatar('bob', 'dragon').error, /no picture/);
  assert.match(list.describe('bob', 'x'.repeat(501)).error, /at most 500/);
  // Tabs saved while a profile is still opening (its session cookies restored before its tabs): the addresses it is
  // opening, not none. Kulisa quit right then lost every profile's tabs (2026-10-08).
  const tabsSaved = {};
  let opened;
  const slow = new ProjectProfiles({ ...store, profiles: () => [{ id: 'dan', name: 'Dan', avatar: 'fox', folder: 'Profile 9' }],
    tabs: () => ['https://d/'], saveTabs: (f, urls) => { tabsSaved[f] = urls; } }, {
    make: fake, start: (p, urls) => new Promise((r) => { opened = () => { p.urls = urls; r(); }; }), unload: async () => {},
    urlsOf: (p) => p.urls, renamed() {}, remove: async () => {}, changed() {} });
  const loading = slow.load();
  await new Promise((r) => setImmediate(r));
  slow.saveTabs();
  assert.deepEqual(tabsSaved['Profile 9'], ['https://d/'], 'while it opens');
  opened(); await loading;
  slow.saveTabs();
  assert.deepEqual(tabsSaved['Profile 9'], ['https://d/'], 'once open');
  // More profiles than pictures: round again, nothing breaks.
  const { AVATARS, nextAvatar } = require('../../src/main/avatars');
  assert.equal(nextAvatar(AVATARS), 'fox');
  assert.equal(nextAvatar([...AVATARS, 'fox']), 'frog');
});
