// Preserve unchanged CodeView models while publishing a complete review (../README.md).
import { parseDiffFromFile, parsePatchFiles, type CodeViewItem } from '@pierre/diffs';
import type { Diff, Review } from '../ipc';
import { refused } from '../../shared/result';

export type Notice = { kind: 'deferred' | 'notice' | 'error'; text: string };
type Entry = { signature: string; item: CodeViewItem<Notice> };
export type Snapshot = { data: Diff; entries: Map<string, Entry>; loaded: string[] };

export function reviewSnapshot(response: Review, previous: Snapshot | undefined, query: string): Snapshot {
  const { diffs, ...data } = response;
  const entries = new Map<string, Entry>();
  for (const { path, result } of diffs) {
    const signature = JSON.stringify(refused(result) ? result : [result.version, result.notice, result.deferred]);
    const prior = previous?.entries.get(path);
    if (prior?.signature === signature) { entries.set(path, prior); continue; }
    let model = !refused(result) && result.patch ? parsePatchFiles(result.patch)[0]?.files[0] : undefined;
    if (!refused(result) && result.addition !== undefined) {
      model = parseDiffFromFile(null, { name: 'file', contents: result.addition }); model.name = path;
    }
    const notice: Notice = refused(result) ? { kind: 'error', text: result.error }
      : result.deferred ? { kind: 'deferred', text: result.deferred }
      : { kind: 'notice', text: result.notice ?? 'The file changed while loading. Refreshing will try again.' };
    const version = (prior?.item.version ?? 0) + 1;
    if (model) model.cacheKey = `${query}:${path}:${signature}`;
    entries.set(path, { signature, item: model ? { id: path, type: 'diff', version, fileDiff: model }
      : { id: path, type: 'file', version, file: { name: path, contents: '', lang: 'text' }, annotations: [{ lineNumber: 0, metadata: notice }] } });
  }
  return { data, entries, loaded: previous?.loaded ?? [] };
}
