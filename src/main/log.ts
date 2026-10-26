// Kulisa's log: what happened and who asked, for a bug the author cannot watch (docs/window.md, The log). electron-log
// writes the file; what is written is ours, a line per action of the core: a window's channel, an agent's tool, a key,
// a hook, a task made or closed, a terminal started. Never what is typed into a terminal or a page, nor a password, a
// token or an address's query (summary).
import fs from 'fs';
import os from 'os';
import path from 'path';
import elog from 'electron-log/main';
import pkg from '../../package.json' with { type: 'json' };
import { tilde as homeAsTilde } from '../shared/paths.ts';

const SECRET_KEY = /pass|secret|token|cookie|credential/i;
const TYPED_KEY = /^(text|values)$/; // what the agent types into a page (browser_type, browser_fill_form)
const SECRET_TEXT = /(password|secret|token|api[_-]?key|credential)\s*[=:]\s*\S|bearer\s+\S/i;
// A text's addresses without their user and password (a clone URL with a token) and without their query and fragment (an
// OAuth code, a magic link's token): the arguments' (summary), and an error's message, which names the address it failed at.
export const bare = (s: string) => s.replace(/\/\/[^/\s@]+@/g, '//…@').replace(/(\b[a-z][a-z0-9+.-]*:\/\/[^\s?#]*)[?#]\S*/gi, '$1?…');
// An action's arguments in one short line: a secret's value left out, by its key or by what the text says of itself
// (a command with token=… or Bearer … in it), typed text left out, addresses bare, long strings and the whole cut.
export function summary(v: unknown, max = 200): string {
  const s = JSON.stringify(v, (k, x) => ((SECRET_KEY.test(k) || TYPED_KEY.test(k)) && x ? '…' : typeof x !== 'string' ? x
    : SECRET_TEXT.test(x) ? '[…]' : bare(x).length > 80 ? `${bare(x).slice(0, 80)}…` : bare(x)));
  return s === undefined ? '' : s.length > max ? `${s.slice(0, max)}…` : s;
}
// An email as the log keeps it: enough of the name to tell one's accounts apart (three letters, at most half of it), not
// all of it, for a log sent with a bug report.
export const shortEmail = (email: string) => {
  const at = email.lastIndexOf('@'), name = email.slice(0, Math.max(at, 0));
  return at < 1 ? '…' : `${name.slice(0, Math.min(3, Math.ceil(name.length / 2)))}…${email.slice(at)}`;
};
export const tilde = (p: string, home = os.homedir()) => homeAsTilde(p, home, path.sep);

export const log = elog;
let file = '', packaged = false, display = '';
export const logFile = () => file;
export const LOG_MAX = elog.transports.file.maxSize; // 1 MB: then kulisa.old.log
// The start line's facts, which a bug report names too (issueUrl): the version, Electron's, the OS and, on Linux, the
// display server Chromium runs on (X11 or Wayland: the first bug looked at was on one and not the other), packaged or
// from source.
export const environment = () => `${pkg.version}, electron ${process.versions.electron}, ${process.platform} ${os.release()}${display ? ` (${display})` : ''}, ${packaged ? 'packaged' : 'from source'}`;
// A new issue on GitHub from the bug template (.github/ISSUE_TEMPLATE/bug.yml), its environment filled in: GitHub takes a
// form's fields by their id in the query. The template asks for the file (Save As… on the Log page) and says what is in it.
export const issueUrl = (env: string) => `https://github.com/cosmotools/kulisa/issues/new?template=bug.yml&environment=${encodeURIComponent(`Kulisa ${env}`)}`;

// logs/kulisa.log in the data folder, on every OS (electron-log would put macOS's in ~/Library/Logs: one place to name,
// and the tests' in their own folder). At 1 MB it becomes kulisa.old.log and a new one starts: 2 MB at most. A second
// Kulisa started on the same data writes its start line and "already running" into the same file (app.ts).
export function startLog(userData: string, isPackaged: boolean, displayServer = '') {
  file = path.join(userData, 'logs', 'kulisa.log'); packaged = isPackaged; display = displayServer;
  const previousRunQuit = quitSaid(tail(file));
  elog.transports.file.resolvePathFn = () => file;
  elog.transports.file.format = ({ message: m, data }) => [`[${stamp(m.date)}] [${m.level}]`, ...data];
  elog.hooks.push((m, _t, name) => { if (name === 'file') pending(); return m; });
  elog.transports.console.format = '{text}'; // stdout as it was (the tests' output): the time is the file's
  Object.assign(console, elog.functions); // what the code says on stdout goes to the file too
  // A console nobody reads any more (`npm start | head`, a terminal closed, a parent gone): its first failed write (EPIPE)
  // is an uncaught exception, which app.ts logs, to the console again, and so on, each round a nextTick that lets nothing
  // else run: Kulisa stops answering the OS. So the console's transport is turned off at its first failed write.
  for (const s of [process.stdout, process.stderr]) s.on('error', () => { elog.transports.console.level = false; });
  // Electron's own events, named one by one: electron-log's defaults listen on every webContents, the profiles' pages
  // too, and would log their failed loads and certificate errors with their addresses, and their console. The line is
  // ours (electronEvent): electron-log's own appends the page's address in full to every webContents event.
  elog.eventLogger.startLogging({ events: { app: { 'child-process-gone': true, 'render-process-gone': true }, webContents: { unresponsive: true, 'preload-error': true } },
    format: electronEvent });
  // Node prints every process warning through console.error, into the file too, and Electron warns of each failed load
  // of any page with its address in full (electron_api_web_contents.cc: "Failed to load URL: …"): [profile] logs it bare.
  process.removeAllListeners('warning');
  process.on('warning', (w) => { if (!w.message.startsWith('Failed to load URL: ')) console.warn(`[warning] ${w.name}: ${w.message}`); });
  return { previousRunQuit };
}

// The time as ISO 8601 with the computer's offset (2026-10-18T14:05:25.077+02:00), not electron-log's local time without
// it: a user's log is read next to an issue's or a message's time, from another time zone.
export function stamp(d: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, '0'), off = -d.getTimezoneOffset();
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`
    + `${off < 0 ? '-' : '+'}${p(Math.floor(Math.abs(off) / 60))}:${p(Math.abs(off) % 60)}`;
}

// Whether the run before this one said it quit (app.ts: [kulisa] quitting), read from the file's end before the first
// write: a log ending otherwise was a crash of the main process, a kill or the computer going down, which nothing else
// can write. After the last start in the tail: a second Kulisa on the same data writes its start and goes (app.ts),
// the first one's quitting coming after. No start in the tail (a long run): quitting near the end is enough.
export const quitSaid = (tail: string | null) => tail === null ? null : tail.includes('[kulisa] quitting', Math.max(0, tail.lastIndexOf('[kulisa] start ')));
function tail(f: string, bytes = 16384): string | null {
  let fd: number;
  try { fd = fs.openSync(f, 'r'); } catch { return null; }
  try {
    const size = fs.fstatSync(fd).size, buf = Buffer.alloc(Math.min(size, bytes));
    fs.readSync(fd, buf, 0, buf.length, size - buf.length);
    return buf.toString();
  } finally { fs.closeSync(fd); }
}

// One of Electron's events as a log line: which, where (the page's webContents and its address, bare), its details.
// render-process-gone is the app's, (event, webContents, details); the others the webContents' own, event.sender.
type Wc = Pick<Electron.WebContents, 'id' | 'getURL' | 'isDestroyed'>;
export function electronEvent({ eventName, event, args }: { eventName: string; event: object; args: unknown[] }): unknown[] {
  const wc = (eventName === 'render-process-gone' ? args[0] : (event as { sender?: Wc } | null)?.sender) as Wc | undefined;
  const where = wc && !wc.isDestroyed() ? ` wc=${wc.id} ${bare(wc.getURL())}` : '';
  const details = eventName === 'render-process-gone' ? args[1] : eventName === 'child-process-gone' ? args[0]
    : eventName === 'preload-error' ? { preload: args[0], error: String(args[1]) } : undefined;
  return [`[electron] ${eventName}${where}`, ...(details ? [details] : [])];
}

// The Log page (settings/LogPage.vue) reads the file whole (1 MB at most) and then follows it: a hook runs before the
// file transport, which writes at once, so what came since goes to the page at the end of the same tick, a burst of
// lines as one. One page follows: the last that read. The file shorter than what was read (turned over at 1 MB): the
// page is told to read it again. Nothing of this is logged: no line of the page's own to send it again.
type Reader = Pick<Electron.WebContents, 'isDestroyed' | 'send'>;
let reader: { wc: Reader; offset: number } | null = null, flushing = false;
export function readLog(wc: Reader) {
  const buf = fs.existsSync(file) ? fs.readFileSync(file) : Buffer.alloc(0);
  reader = { wc, offset: buf.length };
  return { text: buf.toString(), size: buf.length };
}
function pending() { if (reader && !flushing) { flushing = true; setImmediate(flush); } }
function flush() {
  flushing = false;
  const r = reader;
  if (!r) return;
  if (r.wc.isDestroyed()) { reader = null; return; }
  let size: number;
  try { size = fs.statSync(file).size; } catch { return; }
  if (size < r.offset) { reader = null; r.wc.send('log:lines', { reset: true }); return; }
  if (size === r.offset) return;
  const buf = Buffer.alloc(size - r.offset), fd = fs.openSync(file, 'r');
  try { fs.readSync(fd, buf, 0, buf.length, r.offset); } finally { fs.closeSync(fd); }
  r.offset = size;
  r.wc.send('log:lines', { text: buf.toString() });
}
