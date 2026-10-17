<script setup lang="ts">
// What Kulisa does, in three slides, before the first project's steps (Welcome.vue; docs/window.md, The window's pages).
// The pictures are a task's window drawn small in HTML: no pictures to ship, the window's own colors in either theme.
import { computed, ref } from 'vue';
import Icon from '../Icon.vue';
import { avatarSrc } from '../../lib/common';

const emit = defineEmits<{ done: [] }>();
const slide = defineModel<number>({ default: 0 });
const SLIDES = [
  { title: 'Your agent, in your browsers', text: 'Claude Code, Codex or another coding agent works in the terminal, and drives browsers you have signed in to yourself.' },
  { title: 'It checks the result as every user', text: 'An admin, a customer, support: each is a browser profile of its own. The agent builds, checks as each of them, fixes, and goes again until it works.' },
  { title: 'Point at it, and say what is wrong', text: 'Pick an element in a page, and the agent knows exactly which one you mean. Watch it work, or take a break.' },
];
const now = computed(() => SLIDES[slide.value]!);
const last = computed(() => slide.value === SLIDES.length - 1);
const PANES = [{ name: 'Admin', avatar: 'owl' }, { name: 'Customer', avatar: 'fox' }];
const next = ref<HTMLButtonElement>();
const forward = () => { if (last.value) emit('done'); else slide.value++; };
defineExpose({ focus: () => next.value?.focus() });
</script>

<template>
  <div id="tour" :data-slide="slide">
    <div class="slide">
      <div class="words">
        <h1>{{ now.title }}</h1>
        <p class="lead">{{ now.text }}</p>
      </div>
      <!-- A task: its agent's terminal, two profiles' panes -->
      <div class="picture" aria-hidden="true">
        <div class="term">
          <div><Icon name="i-agent-claude" /> claude</div>
          <div class="said">&gt; does the checkout work for every user?</div>
          <div :class="{ on: slide >= 1 }" class="step">⏺ Checking as Admin…</div>
          <div :class="{ on: slide >= 1 }" class="step">⏺ Checking as Customer…</div>
          <div :class="{ on: slide >= 1 }" class="step ok">✓ Fixed: works for both</div>
        </div>
        <div v-for="(p, i) in PANES" :key="p.name" class="pane" :class="{ checked: slide === 1 }">
          <div class="head"><img :src="avatarSrc(p.avatar)" alt="">{{ p.name }}</div>
          <div class="page"><i /><i class="short" /><i class="button" :class="{ picked: slide === 2 && i === 1 }" /><i class="shorter" /></div>
        </div>
        <Icon v-if="slide === 2" name="i-pick" class="pointer" />
      </div>
    </div>
    <footer>
      <ol class="dots" aria-label="Slides">
        <li v-for="(s, i) in SLIDES" :key="s.title" :class="{ on: i <= slide }" :aria-current="i === slide ? 'step' : undefined"><span class="sr">{{ s.title }}</span></li>
      </ol>
      <button id="tourskip" type="button" @click="emit('done')">Skip</button>
      <button v-if="slide" id="tourback" type="button" @click="slide--">Back</button>
      <button id="tournext" ref="next" type="button" class="primary" @click="forward">{{ last ? 'Set Up a Project' : 'Next' }}</button>
    </footer>
  </div>
</template>

<style>
#tour { display: flex; flex-direction: column; gap: calc(var(--pad) * 2); width: min(960px, 100%);
  .slide { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); gap: calc(var(--pad) * 2); align-items: center; }
  .words { display: grid; gap: var(--pad); min-width: 0; }
  h1 { margin: 0; font-size: var(--font-hero); line-height: 1.15; font-weight: 600; letter-spacing: -.02em; color: var(--text-strong); text-wrap: balance; }
  .lead { margin: 0; font-size: var(--font-lead); line-height: 1.5; color: var(--text-dim); max-width: 42ch; }
  .picture { position: relative; display: grid; grid-template-columns: 1.1fr 1fr 1fr; gap: 6px; aspect-ratio: 16 / 10; padding: 6px;
    border-radius: var(--island-radius); background: var(--window); border: 1px solid var(--line); box-shadow: 0 12px 40px var(--shadow); min-width: 0;
    /* no taller than the window leaves it (its title bar, the welcome's padding, the buttons): in a low window the
       slide fits, smaller, rather than scrolls */
    justify-self: center; width: min(100%, (100vh - 200px) * 1.6); }
  .term { display: grid; align-content: start; gap: 4px; padding: var(--gap); border-radius: 6px; background: var(--island); min-width: 0; overflow: hidden;
    font: var(--font-small) / 1.4 ui-monospace, monospace; color: var(--text-dim);
    svg { width: 12px; height: 12px; vertical-align: -1px; }
    .said { color: var(--text-strong); }
    .step { opacity: 0; transition: opacity .4s ease; &.on { opacity: 1; } &:nth-child(4) { transition-delay: .3s; } &:nth-child(5) { transition-delay: .6s; } }
    .ok { color: var(--done); } }
  .pane { display: grid; grid-template-rows: auto 1fr; border-radius: 6px; overflow: hidden; background: var(--page); min-width: 0;
    outline: 2px solid transparent; outline-offset: -2px; transition: outline-color .4s ease;
    &.checked { outline-color: var(--agent); }
    .head { display: flex; align-items: center; gap: 4px; padding: 3px 6px; background: var(--island-hi); color: var(--text); font-size: var(--font-small);
      img { width: 14px; height: 14px; } }
    .page { display: grid; align-content: start; gap: 6px; padding: var(--gap);
      i { height: 6px; border-radius: 3px; background: color-mix(in srgb, var(--text-muted) 25%, var(--page)); }
      .short { width: 70%; } .shorter { width: 45%; }
      .button { width: 55%; height: 14px; background: var(--accent); outline: 2px solid transparent; outline-offset: 2px; transition: outline-color .3s ease; }
      .picked { outline-color: var(--note); } } }
  .pointer { position: absolute; right: 18%; top: 44%; width: 22px; height: 22px; color: var(--note); }
  footer { display: flex; align-items: center; gap: var(--gap); button { min-width: 80px; } .dots { margin-inline-end: auto; } }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  /* Narrow: the picture under the words; narrow and low as well: the words alone, the picture would not fit */
  @media (max-width: 720px) { .slide { grid-template-columns: minmax(0, 1fr); } }
  @media (max-width: 720px) and (max-height: 640px) { .picture { display: none; } }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
}
</style>
