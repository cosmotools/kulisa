// Kulisa's log: what happened and who asked, for a bug the author cannot watch (docs/window.md, The log). electron-log
// writes the file; what is written is ours, a line per action of the core: a window's channel, an agent's tool, a key,
// a hook, a task made or closed, a terminal started. Never what is typed into a terminal or a page, nor a password, a
// token or an address's query (summary).
import path from 'path';
import elog from 'electron-log/main';

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

export const log = elog;

// logs/kulisa.log in the data folder, on every OS (electron-log would put macOS's in ~/Library/Logs: one place to name,
// and the tests' in their own folder). At 1 MB it becomes kulisa.old.log and a new one starts: 2 MB at most. A second
// Kulisa started on the same data writes its start line and "already running" into the same file (app.ts).
export function startLog(userData: string) {
  elog.transports.file.resolvePathFn = () => path.join(userData, 'logs', 'kulisa.log');
  elog.transports.console.format = '{text}'; // stdout as it was (the tests' output): the time is the file's
  Object.assign(console, elog.functions); // what the code says on stdout goes to the file too
  // Electron's own events, named one by one: electron-log's defaults listen on every webContents, the profiles' pages
  // too, and would log their failed loads and certificate errors with their addresses, and their console. The line is
  // ours (electronEvent): electron-log's own appends the page's address in full to every webContents event.
  elog.eventLogger.startLogging({ events: { app: { 'child-process-gone': true, 'render-process-gone': true }, webContents: { unresponsive: true, 'preload-error': true } },
    format: electronEvent });
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
