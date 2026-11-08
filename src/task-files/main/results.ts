// Result listing, watchers and bounded previews; caller owns the surrounding lifecycle (../README.md).
import electron from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { listArtifacts, ownedPath } from './files.ts';
import { readPreview } from './preview.ts';
import type { Artifact } from '../ipc.ts';

interface Host {
  directory: string;
  artifacts: string;
  prepare(): boolean;
  isOpen(): boolean;
  changed(): Promise<void> | undefined;
  activity(message: string): void;
}

// Extra preview resolution keeps 32px rows sharp on high-density displays.
const THUMB_WIDTH = 128;

export class TaskFiles {
  private host: Host;
  private disposed = false;
  constructor(host: Host) { this.host = host; }
  dispose() {
    this.disposed = true;
    this.stopArtifactWatch(); this.thumbs.clear(); this.thumbnailQueue.clear();
  }
  private artifactWatch?: fs.FSWatcher;
  private artifactRootWatch?: fs.FSWatcher;
  private artifactPoll?: NodeJS.Timeout;
  private artifactTimer?: NodeJS.Timeout;
  private stopArtifactWatch() {
    this.artifactWatch?.close(); this.artifactWatch = undefined;
    this.artifactRootWatch?.close(); this.artifactRootWatch = undefined;
    clearInterval(this.artifactPoll); this.artifactPoll = undefined;
    clearTimeout(this.artifactTimer); this.artifactTimer = undefined;
  }
  private watchArtifacts() {
    if (this.artifactRootWatch || this.artifactPoll) return;
    if (!this.host.prepare()) return;
    const changed = () => {
      if (!this.artifactTimer) this.artifactTimer = setTimeout(() => {
        this.artifactTimer = undefined; this.changed();
      }, 200).unref();
    };
    const attach = () => {
      this.artifactWatch?.close();
      if (fs.existsSync(this.host.artifacts) && !fs.lstatSync(this.host.artifacts).isSymbolicLink()) {
        this.artifactWatch = fs.watch(this.host.artifacts, { recursive: true, persistent: false }, (_event, name) => {
          if (name) this.thumbs.delete(path.join(this.host.artifacts, name.toString())); else this.thumbs.clear();
          changed();
        });
        this.artifactWatch.on('error', fallback);
      }
    };
    const fallback = () => {
      this.stopArtifactWatch();
      this.host.activity('filesystem watch unavailable; polling results');
      this.artifactPoll = setInterval(changed, 2000).unref();
    };
    try {
      attach();
      this.artifactRootWatch = fs.watch(this.host.directory, { persistent: false }, (_event, name) => {
        if (!name || name.toString() === path.basename(this.host.artifacts)) { try { attach(); } catch { fallback(); } changed(); }
      });
      this.artifactRootWatch.on('error', fallback);
    } catch { fallback(); }
  }
  // Only rendered rows request thumbnails. Bound retained previews independently of the human's disk storage.
  private thumbs = new Map<string, { revision: string; thumb: string | null }>();
  private thumbnailQueue = new Set<string>();
  private makingThumbs = false;
  private artifactVersion = 0;
  private artifactScan?: { version: number; promise: Promise<Artifact[]> };
  list(): Promise<Artifact[]> {
    if (this.artifactScan) return this.artifactScan.version === this.artifactVersion ? this.artifactScan.promise
      : this.artifactScan.promise.then(() => this.list());
    const promise = this.readArtifacts().finally(() => { this.artifactScan = undefined; });
    this.artifactScan = { version: this.artifactVersion, promise };
    return promise;
  }
  private async readArtifacts(): Promise<Artifact[]> {
    if (!this.disposed && this.host.isOpen()) this.watchArtifacts();
    const list = await listArtifacts(this.host.artifacts), revisions = new Map(list.map((a) => [a.file, a.revision]));
    for (const [file, cached] of this.thumbs) if (revisions.get(file) !== cached.revision) this.thumbs.delete(file);
    return list.map((a) => ({ ...a, thumb: this.thumbs.get(a.file)?.thumb ?? null }));
  }
  async thumbnails(files: string[]) {
    const list = await listArtifacts(this.host.artifacts), wanted = new Set(files);
    if (this.disposed || !this.host.isOpen()) return;
    for (const a of list) if (wanted.has(a.file) && !a.directory && /\.(png|jpe?g|webp)$/i.test(a.file)
      && this.thumbs.get(a.file)?.revision !== a.revision) {
      this.thumbnailQueue.add(a.file);
      while (this.thumbnailQueue.size > 128) this.thumbnailQueue.delete(this.thumbnailQueue.values().next().value!);
    }
    if (this.makingThumbs || !this.thumbnailQueue.size) return;
    this.makingThumbs = true;
    try {
      while (!this.disposed && this.thumbnailQueue.size && this.host.isOpen()) {
        const file = this.thumbnailQueue.values().next().value!; this.thumbnailQueue.delete(file);
        await new Promise((r) => setImmediate(r));
        const a = list.find((a) => a.file === file);
        if (this.disposed || !a || !await ownedPath(this.host.artifacts, file)) continue;
        const now = await fs.promises.lstat(file).catch((): null => null);
        if (!now || now.size !== a.bytes || now.mtimeMs !== a.time) continue;
        let thumb: string | null = null;
        if (a.bytes <= 16 * 1024 * 1024) {
          const data = await readPreview(file);
          if (this.disposed) break;
          const image = data ? electron.nativeImage.createFromBuffer(data) : null;
          if (image && !image.isEmpty()) thumb = `data:image/jpeg;base64,${image.crop({ x: 0, y: 0, width: image.getSize().width, height: Math.min(image.getSize().height, image.getSize().width) }).resize({ width: THUMB_WIDTH }).toJPEG(80).toString('base64')}`;
        }
        this.thumbs.delete(file); this.thumbs.set(file, { revision: a.revision, thumb });
        while (this.thumbs.size > 128) this.thumbs.delete(this.thumbs.keys().next().value!);
      }
    } finally { this.makingThumbs = false; this.changed(); }
  }
  private sendingArtifacts = false;
  private artifactsAgain = false;
  changed() {
    if (this.disposed) return;
    this.artifactVersion++;
    this.artifactsAgain = true;
    if (!this.sendingArtifacts) void this.sendArtifactChanges();
  }
  private async sendArtifactChanges() {
    this.sendingArtifacts = true;
    try {
      while (!this.disposed && this.artifactsAgain && this.host.isOpen()) {
        this.artifactsAgain = false; await this.host.changed();
      }
    } catch (error) { this.host.activity(`refresh failed: ${(error as Error).message}`); }
    finally { this.sendingArtifacts = false; }
  }
}
