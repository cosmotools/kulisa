// Atomic persistence shared by core and Kulisa packages (docs/tasks.md, What is on the computer).
import fs from 'fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

// Written whole or not at all: to a file next to it, then renamed over it. Kulisa may be killed or the computer lose
// power while it writes (the tabs and session cookies are saved every few seconds); a half-written profiles.json
// would lose the list of the profiles, a half-written session cookies file the sign-ins. The data reaches the disk
// (fsync) before the rename: otherwise after a power loss the rename may be there and the data not (an empty file).
// Not the write-file-atomic package: it brings signal-exit, which hooks SIGINT and SIGTERM, and the app handles them.
function writeFileAtomic(file: string, data: string | Uint8Array, options?: { mode?: number }) {
  // Callers also write into human-owned project folders: never follow a pre-existing temporary file or symlink.
  const tmp = path.join(path.dirname(file), `.kulisa-${randomUUID()}.tmp`);
  let created = false;
  try {
    const fd = fs.openSync(tmp, 'wx', options?.mode);
    created = true;
    try { fs.writeFileSync(fd, data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(tmp, file);
  } catch (e) { if (created) fs.rmSync(tmp, { force: true }); throw e; }
}

export { writeFileAtomic };
