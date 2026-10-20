<script setup lang="ts">
// The idea of a task's team, for a newcomer (the welcome's step Team only; the author, 2026-10-20): a builder and a
// checker, a message going between them, their states changing; Learn more, the guide on kulisa.app. Drawn in HTML,
// as the welcome's slides (Tour.vue); still with reduced motion, the message halfway.
import Icon from '../Icon.vue';
import { LINKS } from '../../lib/common';

const docs = LINKS.find((l) => l.icon === 'i-docs')!.href;
</script>

<template>
  <figure id="teamscene" aria-label="A task's team: a builder and a checker, messaging each other">
    <div class="scene" aria-hidden="true">
      <div class="card builder"><Icon name="i-agent-claude" /><b>Builder</b><small>builds the feature</small>
        <span class="state" data-state="working"><Icon name="i-working" /></span></div>
      <div class="line"><span class="note">Found a bug on the checkout: the total is off</span></div>
      <div class="card checker"><Icon name="i-agent-codex" /><b>Checker</b><small>checks as every user</small>
        <span class="state" data-state="done"><Icon name="i-done" /></span></div>
    </div>
    <figcaption>A task can have a team: a builder, a checker, a reviewer… They message each other while you watch.
      <a :href="docs" target="_blank">Learn more</a></figcaption>
  </figure>
</template>

<style>
#teamscene { margin: 0 0 var(--inset); display: grid; gap: var(--inset);
  .scene { position: relative; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: var(--gap);
    padding: var(--inset) var(--pad); border-radius: var(--island-radius); background: var(--window); }
  .card { display: grid; grid-template-columns: auto auto; column-gap: 6px; align-items: center; padding: 6px var(--inset);
    border: 1px solid var(--line); border-radius: var(--radius); background: var(--island);
    > svg { width: 16px; height: 16px; } small { grid-column: 1 / -1; color: var(--text-muted); font-size: var(--font-small); }
    .state { grid-column: 1 / -1; justify-self: start; } }
  .line { position: relative; height: 2px; background: color-mix(in srgb, var(--line) 70%, transparent); }
  .note { position: absolute; top: 50%; left: 0; translate: 0 -50%; padding: 2px 8px; border-radius: 999px; white-space: nowrap;
    background: var(--accent); color: var(--on-accent); font-size: var(--font-small); animation: teamnote 4s ease-in-out infinite alternate; }
  .builder .state { animation: teamstate 8s step-end infinite; }
  figcaption { color: var(--text-dim); a { color: var(--accent); } }
}
/* The message flies from the checker to the builder and back, as their talk goes (the line's width: its parent's). */
@keyframes teamnote { from { left: 100%; translate: -100% -50%; } to { left: 0; translate: 0 -50%; } }
@keyframes teamstate { 50% { opacity: .5; } }
@media (prefers-reduced-motion: reduce) { #teamscene .note { animation: none; left: 50%; translate: -50% -50%; } #teamscene .builder .state { animation: none; } }
</style>
