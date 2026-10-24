<script setup lang="ts">
// The first start, no project at all (docs/window.md, The window's pages): what Kulisa does (Tour.vue), then New
// Project's own steps (newproject/), a question each, the window's glow behind them (App.vue). The first thing a new
// user meets; a tasks' window's New Project stays a plain dialog.
import { nextTick, ref } from 'vue';
import Tour from './Tour.vue';
import Wizard from '../newproject/Wizard.vue';

const QUESTIONS = ['Where is the code?', 'Who writes the code?', 'Who uses your app?'];
const steps = ref(false), slide = ref(0);
const tour = ref<InstanceType<typeof Tour>>(), wizard = ref<InstanceType<typeof Wizard>>();
async function focus() { await nextTick(); if (steps.value) await wizard.value?.focus(); else tour.value?.focus(); }
const show = async (on: boolean) => { steps.value = on; await focus(); };
kulisa.on('project:new', () => void focus()); // the first start: the keyboard here
</script>

<template>
  <div id="welcome">
    <Tour v-if="!steps" ref="tour" v-model="slide" @done="show(true)" />
    <div v-else class="box">
      <Wizard ref="wizard" leavable single @leave="show(false)">
        <template #head="{ step, count }">
          <header class="question">
            <ol class="dots" aria-label="Steps"><li v-for="n in count" :key="n" :class="{ on: n <= step + 1 }" /></ol>
            <h1>{{ QUESTIONS[step] }}</h1>
          </header>
        </template>
      </Wizard>
    </div>
  </div>
</template>

<style>
#welcome { display: grid; place-items: safe center; width: 100%; min-height: 100%; padding: calc(var(--pad) * 2); box-sizing: border-box;
  /* New Project's steps: a dialog's look, no backdrop: nothing else is in the window to cover */
  .box { display: flex; flex-direction: column; width: min(760px, 100%); min-height: min(520px, 100%); border-radius: var(--island-radius);
    background: var(--island); border: 1px solid var(--line); box-shadow: 0 12px 40px var(--shadow); overflow: hidden; }
  .question { display: grid; gap: var(--inset); padding: calc(var(--pad) * 1.5) var(--pad) var(--inset);
    h1 { margin: 0; font-size: var(--font-hero); line-height: 1.15; font-weight: 600; letter-spacing: -.02em; color: var(--text-strong); } }
}
</style>
