// Read-only discovery of a signed-in CLI setup (../README.md). Both onboarding and Settings show the
// native status result, never infer authentication from an installed binary or the presence of a config folder.
import { useEffect, useState } from 'react';
import { refused } from '../../shared/result';
import type { AgentInfo, ExistingAgentSetup } from '../ipc';

interface SetupResult { setup: ExistingAgentSetup | null; error: string }

export function useExistingSetups(agents: readonly AgentInfo[]) {
  const [result, setResult] = useState<{ key: string; revision: number; entries: Record<string, SetupResult> } | null>(null);
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify(agents.map((agent) => [agent.id, !!agent.installed]));
  const checking = result?.key !== key || result?.revision !== revision;
  useEffect(() => {
    let current = true;
    const requests: [string, boolean][] = JSON.parse(key);
    // Commit the batch together: native checks can finish in any order without inserting rows under the pointer.
    void Promise.all(requests.map(async ([id, installed]): Promise<[string, SetupResult]> => {
      if (!installed) return [id, { setup: null, error: '' }];
      try {
        const r = await kulisa.invoke('account:existing', { agent: id });
        return [id, { setup: refused(r) ? null : r.setup, error: refused(r) ? r.error : '' }];
      } catch (e) { return [id, { setup: null, error: String(e) }]; }
    })).then((entries) => { if (current) setResult({ key, revision, entries: Object.fromEntries(entries) }); });
    return () => { current = false; };
  }, [key, revision]);
  return { checking, entries: checking ? {} : result.entries, refresh: () => setRevision((n) => n + 1) };
}

export function useExistingSetup(agent: AgentInfo) {
  const { checking, entries, refresh } = useExistingSetups([agent]);
  return { checking: !!agent.installed && checking, setup: entries[agent.id]?.setup ?? null,
    error: entries[agent.id]?.error ?? '', refresh };
}
