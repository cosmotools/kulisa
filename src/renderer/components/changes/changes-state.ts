// Shared file listings for the current task's tree and review (docs/tasks.md, Changes).
import { createStore } from 'zustand';
import type { ChangeOptions, ChangeSelection, Changes } from '../../../shared/changes';
import { refused, type Result } from '../../../shared/result';
import { store } from '../../lib/store';

export type Comparison = Pick<ChangeSelection, 'task' | 'folder' | 'options'>;
type Listing = { query: string; options: ChangeOptions; result: Result<Changes>; metadata: Changes | null };
export const changeListings = createStore(() => new Map<string, Listing>());
export const reviewActivity = createStore<string | null>(() => null);
export const comparisonKey = ({ task, folder, options }: Comparison) => JSON.stringify({ task, folder, to: options.to });
let readers = 0;
export function observeChanges() {
  readers++;
  return () => { if (--readers === 0) changeListings.setState(new Map(), true); };
}

export function publishChanges(comparison: Comparison, result: Result<Changes>) {
  if (comparison.task !== store.getState().current) return;
  const listings = changeListings.getState(), previous = listings.get(comparison.folder);
  if (!refused(result)) {
    const { git, revision, from, to, branch, branches, files } = result;
    result = { git, revision, from, to, branch, branches, files };
  }
  const metadata = refused(result) ? previous?.metadata ?? null : result;
  changeListings.setState(new Map(listings).set(comparison.folder, { query: comparisonKey(comparison), options: comparison.options, result, metadata }), true);
}

store.subscribe((next, before) => {
  if (next.current !== before.current) changeListings.setState(new Map(), true);
});
