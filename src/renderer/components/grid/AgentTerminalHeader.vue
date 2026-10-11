<script setup lang="ts">
// The agent's terminal's header (docs/window.md, The terminal).
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
