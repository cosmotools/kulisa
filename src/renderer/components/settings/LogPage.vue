<script setup lang="ts">
// The Log page of Settings (docs/window.md, The log): the log read whole and followed as it grows, a line each with its
// time and tag, the tag in its group's color, warnings and errors in red; preset filters and a text filter;
// Copy All, Save As… (a file to attach anywhere), Open Folder, Report… (On GitHub…). Read when first shown, not as
// Settings opens: a megabyte for nothing otherwise.
import { computed, nextTick, ref, watch } from 'vue';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import ButtonMenu from '../menu/ButtonMenu.vue';
import { refused } from '../../../shared/result';
import type { MenuItem } from '../../lib/menu';

const props = defineProps<{ shown: boolean }>(); // the page chosen in the tree

// A line as the file has it: [date T time offset] [level] [tag …] the rest (log.ts, stamp; a local time
// with a space and no offset, electron-log's, read too); a line not of that shape (an object's lines under an [electron] event) belongs to the one
// before it. The tag's group is the filter that shows it.
type Group = 'agent' | 'human' | 'tasks';
type Chip = 'all' | 'errors' | Group;
type Line = { date: string; time: string; offset: string; level: string; tag: string; text: string; raw: string; group: Group | null };
const GROUPS: Record<string, Group> = { mcp: 'agent', hook: 'agent', terminal: 'agent', ipc: 'human', key: 'human', settings: 'human', task: 'tasks', window: 'tasks', kulisa: 'tasks' };
const TAGS: Record<Group, string> = { agent: 'text-blue-500', human: 'text-violet-500', tasks: 'text-amber-600' };
const CHIPS: { id: Chip; label: string; title: string }[] = [
  { id: 'all', label: 'All', title: 'Every line' },
  { id: 'errors', label: 'Errors', title: 'Warnings and errors: a page\'s, Electron\'s, an action refused or failed' },
  { id: 'agent', label: 'Agent', title: 'What the agent did: its tools, its hooks, its terminal' },
  { id: 'human', label: 'Human', title: 'What you did: a window\'s messages, keys, Settings' },
  { id: 'tasks', label: 'Tasks', title: 'Tasks and windows opened and closed, the start' }];
const LINE = /^\[(\d{4}-\d\d-\d\d)[T ](\d\d:\d\d:\d\d\.\d{3})([+-]\d\d:\d\d|Z)?\] \[(\w+)\]\s*(?:\[(\w+)[^\]]*\]\s?)?(.*)$/;
const bad = (l: Line) => l.level === 'warn' || l.level === 'error' || l.tag === 'page' || l.tag === 'electron' || /\b(refused|failed)\b/.test(l.text);

const lines = ref<Line[]>([]), size = ref(0), max = ref(0), old = ref<string | null>(null), loaded = ref(false);
const chip = ref<Chip>('all'), filter = ref(''), follow = ref(true), note = ref(''), error = ref('');
let rest = ''; // a line's beginning, its end not come yet
function add(text: string, into = lines.value) {
  const parts = (rest + text).split('\n');
  rest = parts.pop()!;
  for (const raw of parts.map((p) => p.replace(/\r$/, ''))) {
    const m = LINE.exec(raw), last = into.at(-1);
    if (m) into.push({ date: m[1]!, time: m[2]!, offset: m[3] ?? '', level: m[4]!, tag: m[5] ?? '', text: m[6]!, raw, group: GROUPS[m[5] ?? ''] ?? null });
    else if (last) { last.text += `\n${raw}`; last.raw += `\n${raw}`; }
  }
}
async function load() {
  const info = await kulisa.invoke('log:get');
  const all: Line[] = [];
  rest = ''; add(info.text, all);
  lines.value = all; size.value = info.size; max.value = info.max; old.value = info.old; loaded.value = true;
}
watch(() => props.shown, (s) => { if (s && !loaded.value) void load(); }, { immediate: true });
kulisa.on('log:lines', (m) => {
  if (!loaded.value) return;
  if ('reset' in m) void load(); else { add(m.text); size.value += new TextEncoder().encode(m.text).length; }
});

const visible = computed(() => {
  const q = filter.value.trim().toLowerCase(), c = chip.value;
  return lines.value.filter((l) => (c === 'all' || (c === 'errors' ? bad(l) : l.group === c)) && (!q || l.raw.toLowerCase().includes(q)));
});
// Follow keeps the end in view, as a terminal does, and lets go when the log is scrolled up; checked again, it goes back
// to the end.
const box = ref<HTMLElement>();
const toEnd = () => { if (box.value) box.value.scrollTop = box.value.scrollHeight; };
watch([visible, () => props.shown], async () => { if (follow.value) { await nextTick(); toEnd(); } }, { flush: 'post' });
function scrolled() { const b = box.value!; follow.value = b.scrollHeight - b.scrollTop - b.clientHeight < 4; }
function setFollow(on: boolean | 'indeterminate') { follow.value = !!on; if (on) toEnd(); }

const kb = (n: number) => `${Math.max(1, Math.round(n / 1024))} KB`;
const about = computed(() => `kulisa.log, ${kb(size.value)} of ${Math.round(max.value / 1024 / 1024)} MB${old.value ? `; kulisa.old.log from ${old.value.slice(0, 10)}` : ''}.`);
async function copy() { await navigator.clipboard.writeText(lines.value.map((l) => l.raw).join('\n')); note.value = 'Copied.'; }
async function save() {
  const r = await kulisa.invoke('log:save');
  error.value = refused(r) ? r.error : '';
  if (!refused(r) && r.file) note.value = `Saved as ${r.file}`;
}
const report = (): MenuItem[] => [{ label: 'On GitHub…', sub: 'a public issue, the environment filled in; attach the saved log', run: () => void kulisa.invoke('log:report') }];
</script>

<template>
  <div id="logpage" class="flex min-h-0 flex-1 flex-col gap-3">
    <div class="flex flex-wrap items-center gap-2">
      <Input id="logfilter" v-model="filter" type="search" class="w-64" placeholder="Filter: a task, wc=1, [mcp]…" aria-label="Filter" spellcheck="false" />
      <ToggleGroup id="logchips" type="single" variant="outline" size="sm" aria-label="Show" :model-value="chip" @update:model-value="(v) => { if (v) chip = v as Chip; }">
        <ToggleGroupItem v-for="c in CHIPS" :key="c.id" :value="c.id" :title="c.title" :data-chip="c.id">{{ c.label }}</ToggleGroupItem>
      </ToggleGroup>
      <Field orientation="horizontal" class="ml-auto w-auto">
        <Checkbox id="logfollow" :model-value="follow" @update:model-value="setFollow" />
        <FieldLabel for="logfollow">Follow</FieldLabel>
      </Field>
    </div>
    <div ref="box" class="min-h-0 flex-1 cursor-text overflow-auto rounded-lg border bg-muted/30 px-2 py-1.5 font-mono text-xs/relaxed select-text" role="log" aria-label="Log" @scroll.passive="scrolled">
      <div v-for="(l, i) in visible" :key="i" class="grid grid-cols-[auto_auto_1fr] gap-x-2 wrap-anywhere whitespace-pre-wrap data-bad:text-destructive" :data-group="l.group" :data-bad="bad(l) || undefined"
        :title="`${l.date} ${l.offset}`.trim()" :data-tag="l.tag || undefined">
        <time class="text-muted-foreground tabular-nums">{{ l.time }}</time><b class="font-semibold" :class="bad(l) ? 'text-destructive' : l.group ? TAGS[l.group] : 'text-muted-foreground'">{{ l.tag ? `[${l.tag}]` : '' }}</b><span>{{ l.text }}</span>
      </div>
      <p v-if="loaded && !visible.length" class="font-sans text-sm text-muted-foreground">Nothing matches.</p>
    </div>
    <p class="text-muted-foreground" data-testid="about">{{ about }} Never here: what you typed, passwords, tokens, cookies, the pages' queries.</p>
    <div class="flex items-center justify-end gap-2">
      <span class="mr-auto truncate text-muted-foreground empty:hidden" role="status">{{ note }}</span><span class="mr-auto truncate text-destructive empty:hidden">{{ error }}</span>
      <Button id="logcopy" variant="outline" title="The whole log, to paste anywhere" @click="copy">Copy All</Button>
      <Button id="logsave" variant="outline" title="The log as a file, to attach to a message or an issue" @click="save">Save As…</Button>
      <Button id="logfolder" variant="outline" title="Its folder in your file manager" @click="kulisa.invoke('log:show-folder')">Open Folder</Button>
      <ButtonMenu :items="report" end><Button id="logreport">Report…</Button></ButtonMenu>
    </div>
  </div>
</template>
