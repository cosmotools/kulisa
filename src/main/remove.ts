// A file or a folder and all in it removed, on every OS: every recursive removal of Kulisa's goes through it.
import fs from 'fs';
import path from 'path';

// Walked here, not fs.rmSync's recursive: on Windows Electron's Node follows a junction in the tree (pnpm's
// node_modules are made of them) and removes what it points to, and refuses a read-only file (EPERM; git makes its
// objects read-only). A link goes as a link; a read-only file is made writable first. A folder already gone is no error.
// Electron's fs reads an .asar file as a folder: off while walking (noAsar), so it goes as the file it is.
function removeTree(p: string) {
  const asar = process.noAsar;
  process.noAsar = true;
  try { remove(p); } finally { process.noAsar = asar; }
}

function remove(p: string) {
  let st: fs.Stats;
  try { st = fs.lstatSync(p); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return; throw e; }
  if (st.isDirectory()) {
    for (const f of fs.readdirSync(p)) remove(path.join(p, f));
    fs.rmdirSync(p);
    return;
  }
  if (process.platform === 'win32' && !st.isSymbolicLink() && !(st.mode & 0o200)) fs.chmodSync(p, 0o666);
  fs.unlinkSync(p);
}

export { removeTree };
