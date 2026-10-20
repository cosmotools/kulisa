<script setup lang="ts">
// New Task from a Branch… (docs/tasks.md, Tasks): a project's branches, fetched first, newest first; the one chosen
// opens as a new task working on it, in this window.
import { ref } from 'vue';
import { DialogClose, ListboxContent, ListboxItem, ListboxRoot } from 'reka-ui';
import Modal from './Modal.vue';
import { registerDialog } from '../lib/dialogs';
import { ago } from '../lib/common';
import { refused } from '../../shared/result';
import type { Branch } from '../../shared/types';

const modal = ref<InstanceType<typeof Modal>>();
const list = ref<Branch[] | null>(null), chosen = ref<string>(), error = ref(''), name = ref('');
let project = '';
registerDialog('frombranch', {
  async open(id, projectName) {
    project = id; name.value = projectName; list.value = null; chosen.value = undefined; error.value = '';
    await modal.value!.open();
    const r = await kulisa.invoke('project:branches', { id });
    if (refused(r)) { error.value = r.error; list.value = []; } else list.value = r.branches;
  },
});
async function start() {
  if (!chosen.value) return;
  await kulisa.invoke('project:open', { id: project, branch: chosen.value });
  modal.value!.close();
}
</script>

<template>
  <Modal id="frombranch" ref="modal" :title="`New Task of ${name} from a Branch`" form form-id="frombranchform" @submit="start">
    <p class="hint">A task that works on a branch there is already: one pushed from your other computer, a colleague's, or
      one of your own. Its branch stays when the task is deleted.</p>
    <div class="list">
      <div v-if="list?.length" class="head" aria-hidden="true"><span>Branch</span><span>Last commit</span><span /></div>
      <ListboxRoot v-if="list?.length" id="branches" v-model="chosen" selection-behavior="replace" aria-label="Branches" @dblclick="start">
        <ListboxContent>
          <ListboxItem v-for="b in list" :key="b.name" :value="b.name" class="item" :data-branch="b.name" :title="`${b.name}: ${b.subject}`">
            <span class="cell label">{{ b.name }}</span><small class="cell">{{ b.subject }}</small>
            <span class="cell end"><kbd v-if="b.remote" title="Only on the remote: a local branch is made to follow it">remote</kbd>{{ ago(b.at) }}</span>
          </ListboxItem>
        </ListboxContent>
      </ListboxRoot>
      <p v-else class="empty">{{ list ? 'No branch to work on: each is in a task or the project\'s folder already.' : 'Looking for branches…' }}</p>
    </div>
    <p class="error">{{ error }}</p>
    <template #footer>
      <DialogClose>Cancel</DialogClose><button id="frombranchopen" class="primary" :disabled="!chosen">Open Task</button>
    </template>
  </Modal>
</template>

<style>
#frombranch .list { --cols: fit-content(40%) minmax(0, 1fr) auto; max-height: 50vh; overflow: auto;
  .end { display: flex; gap: var(--inset); align-items: center; color: var(--text-muted); } }
</style>
