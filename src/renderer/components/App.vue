<script setup lang="ts">
// A Kulisa window (docs/window.md): the title bar, the shown task's grid (or the Welcome screen with no project open),
// the projects' bar under it or over it, the dialogs and the menu.
import Sprite from './Sprite.vue';
import TopBar from './TopBar.vue';
import Grid from './Grid.vue';
import ProjectBar from './ProjectBar.vue';
import Welcome from './Welcome.vue';
import ProfileEditor from './ProfileEditor.vue';
import ProjectEditor from './ProjectEditor.vue';
import TaskRename from './TaskRename.vue';
import AgentPicker from './AgentPicker.vue';
import Agents from './Agents.vue';
import Shortcuts from './Shortcuts.vue';
import Ask from './Ask.vue';
import Menu from './Menu.vue';
</script>

<template>
  <Sprite />
  <TopBar />
  <Grid />
  <ProjectBar />
  <Welcome />
  <ProfileEditor />
  <ProjectEditor />
  <TaskRename />
  <AgentPicker />
  <Agents />
  <Shortcuts />
  <Ask />
  <Menu />
</template>

<style>
/* The window never scrolls, also not from a script (scrollIntoView): body clips what reaches past it, such as a panel
   kept behind another (dockview keeps it laid out below the grid). body's own overflow would pass to the window, which
   cannot clip and takes it as hidden (scrollable from a script); html's own keeps body's. */
html { height: 100%; overflow: hidden; }
/* The project's color as a round glow from the middle of the window: seen in the title bar and the gaps between the
   islands, fading towards the edges. */
body {
  margin: 0; height: 100%; overflow: clip; display: flex; flex-direction: column;
  font: var(--font) system-ui, sans-serif; color: var(--text);
  user-select: none; cursor: default; /* a desktop app: labels and buttons are not text to select; fields are */
  background: radial-gradient(circle, color-mix(in srgb, var(--project) 60%, transparent), transparent 90%) var(--window);
}
/* The parts lay out in body's column */
#app { display: contents; }
</style>
