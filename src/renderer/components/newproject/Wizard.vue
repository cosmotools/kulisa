<script setup lang="ts">
// New Project, step by step (docs/tasks.md, Projects): the steps, the buttons; their state in wizard.ts. At the first
// start under a question each (welcome/: its head, and Back on the first step leaves for the slides before it),
// elsewhere a dialog (NewProject.vue, cancelable).
import CodeStep from './CodeStep.vue';
import AgentStep from './AgentStep.vue';
import ProfilesStep from './ProfilesStep.vue';
import { DialogClose } from 'reka-ui';
import { nextTick, ref } from 'vue';
import { STEPS, provideWizard } from './wizard';

const props = defineProps<{ cancelable?: boolean; leavable?: boolean; single?: boolean }>();
const emit = defineEmits<{ done: []; leave: [] }>();
const w = provideWizard(props.single);
const loaded = w.reset(); // anew each time it is shown: its component is made then
const code = ref<InstanceType<typeof CodeStep>>();
const next = async () => { if (await w.next()) emit('done'); };
const back = () => { if (w.step.value) w.back(); else emit('leave'); };
// The keyboard in its name.
const focus = async () => { await loaded; await nextTick(); code.value?.focus(); }; // drawn the tick after its defaults came
defineExpose({ focus, saving: w.saving });
</script>

<template>
  <form v-if="w.ready.value" id="npform" class="wizard" :class="{ single }" @submit.prevent="next">
    <slot name="head" :step="w.step.value" :count="STEPS.length">
      <ol class="steps" aria-label="Steps">
        <li v-for="(s, i) in STEPS" :key="s" :class="{ now: i === w.step.value, done: i < w.step.value }" :aria-current="i === w.step.value ? 'step' : undefined">
          <span class="n">{{ i + 1 }}</span>{{ s }}</li>
      </ol>
    </slot>
    <CodeStep v-show="w.step.value === 0" ref="code" />
    <AgentStep v-show="w.step.value === 1" />
    <ProfilesStep v-show="w.step.value === 2" />
    <p id="nperror" class="error">{{ w.error.value }}</p>
    <footer>
      <button v-if="w.step.value || leavable" id="npback" type="button" class="start" @click="back">Back</button>
      <DialogClose v-if="cancelable" type="button">Cancel</DialogClose>
      <button id="npcreate" class="primary" :disabled="w.saving.value">{{ w.saving.value ? (w.code.from === 'clone' ? 'Cloning…' : 'Creating…') : w.last.value ? 'Create' : 'Next' }}</button>
    </footer>
  </form>
</template>

<style>
.wizard { flex: 1; display: flex; flex-direction: column; min-height: 0;
  --label: 72px; /* its labels are short (Location: the longest) */
  &.single { --label: 100px; } /* the welcome's: Project name: */
  .steps { display: flex; gap: calc(var(--gap) * 3); margin: 0; padding: var(--inset) var(--pad); list-style: none;
    border-bottom: 1px solid var(--island-hi); color: var(--text-muted);
    li { display: flex; align-items: center; gap: 6px; }
    .n { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; border: 1px solid var(--line); font-size: var(--font-small); }
    .now { color: var(--text-strong); .n { border-color: var(--accent); background: var(--accent); color: var(--on-accent); } }
    .done .n { border-color: var(--accent); color: var(--accent); } }
  .npstep { flex: 1; min-width: 0; padding: var(--pad); overflow: auto; > .hint:first-child { margin-top: 0; } .titled { margin-block: var(--pad) var(--inset); } }
  #nperror { margin: 0 var(--pad) var(--inset); &:empty { display: none; } }
}
</style>
