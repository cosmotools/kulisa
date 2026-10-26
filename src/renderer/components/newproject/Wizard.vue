<script setup lang="ts">
// New Project, step by step (docs/tasks.md, Projects): the steps, the buttons; their state in wizard.ts. At the first
// start under a question each (welcome/: its head, and Back on the first step leaves for the slides before it),
// elsewhere a dialog (NewProject.vue, cancelable). A step done is gone back to from the steps; the next one only by Next,
// which checks this one.
import CodeStep from './CodeStep.vue';
import AgentStep from './AgentStep.vue';
import ProfilesStep from './ProfilesStep.vue';
import { Button } from '@/components/ui/button';
import { DialogClose } from '@/components/ui/dialog';
import { FieldError } from '@/components/ui/field';
import { Stepper, StepperIndicator, StepperItem, StepperSeparator, StepperTitle, StepperTrigger } from '@/components/ui/stepper';
import { nextTick, ref } from 'vue';
import { STEPS, provideWizard } from './wizard';

const props = defineProps<{ cancelable?: boolean; leavable?: boolean; single?: boolean }>();
const emit = defineEmits<{ done: []; leave: [] }>();
const w = provideWizard(props.single);
const loaded = w.reset(); // anew each time it is shown: its component is made then
const code = ref<InstanceType<typeof CodeStep>>();
const next = async () => { if (await w.next()) emit('done'); };
const back = () => { if (w.step.value) w.back(); else emit('leave'); };
const toStep = (n: number) => { while (w.step.value > n - 1) w.back(); };
// The keyboard in its name.
const focus = async () => { await loaded; await nextTick(); code.value?.focus(); }; // drawn the tick after its defaults came
defineExpose({ focus, saving: w.saving });
</script>

<template>
  <form v-if="w.ready.value" id="npform" class="flex min-h-0 flex-1 flex-col gap-4" @submit.prevent="next">
    <slot name="head" :step="w.step.value" :count="STEPS.length">
      <Stepper :model-value="w.step.value + 1" aria-label="Steps" class="items-center" @update:model-value="(n) => n && toStep(n)">
        <StepperItem v-for="(s, i) in STEPS" :key="s" :step="i + 1" :completed="i < w.step.value" :disabled="i > w.step.value">
          <StepperTrigger class="flex-row gap-2" type="button">
            <StepperIndicator>{{ i + 1 }}</StepperIndicator>
            <StepperTitle>{{ s }}</StepperTitle>
          </StepperTrigger>
          <StepperSeparator v-if="i < STEPS.length - 1" class="h-px w-8" />
        </StepperItem>
      </Stepper>
    </slot>
    <CodeStep v-show="w.step.value === 0" ref="code" />
    <AgentStep v-show="w.step.value === 1" />
    <ProfilesStep v-show="w.step.value === 2" />
    <FieldError id="nperror" class="empty:hidden">{{ w.error.value }}</FieldError>
    <footer class="mt-auto flex justify-end gap-2">
      <Button v-if="w.step.value || leavable" id="npback" type="button" variant="outline" class="mr-auto" @click="back">Back</Button>
      <DialogClose v-if="cancelable" as-child><Button type="button" variant="outline">Cancel</Button></DialogClose>
      <Button id="npcreate" type="submit" :disabled="w.saving.value">
        {{ w.saving.value ? (w.code.from === 'clone' ? 'Cloning…' : 'Creating…') : w.last.value ? 'Create' : 'Next' }}</Button>
    </footer>
  </form>
</template>
