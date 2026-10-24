// The activity monitor (README): a folder's usage, and the query over the tasks the caller lists. Plain Node
// (npm run test:unit), in a temporary folder of its own.
import { test, after } from 'node:test';
import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ActivityMonitor, folderUsage } from './main/index.ts';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kulisa-activity-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));
const put = (file: string, bytes: number) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, 'x'.repeat(bytes)); };

test('activity monitor: a folder its entries with their sizes, a folder inside summed whole; a missing one nothing', async () => {
  const dir = path.join(root, 'folder');
  put(path.join(dir, 'a.txt'), 10);
  put(path.join(dir, 'sub', 'b.txt'), 20);
  put(path.join(dir, 'sub', 'deeper', 'c.txt'), 30);
  const u = await folderUsage(dir);
  assert.equal(u.bytes, 60);
  assert.deepEqual(u.entries.map(({ name, bytes }) => [name, bytes]).sort(), [['a.txt', 10], ['sub', 50]]);
  assert.deepEqual(await folderUsage(path.join(root, 'none')), { bytes: 0, entries: [] });
});

test('activity monitor: every task, one, a project\'s, or several; totals over those taken; entries only when asked', async () => {
  const task = (key: string, project: string, bytes: number) => {
    const artifacts = path.join(root, 'tasks', key, 'artifacts');
    if (bytes) put(path.join(artifacts, '1-p-t-screenshot.jpg'), bytes);
    return { key, project, artifacts };
  };
  const tasks = [task('a/1', 'a', 100), task('a/2', 'a', 200), task('b/1', 'b', 400), task('b/2', 'b', 0)];
  const monitor = new ActivityMonitor({ list: () => tasks });
  const sizes = (r: Awaited<ReturnType<typeof monitor.query>>) => [r.total.artifacts, r.tasks.map((t) => [t.key, t.metrics.artifacts!.bytes])];
  assert.deepEqual(sizes(await monitor.query()), [700, [['a/1', 100], ['a/2', 200], ['b/1', 400], ['b/2', 0]]], 'all, a task with none at 0');
  assert.deepEqual(sizes(await monitor.query({ tasks: ['a/2'] })), [200, [['a/2', 200]]]);
  assert.deepEqual(sizes(await monitor.query({ projects: ['b'] })), [400, [['b/1', 400], ['b/2', 0]]]);
  assert.deepEqual(sizes(await monitor.query({ tasks: ['a/1'], projects: ['b'] })), [500, [['a/1', 100], ['b/1', 400], ['b/2', 0]]], 'a group: either');
  const one = await monitor.query({ tasks: ['a/1'], metrics: ['artifacts'] });
  assert.equal(one.tasks[0]!.metrics.artifacts!.entries, undefined, 'only the figure by default');
  const files = await monitor.query({ tasks: ['a/1'], entries: true });
  assert.deepEqual(files.tasks[0]!.metrics.artifacts!.entries!.map((e) => [e.name, e.bytes]), [['1-p-t-screenshot.jpg', 100]]);
  assert.deepEqual(await monitor.query({ metrics: [] }), { total: {}, tasks: tasks.map(({ key, project }) => ({ key, project, metrics: {} })) }, 'no metric: none measured');
});
