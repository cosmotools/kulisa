// One shared request per visible comparison; results expire with their last observer (../README.md).
import { QueryClient, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type { DiffSelection, Review } from '../ipc';
import { refused } from '../../shared/result';
import type { DiffActions } from './actions';
import type { Snapshot } from './review';

type Comparison = Pick<DiffSelection, 'folder' | 'options'>;
export const comparisonKey = ({ folder, options }: Comparison) => JSON.stringify({ folder, to: options.to });

export function createDiff(actions: DiffActions) {
  return { actions, client: new QueryClient({ defaultOptions: { queries: {
    gcTime: 0, retry: false, networkMode: 'always', structuralSharing: false,
    refetchOnMount: false, refetchOnWindowFocus: false, refetchOnReconnect: false,
  } } }) };
}
export type DiffSession = ReturnType<typeof createDiff>;

export function useDiff(session: DiffSession, comparison: Comparison, reviewing: boolean) {
  const { folder, options } = comparison;
  const queryKey = useMemo(() => [folder, options.to ?? null, reviewing] as const, [folder, options.to, reviewing]);
  const result = useQuery({ queryKey, refetchInterval: 3000, queryFn: async ({ signal }): Promise<Snapshot> => {
    const previous = session.client.getQueryData<Snapshot>(queryKey), loaded = previous?.loaded ?? [];
    const [response, parser] = await Promise.all([
      reviewing ? session.actions.review(folder, options, loaded) : session.actions.list(folder, options),
      reviewing ? import('./review') : null,
    ]);
    signal.throwIfAborted();
    if (refused(response)) throw new Error(response.error);
    if (!reviewing) return { data: response, entries: new Map(), loaded };
    return parser!.reviewSnapshot(response as Review, previous, comparisonKey(comparison));
  } }, session.client);
  const load = useCallback((path: string) => {
    session.client.setQueryData<Snapshot>(queryKey, (previous) => previous && {
      ...previous, loaded: [...previous.loaded.filter((p) => p !== path).slice(-3), path],
    });
    void session.client.invalidateQueries({ queryKey });
  }, [session.client, queryKey]);
  return { ...result, load };
}
