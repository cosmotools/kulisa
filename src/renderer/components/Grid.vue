<script setup lang="ts">
// The grid of the shown task (lib/grid.ts; docs/window.md, The grid). A profile's page is a native view over its pane's
// .content, rounded in profiles.ts (PAGE_RADIUS).
import { markRaw } from 'vue';
import { DockviewVue, themeAbyssSpaced, type IDockviewVueProps } from 'dockview-vue';
import 'dockview-vue/dist/styles/dockview.css';
import ProfilePane from './grid/ProfilePane.vue';
import ProfileHeader from './grid/ProfileHeader.vue';
import Terminals from './grid/Terminals.vue';
import TerminalTabs from './grid/TerminalTabs.vue';
import ClosedProfiles from './grid/ClosedProfiles.vue';
import Resources from './Resources.vue';
import ResourcesTab from './ResourcesTab.vue';
import { gridMounted } from '../lib/grid';

// dockview takes the gap between panels as a number: tokens.css's --gap, loaded before the window mounts (main.ts).
const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap'));
const theme = { ...themeAbyssSpaced, name: 'kulisa', gap };
const components = markRaw({ profile: ProfilePane, terminal: Terminals, resources: Resources }) as unknown as IDockviewVueProps['components']; // dockview-vue types its components as option objects
const tabComponents = markRaw({ profile: ProfileHeader, terminal: TerminalTabs, resources: ResourcesTab }) as unknown as IDockviewVueProps['tabComponents'];
</script>

<template>
  <main id="dock">
    <ClosedProfiles />
    <DockviewVue id="grid" :theme :disable-floating-groups="true" single-tab-mode="fullwidth" :components :tab-components="tabComponents"
      @ready="(e) => gridMounted(e.api)" />
  </main>
</template>

<style>
#dock {
  /* min-width: a row wider than the window (many closed profiles over the terminal) would stretch the window's column,
     the terminal and the tasks' bar past its edge */
  display: flex; flex-direction: column; min-width: 0; margin-inline: var(--gap); transition: opacity .15s;
  #grid { flex: 1; min-height: 0; }
  .loading & { opacity: 0; transition: none; } /* until the grid is laid out (lib/grid.ts, reveal) */
  .noproject & { display: none; }
  .dockview-theme-abyss-spaced {
    color-scheme: inherit; /* the theme's own is dark; Kulisa's is the root's (tokens.css: light-dark()) */
    --dv-group-view-background-color: var(--island);
    --dv-tabs-and-actions-container-background-color: var(--island); --dv-tabs-and-actions-container-height: 36px; --dv-tab-font-size: var(--font);
    /* One color per island: a lone panel's header is not a separate chip; stacked panels show the chosen one. */
    --dv-activegroup-visiblepanel-tab-background-color: transparent; --dv-inactivegroup-visiblepanel-tab-background-color: transparent;
    --dv-activegroup-hiddenpanel-tab-background-color: transparent; --dv-inactivegroup-hiddenpanel-tab-background-color: transparent;
    --dv-activegroup-hiddenpanel-tab-color: var(--text-muted); --dv-inactivegroup-hiddenpanel-tab-color: var(--text-muted);
    --dv-activegroup-visiblepanel-tab-color: var(--text-strong); --dv-inactivegroup-visiblepanel-tab-color: var(--text);
    --dv-tab-divider-color: transparent; --dv-separator-border: transparent;
    --dv-border-radius: var(--island-radius); --dv-tab-border-radius: var(--radius); --dv-tab-margin: 4px 2px; --dv-spacing-padding: 0px;
    --dv-active-sash-color: var(--accent); --dv-drag-over-background-color: color-mix(in srgb, var(--accent) 25%, transparent);
  }
  :is(.dockview-theme-abyss-spaced, .dv-dockview) { background: transparent; }
  .dv-tabs-container:has(.dv-tab + .dv-tab) .dv-active-tab { background: var(--island-hi); }
  .dv-tabs-and-actions-container { padding-inline: 0; } /* the header's own (.ptab) sets the inset */
  view-transition-name: grid;
  :active-view-transition & { transition: none; } /* the next grid comes in sliding, not fading */
}
/* Switching (lib/grid.ts, grid:closing): the grid slides towards the next task's tab, as macOS desktops do (types
   next and previous say which way). Pictures, so the compositor moves them. */
/* Longhands: Vite's CSS minifier (Lightning CSS) made the shorthand with no name `animation: none`, and nothing slid.
   Material's standard easing: an ease-out (.2, .8, .2, 1) crept over its last few percent, the grid going out lingering
   at the window's edge. */
::view-transition-old(grid), ::view-transition-new(grid) {
  animation-duration: .3s; animation-timing-function: cubic-bezier(.4, 0, .2, 1); animation-fill-mode: both; mix-blend-mode: normal; }
:active-view-transition-type(next) {
  &::view-transition-old(grid) { animation-name: grid-to-left; }
  &::view-transition-new(grid) { animation-name: grid-from-right; } }
:active-view-transition-type(previous) {
  &::view-transition-old(grid) { animation-name: grid-to-right; }
  &::view-transition-new(grid) { animation-name: grid-from-left; } }
/* Its width and the window's margin (#dock's): by its width alone, its edge stayed in the margin, a strip of the page. */
@keyframes grid-to-left { to { translate: calc(-100% - var(--gap)) 0; } }
@keyframes grid-from-right { from { translate: calc(100% + var(--gap)) 0; } }
@keyframes grid-to-right { to { translate: calc(100% + var(--gap)) 0; } }
@keyframes grid-from-left { from { translate: calc(-100% - var(--gap)) 0; } }

/* A panel's header: a profile's picture, name, the agent's caption, ×. Everything in a
   panel keeps --gap from the island's edges: the header's picture and ×, the tabs, the toolbar's first and last button,
   the page (dockview's tab has a margin of 2px, --dv-tab-margin). */
.ptab { display: flex; align-items: center; gap: 6px; height: 100%; padding: 0 calc(var(--gap) - 2px); min-width: 0; }
</style>
