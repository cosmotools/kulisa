<script setup lang="ts">
// The first start, no project at all (docs/tasks.md, The window's pages): what Kulisa does (Tour.vue), then New
// Project's own steps (newproject/), a question each. The first thing a new
// user meets; a tasks' window's New Project stays a plain dialog.
import { nextTick, ref } from 'vue';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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
  <div id="welcome" class="grid min-h-full w-full place-items-center-safe p-8">
    <Tour v-if="!steps" ref="tour" v-model="slide" @done="show(true)" />
    <!-- New Project's steps: a dialog's look, no backdrop: nothing else is in the window to cover -->
    <Card v-else class="min-h-[min(32rem,100%)] w-full max-w-3xl">
      <CardContent class="flex flex-1 flex-col">
        <Wizard ref="wizard" leavable single @leave="show(false)">
          <template #head="{ step, count }">
            <header class="flex flex-col gap-4">
              <Progress :model-value="((step + 1) / count) * 100" aria-label="Steps" />
              <CardTitle><h1 class="text-2xl">{{ QUESTIONS[step] }}</h1></CardTitle>
            </header>
          </template>
        </Wizard>
      </CardContent>
    </Card>
  </div>
</template>
