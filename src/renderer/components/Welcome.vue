<script setup lang="ts">
// The Welcome screen (no project open: at the first start, after the last project is closed), as JetBrains': New
// Project… (also for a folder there already); the tasks, grouped by project (TaskList.vue, as in the bar's Search
// Tasks panel); a project's right-click: Open, Project Settings… (the projects' manager, where it is deleted too).
// Links with Kulisa's version. On one island in the grid's place (text on the project's glow reads badly).
import TaskList from './TaskList.vue';
import RightClickMenu from './menu/RightClickMenu.vue';
import icon from '../../../assets/icon.svg';
import { store } from '../lib/store';
import { LINKS, version } from '../lib/common';
import type { MenuItem } from '../lib/menu';
import { dialog } from '../lib/dialogs';

const open = (id: string) => kulisa.invoke('project:open', { id });
function menu(e: MouseEvent): MenuItem[] | null {
  const id = (e.target as Element).closest<HTMLElement>('[data-project]')?.dataset.project;
  return id ? [{ label: 'Open', run: () => open(id) }, { label: 'Project Settings…', run: () => dialog('projects').then((d) => d.openProjects(id)) }] : null;
}
</script>

<template>
  <section id="welcome">
    <img class="applogo" :src="icon" alt="Kulisa">
    <h2>No project is open</h2>
    <p class="hint">A project is your code (repositories or a folder), the agents that work on it and the profiles they test
      as. Each task is an agent of its own in a copy of the code.</p>
    <div class="start">
      <button id="welcome-new" @click="dialog('projects').then((d) => d.newProject())">New Project…</button>
    </div>
    <h3 v-if="store.projects.projects.length">Tasks</h3>
    <RightClickMenu :items="menu"><TaskList id="welcome-list" /></RightClickMenu>
    <nav class="links">
      <a v-for="l in LINKS" :key="l.href" :href="l.href" target="_blank">{{ l.label }}</a>
      <span id="version">Kulisa {{ version }}</span>
    </nav>
  </section>
</template>

<style>
#welcome { display: none; flex: 1; align-content: center; justify-items: center; gap: var(--gap); padding: var(--gap);
  margin: 0 var(--gap) var(--gap); border-radius: var(--island-radius); background: var(--island);
  .noproject & { display: grid; }
  .applogo { width: 96px; height: 96px; margin-bottom: var(--gap); }
  h2 { margin: 0; font-size: 1.3em; }
  .hint { max-width: 64ch; margin: 0 0 var(--gap); text-align: center; color: var(--text-muted); }
  .start { display: flex; gap: var(--gap); }
  h3 { margin: calc(var(--gap) * 2) 0 0; width: min(480px, 100%); font-size: 1em; color: var(--text-dim); }
  .links { display: flex; flex-wrap: wrap; justify-content: center; gap: calc(var(--gap) * 2); margin-top: calc(var(--gap) * 3);
    color: var(--text-muted);
    a { color: inherit; &:hover { color: var(--text); } } }
}
#welcome-list { width: min(520px, 100%); max-height: 50vh; margin-top: var(--gap); }
</style>
