<script setup lang="ts">
// The Welcome screen (no project open: at the first start, after the last project is closed), as JetBrains': New
// Project… (also for a folder there already); the tasks, grouped by project (the author, 2026-10-11: the bar's tabs
// are tasks, so what is opened from here is a task): each project's heading in its color (a click opens it as it was
// left), its tasks under it (those open when it was closed, then the closed ones, the one closed last first; a click
// opens the project on that task), New Task for one with none; a project's right-click: Open, Project Settings… (the
// projects' manager, where it is deleted too). Links with Kulisa's version. On one island in the grid's place (text on
// the project's glow reads badly).
import ProjectIcon from './ProjectIcon.vue';
import RightClickMenu from './menu/RightClickMenu.vue';
import icon from '../../../assets/icon.svg';
import { store } from '../lib/store';
import { LINKS, version } from '../lib/common';
import type { MenuItem } from '../lib/menu';
import type { ProjectTask } from '../types';
import { dialog } from '../lib/dialogs';

const open = (id: string, task?: number) => kulisa.invoke('project:open', { id, task });
const about = (t: ProjectTask) => [t.branch !== t.name && t.branch, t.closed && 'closed', t.merged && 'merged'].filter(Boolean).join(' · ');
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
    <RightClickMenu :items="menu"><div id="welcome-list">
      <section v-for="p in store.projects.projects" :key="p.id" class="wgroup" :data-project="p.id" :style="{ '--color': p.color }">
        <button class="item wproject" :title="p.folder" @click="open(p.id)"><ProjectIcon :p /><span class="text"><span class="label">{{ p.name }}</span></span></button>
        <button v-for="t in p.tasks" :key="t.n" class="item wtask" :class="{ closed: t.closed }" :data-task="t.n" @click="open(p.id, t.n)"><span
          class="text"><span class="label">{{ t.name }}</span><small>{{ about(t) }}</small></span></button>
        <button v-if="!p.tasks.length" class="item wtask wnew" @click="open(p.id)"><span class="text"><span class="label">New Task</span><small>No tasks yet</small></span></button>
      </section>
    </div></RightClickMenu>
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
/* The tasks, grouped by project: each project's heading in its color, its tasks under it, set in to its name; rows
   as a menu's but roomier; the list scrolls when it is long */
#welcome-list { display: flex; flex-direction: column; gap: var(--gap); width: min(520px, 100%); max-height: 50vh; overflow: auto;
  margin-top: var(--gap);
  .wgroup { display: flex; flex-direction: column; gap: 2px; }
  .item { gap: 12px; padding: 8px 14px; .text { gap: 3px; } }
  .wproject .label { color: var(--text-strong); font-weight: 600; }
  .wtask { padding-inline-start: calc(14px + 20px + 12px); .label { color: var(--text-strong); } &.closed .label { color: var(--text); } }
  .wnew .label { color: var(--text-dim); }
  .picon { flex: none; width: 20px; height: 20px; color: var(--color); }
}
</style>
