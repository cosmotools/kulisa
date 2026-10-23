// The paths a terminal names as links (src/terminal/README.md, Links; docs/window.md, The terminal): which exist, and
// whether opening one would run it: such a file is only shown in its folder.
import electron from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';
import url from 'url';
import { log } from './log.ts';
import type { FileLink } from '../terminal/ipc.ts';

// What runs when opened, whatever its mode: Windows' programs and scripts, a Linux launcher, a macOS app (a folder).
const RUNS = /\.(exe|com|bat|cmd|ps1|vbs|msi|scr|lnk|desktop|app|command)$/i;

async function fileOf(where: string): Promise<FileLink> {
  const s = await fs.promises.stat(where);
  return { path: where, executable: RUNS.test(where) || (process.platform !== 'win32' && s.isFile() && (s.mode & 0o111) !== 0) };
}

// A file:// address (an agent's link, OSC 8) names a file here only when its host is this computer: none, localhost,
// or its name, short or full. Another host's never opens the same path here (the OSC 8 spec: an ssh session's
// `ls --hyperlink`).
function local(file: string): string | null {
  if (!/^file:\/\//i.test(file)) return file.replace(/^~(?=[/\\])/, os.homedir());
  try {
    const u = new URL(file), host = u.hostname.toLowerCase().split('.')[0];
    if (host && host !== 'localhost' && host !== os.hostname().toLowerCase().split('.')[0]) return null;
    u.hostname = '';
    return url.fileURLToPath(u);
  } catch { return null; }
}

// Each path that exists, as given: absolute, from the home folder (~/), relative to the folder, or a file:// address.
export const filesIn = (folder: string, paths: string[]) => Promise.all(paths.map(async (p) => {
  const file = local(p);
  return file === null ? null : fileOf(path.resolve(folder, file)).catch((): null => null);
}));

// Opened in the OS's app for it; what would run, never (asked again here: the window's answer may be stale).
export async function openFile(file: string) {
  const f = await fileOf(file).catch((): null => null);
  if (!f || f.executable) return;
  const error = await electron.shell.openPath(f.path);
  if (error) log.info(`[terminal] not opened: ${error}`);
}
export function showFile(file: string) { if (fs.existsSync(file)) electron.shell.showItemInFolder(file); }
