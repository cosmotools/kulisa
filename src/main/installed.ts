// The version installed on disk while Kulisa runs: the package manager replaces its files under it (Linux), and the
// running Kulisa goes on from the old ones. docs/releases.md, Updates.
import fs from 'fs';
import path from 'path';
import { extractFile, uncache } from '@electron/asar';

// The version in the package.json of the app archive at asar, read from the file as it is now: Electron's own
// reads of the archive go to the file it opened at start (the old inode, once apt renamed a new one over it), so
// @electron/asar reads through original-fs. Clear its own header cache before reading a replaced archive and
// release it afterwards. Null when there is no archive there, or no version in it.
export function installedVersion(asar: string): string | null {
  try {
    uncache(asar);
    return JSON.parse(extractFile(asar, 'package.json').toString()).version ?? null;
  } catch { return null; } finally { uncache(asar); }
}

// Watches the archive's folder for the package manager's work (a file is written beside and renamed over, so the
// folder's events; a second after the last one, as a package is many files) and calls found with the version there
// once it differs from the one running, once per version. check: now, not waiting for an event (the tests); close:
// the watching ended (the tests: on Windows a folder removed while watched keeps Node from exiting).
// Nothing keeps Kulisa alive for it (unref); no folder (not installed): nothing watched.
export function watchInstalled(asar: string, running: string, found: (version: string) => void) {
  let last = running, timer: NodeJS.Timeout | null = null, w: fs.FSWatcher | null = null;
  const check = () => {
    const version = installedVersion(asar);
    if (version && version !== last) { last = version; found(version); }
  };
  try {
    w = fs.watch(path.dirname(asar), () => { if (timer) clearTimeout(timer); timer = setTimeout(check, 1000).unref(); });
    w.unref(); w.on('error', () => {});
  } catch { /* not installed there */ }
  return { check, close: () => { w?.close(); if (timer) clearTimeout(timer); } };
}
