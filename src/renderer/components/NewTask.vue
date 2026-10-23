<script setup lang="ts">
// The bar's +, after the tabs (tasks.md, Projects): a menu of every project with its tasks — an open one switches to
// it, a closed one opens it again, its 🗑 deletes it (after a question) — and New Task of each, then New Project….
// One project's tasks show at the top; with several, each project is a submenu, and a click on the project itself makes
// it a new task (its tasks show on hover). Ctrl+Shift+A opens it (keys.ts).
import Icon from './Icon.vue';
import ButtonMenu from './menu/ButtonMenu.vue';
import { store } from '../lib/store';
import { dialog } from '../lib/dialogs';
import { projectColor } from '../lib/project-color';
import { lastWorked, taskLine, withKeys } from '../lib/common';
import type { MenuItem } from '../lib/menu';
import type { ProjectEntry } from '../../shared/types';
// A project's rows: its tasks (open first, then closed last-first), each opened (an open one shown, a closed one again),
// then New Task.
function projectItems(p: ProjectEntry): MenuItem[] {
  const tasks = [...p.tasks.filter((t) => !t.closed), ...p.tasks.filter((t) => t.closed)];
  return [
    ...tasks.map((t): MenuItem => ({ label: t.name, sub: taskLine(t), title: t.name,
      run: () => (t.closed ? kulisa.invoke('project:open', { id: p.id, task: t.n }) : kulisa.invoke('task:show', `${p.id}/${t.n}`)),
      remove: { label: 'Delete Task…', run: () => (t.closed ? kulisa.invoke('task:delete-closed', { project: p.id, n: t.n }) : kulisa.invoke('task:delete', `${p.id}/${t.n}`)) } })),
    // project:open with no task loads the project (open or not) and makes it a new task; task:new needs it already open.
    '-', { label: 'New Task', icon: 'i-plus', run: () => kulisa.invoke('project:open', { id: p.id }) },
  ];
}
function items(): MenuItem[] {
  const projects = [...store.projects.projects].sort((a, b) => lastWorked(b) - lastWorked(a));
  const rows: MenuItem[] = projects.length === 1 ? projectItems(projects[0]!)
    : projects.map((p) => ({ submenu: p.name, project: { favicon: p.favicon, color: projectColor(p) }, items: projectItems(p),
      run: () => kulisa.invoke('project:open', { id: p.id }) }));
  return [...rows, '-', { label: 'New Project…', icon: 'i-folder-plus', run: () => dialog('newproject').then((d) => d.open()) }];
}
</script>

<template>
  <ButtonMenu :items="items" end>
    <button id="newTask" class="icon" :title="withKeys('New task: a task of any project, new or closed', 'task.menu')" aria-label="New task"><Icon name="i-plus" /></button>
  </ButtonMenu>
</template>
