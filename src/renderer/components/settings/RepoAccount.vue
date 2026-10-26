<script setup lang="ts">
// A repository's GitHub account on its row of a project's page (src/github/README.md, A repository's account); choosing
// one binds the repository's remote to it.
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { covered } from '../../lib/cover';
import type { ProjectGitHub } from '../../../shared/types';

const props = defineProps<{ repo: ProjectGitHub['repos'][number]; accounts: ProjectGitHub['accounts'] }>();
const emit = defineEmits<{ choose: [account: string] }>();
const { open, ready } = covered('pictures');
const name = (a: ProjectGitHub['accounts'][number]) => (a.kind === 'pat' ? `${a.login} (token)` : a.login);
const chosen = () => props.accounts.find((a) => a.id === props.repo.account);
</script>

<template>
  <Select v-model:open="open" :model-value="repo.account ?? undefined" @update:model-value="(v) => v && emit('choose', String(v))">
    <!-- Its keys are its own (Delete and the arrows would act on the list's row), but Esc, which closes Settings -->
    <SelectTrigger size="sm" class="max-w-48" data-testid="ghaccount" :data-remote="repo.remote" :aria-label="`GitHub account of ${repo.repo}`"
      :title="repo.suggested ? `${chosen()?.login} reaches ${repo.repo}: suggested` : `The GitHub account ${repo.repo} goes as`" @keydown="(e: KeyboardEvent) => e.key !== 'Escape' && e.stopPropagation()">
      <SelectValue placeholder="Choose…">{{ chosen() ? name(chosen()!) : 'Choose…' }}</SelectValue>
    </SelectTrigger>
    <SelectContent class="not-data-ready:opacity-0" :data-ready="ready || undefined" position="popper" align="start" :collision-padding="4">
      <SelectItem v-for="a in accounts" :key="a.id" :value="a.id" :data-account="a.id">{{ name(a) }}</SelectItem>
    </SelectContent>
  </Select>
</template>
