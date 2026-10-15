<script setup lang="ts">
// New Project, a dialog of its own as JetBrains' (docs/tasks.md, Projects; docs/ui.md): on the left what its code
// comes from, on the right the form; Create makes it and shows its page in Settings. Opened from the empty window,
// the main process (project:new) and Settings' + (Cancel goes back there).
import { computed, ref, watch } from 'vue';
import { CheckboxIndicator, CheckboxRoot, DialogClose, ListboxContent, ListboxItem, ListboxRoot } from 'reka-ui';
import Modal from './Modal.vue';
import Icon from './Icon.vue';
import { registerDialog, dialog } from '../lib/dialogs';
import type { ProjectChoices } from '../types';
import { MAX, nameChar, repoName } from '../../shared/names';

const modal = ref<InstanceType<typeof Modal>>();
const nameField = ref<HTMLInputElement>(), sourceField = ref<HTMLInputElement>();
const name = ref(''), place = ref(''), sep = ref('/'), git = ref(true), saving = ref(false), error = ref('');
let fromSettings = false, created = false;

// Its code, asked first (the author, 2026-10-11): a new folder, folders on the disk (nothing made), or repositories
// cloned from URLs; several of them for a project of several (a frontend and a backend). Its name follows the first
// folder's or repository's until the human types one.
const kinds = [{ value: 'new', label: 'New Folder', icon: 'i-folder-plus' }, { value: 'folder', label: 'Folders on Disk', icon: 'i-folder' },
  { value: 'clone', label: 'Clone from URL', icon: 'i-git' }] as const;
const from = ref<'new' | 'folder' | 'clone'>('new');
const sources = ref<{ folder: string; state: string }[]>([]), urls = ref<string[]>([]), typedSource = ref('');
const chosenSource = ref<string>();
let named = '';
const nameOf = (s = '') => {
  const n = [...repoName(s)].filter(nameChar).join('');
  return n.replace(/^[^\p{L}\p{N}]+/u, '').slice(0, MAX);
};
watch([from, sources, urls], () => {
  if (from.value === 'new' || (name.value.trim() && name.value !== named)) return;
  name.value = named = nameOf(from.value === 'folder' ? sources.value[0]?.folder : urls.value[0]);
}, { deep: true });
const rows = computed(() => (from.value === 'folder' ? sources.value : urls.value.map((u) => ({ folder: u, state: '' }))));
// One more folder or URL (Enter in its field, Add, Browse…): a folder that is not there, or a project's, is refused.
// One after another, in the order they were added: each folder is asked about first, and the first is the default.
let queue: Promise<boolean> = Promise.resolve(true);
function addSource(given?: string) {
  const v = (given ?? typedSource.value).trim();
  if (typedSource.value.trim() === v) typedSource.value = '';
  return (queue = queue.then(() => addOne(v)));
}
async function addOne(v: string) {
  if (!v) return true;
  error.value = '';
  if (from.value === 'clone') { if (!urls.value.includes(v)) urls.value.push(v); return true; }
  const r = await kulisa.invoke<{ folder: string; state: string; project?: string } | null>('project:folder-state', { from: 'folder', folder: v });
  const why = !r ? `${v}: a full path, please` : ({ new: `${r.folder} is not there`, file: `${r.folder} is a file, not a folder`,
    project: `${r.folder} is the project ${r.project}'s already` } as Record<string, string>)[r.state];
  if (why) { error.value = why; if (!typedSource.value) typedSource.value = v; return false; } // left to correct
  if (!sources.value.some((x) => x.folder === r!.folder)) sources.value.push({ folder: r!.folder, state: r!.state });
  return true;
}
// −, or Delete in the list: the selected one left out.
function removeSource() {
  const list = from.value === 'folder' ? sources.value.map((x) => x.folder) : urls.value;
  const i = list.indexOf(chosenSource.value ?? '');
  if (i < 0) return;
  if (from.value === 'folder') sources.value.splice(i, 1); else urls.value.splice(i, 1);
  chosenSource.value = undefined;
}
const sourceLine = (x: { state: string }) => (x.state === 'repo' ? 'git' : 'no git');
// A new or cloned project's folder, and what it is (app.ts, project:folder-state), asked again as it is typed.
const target = computed(() => (from.value === 'folder' ? '' : `${place.value.trim().replace(/[\\/]+$/, '')}${sep.value}${name.value.trim()}`));
const there = ref<{ state: string; project?: string } | null>(null);
watch([name, place, from], async () => {
  const asked = target.value;
  const r = !asked ? null : await kulisa.invoke<{ state: string; project?: string } | null>('project:folder-state', { location: place.value, name: name.value });
  if (asked === target.value) there.value = r;
});
const where = computed(() => {
  if (from.value === 'folder') return sources.value.length > 1 ? 'The project takes these folders as they are; the first is the default' : '';
  if (!name.value.trim() || !place.value.trim()) return '';
  const t = target.value, state = there.value?.state ?? '';
  const refused = ({ project: `${t} is the project ${there.value?.project}'s already`, file: `${t} is a file, not a folder` } as Record<string, string>)[state];
  if (refused) return refused;
  if (from.value === 'clone') return ['files', 'repo'].includes(state) ? `${t} is there already: choose another name or location`
    : urls.value.length > 1 ? `The repositories will be cloned into ${t}, each in a folder of its own` : `The repository will be cloned into ${t}`;
  return ({ files: `${t} is there already: the project takes it as it is, its files kept`,
    repo: `${t} is a git repository: the project takes it as it is` } as Record<string, string>)[state] ?? `The project will be created in ${t}`;
});
// Create Git repository: not for a repository or a clone; on the disk, in the folders that are none.
const askGit = computed(() => (from.value === 'folder' ? sources.value.some((x) => x.state !== 'repo')
  : from.value === 'new' && there.value?.state !== 'repo'));

async function open(opts: { fromSettings?: boolean } = {}) {
  const c = await kulisa.invoke<ProjectChoices & { location: string; sep: string }>('project:new-defaults');
  sep.value = c.sep; name.value = ''; place.value = c.location; git.value = true; error.value = '';
  from.value = 'new'; sources.value = []; urls.value = []; typedSource.value = ''; named = ''; chosenSource.value = undefined;
  fromSettings = !!opts.fromSettings; created = false;
  await modal.value!.open();
  nameField.value?.focus();
}
registerDialog('newproject', { open });

async function browse(existing = false) {
  const picked = await kulisa.invoke<string | null>('project:pick-location', { location: place.value.trim(), existing });
  if (picked && existing) await addSource(picked); else if (picked) place.value = picked;
}
// + in the folders' or URLs' toolbar: Browse… for a folder; a URL is typed in the field under the list.
const plus = () => (from.value === 'folder' ? browse(true) : sourceField.value?.focus());
// Create: made (a clone: cloned, which takes a while), then its page shown in Settings.
async function create() {
  if (from.value !== 'new' && !(await addSource())) return; // what is typed in its field counts
  if (!name.value.trim()) { nameField.value?.focus(); return; }
  saving.value = true;
  const r = await kulisa.invoke<{ error?: string; id?: string } | null>('project:new', { from: from.value, name: name.value,
    location: place.value, folders: sources.value.map((x) => x.folder), urls: [...urls.value], git: git.value && askGit.value });
  saving.value = false;
  if (r?.error) { error.value = r.error; return; }
  created = true;
  modal.value!.close();
  await (await dialog('projects')).openProjects(r!.id!);
}
// Cancelled after Settings' +: back there.
async function closed() { if (fromSettings && !created) await (await dialog('projects')).openProjects(); }
</script>

<template>
  <Modal id="newproject" ref="modal" title="New Project" form form-id="npform" @submit="create" @close="closed">
    <div class="npsplit">
      <ListboxRoot selection-behavior="replace" id="npfrom" v-model="from" class="npkinds" aria-label="Start from" @update:model-value="error = ''">
        <ListboxContent>
          <ListboxItem v-for="k in kinds" :key="k.value" :value="k.value" class="item" :data-value="k.value"><Icon :name="k.icon" /><span class="text"><span class="label">{{ k.label }}</span></span></ListboxItem>
        </ListboxContent>
      </ListboxRoot>
      <div class="npform">
        <!-- Folders or URLs, one or several (a frontend and a backend): Enter or Add puts the one typed in the list -->
        <div v-if="from !== 'new'" id="npsources" class="field top"><span>{{ from === 'folder' ? 'Folders:' : 'URLs:' }}</span>
          <div class="npsourcelist">
            <div class="list">
              <div class="tools">
                <button :id="from === 'folder' ? 'npbrowsesource' : 'npurladd'" class="icon small" type="button" :title="from === 'folder' ? 'Add Folder…' : 'Add a URL'" :aria-label="from === 'folder' ? 'Add Folder' : 'Add a URL'" @click="plus"><Icon name="i-plus" /></button>
                <button class="icon small" type="button" title="Leave Out" aria-label="Leave Out" :disabled="!chosenSource" @click="removeSource"><Icon name="i-minus" /></button>
              </div>
              <ListboxRoot selection-behavior="replace" v-if="rows.length" v-model="chosenSource" :aria-label="from === 'folder' ? 'Folders' : 'URLs'" @keydown.delete="removeSource">
                <ListboxContent>
                  <ListboxItem v-for="(x, i) in rows" :key="x.folder" :value="x.folder" class="item" :data-source="x.folder">
                    <span class="text"><span class="label" :title="x.folder">{{ x.folder }}</span></span>
                    <kbd v-if="x.state">{{ sourceLine(x) }}</kbd><kbd v-if="!i && rows.length > 1" class="default">default</kbd>
                  </ListboxItem>
                </ListboxContent>
              </ListboxRoot>
              <p v-if="!rows.length" class="empty">{{ from === 'folder' ? 'No folders yet' : 'No URLs yet' }}</p>
            </div>
            <span class="pick"><input id="npsource" ref="sourceField" v-model="typedSource" spellcheck="false" :aria-label="from === 'folder' ? 'A folder' : 'A repository URL'"
              :placeholder="from === 'folder' ? '~/IdeaProjects/shop' : 'git@github.com:me/shop.git'" @input="error = ''" @keydown.enter.prevent="addSource()">
              <button id="npaddsource" type="button" @click="addSource()">Add</button></span>
          </div></div>
        <div class="field"><label for="npname">Name:</label><input id="npname" ref="nameField" v-model="name" data-name maxlength="64"
          placeholder="e.g. tenant-audit" spellcheck="false" @input="error = ''"></div>
        <div v-if="from !== 'folder'" id="nplocationrow" class="field"><label for="nplocation">Location:</label><span class="pick"><input id="nplocation" v-model="place"
          spellcheck="false" @input="error = ''"><button id="npbrowse" type="button" title="Browse…" @click="browse()">Browse…</button></span></div>
        <p id="npwhere" class="hint">{{ where }}</p>
        <label id="npgitrow" class="check" :hidden="!askGit"><CheckboxRoot id="npgit" v-model="git" class="checkbox"><CheckboxIndicator as-child><Icon name="i-done" /></CheckboxIndicator></CheckboxRoot>
          Create Git repository</label>
        <p id="nperror" class="error">{{ error }}</p>
      </div>
    </div>
    <template #footer>
      <DialogClose>Cancel</DialogClose><button id="npcreate" class="primary" :disabled="saving">{{ saving && from === 'clone' ? 'Cloning…' : 'Create' }}</button>
    </template>
  </Modal>
</template>

<style>
/* What its code comes from on the left, the form on the right (JetBrains' New Project) */
#newproject { width: min(760px, 92vw);
  .body { display: flex; padding: 0; min-height: 320px; }
  .npsplit { flex: 1; display: flex; min-width: 0; }
  .npkinds { flex: none; width: 200px; padding: var(--gap); border-inline-end: 1px solid var(--island-hi); background: var(--window); outline: none;
    .item { border-radius: var(--radius); } }
  .npform { flex: 1; min-width: 0; padding: var(--pad); overflow: auto; > .field:first-child { margin-top: 0; } }
  .field.top { align-items: start; > span { line-height: var(--control); } }
  .npsourcelist { display: flex; flex-direction: column; gap: var(--gap); min-width: 0;
    .list [role="listbox"] { min-height: calc(2 * var(--row)); max-height: calc(5 * var(--row)); overflow: auto; }
    .label { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; } }
  #npwhere:empty { display: none; }
}
</style>
