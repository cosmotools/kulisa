// The version installed on disk while Kulisa runs: the package manager replaces its files under it (Linux), and the
// running Kulisa goes on from the old ones. docs/window.md, "The app icon, installers and updates".
import fs from 'fs';
import path from 'path';

// The version in the package.json of the app archive at asar, read from the file as it is now: Electron's own
// reads of the archive go to the file it opened at start (the old inode, once apt renamed a new one over it), so
// its asar support is off for this read (Electron's asar-archives.md, process.noAsar). The format (@electron/asar):
// a pickle with the header's size, a pickle with the header (JSON: each file's offset and size), then the files,
// their offsets from the header's end. Null when there is no archive there, or no version in it.
export function installedVersion(asar: string): string | null {
  const noAsar = process.noAsar;
  process.noAsar = true;
  try {
    const fd = fs.openSync(asar, 'r');
    try {
      const sizes = Buffer.alloc(16);
      fs.readSync(fd, sizes, 0, 16, 0);
      const headerSize = sizes.readUInt32LE(4), json = Buffer.alloc(sizes.readUInt32LE(12));
      fs.readSync(fd, json, 0, json.length, 16);
      const { offset, size } = JSON.parse(json.toString()).files['package.json'];
      const pkg = Buffer.alloc(size);
      fs.readSync(fd, pkg, 0, size, 8 + headerSize + Number(offset));
      return JSON.parse(pkg.toString()).version ?? null;
    } finally { fs.closeSync(fd); }
  } catch { return null; } finally { process.noAsar = noAsar; }
}

// Watches the archive's folder for the package manager's work (a file is written beside and renamed over, so the
// folder's events; a second after the last one, as a package is many files) and calls found with the version there
// once it differs from the one running, once per version. check: now, not waiting for an event (the tests).
// Nothing keeps Kulisa alive for it (unref); no folder (not installed): nothing watched.
export function watchInstalled(asar: string, running: string, found: (version: string) => void) {
  let last = running, timer: NodeJS.Timeout | null = null;
  const check = () => {
    const version = installedVersion(asar);
    if (version && version !== last) { last = version; found(version); }
  };
  try {
    const w = fs.watch(path.dirname(asar), () => { if (timer) clearTimeout(timer); timer = setTimeout(check, 1000).unref(); });
    w.unref(); w.on('error', () => {});
  } catch { /* not installed there */ }
  return { check };
}
