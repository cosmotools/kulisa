<script setup lang="ts">
// New Project's third step: its profiles, new ones (a name, who it is) and any of those there are already.
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { avatarSrc } from '../../lib/common';
import { useWizard } from './wizard';
import { PlusIcon, XIcon } from '@lucide/vue';

const w = useWizard();
const take = (id: string, on: boolean) => (on ? w.taken.add(id) : w.taken.delete(id));
</script>

<template>
  <FieldGroup id="npprofilestep" class="min-w-0 flex-1 overflow-y-auto">
    <FieldSet>
      <FieldLegend variant="label">New profiles</FieldLegend>
      <FieldDescription>The users of your app the agent works as, a browser profile each: a name and who it is ("seller; can approve refunds"). You
        sign in to them when the agent asks. None now: the agent makes those it needs.</FieldDescription>
      <div v-for="(f, i) in w.fresh.value" :key="i" class="flex gap-2" data-testid="npprofile">
        <Input v-model="f.name" class="w-48" data-name maxlength="64" placeholder="ann@shop.com" spellcheck="false" aria-label="Name" />
        <Input v-model="f.description" class="flex-1" maxlength="500" placeholder="Who it is in your app" aria-label="Who it is" />
        <Button type="button" variant="ghost" size="icon" title="Leave Out" aria-label="Leave Out" @click="w.fresh.value.splice(i, 1)"><XIcon /></Button>
      </div>
      <Button id="npprofileadd" type="button" variant="outline" class="w-fit" @click="w.fresh.value.push({ name: '', description: '' })"><PlusIcon />Add Profile</Button>
    </FieldSet>
    <FieldSet v-if="w.others.value.length">
      <FieldLegend variant="label">Your profiles</FieldLegend>
      <Field v-for="p in w.others.value" :key="p.id" orientation="horizontal" :data-profile="p.id">
        <Checkbox :id="`npprofile-${p.id}`" :model-value="w.taken.has(p.id)" @update:model-value="(on) => take(p.id, !!on)" />
        <FieldLabel :for="`npprofile-${p.id}`" class="font-normal">
          <Avatar class="size-5"><AvatarImage :src="avatarSrc(p.avatar)" alt="" /></Avatar>{{ p.name }} <span class="text-muted-foreground">{{ p.description }}</span></FieldLabel>
      </Field>
    </FieldSet>
  </FieldGroup>
</template>
