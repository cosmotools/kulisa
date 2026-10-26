<script setup lang="ts">
// New Project's second step: its agents, the accounts there are first, then a new one of Claude Code or Codex
// (wizard.ts has the rules).
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Empty, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Toggle } from '@/components/ui/toggle';
import AccountSignIn from '../AccountSignIn.vue';
import InstallProgress from '../InstallProgress.vue';
import { agentMark } from '../../lib/agents';
import { useWizard } from './wizard';
import type { Account } from '../../../shared/types';
import { StarIcon } from '@lucide/vue';

const w = useWizard();
const accountName = (a: Account) => `${a.name} · ${a.email || a.id}`;
</script>

<template>
  <FieldGroup id="npagentstep" class="min-w-0 flex-1 overflow-y-auto">
    <FieldSet>
      <FieldLegend variant="label">Accounts</FieldLegend>
      <FieldDescription>Who works in its tasks: agents signed in to your accounts, one or several (a new task starts the default one; the others
        open beside it). Change it any time in Settings.</FieldDescription>
      <div id="npagents" class="flex flex-col gap-2">
        <Field v-for="a in w.accounts.value" :key="a.id" orientation="horizontal" :data-account="a.id">
          <Checkbox :id="`npaccount-${a.id}`" :model-value="w.chosen.value.includes(a.id)" @update:model-value="(on) => w.choose(a.id, !!on)" />
          <FieldLabel :for="`npaccount-${a.id}`" class="font-normal"><component :is="agentMark(a.agent)!" />{{ accountName(a) }}</FieldLabel>
          <template v-if="w.chosen.value.includes(a.id)">
            <Badge v-if="w.isDefault(a.id)" variant="secondary">default</Badge>
            <Toggle size="sm" :model-value="w.isDefault(a.id)" :title="w.isDefault(a.id) ? 'The default: a new task starts it' : 'Make Default'" aria-label="Default"
              @update:model-value="w.main.value = a.id"><StarIcon /></Toggle>
          </template>
        </Field>
        <Empty v-if="!w.accounts.value.length" class="border p-4"><EmptyTitle class="text-sm font-normal text-muted-foreground">No accounts yet: add one below, or go on without (a task then starts with a terminal).</EmptyTitle></Empty>
      </div>
    </FieldSet>
    <FieldSet>
      <FieldLegend variant="label">Add account</FieldLegend>
      <AccountSignIn v-if="w.signing.value" :agent="w.signing.value" @done="w.signedIn" @close="w.signing.value = null" />
      <template v-else>
        <div class="flex flex-wrap gap-2">
          <Button v-for="a in w.addable.value" :key="a.id" type="button" variant="outline" :data-add="a.id" :disabled="w.installs.state.installing || (!a.installed && !a.install)"
            :title="a.installed ? `Sign in to an account of ${a.name}` : `${a.name} is installed first (its maker's installer), then you sign in`"
            @click="w.addAccount(a)"><component :is="agentMark(a.id)!" />{{ a.name }}</Button>
        </div>
        <InstallProgress :list="w.installs" />
      </template>
    </FieldSet>
  </FieldGroup>
</template>
