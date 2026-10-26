<script setup lang="ts">
// What Kulisa does, in three slides, before the first project's steps (Welcome.vue; docs/tasks.md, The window's pages).
// The pictures are a task's window drawn small of the window's own parts: no pictures to ship, its colors in either theme.
import { computed, ref } from 'vue';
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { avatarSrc } from '../../lib/common';
import { SquareMousePointerIcon } from '@lucide/vue';
import ClaudeMark from '../marks/ClaudeMark.vue';

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
const next = ref<{ $el: HTMLButtonElement }>(); // shadcn-vue's Button
const forward = () => { if (last.value) emit('done'); else slide.value++; };
defineExpose({ focus: () => next.value?.$el.focus() });
</script>

<template>
  <div id="tour" class="flex w-full max-w-5xl flex-col gap-12" :data-slide="slide">
    <!-- Narrow: the picture under the words; narrow and low as well: the words alone, the picture would not fit -->
    <div class="grid items-center gap-12 md:grid-cols-[1fr_1.15fr]">
      <div class="flex flex-col gap-4">
        <h1 class="text-4xl font-semibold tracking-tight text-balance">{{ now.title }}</h1>
        <p class="max-w-prose text-lg text-muted-foreground">{{ now.text }}</p>
      </div>
      <!-- A task: its agent's terminal, two profiles' panes; no taller than the window leaves it -->
      <div class="relative grid aspect-16/10 w-[min(100%,(100vh-200px)*1.6)] grid-cols-[1.1fr_1fr_1fr] gap-2 justify-self-center rounded-xl border bg-muted p-2 shadow-lg
        max-md:[@media(max-height:40rem)]:hidden" aria-hidden="true">
        <Card size="sm" class="gap-1 px-3 font-mono text-xs text-muted-foreground">
          <div class="flex items-center gap-1"><ClaudeMark class="size-3" /> claude</div>
          <div class="text-foreground">&gt; does the checkout work for every user?</div>
          <div v-for="(line, i) in ['⏺ Checking as Admin…', '⏺ Checking as Customer…', '✓ Fixed: works for both']" :key="line" :data-on="slide >= 1 || undefined"
            class="opacity-0 transition-opacity duration-500 last:text-green-500 data-on:opacity-100 motion-reduce:transition-none" :class="['delay-0', 'delay-300', 'delay-600'][i]">{{ line }}</div>
        </Card>
        <Card v-for="(p, i) in PANES" :key="p.name" size="sm" class="gap-2 transition-shadow duration-500" :class="{ 'ring-2 ring-primary': slide === 1 }">
          <CardHeader class="flex items-center gap-1.5"><Avatar class="size-4"><AvatarImage :src="avatarSrc(p.avatar)" alt="" /></Avatar><CardTitle class="text-xs">{{ p.name }}</CardTitle></CardHeader>
          <CardContent class="flex flex-col gap-2">
            <Skeleton class="h-2 animate-none" /><Skeleton class="h-2 w-2/3 animate-none" />
            <Button as="span" size="xs" class="w-1/2" :class="{ 'ring-2 ring-amber-500 ring-offset-2 ring-offset-card': slide === 2 && i === 1 }" />
            <Skeleton class="h-2 w-1/2 animate-none" />
          </CardContent>
        </Card>
        <SquareMousePointerIcon v-if="slide === 2" class="absolute top-[44%] right-[18%] size-6 text-amber-500" />
      </div>
    </div>
    <footer class="flex items-center gap-2">
      <Progress :model-value="((slide + 1) / SLIDES.length) * 100" aria-label="Slides" class="mr-auto w-24" />
      <Button id="tourskip" variant="ghost" @click="emit('done')">Skip</Button>
      <Button v-if="slide" id="tourback" variant="outline" @click="slide--">Back</Button>
      <Button id="tournext" ref="next" @click="forward">{{ last ? 'Set Up a Project' : 'Next' }}</Button>
    </footer>
  </div>
</template>
