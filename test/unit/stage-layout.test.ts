// A saved layout keeps development panels and browser profiles in their independent grids.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitLayout } from '../../src/renderer/lib/stage-layout.ts';

test('flat layouts split mixed groups while retaining order, stacking, sizes and active views', () => {
  const panels = Object.fromEntries(['terminal', 'resources', 'profile:a', 'profile:b', 'profile:c'].map((id) => [id, { id, contentComponent: id.startsWith('profile:') ? 'profile' : id }]));
  const layout = {
    grid: { width: 1000, height: 800, orientation: 'HORIZONTAL', root: { type: 'branch', data: [
      { type: 'leaf', size: 600, data: { id: '1', views: ['profile:b', 'terminal', 'profile:a'], activeView: 'terminal' } },
      { type: 'branch', size: 400, data: [
        { type: 'leaf', size: 500, data: { id: '2', views: ['profile:c'], activeView: 'profile:c' } },
        { type: 'leaf', size: 300, data: { id: '3', views: ['resources'], activeView: 'resources' } },
      ] },
    ] } }, panels,
  };
  const split = splitLayout(layout);
  assert.deepEqual(Object.keys(split.workspace.panels), ['terminal', 'resources']);
  assert.deepEqual(Object.keys(split.stage.panels), ['profile:a', 'profile:b', 'profile:c']);
  const stage = split.stage.grid.root.data as Array<{ size: number; data: { views: string[]; activeView: string } }>;
  assert.equal(stage[0].size, 600);
  assert.deepEqual(stage[0].data.views, ['profile:b', 'profile:a']);
  assert.equal(stage[0].data.activeView, 'profile:b');
  assert.deepEqual((layout.grid.root.data[0].data as { views: string[] }).views, ['profile:b', 'terminal', 'profile:a'], 'the saved value is not mutated');
  assert.equal(splitLayout(split), split);
  assert.equal(splitLayout(null), null);
  assert.equal(splitLayout({}), null);
});
