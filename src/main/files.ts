// Atomic file persistence shared by core and Kulisa packages.
import fs from 'fs';

// Written whole or not at all: to a file next to it, then renamed over it. Kulisa may be killed or the computer lose
// power while it writes (the tabs and session cookies are saved every few seconds); a half-written profiles.json
// would lose the list of the profiles, a half-written session cookies file the sign-ins. The data reaches the disk
// (fsync) before the rename: otherwise after a power loss the rename may be there and the data not (an empty file).
// Not the write-file-atomic package: it brings signal-exit, which hooks SIGINT and SIGTERM, and the app handles them.
function writeFileAtomic(file: string, data: string | Uint8Array, options?: { mode?: number }) {
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    const fd = fs.openSync(tmp, 'w', options?.mode);
    try { fs.writeFileSync(fd, data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(tmp, file);
  } catch (e) { fs.rmSync(tmp, { force: true }); throw e; }
}

export { writeFileAtomic };
