<script setup lang="ts">
// A Kulisa window (docs/window.md).
import Sprite from './Sprite.vue';
import TopBar from './TopBar.vue';
import Grid from './Grid.vue';
import TaskBar from './TaskBar.vue';
import Empty from './Empty.vue';
import ProjectEditor from './ProjectEditor.vue';
import NewProject from './NewProject.vue';
import TaskRename from './TaskRename.vue';
import AgentPicker from './AgentPicker.vue';
import HandOver from './HandOver.vue';
import Shortcuts from './Shortcuts.vue';
import Ask from './Ask.vue';
import PointMenu from './menu/PointMenu.vue';
import { store } from '../lib/store';
</script>

<template>
  <Sprite />
  <!-- The tasks' bar in the title bar, as a browser's tabs, or under the grid (☰ → Tasks bar: Top, Bottom) -->
  <TopBar><TaskBar v-if="store.bar === 'top'" /></TopBar>
  <Grid />
  <Empty />
  <TaskBar v-if="store.bar !== 'top'" />
  <ProjectEditor />
  <NewProject />
  <TaskRename />
  <AgentPicker />
  <HandOver />
  <Shortcuts />
  <Ask />
  <PointMenu />
</template>

<style>
/* The window never scrolls, also not from a script (scrollIntoView): body clips what reaches past it, such as a panel
   kept behind another (dockview keeps it laid out below the grid). body's own overflow would pass to the window, which
   cannot clip and takes it as hidden (scrollable from a script); html's own keeps body's. */
html { height: 100%; overflow: hidden; }
/* The window: a grid of rows: the title bar, the grid (or the empty window's island), the tasks' bar when it is
   under the grid. One gap, --gap: the title bar holds it above and below what is in it (its height, --title in
   tokens.css: its buttons, or the tasks' tabs), so the grid starts at its edge; the grid keeps it from the sides; the
   bar keeps it from the grid (TaskBar.vue) and the window's bottom edge keeps it from the last row. Nothing else adds
   to it (the author, 2026-10-14: a gap of the title bar's and one of the grid's added up, and showed). The project's
   color as a round glow from the middle of the window: seen in the title bar and the gaps between the islands, fading
   towards the edges. */
body {
  margin: 0; height: 100%; overflow: clip; box-sizing: border-box;
  display: grid; grid-template-rows: auto minmax(0, 1fr) auto; padding-block-end: var(--gap);
  font: var(--font) var(--sans); color: var(--text);
  user-select: none; cursor: default; /* a desktop app: labels and buttons are not text to select; fields are */
  background: radial-gradient(circle, color-mix(in srgb, var(--project) 60%, transparent), transparent 90%) var(--window);
}
/* The parts lay out in body's column */
#app { display: contents; }
</style>
