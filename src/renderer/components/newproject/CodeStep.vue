<script setup lang="ts">
// New Project's first step: what its code comes from, as JetBrains' New Project: the kinds on the left, the form on the
// right (wizard.ts has the rules).
import { computed, ref } from 'vue';
import { ListboxContent, ListboxItem, ListboxRoot } from 'reka-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from '@/components/ui/item';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWizard } from './wizard';
import { FolderIcon, FolderPlusIcon, GitBranchIcon, MinusIcon, PlusIcon } from '@lucide/vue';

const w = useWizard(), c = w.code;
const kinds = [{ value: 'new', label: 'New Folder', icon: FolderPlusIcon }, { value: 'folder', label: 'Folders on Disk', icon: FolderIcon },
  { value: 'clone', label: 'Clone from URL', icon: GitBranchIcon }] as const;
type InputRef = { $el: HTMLInputElement }; // shadcn-vue's Input, its element the field
const nameField = ref<InputRef>(), sourceField = ref<InputRef>();
const chosen = ref<string>();
const rows = computed(() => (c.from === 'folder' ? c.sources : c.urls.map((u) => ({ folder: u, state: '' }))));
const sourceLine = (x: { state: string }) => (x.state === 'repo' ? 'git' : 'no git');
// + in the folders' or URLs' toolbar: Browse… for a folder; a URL is typed in the field under the list.
const plus = () => (c.from === 'folder' ? w.browse(true) : sourceField.value?.$el.focus());
// −, or Delete in the list: the selected one left out.
const remove = () => { w.removeSource(chosen.value); chosen.value = undefined; };
defineExpose({ focus: () => nameField.value?.$el.focus() });
</script>

<template>
  <Tabs id="npfrom" v-model="c.from" orientation="vertical" class="min-h-0 flex-1 gap-6" @update:model-value="w.error.value = ''">
    <TabsList aria-label="Start from" class="shrink-0">
      <TabsTrigger v-for="k in kinds" :key="k.value" :value="k.value" :data-value="k.value" class="justify-start"><component :is="k.icon" />{{ k.label }}</TabsTrigger>
    </TabsList>
    <FieldGroup class="min-w-0 flex-1 overflow-y-auto">
      <!-- One folder or URL (the welcome's): taken as it is left, or at Next -->
      <Field v-if="c.from !== 'new' && w.single" id="npsingle">
        <FieldLabel for="npsource">{{ c.from === 'folder' ? 'Folder' : 'URL' }}</FieldLabel>
        <div class="flex gap-2">
          <Input id="npsource" v-model="c.typed" spellcheck="false" :placeholder="c.from === 'folder' ? '~/IdeaProjects/shop' : 'git@github.com:me/shop.git'"
            @input="w.error.value = ''" @change="w.addSource()" />
          <Button v-if="c.from === 'folder'" id="npbrowsesource" type="button" variant="outline" @click="w.browse(true)">Browse…</Button>
        </div>
      </Field>
      <!-- Folders or URLs, one or several (a frontend and a backend): Enter or Add puts the one typed in the list -->
      <Field v-else-if="c.from !== 'new'" id="npsources">
        <div class="flex items-center gap-1">
          <FieldLabel for="npsource" class="mr-auto">{{ c.from === 'folder' ? 'Folders' : 'URLs' }}</FieldLabel>
          <Button :id="c.from === 'folder' ? 'npbrowsesource' : 'npurladd'" type="button" variant="ghost" size="icon-sm" :title="c.from === 'folder' ? 'Add Folder…' : 'Add a URL'"
            :aria-label="c.from === 'folder' ? 'Add Folder' : 'Add a URL'" @click="plus"><PlusIcon /></Button>
          <Button type="button" variant="ghost" size="icon-sm" title="Leave Out" aria-label="Leave Out" :disabled="!chosen" @click="remove"><MinusIcon /></Button>
        </div>
        <ListboxRoot v-if="rows.length" v-model="chosen" selection-behavior="replace" :aria-label="c.from === 'folder' ? 'Folders' : 'URLs'" @keydown.delete="remove">
          <ListboxContent as-child>
            <ItemGroup class="max-h-48 overflow-y-auto rounded-lg border p-1">
              <ListboxItem v-for="(x, i) in rows" :key="x.folder" :value="x.folder" as-child>
                <Item size="xs" class="data-[state=checked]:bg-muted" :data-source="x.folder" :aria-label="x.folder">
                  <ItemContent class="min-w-0"><ItemTitle class="max-w-full truncate" :title="x.folder">{{ x.folder }}</ItemTitle></ItemContent>
                  <ItemActions>
                    <Badge v-if="x.state" variant="outline">{{ sourceLine(x) }}</Badge>
                    <Badge v-if="!i && rows.length > 1" variant="secondary">default</Badge>
                  </ItemActions>
                </Item>
              </ListboxItem>
            </ItemGroup>
          </ListboxContent>
        </ListboxRoot>
        <Empty v-else class="border p-4"><EmptyTitle class="text-sm font-normal text-muted-foreground">{{ c.from === 'folder' ? 'No folders yet' : 'No URLs yet' }}</EmptyTitle></Empty>
        <div class="flex gap-2">
          <Input id="npsource" ref="sourceField" v-model="c.typed" spellcheck="false" :aria-label="c.from === 'folder' ? 'A folder' : 'A repository URL'"
            :placeholder="c.from === 'folder' ? '~/IdeaProjects/shop' : 'git@github.com:me/shop.git'" @input="w.error.value = ''" @keydown.enter.prevent="w.addSource()" />
          <Button id="npaddsource" type="button" variant="outline" @click="w.addSource()">Add</Button>
        </div>
      </Field>
      <Field v-if="w.askName.value">
        <FieldLabel for="npname">{{ w.single ? 'Project name' : 'Name' }}</FieldLabel>
        <Input id="npname" ref="nameField" v-model="c.name" data-name maxlength="64" placeholder="e.g. tenant-audit" spellcheck="false" @input="w.error.value = ''" />
      </Field>
      <Field v-if="c.from !== 'folder'" id="nplocationrow">
        <FieldLabel for="nplocation">Location</FieldLabel>
        <div class="flex gap-2">
          <Input id="nplocation" v-model="c.place" spellcheck="false" @input="w.error.value = ''" />
          <Button id="npbrowse" type="button" variant="outline" title="Browse…" @click="w.browse()">Browse…</Button>
        </div>
      </Field>
      <FieldDescription id="npwhere" class="empty:hidden">{{ w.where.value }}</FieldDescription>
      <FieldDescription v-if="w.single && c.from !== 'new'" id="npmore">A frontend and a backend? Add the other {{ c.from === 'folder' ? 'folder' : 'repository' }} later in Settings.</FieldDescription>
    </FieldGroup>
  </Tabs>
</template>
