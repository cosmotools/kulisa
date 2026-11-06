// One document session per caller; filesystem access and questions are injected (../README.md).
import { createStore } from 'zustand';
import type { EditState, EditorViewState } from '@pierre/diffs/edit';
import type { Result } from '../../shared/result';
import { refused } from '../../shared/result';
import type { EditorAction, EditorDocument, EditorSnapshot } from '../ipc';

export interface EditorActions {
  execute(action: EditorAction): Promise<Result<EditorSnapshot>>;
  external(path: string): Promise<unknown>;
  showFile(path: string): unknown;
  showMenu(event: MouseEvent, rows: { label: string; run(): unknown }[]): void;
  confirmDiscard(path: string): Promise<boolean>;
}
export function createEditorSession(actions: EditorActions) {
  const store = createStore<EditorSnapshot & { error?: string; loading: boolean }>()(() => ({ tabs: [], selected: null, loading: true }));
  const views = new Map<string, EditorViewState>(), scroll = new Map<string, number>();
  const histories = new Map<string, { version: number; state: EditState<'file', undefined> }>();
  const forget = (path: string) => { histories.delete(path); scroll.delete(path); views.delete(path); requests.delete(path); edits.delete(path); };
  let queue: Promise<unknown> = Promise.resolve(), edits = new Map<string, string>();
  const requests = new Map<string, number>();
  const receive = (state: EditorSnapshot) => store.setState((previous) => {
    // A response or autosave notification may arrive while newer input is still on its way to the core.
    const document = state.document?.path === state.selected ? state.document : previous.document?.path === state.selected ? previous.document : undefined;
    const text = document && edits.get(document.path);
    return { ...state, document: text !== undefined && document ? { ...document, text, dirty: true } : document,
      tabs: state.tabs.map((tab) => edits.has(tab.path) ? { ...tab, dirty: true } : tab), loading: false, error: undefined };
  });
  const run = (action: EditorAction): Promise<Result> => {
    const version = 'path' in action ? requests.get(action.path) : undefined;
    // Start IPC before waiting for older replies. The core serializes actions, and task closure must receive every
    // preceding input even if an earlier reply is slow. Only publishing responses waits for their request order.
    const response = Promise.resolve().then(() => actions.execute(action)).catch((error: unknown) =>
      ({ error: error instanceof Error ? error.message : String(error) }));
    const next = queue.then(async (): Promise<Result> => {
      try {
        const result = await response;
        if (refused(result)) { store.setState({ error: result.error, loading: false }); return result; }
        if (action.type === 'edit' && requests.get(action.path) === version) edits.delete(action.path);
        receive(result);
        if (result.external) await actions.external(result.external);
        return {};
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        store.setState({ error: message, loading: false }); return { error: message };
      }
    });
    queue = next;
    return next;
  };
  const session = {
    store, receive, views, scroll, histories,
    load: () => run({ type: 'list' }),
    open(path: string) { return run({ type: 'open', path }); },
    select(path: string) { return run({ type: 'select', path }); },
    menu(event: MouseEvent, path: string): void {
      actions.showMenu(event, [
        { label: 'Open in System Application', run: () => actions.external(path) },
        { label: 'Show in Folder', run: () => actions.showFile(path) },
        { label: 'Close', run: () => session.close(path) },
        { label: 'Close All', run: () => session.closeAll() },
      ]);
    },
    edit(doc: EditorDocument, text: string) {
      edits.set(doc.path, text); requests.set(doc.path, (requests.get(doc.path) ?? 0) + 1);
      store.setState((s) => ({ document: s.document?.path === doc.path ? { ...s.document, text, dirty: true } : s.document,
        tabs: s.tabs.map((tab) => tab.path === doc.path ? { ...tab, dirty: true } : tab) }));
      // Send input immediately: ordinary task/window closure must not lose a renderer's debounce buffer.
      void run({ type: 'edit', path: doc.path, text });
    },
    refresh() { const selected = store.getState().selected; if (selected) return run({ type: 'refresh', path: selected }); },
    retry() { const selected = store.getState().selected; if (selected) return run({ type: 'retry', path: selected }); },
    resolve(doc: EditorDocument, choice: 'disk' | 'mine') {
      return run({ type: 'resolve', path: doc.path, choice, revision: doc.disk?.revision ?? '' });
    },
    async close(path: string) {
      await queue;
      if (edits.has(path)) {
        if (await actions.confirmDiscard(path)) {
          const result = await run({ type: 'close', path, discard: true });
          if (!refused(result)) forget(path);
        }
        return;
      }
      const result = await run({ type: 'close', path });
      if (refused(result)) {
        if (!await actions.confirmDiscard(path)) return;
        const discarded = await run({ type: 'close', path, discard: true });
        if (!refused(discarded)) forget(path);
      } else forget(path);
    },
    async closeAll() {
      await queue;
      for (const { path } of store.getState().tabs) {
        await session.close(path);
        if (store.getState().tabs.some((tab) => tab.path === path)) break;
      }
    },
    dispose() { histories.clear(); scroll.clear(); views.clear(); edits.clear(); requests.clear(); },
  };
  return session;
}
export type EditorSession = ReturnType<typeof createEditorSession>;
