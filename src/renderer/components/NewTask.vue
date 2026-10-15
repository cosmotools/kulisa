<script setup lang="ts">
// The bar's +, after the islands (tasks.md, Projects): a task is made of a project (its profiles, agents and code), so
// its menu lists the projects: a click makes a task of one with its default agent, a tab at the end of the bar. Under
// each, its closed tasks, opened again with a click: the one place they are listed. Ctrl+Shift+A, and
// New Task in the empty window, open it too (open below).
import Icon from './Icon.vue';
import ButtonMenu from './menu/ButtonMenu.vue';
import { store } from '../lib/store';
import { dialog } from '../lib/dialogs';
import { withKeys } from '../lib/common';
import type { MenuItem } from '../lib/menu';
import type { ProjectTask } from '../../shared/types';

const about = (t: ProjectTask) => [t.branch !== t.name && t.branch, 'closed', t.merged && 'merged'].filter(Boolean).join(' · ');
function items(): MenuItem[] {
  const rows = store.projects.projects.flatMap((p): MenuItem[] => [
    { label: p.name, project: p, run: () => kulisa.invoke('project:open', { id: p.id }) },
    ...p.tasks.filter((t) => t.closed).map((t) => ({ label: t.name, sub: about(t), title: t.about, inset: true,
      remove: { label: 'Delete Task…', run: () => kulisa.invoke('task:delete-closed', { project: p.id, n: t.n }) },
      run: () => kulisa.invoke('project:open', { id: p.id, task: t.n }) })),
  ]);
  return [...(rows.length ? [{ heading: 'New Task of' }, ...rows] : [{ note: 'No projects yet' }]),
    '-', { label: 'New Project…', run: () => dialog('projects').then((d) => d.newProject()) }];
}
</script>

<template>
  <ButtonMenu :items end><button id="newTask" class="icon" :title="withKeys('New task: of which project', 'task.menu')"
    aria-label="New task"><Icon name="i-plus" /></button></ButtonMenu>
</template>
