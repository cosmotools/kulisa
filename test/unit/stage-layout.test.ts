// Closed panes are pruned without disturbing surviving groups.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SerializedDockview } from 'dockview-react';
import { filterLayout } from '../../src/task-view/main/index.ts';

test('pruning closed panes retains the active group when it survives', () => {
  const layout = {
    grid: { width: 800, height: 600, orientation: 'HORIZONTAL', root: { type: 'branch', data: [
      { type: 'leaf', data: { id: 'first', views: ['profile:a'], activeView: 'profile:a' } },
      { type: 'leaf', data: { id: 'second', views: ['profile:b', 'profile:c'], activeView: 'profile:c' } },
    ] } },
    panels: Object.fromEntries(['profile:a', 'profile:b', 'profile:c'].map((id) => [id, { id, contentComponent: 'profile' }])),
    activeGroup: 'second',
  } as SerializedDockview;
  assert.equal(layout.activeGroup, 'second');
  const pruned = filterLayout(layout, (id) => id !== 'profile:b');
  assert.equal(pruned.activeGroup, 'second');
  assert.equal(filterLayout(layout, (id) => id === 'profile:a').activeGroup, undefined);
});
