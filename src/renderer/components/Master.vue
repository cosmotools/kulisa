<script setup lang="ts">
// The bar of a master's window (docs/profiles.md), 44 px high (main/master.ts, BAR). While the human types an address,
// where the page goes does not overwrite it.
import { onMounted, ref } from 'vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeftIcon, ArrowRightIcon, RotateCwIcon } from '@lucide/vue';

const query = new URLSearchParams(location.search);
const what = `${query.get('name')}: signed in here, every new task's copy is too`;
const address = ref<{ $el: HTMLInputElement }>();
let typing = false;
const go = () => { typing = false; const url = address.value!.$el.value.trim(); if (url) void kulisa.invoke('master:go', url); };
kulisa.on('master:url', (url) => { if (!typing && address.value) address.value.$el.value = url === 'about:blank' ? '' : url; });
onMounted(() => address.value?.$el.focus());
</script>

<template>
  <header id="bar" class="flex h-11 items-center gap-1 border-b px-2">
    <Button id="back" variant="ghost" size="icon-sm" aria-label="Back" title="Back" @click="kulisa.invoke('master:back')"><ArrowLeftIcon /></Button>
    <Button id="forward" variant="ghost" size="icon-sm" aria-label="Forward" title="Forward" @click="kulisa.invoke('master:forward')"><ArrowRightIcon /></Button>
    <Button id="reload" variant="ghost" size="icon-sm" aria-label="Reload" title="Reload" @click="kulisa.invoke('master:reload')"><RotateCwIcon /></Button>
    <form id="go" class="mx-1 flex flex-1" @submit.prevent="go"><Input id="address" ref="address" class="h-8" spellcheck="false" aria-label="Address"
      placeholder="The site to sign in to, e.g. github.com" @input="typing = true" @blur="typing = false" /></form>
    <span id="what" class="whitespace-nowrap text-muted-foreground">{{ what }}</span>
  </header>
</template>
