<script setup lang="ts">
// The agents Kulisa knows (lib/agents.ts) as a list to choose a task's agent from (AgentPicker.vue), whose state it
// draws (list): shadcn-vue's choice cards. Each row: who makes it and what it needs, whether it is on this computer,
// the project's accounts (main/accounts.ts). One that is not installed has an Install button: Kulisa runs its maker's
// installer (the command line is shown for the chosen one). Meanwhile the list says only that it is installing: the
// installer's own output (written for programmers: "open a new terminal and run …") is under Details, opened by itself
// when it fails (InstallProgress.vue).
import { Button } from '@/components/ui/button';
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import InstallProgress from './InstallProgress.vue';
import { agentMark, type Agent, type AgentList } from '../lib/agents';

const props = defineProps<{ list: AgentList }>();
const s = props.list.state;
const needs = (a: Agent) => (a.account ? '' : a.needs || '');
const installLine = (a: Agent) => (a.install && !a.installed && !a.account && s.selected === a.id ? `Install runs ${a.maker || 'its maker'}'s installer: ${a.install}` : '');
const mark = (a: Agent) => agentMark(a.agent || a.id, null);
const status = (a: Agent) => (a.installed ? (a.install && !a.account ? 'Installed' : '') : 'Not installed');
</script>

<template>
  <div :ref="(el) => { s.el = el as HTMLElement | null; }">
    <RadioGroup v-model="s.selected" aria-label="Agents" :disabled="s.installing">
      <p v-if="s.looking" class="text-muted-foreground">Looking for agents on this computer…</p>
      <FieldLabel v-for="a in s.agents" :key="a.id" :data-agent="a.id">
        <Field orientation="horizontal">
          <RadioGroupItem :value="a.id" />
          <component :is="mark(a)!" v-if="mark(a)" class="size-5 self-start" />
          <FieldContent>
            <FieldTitle>{{ a.account || !a.maker ? a.name : `${a.name} · ${a.maker}` }}</FieldTitle>
            <FieldDescription v-if="needs(a)">{{ needs(a) }}</FieldDescription>
            <FieldDescription v-if="installLine(a)" class="font-mono text-xs wrap-anywhere">{{ installLine(a) }}</FieldDescription>
          </FieldContent>
          <span class="text-muted-foreground">{{ status(a) }}</span>
          <Button v-if="!a.installed && a.install && !a.account" type="button" variant="outline" size="sm" :disabled="s.installing"
            @click.prevent="list.install(a.id)">Install</Button>
        </Field>
      </FieldLabel>
    </RadioGroup>
    <InstallProgress :list />
  </div>
</template>
