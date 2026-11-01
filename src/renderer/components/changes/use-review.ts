// One review request and one visible document snapshot (docs/tasks.md, Changes).
import { useEffect, useState } from 'react';
import { parseDiffFromFile, parsePatchFiles, type CodeViewItem } from '@pierre/diffs';
import type { ChangeSelection, Review } from '../../../shared/changes';
import { refused } from '../../../shared/result';
import { comparisonKey, observeChanges, publishChanges, reviewActivity } from './changes-state';

export type Notice = { kind: 'loading' | 'deferred' | 'notice' | 'error'; text: string };
export const loading: Notice = { kind: 'loading', text: 'Loading diff…' };
export function placeholder(path: string, notice: Notice, version = 0): CodeViewItem<Notice> {
  return { id: path, type: 'file', version, file: { name: path, contents: '', lang: 'text' }, annotations: [{ lineNumber: 0, metadata: notice }] };
}
type Entry = { signature: string; item: CodeViewItem<Notice> };
type Snapshot = { answer: Review | null; error: string | null; entries: Map<string, Entry> };

export function useReview(selection: ChangeSelection) {
  const [snapshot, setSnapshot] = useState<Snapshot>({ answer: null, error: null, entries: new Map() });
  const [loaded, setLoaded] = useState<string[]>([]);
  const { task, folder } = selection, target = selection.options.to, query = comparisonKey(selection);
  useEffect(() => {
    let active = true, timer = 0;
    const stopObserving = observeChanges(), options = { to: target };
    reviewActivity.setState(query, true);
    const read = async () => {
      try {
        const response = await kulisa.invoke('task:review', { key: task, folder, options, load: loaded });
        if (!active) return;
        publishChanges({ task, folder, options }, response);
        if (refused(response)) setSnapshot((previous) => ({ ...previous, error: response.error }));
        else {
          // Release patch strings after parsing; only the current document's models remain alive.
          const metadata = { ...response, patch: '', diffs: [] };
          setSnapshot((previous) => {
            const changed = response.diffs.filter(({ path, result }) => previous.entries.get(path)?.signature !== JSON.stringify(refused(result) ? result : { ...result, addition: undefined }));
            const parsed = changed.some(({ result }) => !refused(result) && result.version && result.addition === undefined)
              ? new Map(parsePatchFiles(response.patch).flatMap((patch) => patch.files).map((file) => [file.name, file])) : new Map();
            const entries = new Map<string, Entry>();
            for (const { path, result } of response.diffs) {
              // Versions include Git's patch headers, so status changes also invalidate a model.
              const signature = JSON.stringify(refused(result) ? result : { ...result, addition: undefined });
              const previousEntry = previous.entries.get(path);
              if (previousEntry?.signature === signature) { entries.set(path, previousEntry); continue; }
              let model = parsed.get(path);
              if (!refused(result) && result.addition !== undefined) {
                model = parseDiffFromFile(null, { name: 'file', contents: result.addition }); model.name = path;
              }
              const notice: Notice = refused(result) ? { kind: 'error', text: result.error }
                : result.deferred ? { kind: 'deferred', text: result.deferred }
                : result.notice ? { kind: 'notice', text: result.notice }
                : { kind: 'error', text: 'The file changed while loading. Refreshing will try again.' };
              const version = (previousEntry?.item.version ?? 0) + 1;
              if (model) model.cacheKey = `${query}:${path}:${signature}`;
              entries.set(path, { signature, item: model ? { id: path, type: 'diff', version, fileDiff: model } : placeholder(path, notice, version) });
            }
            return { answer: metadata, error: null, entries };
          });
        }
      } catch (e) { if (active) setSnapshot((previous) => ({ ...previous, error: (e as Error).message })); }
      if (active) timer = window.setTimeout(() => void read(), 3000);
    };
    void read();
    return () => {
      active = false; clearTimeout(timer); stopObserving();
      if (reviewActivity.getState() === query) reviewActivity.setState(null, true);
    };
  }, [task, folder, target, query, loaded]);
  return { ...snapshot, load: (path: string) => setLoaded((previous) => [...previous.filter((p) => p !== path).slice(-3), path]) };
}
