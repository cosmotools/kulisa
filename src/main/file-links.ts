// The paths a terminal names as links (src/terminal/README.md, Links; docs/window.md, The terminal): which exist, and
// whether opening one would run it: such a file is only shown in its folder.
import electron from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { log } from './log.ts';
import type { FileLink } from '../terminal/ipc.ts';

// What runs when opened, whatever its mode: Windows' programs and scripts, a Linux launcher, a macOS app (a folder).
const RUNS = /\.(exe|com|bat|cmd|ps1|vbs|msi|scr|lnk|desktop|app|command)$/i;

async function fileOf(where: string): Promise<FileLink> {
  const s = await fs.promises.stat(where);
  return { path: where, executable: RUNS.test(where) || (process.platform !== 'win32' && s.isFile() && (s.mode & 0o111) !== 0) };
}

// Each path that exists, as given: absolute, from the home folder (~/), or relative to the folder.
export const filesIn = (folder: string, paths: string[]) => Promise.all(paths.map((p) =>
  fileOf(path.resolve(folder, p.replace(/^~(?=[/\\])/, os.homedir()))).catch((): null => null)));

// Opened in the OS's app for it; what would run, never (asked again here: the window's answer may be stale).
export async function openFile(file: string) {
  const f = await fileOf(file).catch((): null => null);
  if (!f || f.executable) return;
  const error = await electron.shell.openPath(f.path);
  if (error) log.info(`[terminal] not opened: ${error}`);
}
export function showFile(file: string) { if (fs.existsSync(file)) electron.shell.showItemInFolder(file); }
