// Kulisa's log: what happened and who asked, for a bug the author cannot watch (docs/window.md, The log). electron-log
// writes the file; what is written is ours, a line per action of the core: a window's channel, an agent's tool, a key,
// a hook, a task made or closed, a terminal started. Never what is typed into a terminal or a page, nor a password or a
// token (summary).
import path from 'path';
import elog from 'electron-log/main';

const SECRET_KEY = /pass|secret|token|cookie|credential/i;
const SECRET_TEXT = /(password|secret|token|api[_-]?key|credential)\s*[=:]\s*\S|bearer\s+\S/i;
// An action's arguments in one short line: a secret's value left out, by its key or by what the text says of itself
// (a command with token=… or Bearer … in it), long strings and the whole cut.
export function summary(v: unknown, max = 200): string {
  const s = JSON.stringify(v, (k, x) => (SECRET_KEY.test(k) && x ? '…' : typeof x === 'string' && SECRET_TEXT.test(x) ? '[…]'
    : typeof x === 'string' && x.length > 80 ? `${x.slice(0, 80)}…` : x));
  return s === undefined ? '' : s.length > max ? `${s.slice(0, max)}…` : s;
}

export const log = elog;

// logs/kulisa.log in the data folder, on every OS (electron-log would put macOS's in ~/Library/Logs: one place to name,
// and the tests' in their own folder). At 1 MB it becomes kulisa.old.log and a new one starts: 2 MB at most.
export function startLog(userData: string) {
  elog.transports.file.resolvePathFn = () => path.join(userData, 'logs', 'kulisa.log');
  elog.transports.console.format = '{text}'; // stdout as it was (the tests' output): the time is the file's
  Object.assign(console, elog.functions); // what the code says on stdout goes to the file too
  elog.eventLogger.startLogging(); // Electron's own events: a page's renderer or the GPU gone, a page that failed to load
}
