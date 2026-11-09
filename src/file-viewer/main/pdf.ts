// One ephemeral native PDF view per host; no preload, filesystem or network access (../README.md).
import electron from 'electron';
import { randomUUID } from 'node:crypto';
import type { BrowserWindow, WebContents, WebContentsView } from 'electron';
import type { ViewerBox, ViewerSearchResult } from '../ipc.ts';

const LIMIT = 32 * 1024 * 1024;
const PDF_EXTENSION = 'chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/';
const documents = new Map<string, Uint8Array<ArrayBuffer>>();
let isolated: Electron.Session | undefined;
export function registerPdfScheme(additionalSchemes: Electron.CustomScheme[] = []) {
  // A standard origin is required for Chromium's PDF metadata/toolbar messages to reach their embedder.
  electron.protocol.registerSchemesAsPrivileged([{ scheme: 'file-viewer', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }, ...additionalSchemes]);
}
function pdfSession() {
  if (isolated) return isolated;
  isolated = electron.session.fromPartition('file-viewer-pdf');
  isolated.setPermissionRequestHandler((_wc, _permission, reply) => reply(false));
  isolated.setPermissionCheckHandler(() => false);
  isolated.on('will-download', (event) => event.preventDefault());
  isolated.webRequest.onBeforeRequest((details, reply) => {
    reply({ cancel: !documents.has(details.url) && !details.url.startsWith(PDF_EXTENSION) && !details.url.startsWith('chrome://resources/') });
  });
  isolated.protocol.handle('file-viewer', (request) => {
    const bytes = documents.get(request.url);
    return bytes ? new Response(bytes, { headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store' } }) : new Response(null, { status: 404 });
  });
  return isolated;
}
interface Shown { url: string; view: WebContentsView }
export class NativePdf {
  private shown: Shown | null = null;
  private hidden = false;
  private placed = false;
  private cancelFind: (() => void) | null = null;
  private query = '';
  private window: BrowserWindow;
  private host: { onContents?(contents: WebContents): void; onFind?(): void };
  constructor(window: BrowserWindow, host: { onContents?(contents: WebContents): void; onFind?(): void } = {}) { this.window = window; this.host = host; }
  get contents() { return this.shown?.view.webContents ?? null; }
  async open(bytes: Uint8Array, name: string, box: ViewerBox): Promise<void> {
    this.close();
    if (bytes.length > LIMIT || new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') throw new Error('Not a supported PDF (maximum 32 MiB).');
    const id = randomUUID(), url = `file-viewer://document/${id}/${encodeURIComponent(name)}`;
    const view = new electron.WebContentsView({ webPreferences: {
      session: pdfSession(), plugins: true, sandbox: true, contextIsolation: true, nodeIntegration: false,
      navigateOnDragDrop: false, devTools: false,
    } });
    const shown = { url, view };
    documents.set(url, new Uint8Array(bytes));
    this.shown = shown;
    view.setVisible(false);
    this.window.contentView.addChildView(view);
    const wc = view.webContents;
    this.host.onContents?.(wc);
    wc.setWindowOpenHandler(() => ({ action: 'deny' }));
    wc.on('will-navigate', (event) => event.preventDefault());
    wc.on('will-attach-webview', (event) => event.preventDefault());
    wc.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && (input.control || input.meta) && input.key.toLowerCase() === 'f') {
        event.preventDefault(); this.host.onFind?.();
      }
    });
    this.place(box);
    try {
      await wc.loadURL(url);
      if (this.shown !== shown || wc.isDestroyed()) throw new Error('PDF opening was cancelled.');
    } catch (error) { if (this.shown === shown) this.close(); throw error; }
  }
  place(box: ViewerBox) {
    if (![box.x, box.y, box.width, box.height].every(Number.isFinite)) return;
    const shown = this.shown;
    if (!shown || shown.view.webContents.isDestroyed() || this.window.isDestroyed()) return;
    const zoom = this.window.webContents.getZoomFactor();
    const { width, height } = this.window.getContentBounds();
    const left = Math.max(0, Math.round(box.x * zoom)), top = Math.max(0, Math.round(box.y * zoom));
    const right = Math.min(width, Math.round((box.x + box.width) * zoom)), bottom = Math.min(height, Math.round((box.y + box.height) * zoom));
    shown.view.setBounds({ x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) });
    this.placed = right > left && bottom > top;
    shown.view.setVisible(!this.hidden && this.placed);
  }
  setHidden(hidden: boolean) { this.hidden = hidden; this.shown?.view.setVisible(!hidden && this.placed); }
  find(query: string, forward: boolean): Promise<ViewerSearchResult> {
    this.cancelFind?.();
    const wc = this.contents;
    if (!wc || wc.isDestroyed()) return Promise.resolve({ matches: 0, active: 0 });
    if (!query) { this.query = ''; wc.stopFindInPage('clearSelection'); return Promise.resolve({ matches: 0, active: 0 }); }
    if (query.length > 1000) return Promise.reject(new Error('Search is limited to 1,000 characters.'));
    return new Promise((resolve) => {
      let request = 0;
      const done = (result: ViewerSearchResult) => { wc.removeListener('found-in-page', found); this.cancelFind = null; resolve(result); };
      const found = (_event: Electron.Event, result: Electron.Result) => {
        if (result.requestId === request && result.finalUpdate) done({ matches: result.matches, active: result.activeMatchOrdinal });
      };
      this.cancelFind = () => done({ matches: 0, active: 0 });
      wc.on('found-in-page', found);
      request = wc.findInPage(query, { forward, findNext: query !== this.query });
      this.query = query;
    });
  }
  close() {
    this.cancelFind?.(); this.query = '';
    const shown = this.shown;
    if (!shown) return;
    this.shown = null;
    documents.delete(shown.url);
    if (!this.window.isDestroyed()) this.window.contentView.removeChildView(shown.view);
    if (!shown.view.webContents.isDestroyed()) shown.view.webContents.close();
  }
}
