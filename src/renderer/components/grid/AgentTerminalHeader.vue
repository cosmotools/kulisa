<script setup lang="ts">
// The agent's terminal's header: its name, + for a shell of the human's next to it (in the task's folder), and
// dictation where the shown task's agent has its own (Dictation.vue).
import Icon from '../Icon.vue';
import Dictation from './Dictation.vue';
import { act } from '../../lib/store';
import { withKeys } from '../../lib/common';
</script>

<template>
  <div class="ptab">
    <b>Terminal</b>
    <button class="add icon quiet small" :title="withKeys('New terminal: your shell in the task\'s folder', 'terminal.new')" aria-label="New terminal"
      @click="act('terminal:open')"><Icon name="i-plus" /></button>
    <Dictation />
  </div>
</template>
