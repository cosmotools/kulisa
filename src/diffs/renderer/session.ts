// A visible comparison's metadata and reader coordination (../README.md).
import { createStore } from 'zustand';
import type { DiffOptions, DiffSelection, Diffs } from '../ipc';
import { refused, type Result } from '../../shared/result';
import type { DiffsActions } from './actions';

type Comparison = Pick<DiffSelection, 'folder' | 'options'>;
type Listing = { query: string; options: DiffOptions; result: Result<Diffs>; metadata: Diffs | null };
export const comparisonKey = ({ folder, options }: Comparison) => JSON.stringify({ folder, to: options.to });

export function createDiffs(actions: DiffsActions) {
  const listings = createStore(() => new Map<string, Listing>());
  const activity = createStore<string | null>(() => null);
  let readers = 0;
  return {
    actions, listings, activity,
    observe() {
      readers++;
      return () => { if (--readers === 0) listings.setState(new Map(), true); };
    },
    publish(comparison: Comparison, result: Result<Diffs>) {
      const previous = listings.getState().get(comparison.folder);
      if (!refused(result)) {
        const { git, revision, from, to, branch, branches, files } = result;
        result = { git, revision, from, to, branch, branches, files };
      }
      const metadata = refused(result) ? previous?.metadata ?? null : result;
      listings.setState(new Map(listings.getState()).set(comparison.folder,
        { query: comparisonKey(comparison), options: comparison.options, result, metadata }), true);
    },
  };
}
export type DiffsSession = ReturnType<typeof createDiffs>;
