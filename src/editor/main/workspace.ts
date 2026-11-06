// Recoverable documents and version-checked autosaving (../README.md).
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { resourcePath } from '../../project-explorer/main/index.ts';
import { writeFileAtomic } from '../../main/files.ts';
import type { Result } from '../../shared/result.ts';
import { refused } from '../../shared/result.ts';
import { MAX_DOCUMENTS, MAX_FILE_BYTES, type EditorAction, type EditorDocument, type EditorSnapshot } from '../ipc.ts';

interface Document extends EditorDocument { revision: string; bom: boolean; mode: number; writeError?: boolean }
const revision = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const message = (error: unknown) => error instanceof Error ? error.message : String(error);
class UnsupportedFile extends Error {}

function read(file: string) {
  if (!fs.statSync(file).isFile()) throw new Error('This is not a regular file.');
  const fd = fs.openSync(file, 'r');
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile()) throw new Error('This is not a regular file.');
    if (stat.size > MAX_FILE_BYTES) throw new UnsupportedFile('Files larger than 1 MB open in the system application.');
    // A bounded read also covers files growing between stat and read.
    const bytes = Buffer.alloc(MAX_FILE_BYTES + 1), size = fs.readSync(fd, bytes, 0, bytes.length, 0), data = bytes.subarray(0, size);
    if (size > MAX_FILE_BYTES) throw new UnsupportedFile('Files larger than 1 MB open in the system application.');
    if (data.some((byte) => byte === 0 || byte < 9 || byte > 13 && byte < 32)) throw new UnsupportedFile('Binary files open in the system application.');
    let text: string;
    try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(data); }
    catch { throw new UnsupportedFile('This encoding is not supported. Open the file in the system application.'); }
    const bom = text.startsWith('\uFEFF');
    return { text: bom ? text.slice(1) : text, bom, revision: revision(data), mode: stat.mode };
  } finally { fs.closeSync(fd); }
}

export class EditorWorkspace {
  private documents = new Map<string, Document>();
  private selected: string | null = null;
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private queue: Promise<unknown> = Promise.resolve();
  private restored = false;
  private stopped = false;
  private readonly directory: string;
  private readonly roots: () => string[];
  private readonly changed: (state: EditorSnapshot) => void;
  private readonly activity: (action: string, file: string) => void;
  constructor(options: { directory: string; roots(): string[]; changed(state: EditorSnapshot): void; activity(action: string, file: string): void }) {
    this.directory = options.directory; this.roots = options.roots; this.changed = options.changed; this.activity = options.activity;
  }
  private snapshot(document?: Document): EditorSnapshot {
    return { tabs: [...this.documents.values()].map(({ path, dirty, conflict, error }) => ({ path, dirty, conflict, error })),
      selected: this.selected, document: document && { ...document } };
  }
  private draft(file: string) { return path.join(this.directory, `${revision(Buffer.from(file))}.json`); }
  private persist(document?: Document) {
    fs.mkdirSync(this.directory, { recursive: true });
    if (document) {
      if (document.dirty) writeFileAtomic(this.draft(document.path), JSON.stringify(document), { mode: 0o600 });
      else fs.rmSync(this.draft(document.path), { force: true });
    }
    writeFileAtomic(path.join(this.directory, 'tabs.json'), JSON.stringify({ paths: [...this.documents.keys()], selected: this.selected }), { mode: 0o600 });
  }
  private async restore() {
    if (this.restored) return;
    this.restored = true;
    const file = path.join(this.directory, 'tabs.json');
    if (!fs.existsSync(file)) return;
    let saved: { paths: string[]; selected: string | null };
    try { saved = JSON.parse(fs.readFileSync(file, 'utf8')); if (!Array.isArray(saved.paths)) throw new Error(); }
    catch { throw new Error('The saved editor tabs could not be read. Recovery drafts have been kept.'); }
    for (const name of saved.paths.slice(0, MAX_DOCUMENTS)) {
      try {
        const draft = this.draft(name);
        if (fs.existsSync(draft) && fs.statSync(draft).size <= MAX_FILE_BYTES * 12) {
          const doc = JSON.parse(fs.readFileSync(draft, 'utf8')) as Document;
          if (doc.path !== name || typeof doc.text !== 'string' || typeof doc.base !== 'string' || Buffer.byteLength(doc.text) > MAX_FILE_BYTES) continue;
          doc.version = 0; doc.dirty = true; doc.conflict = false; delete doc.error; delete doc.writeError;
          this.documents.set(name, doc);
          await this.refresh(doc);
          // Recovery never silently writes a previous run's draft over an agent's work.
          if (doc.dirty && !doc.conflict && !doc.error) this.schedule(doc);
        } else {
          const found = await resourcePath(this.roots(), name);
          if (refused(found)) continue;
          const disk = read(found.path);
          this.documents.set(name, { path: name, ...disk, base: disk.text, version: 0, dirty: false, conflict: false });
        }
      } catch { this.activity('restore failed; draft retained', name); }
    }
    this.selected = saved.selected && this.documents.has(saved.selected) ? saved.selected : this.documents.keys().next().value ?? null;
  }
  execute(action: EditorAction): Promise<Result<EditorSnapshot>> {
    const next = this.queue.then(async (): Promise<Result<EditorSnapshot>> => {
      try {
        if (this.stopped) return { error: 'The editor is closed.' };
        await this.restore();
        return await this.perform(action);
      } catch (error) { return { error: message(error) }; }
    });
    this.queue = next;
    return next;
  }
  private async perform(action: EditorAction): Promise<Result<EditorSnapshot>> {
    if (action.type === 'list') return this.snapshot(this.selected ? this.documents.get(this.selected) : undefined);
    let doc = this.documents.get(action.path);
    if (action.type === 'open' && !doc) {
      const found = await resourcePath(this.roots(), action.path);
      if (refused(found)) return found;
      let disk: ReturnType<typeof read>;
      try { disk = read(found.path); }
      catch (error) {
        if (!(error instanceof UnsupportedFile)) throw error;
        return { ...this.snapshot(), external: found.path, notice: message(error) };
      }
      if (this.documents.size >= MAX_DOCUMENTS) return { error: 'Close a file before opening another (12 files maximum).' };
      doc = { path: action.path, ...disk, base: disk.text, version: 0, dirty: false, conflict: false };
      this.documents.set(doc.path, doc);
      this.activity('open', doc.path);
    }
    if (!doc) return { error: 'This document is no longer open.' };
    if (action.type === 'open' || action.type === 'select') { this.selected = doc.path; await this.refresh(doc); this.persist(); }
    if (action.type === 'edit') {
      if (Buffer.byteLength(action.text) + (doc.bom ? 3 : 0) > MAX_FILE_BYTES) return { error: 'The document exceeds the 1 MB editor limit. Your text remains in the editor.' };
      doc.text = action.text; doc.dirty = doc.text !== doc.base;
      delete doc.writeError; delete doc.error;
      // Durability precedes the autosave timer; closing the window cannot strand a queued write in the renderer.
      this.persist(doc);
      if (!doc.conflict) this.schedule(doc);
    }
    if (action.type === 'refresh') {
      await this.refresh(doc);
      if (doc.dirty && !doc.conflict && !doc.error && !this.timers.has(doc.path)) this.schedule(doc);
    }
    if (action.type === 'retry') { delete doc.writeError; delete doc.error; await this.save(doc); }
    if (action.type === 'resolve') {
      await this.refresh(doc);
      const found = await resourcePath(this.roots(), doc.path);
      if (refused(found)) return found;
      const disk = read(found.path);
      if (disk.revision !== action.revision) return { error: 'The file changed again. Compare the latest version before choosing.' };
      this.cancel(doc.path);
      doc.base = disk.text; doc.revision = disk.revision; doc.mode = disk.mode; doc.bom = disk.bom;
      if (action.choice === 'disk') { doc.text = disk.text; doc.version++; }
      doc.conflict = false; delete doc.error; delete doc.disk; delete doc.writeError; doc.dirty = doc.text !== doc.base;
      this.persist(doc);
      if (doc.dirty) this.schedule(doc);
      this.activity(`resolve ${action.choice}`, doc.path);
    }
    if (action.type === 'close') {
      this.cancel(doc.path);
      if (doc.dirty && !action.discard) { await this.save(doc); if (doc.dirty) return { error: 'This file has unsaved changes. Resolve the conflict or discard the changes before closing.' }; }
      this.documents.delete(doc.path); fs.rmSync(this.draft(doc.path), { force: true });
      if (this.selected === doc.path) this.selected = this.documents.keys().next().value ?? null;
      this.persist(); this.activity('close', doc.path);
      return this.snapshot(this.selected ? this.documents.get(this.selected) : undefined);
    }
    return this.snapshot(doc);
  }
  private cancel(file: string) { clearTimeout(this.timers.get(file)); this.timers.delete(file); }
  private schedule(doc: Document) {
    this.cancel(doc.path);
    if (!doc.dirty || this.stopped) return;
    this.timers.set(doc.path, setTimeout(() => {
      this.timers.delete(doc.path);
      this.queue = this.queue.then(async () => {
        if (this.stopped) return;
        await this.save(doc); this.changed(this.snapshot(doc));
      }).catch((error) => this.activity(`autosave failed: ${message(error)}`, doc.path));
    }, 600));
  }
  private async refresh(doc: Document) {
    try {
      const found = await resourcePath(this.roots(), doc.path);
      if (refused(found)) throw new Error(found.error);
      const disk = read(found.path);
      if (!doc.writeError) delete doc.error;
      if (disk.revision === doc.revision) { doc.mode = disk.mode; doc.conflict = false; delete doc.disk; return; }
      if (doc.dirty && disk.text !== doc.text) { doc.conflict = true; doc.disk = { text: disk.text, revision: disk.revision }; this.cancel(doc.path); return; }
      const changed = doc.text !== disk.text;
      Object.assign(doc, disk, { base: disk.text, dirty: false, conflict: false });
      delete doc.disk; delete doc.error; delete doc.writeError;
      if (changed) doc.version++;
      this.persist(doc); this.activity('reload', doc.path);
    } catch (error) { doc.error = message(error); this.cancel(doc.path); }
  }
  private async save(doc: Document) {
    await this.refresh(doc);
    if (!doc.dirty || doc.conflict || doc.error) return;
    try {
      const found = await resourcePath(this.roots(), doc.path);
      if (refused(found)) throw new Error(found.error);
      const disk = read(found.path);
      if (disk.revision !== doc.revision) { doc.conflict = true; return; }
      if ((disk.mode & 0o222) === 0) throw new Error('The file is read-only.');
      const bytes = Buffer.from(`${doc.bom ? '\uFEFF' : ''}${doc.text}`);
      // The core's atomic writer preserves complete contents; retain the source's executable/permission bits.
      writeFileAtomic(found.path, bytes, { mode: disk.mode & 0o777 });
      doc.base = doc.text; doc.revision = revision(bytes); doc.dirty = false; delete doc.error;
      this.persist(doc); this.activity('autosave', doc.path);
    } catch (error) { doc.error = message(error); doc.writeError = true; this.activity('autosave refused', doc.path); }
  }
  async dispose() {
    for (const file of this.timers.keys()) this.cancel(file);
    await this.queue;
    for (const doc of this.documents.values()) if (doc.dirty) await this.save(doc);
    this.stopped = true; this.documents.clear();
  }
}
