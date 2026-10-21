<script setup lang="ts">
// New Project's first step: what its code comes from, as JetBrains' New Project: the kinds on the left, the form on the
// right (wizard.ts has the rules).
import { computed, ref } from 'vue';
import { ListboxContent, ListboxItem, ListboxRoot } from 'reka-ui';
import Icon from '../Icon.vue';
import { useWizard } from './wizard';

const w = useWizard(), c = w.code;
const kinds = [{ value: 'new', label: 'New Folder', icon: 'i-folder-plus' }, { value: 'folder', label: 'Folders on Disk', icon: 'i-folder' },
  { value: 'clone', label: 'Clone from URL', icon: 'i-git' }] as const;
const nameField = ref<HTMLInputElement>(), sourceField = ref<HTMLInputElement>();
const chosen = ref<string>();
const rows = computed(() => (c.from === 'folder' ? c.sources : c.urls.map((u) => ({ folder: u, state: '' }))));
const sourceLine = (x: { state: string }) => (x.state === 'repo' ? 'git' : 'no git');
// + in the folders' or URLs' toolbar: Browse… for a folder; a URL is typed in the field under the list.
const plus = () => (c.from === 'folder' ? w.browse(true) : sourceField.value?.focus());
// −, or Delete in the list: the selected one left out.
const remove = () => { w.removeSource(chosen.value); chosen.value = undefined; };
defineExpose({ focus: () => nameField.value?.focus() });
</script>

<template>
  <div class="npsplit">
    <ListboxRoot selection-behavior="replace" id="npfrom" v-model="c.from" class="npkinds" aria-label="Start from" @update:model-value="w.error.value = ''">
      <ListboxContent>
        <ListboxItem v-for="k in kinds" :key="k.value" :value="k.value" class="item" :data-value="k.value"><Icon :name="k.icon" /><span class="text"><span class="label">{{ k.label }}</span></span></ListboxItem>
      </ListboxContent>
    </ListboxRoot>
    <div class="npform">
      <!-- One folder or URL (the welcome's): taken as it is left, or at Next -->
      <div v-if="c.from !== 'new' && w.single" id="npsingle" class="field"><label for="npsource">{{ c.from === 'folder' ? 'Folder:' : 'URL:' }}</label>
        <span class="pick"><input id="npsource" v-model="c.typed" spellcheck="false" :placeholder="c.from === 'folder' ? '~/IdeaProjects/shop' : 'git@github.com:me/shop.git'"
          @input="w.error.value = ''" @change="w.addSource()"><button v-if="c.from === 'folder'" id="npbrowsesource" type="button" @click="w.browse(true)">Browse…</button></span></div>
      <!-- Folders or URLs, one or several (a frontend and a backend): Enter or Add puts the one typed in the list -->
      <div v-else-if="c.from !== 'new'" id="npsources" class="field top"><span>{{ c.from === 'folder' ? 'Folders:' : 'URLs:' }}</span>
        <div class="npsourcelist">
          <div class="list">
            <div class="tools">
              <button :id="c.from === 'folder' ? 'npbrowsesource' : 'npurladd'" class="icon small" type="button" :title="c.from === 'folder' ? 'Add Folder…' : 'Add a URL'" :aria-label="c.from === 'folder' ? 'Add Folder' : 'Add a URL'" @click="plus"><Icon name="i-plus" /></button>
              <button class="icon small" type="button" title="Leave Out" aria-label="Leave Out" :disabled="!chosen" @click="remove"><Icon name="i-minus" /></button>
            </div>
            <div v-if="rows.length" class="head" aria-hidden="true"><span>{{ c.from === 'folder' ? 'Folder' : 'URL' }}</span><span /></div>
            <ListboxRoot selection-behavior="replace" v-if="rows.length" v-model="chosen" :aria-label="c.from === 'folder' ? 'Folders' : 'URLs'" @keydown.delete="remove">
              <ListboxContent>
                <ListboxItem v-for="(x, i) in rows" :key="x.folder" :value="x.folder" class="item" :data-source="x.folder">
                  <span class="cell label" :title="x.folder">{{ x.folder }}</span>
                  <span class="cell end"><kbd v-if="x.state">{{ sourceLine(x) }}</kbd><kbd v-if="!i && rows.length > 1" class="default">default</kbd></span>
                </ListboxItem>
              </ListboxContent>
            </ListboxRoot>
            <p v-if="!rows.length" class="empty">{{ c.from === 'folder' ? 'No folders yet' : 'No URLs yet' }}</p>
          </div>
          <span class="pick"><input id="npsource" ref="sourceField" v-model="c.typed" spellcheck="false" :aria-label="c.from === 'folder' ? 'A folder' : 'A repository URL'"
            :placeholder="c.from === 'folder' ? '~/IdeaProjects/shop' : 'git@github.com:me/shop.git'" @input="w.error.value = ''" @keydown.enter.prevent="w.addSource()">
            <button id="npaddsource" type="button" @click="w.addSource()">Add</button></span>
        </div></div>
      <div v-if="w.askName.value" class="field"><label for="npname">{{ w.single ? 'Project name:' : 'Name:' }}</label><input id="npname" ref="nameField" v-model="c.name" data-name maxlength="64"
        placeholder="e.g. tenant-audit" spellcheck="false" @input="w.error.value = ''"></div>
      <div v-if="c.from !== 'folder'" id="nplocationrow" class="field"><label for="nplocation">Location:</label><span class="pick"><input id="nplocation" v-model="c.place"
        spellcheck="false" @input="w.error.value = ''"><button id="npbrowse" type="button" title="Browse…" @click="w.browse()">Browse…</button></span></div>
      <p id="npwhere" class="hint">{{ w.where.value }}</p>
      <p v-if="w.single && c.from !== 'new'" id="npmore" class="hint">A frontend and a backend? Add the other {{ c.from === 'folder' ? 'folder' : 'repository' }} later in Settings.</p>
    </div>
  </div>
</template>

<style>
.npsplit { flex: 1; display: flex; min-width: 0; min-height: 0;
  .npkinds { flex: none; width: 200px; padding: var(--gap); border-inline-end: 1px solid var(--island-hi); background: var(--window); outline: none;
    .item { border-radius: var(--radius); } }
  .npform { flex: 1; min-width: 0; padding: var(--pad); overflow: auto; > .field:first-child { margin-top: 0; } }
  .field.top { align-items: start; > span { line-height: var(--control); } }
  .npsourcelist { display: flex; flex-direction: column; gap: var(--gap); min-width: 0;
    .list { --cols: minmax(0, 1fr) auto; } /* the folder or URL, its state */
    .list [role="listbox"] { min-height: calc(2 * var(--row)); max-height: calc(5 * var(--row)); overflow: auto; }
    .label { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; } }
  #npwhere:empty { display: none; }
}
</style>
