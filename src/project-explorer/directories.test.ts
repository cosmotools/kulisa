// Lazy directory races and replacement state through the public Trees model.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { FileTree } from '@pierre/trees';
import { Directories } from './renderer/directories.ts';
import { GitStatuses } from './renderer/git-status.ts';
import type { ExplorerActions } from './renderer/actions.ts';
import type { ProjectFile, ProjectGitStatus } from './ipc.ts';
import type { Result } from '../shared/result.ts';

const settled = () => new Promise<void>((resolve) => setImmediate(resolve));
function fixture(t: TestContext) {
  const requests: { folder: string; finish(result: Result<{ entries: ProjectFile[] }>): void }[] = [];
  const model = new FileTree({ paths: [], flattenEmptyDirectories: false, initialExpansion: 'closed', presorted: true });
  const actions: ExplorerActions = {
    readFolder: (folder) => new Promise((finish) => requests.push({ folder, finish })),
    readGitStatus: async () => ({ entries: [] }),
    openFolder() {}, folderMenu: () => [], openFile: async () => ({}), showFile() {}, showMenu() {},
  };
  const data = new Directories(model, actions, () => {});
  t.after(() => { data.dispose(); model.cleanUp(); });
  data.setRoots([{ folder: '/project', label: 'project', caption: 'main working tree' }]);
  data.setActive(true);
  const entries = (names: string[], folder = '/project') => ({ entries: names.map((name) => ({
    name: name.replace(/\/$/, ''), directory: name.endsWith('/'), path: `${folder}/${name.replace(/\/$/, '')}`,
  })) });
  const toggle = (path: string, open: boolean) => {
    const item = model.getItem(path);
    assert.ok(item && 'isExpanded' in item);
    if (open) item.expand(); else item.collapse();
  };
  return { data, model, requests, entries, toggle };
}

test('only expanded visible folders read; stale collapse, background and removal replies are discarded', async (t) => {
  const { data, model, requests, entries, toggle } = fixture(t);
  await settled();
  assert.deepEqual(requests.map((r) => r.folder), ['/project']);
  requests[0]!.finish(entries(['src/', 'file.txt'])); await settled();
  assert.equal(requests.length, 1);
  toggle('project/src/', true); await settled();
  toggle('project/src/', false); toggle('project/src/', true);
  await settled(); assert.equal(requests.length, 2, 'reopening does not overlap an outstanding read');
  assert.equal(data.status('project/src/'), 'Loading…');
  requests[1]!.finish(entries(['obsolete.txt'], '/project/src')); await settled();
  assert.equal(model.getItem('project/src/obsolete.txt'), null);
  assert.equal(requests.length, 3);
  data.setActive(false);
  requests[2]!.finish(entries(['background.txt'], '/project/src')); await settled();
  assert.equal(model.getItem('project/src/background.txt'), null);
  data.setActive(true); await settled();
  assert.equal(requests.length, 5);
  requests[3]!.finish(entries(['file.txt'])); await settled();
  requests[4]!.finish(entries(['removed.txt'], '/project/src')); await settled();
  assert.equal(model.getItem('project/src/'), null);
  assert.equal(model.getItem('project/src/removed.txt'), null);
});

test('Git snapshots do not overlap or cross root lifetimes; errors retry explicitly', async (t) => {
  const pending: ((result: Result<{ entries: ProjectGitStatus[] }>) => void)[] = [];
  let published: ProjectGitStatus[] = [];
  let errorsChanged = false;
  const git = new GitStatuses(() => new Promise((resolve) => pending.push(resolve)), (entries, changed) => { published = entries; errorsChanged = changed; });
  t.after(() => git.dispose());
  git.setRoots(new Map([['repo/', { folder: '/repo' }]]));
  git.setActive(true); git.refresh();
  assert.equal(pending.length, 1);
  git.setActive(false); git.setActive(true);
  pending[0]!({ entries: [{ path: 'stale.txt', status: 'modified' }] }); await settled();
  assert.deepEqual(published, []); assert.equal(pending.length, 2);
  pending[1]!({ entries: [{ path: 'file.txt', status: 'modified' }] }); await settled();
  assert.deepEqual(published, [{ path: 'repo/file.txt', status: 'modified' }]);
  git.refresh();
  git.setRoots(new Map([['repo/', { folder: '/replacement' }]]));
  pending[2]!({ entries: [{ path: 'removed.txt', status: 'added' }] }); await settled();
  assert.deepEqual(published, []);
  pending[3]!({ error: 'Git failed' }); await settled();
  assert.match(git.error('repo/'), /Git failed/);
  assert.equal(errorsChanged, true);
  git.refresh(); assert.equal(pending.length, 4);
  git.retry('repo/'); assert.equal(pending.length, 5);
  pending[4]!({ entries: [] }); await settled();
  assert.equal(git.error('repo/'), ''); assert.equal(errorsChanged, true);
  git.refresh();
  git.dispose(); pending[5]!({ entries: [{ path: 'late.txt', status: 'added' }] }); await settled();
  assert.deepEqual(published, []);
});

test('errors retry explicitly; empty folders need no sentinel; unchanged polling preserves the model', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const { data, model, requests, entries } = fixture(t);
  await settled(); requests[0]!.finish({ error: 'Permission denied' }); await settled();
  assert.equal(data.status('project/'), 'Permission denied');
  t.mock.timers.tick(9000); await settled(); assert.equal(requests.length, 1);
  data.retry('project/'); await settled(); requests[1]!.finish(entries([])); await settled();
  assert.equal(data.status('project/'), 'Empty folder');
  assert.equal(model.getVisibleCount(), 1);
  let resets = 0; model.onMutation('reset', () => resets++);
  const getItem = model.getItem.bind(model);
  let lookups = 0; model.getItem = (path) => { lookups++; return getItem(path); };
  t.mock.timers.tick(3000); await settled(); requests[2]!.finish(entries([])); await settled();
  assert.equal(resets, 0);
  assert.equal(lookups, 0, 'unchanged replies do not traverse the tree');
  data.dispose(); t.mock.timers.tick(9000); await settled(); assert.equal(requests.length, 3);
});

test('refresh retains selection, focus and expansion; focus changes do not scan known directories', async (t) => {
  const { data, model, requests, entries, toggle } = fixture(t);
  await settled(); requests[0]!.finish(entries(['src/', 'a.txt', 'b.txt'])); await settled();
  toggle('project/src/', true); await settled(); requests[1]!.finish(entries([], '/project/src')); await settled();
  model.focusPath('project/a.txt'); model.getItem('project/a.txt')!.select();
  data.retry('project/'); await settled(); requests[2]!.finish(entries(['src/', 'a.txt', 'b.txt', 'c.txt'])); await settled();
  assert.equal(model.getFocusedPath(), 'project/a.txt');
  assert.deepEqual(model.getSelectedPaths(), ['project/a.txt']);
  assert.equal(data.status('project/src/'), 'Empty folder');
  const original = model.getItem.bind(model);
  let lookups = 0;
  model.getItem = (path) => { lookups++; return original(path); };
  model.focusPath('project/b.txt'); model.focusPath('project/a.txt');
  assert.equal(lookups, 0);
});

test('root identity survives replacement and duplicate labels; supplied folder order is retained', async (t) => {
  const { data, model, requests, entries } = fixture(t);
  await settled();
  data.setRoots([{ folder: 'C:\\work\\project', label: 'project', caption: '' }]);
  await settled();
  assert.equal(data.file('project/'), 'C:\\work\\project');
  assert.equal(requests[1]!.folder, 'C:\\work\\project');
  requests[0]!.finish(entries(['obsolete.txt']));
  requests[1]!.finish(entries(['z/', 'a/', 'file10.txt', 'file2.txt'])); await settled();
  assert.equal(model.getItem('project/obsolete.txt'), null);
  assert.deepEqual(model.getVisibleRows(0, 10).map((r) => r.name), ['project', 'z', 'a', 'file10.txt', 'file2.txt']);
  data.setRoots([{ folder: 'C:\\work\\project', label: 'project', caption: '' }, { folder: '/other/project', label: 'project', caption: '' }]);
  await settled();
  const roots = model.getVisibleRows(0, 10).filter((r) => r.depth === 0);
  assert.equal(roots.length, 2);
  assert.equal(data.file(roots[0]!.path), 'C:\\work\\project');
  assert.equal(data.file(roots[1]!.path), '/other/project');
  data.setRoots([{ folder: '/other/project', label: 'project', caption: '' }]);
  await settled();
  assert.equal(model.getItem('project/'), null);
  assert.equal(data.file(roots[1]!.path), '/other/project');
  data.setRoots([{ folder: '/', label: '', caption: '' }]); await settled();
  assert.equal(model.getVisibleCount(), 1);
  assert.equal(data.file(model.getVisibleRows(0, 0)[0]!.path), '/');
});
