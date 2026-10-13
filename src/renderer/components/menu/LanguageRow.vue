<script setup lang="ts">
// ☰'s Language (docs/window.md, Language): a row opening a menu of its own beside it, as there are too many to show
// in the row, Theme's way. The system's language first, then by name in each language itself.
import { computed } from 'vue';
import { DropdownMenuPortal, DropdownMenuRadioGroup, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from 'reka-ui';
import Icon from '../Icon.vue';
import MenuButton from '../MenuButton.vue';
import { store } from '../../lib/store';
import { ask } from '../../lib/ask';

const name = (code: string, inLanguage = code) => new Intl.DisplayNames([inLanguage], { type: 'language' }).of(code)!;
const info = computed(() => store.language);
const order = computed(() => {
  const system = navigator.language.split('-')[0];
  return (info.value?.languages || []).toSorted((a, b) => Number(b === system) - Number(a === system) || name(a).localeCompare(name(b)));
});
// What it changes, and for which agents: their own setting, nothing more (agents/, language).
const title = computed(() => {
  const agents = info.value?.agents || [], has = agents.filter((a) => a.has).map((a) => a.name), not = agents.filter((a) => !a.has).map((a) => a.name);
  return `The language you speak with the agents. ${has.join(', ')} ${has.length > 1 ? 'dictate and answer' : 'dictates and answers'} in it, `
    + `and may write code comments in it too: your project's CLAUDE.md or AGENTS.md decides that.`
    + (not.length ? ` ${not.join(', ')} ${not.length > 1 ? 'have' : 'has'} no language setting yet.` : '');
});
async function choose(code: string) {
  const r = await kulisa.invoke<{ error?: string }>('language:set', code);
  if (r?.error) await ask({ message: 'The language was not changed', detail: r.error });
}
</script>

<template>
  <DropdownMenuSub v-if="info?.languages.length">
    <DropdownMenuSubTrigger class="item languagerow" :title>
      <Icon class="ico" name="i-language" /><span class="text"><span class="label">Language</span></span>
      <span class="value">{{ name(info.language, 'en') }}</span><Icon class="more" name="i-chevron" />
    </DropdownMenuSubTrigger>
    <DropdownMenuPortal>
      <DropdownMenuSubContent class="menu ready languages" :side-offset="4" :collision-padding="4">
        <DropdownMenuRadioGroup :model-value="info.language" @update:model-value="(v) => choose(String(v))">
          <MenuButton v-for="code in order" :key="code" :value="code" :data-language="code"
            :it="{ label: name(code), sub: name(code, 'en') === name(code) ? '' : name(code, 'en') }" />
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuPortal>
  </DropdownMenuSub>
</template>

<style>
/* The language chosen at the row's end, as a select shows it; the menu beside it scrolls when the window is low. */
.menu .languagerow { .value { color: var(--text-dim); } .more { --icon: 14px; color: var(--text-dim); } }
.menu.languages { max-height: min(60vh, 520px); overflow-y: auto; }
</style>
