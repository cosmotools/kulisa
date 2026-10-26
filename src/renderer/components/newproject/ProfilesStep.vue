<script setup lang="ts">
// New Project's third step: its profiles, new ones (a name, who it is) and any of those there are already.
import { CheckboxIndicator, CheckboxRoot } from 'reka-ui';
import { avatarSrc } from '../../lib/common';
import { useWizard } from './wizard';
import { CheckIcon, PlusIcon, XIcon } from '@lucide/vue';

const w = useWizard();
const take = (id: string, on: boolean) => (on ? w.taken.add(id) : w.taken.delete(id));
</script>

<template>
  <div id="npprofilestep" class="npstep">
    <p class="hint">The users of your app the agent works as, a browser profile each: a name and who it is ("seller; can
      approve refunds"). You sign in to them when the agent asks. None now: the agent makes those it needs.</p>
    <div v-for="(f, i) in w.fresh.value" :key="i" class="row npprofile">
      <input v-model="f.name" data-name maxlength="64" placeholder="ann@shop.com" spellcheck="false" aria-label="Name">
      <input v-model="f.description" class="about" maxlength="500" placeholder="Who it is in your app" aria-label="Who it is">
      <button class="icon small quiet" type="button" title="Leave Out" aria-label="Leave Out" @click="w.fresh.value.splice(i, 1)"><XIcon /></button>
    </div>
    <button id="npprofileadd" type="button" @click="w.fresh.value.push({ name: '', description: '' })"><PlusIcon />Add Profile</button>
    <template v-if="w.others.value.length">
      <h3 class="titled">Your profiles</h3>
      <label v-for="p in w.others.value" :key="p.id" class="nprow" :data-profile="p.id">
        <CheckboxRoot class="checkbox" :model-value="w.taken.has(p.id)" @update:model-value="(on) => take(p.id, !!on)">
          <CheckboxIndicator as-child><CheckIcon /></CheckboxIndicator></CheckboxRoot>
        <img class="avatar" alt="" :src="avatarSrc(p.avatar)"><span>{{ p.name }} <small>{{ p.description }}</small></span></label>
    </template>
  </div>
</template>

<style>
#npprofilestep {
  .npprofile { margin-block-end: var(--gap); input:first-child { flex: 0 1 200px; } .about { flex: 1; } }
  #npprofileadd { display: inline-flex; align-items: center; gap: 6px; }
  .nprow { display: flex; align-items: center; gap: var(--inset); min-height: var(--row); small { color: var(--text-muted); } }
}
</style>
