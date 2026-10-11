// A project's site's favicon, found in its code (docs/tasks.md, Projects: its icon).
// Runs the user's git (worktrees.ts): its list of files leaves out what the project ignores (node_modules, builds),
// where libraries' own favicons are.
import fs from 'fs';
import path from 'path';
import { git } from './worktrees.ts';

// favicon.* anywhere; icon.* only in an app/ folder, Next's (elsewhere icon.svg is any component's).
const IMAGE = '(svg|png|ico|webp|gif|jpe?g)';
const NAME = new RegExp(`(^|/)(favicon\\.${IMAGE}|app/icon\\.${IMAGE})$`, 'i');
const EXTS = ['svg', 'png', 'ico', 'webp', 'gif', 'jpg', 'jpeg'];

// The favicons among a folder's files (paths with /), the one to take first: the nearest to the top, then the one
// that scales best (svg, a large png before a small ico), then a favicon before an icon, then by name.
function rankFavicons(files: string[]) {
  const key = (f: string) => [f.split('/').length, EXTS.indexOf(path.extname(f).slice(1).toLowerCase()), /(^|\/)favicon\./i.test(f) ? 0 : 1];
  return files.filter((f) => NAME.test(f)).sort((a, b) => {
    const ka = key(a), kb = key(b), i = ka.findIndex((v, j) => v !== kb[j]);
    return i >= 0 ? ka[i] - kb[i] : a < b ? -1 : a > b ? 1 : 0;
  });
}

// A folder without git: its files a few levels down, without hidden folders, dependencies and builds; a limit, so a
// folder as large as a home one is not read whole.
function walk(folder: string, depth = 5, limit = { dirs: 2000 }, at = ''): string[] {
  if (depth < 0 || limit.dirs-- <= 0) return [];
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(path.join(folder, at), { withFileTypes: true }); } catch { return []; }
  return entries.flatMap((e) => {
    const f = at ? `${at}/${e.name}` : e.name;
    if (e.isFile()) return [f];
    return e.isDirectory() && !e.name.startsWith('.') && !['node_modules', 'dist', 'build', 'vendor'].includes(e.name) ? walk(folder, depth - 1, limit, f) : [];
  });
}

// The favicon of the first of the folders that has one (a project's repositories, the default first): its full path,
// or null.
async function findFavicon(folders: string[]) {
  for (const folder of folders) {
    const files = await git(folder, ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ':(glob,icase)**/favicon.*', ':(glob,icase)**/app/icon.*'])
      .then((out) => out.split('\0').filter(Boolean), () => walk(folder));
    const first = rankFavicons(files)[0];
    if (first) return path.join(folder, first);
  }
  return null;
}

export { findFavicon, rankFavicons };
