<script setup lang="ts">
// A repository's GitHub account on its row of a project's page (src/github/README.md, A repository's account): Reka's
// Select, a menu's look, the chosen account in a .select; choosing one binds the repository's remote to it.
import { SelectContent, SelectItem, SelectItemIndicator, SelectItemText, SelectPortal, SelectRoot, SelectTrigger, SelectValue, SelectViewport } from 'reka-ui';
import Icon from '../Icon.vue';
import { covered } from '../../lib/cover';
import type { ProjectGitHub } from '../../../shared/types';

const props = defineProps<{ repo: ProjectGitHub['repos'][number]; accounts: ProjectGitHub['accounts'] }>();
const emit = defineEmits<{ choose: [account: string] }>();
const { open, ready } = covered('pictures');
const name = (a: ProjectGitHub['accounts'][number]) => (a.kind === 'pat' ? `${a.login} (token)` : a.login);
const chosen = () => props.accounts.find((a) => a.id === props.repo.account);
</script>

<template>
  <SelectRoot v-model:open="open" :model-value="repo.account ?? undefined" @update:model-value="(v) => v && emit('choose', String(v))">
    <!-- Its keys are its own (Delete and the arrows would act on the list's row), but Esc, which closes Settings -->
    <SelectTrigger class="select ghaccount" :data-remote="repo.remote" :aria-label="`GitHub account of ${repo.repo}`"
      :title="repo.suggested ? `${chosen()?.login} reaches ${repo.repo}: suggested` : `The GitHub account ${repo.repo} goes as`" @keydown="(e: KeyboardEvent) => e.key !== 'Escape' && e.stopPropagation()">
      <SelectValue placeholder="Choose…">{{ chosen() ? name(chosen()!) : 'Choose…' }}</SelectValue><Icon name="i-down" />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent class="menu" :data-ready="ready || undefined" position="popper" align="start" :side-offset="4" :collision-padding="4">
        <SelectViewport>
          <SelectItem v-for="a in accounts" :key="a.id" :value="a.id" class="item" :data-account="a.id">
            <span class="text"><SelectItemText class="label">{{ name(a) }}</SelectItemText></span>
            <SelectItemIndicator as-child><Icon class="check" name="i-done" /></SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
