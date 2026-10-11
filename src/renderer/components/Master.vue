<script setup lang="ts">
// The bar of a master's window, and of an agent's sign-in's (docs/profiles.md, docs/tasks.md: Accounts).
// While the human types an address, where the page goes does not overwrite it.
// A sign-in's shows the site alone, as Chrome's OAuth popup: the page cannot fake it, and nothing there needs another.
import { onMounted, ref } from 'vue';

const query = new URLSearchParams(location.search);
const signin = query.has('signin');
const what = query.get('what') || `${query.get('name')}: signed in here, every new task's copy is too`;
const address = ref<HTMLInputElement>();
const site = ref(''), secure = ref(true);
let typing = false;
const go = () => { typing = false; const url = address.value!.value.trim(); if (url) kulisa.invoke('master:go', url); };
kulisa.on<string>('master:url', (url) => {
  if (signin) {
    try { const u = new URL(url); site.value = u.host; secure.value = u.protocol === 'https:'; } catch { site.value = ''; }
  } else if (!typing && address.value) address.value.value = url === 'about:blank' ? '' : url;
});
onMounted(() => address.value?.focus());
</script>

<template>
  <header v-if="signin" id="bar" class="signin">
    <span id="site"><span v-if="!secure" class="hint">Not secure ·</span> {{ site }}</span>
    <span id="what" class="hint">{{ what }}</span>
  </header>
  <header v-else id="bar">
    <button id="back" type="button" @click="kulisa.invoke('master:back')">Back</button>
    <button id="forward" type="button" @click="kulisa.invoke('master:forward')">Forward</button>
    <button id="reload" type="button" @click="kulisa.invoke('master:reload')">Reload</button>
    <form id="go" @submit.prevent="go"><input id="address" ref="address" spellcheck="false" aria-label="Address" placeholder="The site to sign in to, e.g. github.com"
      @input="typing = true" @blur="typing = false"></form>
    <span id="what" class="hint">{{ what }}</span>
  </header>
</template>

<style>
body { margin: 0; background: var(--window); color: var(--text); font: var(--font) system-ui, sans-serif; }
#bar { display: flex; align-items: center; gap: var(--gap); height: 44px; box-sizing: border-box; padding: 0 var(--gap);
  #go { flex: 1; display: flex; } #address { flex: 1; } .hint { color: var(--text-muted); white-space: nowrap; }
  &.signin { height: 32px; #site { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-strong); } } }
</style>
