// Window/task authorization and shared lifetime for PDF and media leases (docs/tasks.md).
import path from 'node:path';
import { NativePdf, openMedia } from '../file-viewer/main/index.ts';
import { guardFocus } from '../browser/main/index.ts';
import { log } from './log.ts';
import { refused } from '../shared/result.ts';
import type { ViewerBox } from '../file-viewer/ipc.ts';
import type { AppWindow } from './window.ts';
import type { Task } from './tasks.ts';

export class ArtifactViewer {
  readonly native: NativePdf;
  private media: ReturnType<typeof openMedia> | null = null;
  private owner: { kind: 'PDF' | 'media'; key: string; file: string; request: string; controller: AbortController } | null = null;
  private window: AppWindow;
  constructor(window: AppWindow) {
    this.window = window;
    this.native = new NativePdf(window.win, { onContents: (wc) => guardFocus(wc, () => window.win),
      onFind: () => { window.win.webContents.focus(); window.send('artifact:pdf:find'); } });
  }
  async open(task: Task, file: string, request: string, box: ViewerBox) {
    if (task.viewFailed) return { error: 'That task’s screen could not be displayed.' };
    this.close();
    const owner = { kind: 'PDF' as const, key: task.key, file, request, controller: new AbortController() };
    this.owner = owner;
    try {
      const result = await task.readArtifactPdf(file, owner.controller.signal);
      if (this.owner !== owner || this.window.task !== task || this.window.switching || task.viewFailed) return { error: 'PDF opening was cancelled.' };
      if (refused(result)) { this.close(request); return result; }
      this.native.setHidden(this.window.viewsHidden);
      await this.native.open(result.bytes, result.name, box);
      if (this.owner !== owner) return { error: 'PDF opening was cancelled.' };
      log.info(`[artifact-viewer] PDF opened task=${task.key} wc=${this.native.contents?.id}`);
      return {};
    } catch (error) { this.close(request); return { error: (error as Error).message }; }
  }
  async openMedia(task: Task, file: string, revision: string, request: string) {
    if (task.viewFailed) return { error: 'That task’s screen could not be displayed.' };
    this.close();
    const owner = { kind: 'media' as const, key: task.key, file, request, controller: new AbortController() };
    this.owner = owner;
    try {
      const found = await task.findArtifact(file);
      owner.controller.signal.throwIfAborted();
      if (this.window.task !== task || this.window.switching || task.viewFailed) throw new Error('Media opening was cancelled.');
      if (refused(found)) { this.close(request); return found; }
      if (found.artifact.directory || found.artifact.revision !== revision) throw new Error('The artifact changed. Select it again to reload.');
      this.media = openMedia(this.window.win.webContents.session, { size: found.artifact.bytes,
        read: async (offset, length, signal) => {
          signal.throwIfAborted(); owner.controller.signal.throwIfAborted();
          const result = await task.readArtifact(file, offset, length);
          signal.throwIfAborted(); owner.controller.signal.throwIfAborted();
          if (refused(result)) throw new Error(result.error ?? 'The artifact is unavailable.');
          if (result.revision !== revision) throw new Error('The artifact changed while reading.');
          return result.bytes;
        } });
      log.info(`[artifact-viewer] media opened task=${task.key}`);
      return { url: this.media.url };
    } catch (error) { this.close(request); return { error: (error as Error).message }; }
  }
  place(request: string, box: ViewerBox) { if (this.owner?.request === request) this.native.place(box); }
  find(request: string, query: string, forward: boolean) {
    return this.owner?.request === request ? this.native.find(query, forward) : Promise.resolve({ active: 0, matches: 0 });
  }
  close(request?: string) {
    if (request !== undefined && this.owner?.request !== request) return;
    if (this.owner) log.info(`[artifact-viewer] ${this.owner.kind} closed task=${this.owner.key}`);
    this.owner?.controller.abort();
    this.owner = null; this.native.close(); this.media?.dispose(); this.media = null;
  }
  closeFiles(key: string, files: string[] | null) {
    if (this.owner?.key === key && (!files || files.some((file) => this.owner!.file === path.resolve(file) || this.owner!.file.startsWith(path.resolve(file) + path.sep)))) this.close();
  }
  reconcile(key: string, files: string[]) { if (this.owner?.key === key && !files.includes(this.owner.file)) this.close(); }
}
