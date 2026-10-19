<script setup lang="ts">
// A Kulisa window (docs/window.md).
import Sprite from './Sprite.vue';
import TopBar from './TopBar.vue';
import Grid from './Grid.vue';
import TaskBar from './TaskBar.vue';
import Empty from './Empty.vue';
import NewProject from './newproject/NewProject.vue';
import TaskRename from './TaskRename.vue';
import AgentPicker from './AgentPicker.vue';
import HandOver from './HandOver.vue';
import Shortcuts from './Shortcuts.vue';
import Ask from './Ask.vue';
import PointMenu from './menu/PointMenu.vue';
import { Thumbnail, thumbnailMenu } from '../../screenshots/renderer';
import { menuAtPoint } from '../lib/menu';
import { store } from '../lib/store';

thumbnailMenu(menuAtPoint);
</script>

<template>
  <Sprite />
  <div id="glow" aria-hidden="true"><i /><i /><i /></div>
  <!-- The tasks' bar in the title bar, as a browser's tabs, or under the grid (☰ → Tasks bar: Top, Bottom); none with
       no task open: no tab, and its + would show the board the window shows already -->
  <TopBar><TaskBar v-if="store.bar === 'top' && store.current !== null" /></TopBar>
  <Grid />
  <Empty />
  <TaskBar v-if="store.bar !== 'top' && store.current !== null" />
  <NewProject />
  <TaskRename />
  <AgentPicker />
  <HandOver />
  <Shortcuts />
  <Ask />
  <Thumbnail />
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
   to it (the author, 2026-10-14: a gap of the title bar's and one of the grid's added up, and showed). */
body {
  margin: 0; height: 100%; overflow: clip; box-sizing: border-box;
  display: grid; grid-template-rows: auto minmax(0, 1fr) auto; padding-block-end: var(--gap);
  font: var(--font) var(--sans); color: var(--text);
  user-select: none; cursor: default; /* a desktop app: labels and buttons are not text to select; fields are */
  background: var(--window);
}
/* The shown task's project's color as a glow, seen in the title bar and the gaps between the islands, fading towards
   the edges; only while a task is shown (a new tab over it too), coming and going softly, and from one project's color
   to the next as another task is shown (the author, 2026-10-17). A blot, never a circle: three soft spots of it, each
   its own size, off the middle, stretched, drifting and turning at its own pace (19, 27, 37 s: they never line up into
   a circle again), so their sum keeps changing shape. Only their transform moves (the compositor's work, no paint, no
   blur), five times a second: at the screen's rate the window with a task's grid over it cost 11 % of a core (the GPU's
   process 9, the window's 2), all the time a task is shown; ten times a second 7 %; five times 2.3 % (2026-10-17), a
   step a few pixels of a soft edge. Still with reduced motion. At the first start (the welcome) it is Kulisa's own
   red, until the first task's project's color takes its place. */
@property --glow { syntax: '<color>'; inherits: true; initial-value: transparent; }
:root { transition: --glow .8s ease; }
#glow { position: fixed; inset: 0; z-index: -1; pointer-events: none; opacity: 0; transition: opacity .8s ease;
  :root:is([data-page="task"], [data-page="newtab"], [data-page="welcome"]) & { opacity: 1; }
  :root[data-page="welcome"] & { --glow: var(--project); }
  /* steps(n): a fifth of a second each, n = a quarter of its cycle (its keyframes' spans) × 5 */
  i { position: absolute; left: 50%; top: 50%; width: 90vmax; height: 90vmax; will-change: transform;
    background: radial-gradient(closest-side, color-mix(in srgb, var(--glow) 38%, transparent), transparent);
    animation: blot-a 19s steps(24) infinite alternate; }
  i:nth-child(2) { width: 70vmax; height: 70vmax; animation: blot-b 27s steps(34) infinite alternate; }
  i:nth-child(3) { width: 55vmax; height: 55vmax; animation: blot-c 37s steps(46) infinite alternate; }
}
@keyframes blot-a {
  0% { transform: translate(-50%, -50%) translate(-16vw, -10vh) rotate(0deg) scale(1.3, .8); }
  25% { transform: translate(-50%, -50%) translate(-8vw, 4vh) rotate(25deg) scale(1.05, 1); }
  50% { transform: translate(-50%, -50%) translate(4vw, 12vh) rotate(50deg) scale(.85, 1.2); }
  75% { transform: translate(-50%, -50%) translate(12vw, 4vh) rotate(10deg) scale(1, 1.05); }
  100% { transform: translate(-50%, -50%) translate(14vw, -6vh) rotate(-30deg) scale(1.2, .9); }
}
@keyframes blot-b {
  0% { transform: translate(-50%, -50%) translate(18vw, 12vh) rotate(0deg) scale(.8, 1.3); }
  25% { transform: translate(-50%, -50%) translate(4vw, 10vh) rotate(-30deg) scale(1, 1.05); }
  50% { transform: translate(-50%, -50%) translate(-12vw, 4vh) rotate(-60deg) scale(1.25, .85); }
  75% { transform: translate(-50%, -50%) translate(-10vw, -8vh) rotate(-20deg) scale(1.05, 1); }
  100% { transform: translate(-50%, -50%) translate(-4vw, -16vh) rotate(25deg) scale(.9, 1.15); }
}
@keyframes blot-c {
  0% { transform: translate(-50%, -50%) translate(2vw, -18vh) rotate(0deg) scale(1.2, .75); }
  25% { transform: translate(-50%, -50%) translate(14vw, -8vh) rotate(35deg) scale(1, 1); }
  50% { transform: translate(-50%, -50%) translate(20vw, 6vh) rotate(70deg) scale(.8, 1.3); }
  75% { transform: translate(-50%, -50%) translate(2vw, 12vh) rotate(15deg) scale(.95, 1.1); }
  100% { transform: translate(-50%, -50%) translate(-18vw, 14vh) rotate(-45deg) scale(1.1, 1); }
}
@media (prefers-reduced-motion: reduce) { #glow i { animation: none; transform: translate(-50%, -50%); } }
/* The parts lay out in body's column; the grid and what is shown in its place (Empty.vue) in one cell: a new tab lies
   over the task's grid */
#app { display: contents; }
:is(#dock, #empty) { grid-row: 2; grid-column: 1; }
</style>
