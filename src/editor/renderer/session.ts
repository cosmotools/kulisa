// One document session per caller; filesystem access and questions are injected (../README.md).
import { createStore } from 'zustand';
import { EditStateManager } from '@pierre/diffs/edit';
import type { Result } from '../../shared/result';
import { refused } from '../../shared/result';
import { MAX_DOCUMENTS, type EditorAction, type EditorDocument, type EditorSnapshot } from '../ipc';

let sessions = 0;
// Preserve every open file's history across callers rather than evicting it at the library's global default.
const capacity = (change: number) => EditStateManager.setCapacity(Math.max(1, (sessions += change) * MAX_DOCUMENTS));

export interface EditorActions {
  execute(action: EditorAction): Promise<Result<EditorSnapshot>>;
  external(path: string): Promise<unknown>;
  showFile(path: string): unknown;
  showMenu(event: MouseEvent, rows: { label: string; run(): unknown }[]): void;
  confirmDiscard(path: string): Promise<boolean>;
}
export function createEditorSession(actions: EditorActions) {
  capacity(1);
  const store = createStore<EditorSnapshot & { error?: string; loading: boolean }>()(() => ({ tabs: [], selected: null, loading: true }));
  const states = new Map<string, { version: number; key: string }>();
  let disposed = false;
  const clearState = (path: string) => { const state = states.get(path); if (state) EditStateManager.clear('file', state.key); states.delete(path); };
  const forget = (path: string) => { clearState(path); requests.delete(path); edits.delete(path); };
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
    store, receive,
    stateKey(doc: EditorDocument) {
      if (states.get(doc.path)?.version !== doc.version) {
        clearState(doc.path); states.set(doc.path, { version: doc.version, key: crypto.randomUUID() });
      }
      return states.get(doc.path)!.key;
    },
    complete(key: string) {
      // clear() refuses active entries. Completion runs after Pierre releases the old editor.
      if (disposed || ![...states.values()].some((state) => state.key === key)) EditStateManager.clear('file', key);
      return 'accept' as const;
    },
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
      if (edits.has(path) || refused(await run({ type: 'close', path }))) {
        if (!await actions.confirmDiscard(path)) return;
        if (refused(await run({ type: 'close', path, discard: true }))) return;
      }
      forget(path);
    },
    async closeAll() {
      await queue;
      for (const { path } of store.getState().tabs) {
        await session.close(path);
        if (store.getState().tabs.some((tab) => tab.path === path)) break;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const path of states.keys()) clearState(path);
      edits.clear(); requests.clear();
      // Finish the unmount's active-editor releases before shrinking the shared inactive-state cache.
      queueMicrotask(() => capacity(-1));
    },
  };
  return session;
}
export type EditorSession = ReturnType<typeof createEditorSession>;
