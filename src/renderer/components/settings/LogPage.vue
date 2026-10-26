<script setup lang="ts">
// The Log page of Settings (docs/window.md, The log): the log read whole and followed as it grows, a line each with its
// time and tag, the tag in its group's color, warnings and errors in red; preset filters (chips) and a text filter;
// Copy All, Save As… (a file to attach anywhere), Open Folder, Report… (On GitHub…). Read when first shown, not as
// Settings opens: a megabyte for nothing otherwise.
import { computed, nextTick, ref, watch } from 'vue';
import { CheckboxIndicator, CheckboxRoot, ToggleGroupItem, ToggleGroupRoot } from 'reka-ui';
import Icon from '../Icon.vue';
import ButtonMenu from '../menu/ButtonMenu.vue';
import { refused } from '../../../shared/result';
import type { MenuItem } from '../../lib/menu';

const props = defineProps<{ shown: boolean }>(); // the page chosen in the tree

// A line as the file has it: [date T time offset] [level] [tag …] the rest (log.ts, stamp; a local time
// with a space and no offset, electron-log's, read too); a line not of that shape (an object's lines under an [electron] event) belongs to the one
// before it. The tag's group is the chip that shows it.
type Group = 'agent' | 'human' | 'tasks';
type Chip = 'all' | 'errors' | Group;
type Line = { date: string; time: string; offset: string; level: string; tag: string; text: string; raw: string; group: Group | null };
const GROUPS: Record<string, Group> = { mcp: 'agent', hook: 'agent', terminal: 'agent', ipc: 'human', key: 'human', settings: 'human', task: 'tasks', window: 'tasks', kulisa: 'tasks' };
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
  <div id="logpage">
    <div class="tools">
      <input id="logfilter" v-model="filter" type="search" placeholder="Filter: a task, wc=1, [mcp]…" aria-label="Filter" spellcheck="false">
      <ToggleGroupRoot id="logchips" class="chips" type="single" aria-label="Show" :model-value="chip" @update:model-value="(v) => { if (v) chip = v as Chip; }">
        <ToggleGroupItem v-for="c in CHIPS" :key="c.id" :value="c.id" class="chip" :title="c.title" :data-chip="c.id">{{ c.label }}</ToggleGroupItem>
      </ToggleGroupRoot>
      <label class="check"><CheckboxRoot id="logfollow" class="checkbox" :model-value="follow" @update:model-value="setFollow">
        <CheckboxIndicator as-child><Icon name="i-done" /></CheckboxIndicator></CheckboxRoot> Follow</label>
    </div>
    <div ref="box" class="lines" role="log" aria-label="Log" @scroll.passive="scrolled">
      <div v-for="(l, i) in visible" :key="i" class="line" :data-group="l.group" :data-bad="bad(l) || undefined" :title="`${l.date} ${l.offset}`.trim()" :data-tag="l.tag || undefined">
        <time>{{ l.time }}</time><b>{{ l.tag ? `[${l.tag}]` : '' }}</b><span>{{ l.text }}</span>
      </div>
      <p v-if="loaded && !visible.length" class="empty">Nothing matches.</p>
    </div>
    <p class="hint about">{{ about }} Never here: what you typed, passwords, tokens, cookies, the pages' queries.</p>
    <div class="actions">
      <span class="note" role="status">{{ note }}</span><span class="error">{{ error }}</span>
      <button id="logcopy" type="button" title="The whole log, to paste anywhere" @click="copy">Copy All</button>
      <button id="logsave" type="button" title="The log as a file, to attach to a message or an issue" @click="save">Save As…</button>
      <button id="logfolder" type="button" title="Its folder in your file manager" @click="kulisa.invoke('log:show-folder')">Open Folder</button>
      <ButtonMenu :items="report" end><button id="logreport" type="button" class="primary">Report…</button></ButtonMenu>
    </div>
  </div>
</template>

<style>
#logpage { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: var(--gap);
  .tools { display: flex; align-items: center; gap: var(--gap); flex-wrap: wrap;
    #logfilter { flex: 1; min-width: 140px; max-width: 260px; } .check { margin: 0 0 0 auto; } }
  .lines { flex: 1; min-height: 0; overflow: auto; padding: 6px 8px; border: 1px solid var(--line); border-radius: var(--corner); background: var(--field);
    font: var(--font-small) / 1.5 "JetBrains Mono", monospace; color: var(--text); user-select: text; cursor: text;
    .empty { margin: 0; color: var(--text-muted); font: var(--font) var(--sans); } }
  .line { display: grid; grid-template-columns: auto auto 1fr; gap: 0 var(--gap); white-space: pre-wrap; overflow-wrap: anywhere;
    time { color: var(--text-muted); font-variant-numeric: tabular-nums; } b { font-weight: 600; color: var(--text-dim); }
    &[data-group="agent"] b { color: var(--log-agent); } &[data-group="human"] b { color: var(--log-human); } &[data-group="tasks"] b { color: var(--log-tasks); }
    &[data-bad] { color: var(--error); b { color: var(--error); } } }
  .about { margin: 0; }
  .actions { display: flex; align-items: center; gap: var(--gap); justify-content: end;
    .note { color: var(--text-muted); } .error { margin: 0; } :is(.note, .error) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .note:not(:empty), .error:not(:empty) { margin-inline-end: auto; } }
}
</style>
