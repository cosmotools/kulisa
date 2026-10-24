// The thumbnail of the picture just taken, in a corner of its pane, as macOS shows one (../README.md, The thumbnail).
import electron from 'electron';
import { handle, on } from '../../main/ipc.ts';
import { log } from '../../main/log.ts';
import { copyFile } from './folder.ts';
import type { BrowserWindow, Rectangle, WebContents, WebContentsView } from 'electron';
import type { ThumbnailAction } from '../ipc.ts';

// Its size and place in CSS pixels, times the Kulisa zoom: at most this wide and tall, this far from the pane's corner.
const WIDTH = 240, HEIGHT = 180, MARGIN = 20;
// Room around the picture in its view for its shadow: a view draws nothing outside its bounds (renderer/thumbnail.ts).
const PAD = 12;
// How long it stays, as macOS's; the pointer over it or its menu open hold it.
const STAYS = 5000;
// How long its page fades out (renderer/thumbnail.ts) before its view goes.
const FADE = 200;

// The window's (one each), by the window's page and by the thumbnail's own page: the messages of both find it.
const byWindow = new Map<WebContents, Thumbnails>();
const byPage = new Map<WebContents, Thumbnails>();

interface Shown { owner: string; file: string; view: WebContentsView; src: string; size: { width: number; height: number }; bounds: Rectangle | null; fading?: boolean }

// A window's thumbnail: one at a time, the next taking its place. The window says where its panes are (place) and
// when its pages are covered (setHidden); the rest is here.
class Thumbnails {
  private win: BrowserWindow; private page: string; private preload: string; private send: (text: string) => void;
  private shown: Shown | null = null; private hidden = false; private timer?: NodeJS.Timeout; private over = false; private held = false;

  // page: its page's file; preload: the windows'; send: words for the agent's prompt (Send to Agent: the agents are
  // the window's tasks', not the package's).
  constructor(win: BrowserWindow, { page, preload, send }: { page: string; preload: string; send: (text: string) => void }) {
    install();
    this.win = win; this.page = page; this.preload = preload; this.send = send;
    byWindow.set(win.webContents, this);
  }
  get file() { return this.shown?.file ?? null; }
  get bounds() { return this.shown?.bounds ?? null; }
  get view() { return this.shown?.view ?? null; }

  // The picture just taken in a pane (owner: its profile), at box: the pane's page in the window (null: off screen).
  // A view of its own over the page: the pages are native views above the window's HTML, so HTML could not be on top
  // of them. It lives only while it is shown (one more process for those seconds); Electron's ImageView, with no
  // process, gets no mouse (issue #107).
  show(owner: string, file: string, png: Buffer, box: Rectangle | null) {
    this.close();
    const zoom = this.zoom();
    const view = new electron.WebContentsView({ webPreferences: { preload: this.preload, sandbox: true, zoomFactor: zoom } });
    view.setBackgroundColor('#00000000');
    view.setVisible(false);
    const { src, size } = preview(png);
    this.shown = { owner, file, view, src, size, bounds: null };
    const wc = view.webContents;
    byPage.set(wc, this);
    wc.once('did-finish-load', () => { if (!wc.isDestroyed()) wc.send('thumbnail:image', src); });
    void wc.loadFile(this.page);
    this.win.contentView.addChildView(view);
    this.over = false; this.held = false;
    this.wait();
    this.place(() => box);
  }
  // Into its pane's bottom right corner, after every change of the grid (boxOf: a pane's page in the window by its
  // profile, null: off screen, and it goes). On top of the window's views again: a tab's view added since went over it.
  place(boxOf: (owner: string) => Rectangle | null) {
    const s = this.shown;
    if (!s) return;
    const box = boxOf(s.owner);
    if (!box || box.width <= 0 || box.height <= 0) return this.close();
    const z = this.zoom(), width = Math.round((s.size.width + 2 * PAD) * z), height = Math.round((s.size.height + 2 * PAD) * z), m = Math.round((MARGIN - PAD) * z);
    s.bounds = { x: box.x + box.width - width - m, y: box.y + box.height - height - m, width, height };
    s.view.setBounds(s.bounds);
    this.win.contentView.addChildView(s.view);
    s.view.setVisible(!this.hidden);
    // The window draws it too, seen while its pages are pictures (renderer/index.ts), in CSS pixels.
    this.tell('thumbnail:place', { src: s.src, x: s.bounds.x / z + PAD, y: s.bounds.y / z + PAD, width: s.size.width, height: s.size.height });
  }
  // Under a menu or a dialog of the window, with its pages: their pictures and the window's drawing of it show then.
  setHidden(hidden: boolean) {
    this.hidden = hidden;
    const s = this.shown;
    if (s && !s.view.webContents.isDestroyed()) s.view.setVisible(!hidden && !!s.bounds);
  }
  close() {
    const s = this.shown;
    if (!s) return;
    this.shown = null;
    clearTimeout(this.timer);
    byPage.delete(s.view.webContents);
    try { this.win.contentView.removeChildView(s.view); } catch {}
    if (!s.view.webContents.isDestroyed()) s.view.webContents.close();
    this.tell('thumbnail:place', null);
  }
  // Gone by the human's wish or its time: faded out first. Taken away by Kulisa (the next picture, its pane off screen,
  // its window going): at once, by close.
  fade() {
    const s = this.shown;
    if (!s || s.fading) return;
    s.fading = true;
    clearTimeout(this.timer);
    if (!s.view.webContents.isDestroyed()) s.view.webContents.send('thumbnail:fade');
    setTimeout(() => { if (this.shown === s) this.close(); }, FADE);
  }
  // The window going: nothing more to tell it.
  destroy() { this.close(); byWindow.delete(this.win.webContents); }

  // Its menu's rows (the window's menu: renderer/index.ts), and the menu closing (resume: its time goes on).
  async act(action: ThumbnailAction) {
    const s = this.shown;
    if (!s) return;
    if (action === 'resume') { this.held = false; return this.wait(); }
    log.info(`[screenshot] thumbnail: ${action}`);
    if (action === 'show') electron.shell.showItemInFolder(s.file);
    else if (action === 'copy') await copyFile(s.file);
    else if (action === 'close') this.fade();
    else if (action === 'send') this.send(agentText(s.file));
    else if (action === 'delete') {
      try { await electron.shell.trashItem(s.file); } catch (e) { log.info(`[screenshot] not moved to the trash: ${(e as Error).message}`); }
      if (this.shown === s) this.fade();
    }
  }

  // Its page's messages.
  open() { const f = this.file; if (f) void electron.shell.openPath(f).then((error) => { if (error) log.info(`[screenshot] not opened: ${error}`); }); }
  // A drag carries the file itself, as the OS's file manager's (tutorial/native-file-drag-drop.md).
  drag() { const s = this.shown; if (s) s.view.webContents.startDrag({ file: s.file, icon: electron.nativeImage.createFromPath(s.file).resize({ width: 64 }) }); }
  hover(over: boolean) { if (this.shown?.fading) return; this.over = over; this.wait(); }
  // Its right-click gave its own page the keyboard: the window's menu needs it back.
  menu(x: number, y: number) {
    const s = this.shown;
    if (!s?.bounds) return;
    this.held = true; this.wait();
    this.win.webContents.focus();
    const z = this.zoom();
    this.tell('thumbnail:open-menu', { x: s.bounds.x / z + x, y: s.bounds.y / z + y });
  }

  private zoom() { return this.win.webContents.getZoomFactor(); }
  private tell(channel: 'thumbnail:place' | 'thumbnail:open-menu', data: unknown) { if (!this.win.isDestroyed()) this.win.webContents.send(channel, data); }
  private wait() {
    clearTimeout(this.timer);
    if (this.shown && !this.shown.fading && !this.over && !this.held) this.timer = setTimeout(() => this.fade(), STAYS);
  }
}

// The picture as small as the thumbnail shows it (twice, for a dense screen), and that size in CSS pixels: at most
// WIDTH wide; a taller one (a whole page) its top only, as tall as HEIGHT. Not the picture itself: a whole page is
// megabytes, sent to two pages.
function preview(png: Buffer) {
  const img = electron.nativeImage.createFromBuffer(png), { width, height } = img.getSize();
  const scale = Math.min(1, WIDTH / width), rows = Math.min(height, Math.round(HEIGHT / scale));
  const size = { width: Math.round(width * scale), height: Math.round(rows * scale) };
  const top = rows < height ? img.crop({ x: 0, y: 0, width, height: rows }) : img;
  return { size, src: top.resize({ width: Math.min(width, size.width * 2), quality: 'good' }).toDataURL() };
}

// A file for the agent's prompt, quoted as a file dropped onto a terminal is typed: Claude Code takes an image so.
const agentText = (file: string) => `'${file.replace(/'/g, "'\\''")}' `;

// The channels (../ipc.ts), once: the thumbnail's page's, found by the page; its menu's rows, by the window.
let installed = false;
function install() {
  if (installed) return;
  installed = true;
  on('thumbnail:open', (e) => byPage.get(e.sender)?.open());
  on('thumbnail:drag', (e) => byPage.get(e.sender)?.drag());
  on('thumbnail:menu', (e, { x, y }) => byPage.get(e.sender)?.menu(x, y));
  on('thumbnail:hover', (e, over) => byPage.get(e.sender)?.hover(over));
  on('thumbnail:close', (e) => byPage.get(e.sender)?.act('close'));
  handle('thumbnail:act', (e, { action }) => byWindow.get(e.sender)?.act(action));
}

export { Thumbnails };
