// Browser disk formats and copying; see ../README.md.
import fs from 'fs';
import path from 'path';
import { writeFileAtomic } from '../../main/files.ts';

const TABS_FILE = 'Kulisa Tabs.json';
const SESSION_COOKIES_FILE = 'Kulisa Session Cookies.bin';
// Chromium's caches inside a profile: rebuilt by themselves, so a copy of a profile goes without them.
const CACHES = ['Cache', 'Code Cache', 'GPUCache', 'DawnGraphiteCache', 'DawnWebGPUCache', 'GrShaderCache', 'ShaderCache'];
const NOT_COPIED = new Set([...CACHES, 'Network/Cookies', 'Network/Cookies-journal']);

// A profile's tabs as saved: their URLs, in the strip's order, and the place of the one in front.
interface SavedTabs { urls: string[]; active: number }
// Copy a profile's folder without its caches and its cookies: those come through its session (cookie-sync.ts, copy),
// as Windows keeps an open session's cookie database locked. An open profile can be copied once its data is flushed
// (tasks.ts); a file that cannot be read (locked on Windows) is left out and logged.
async function copyProfile(from: string, to: string) {
  const walk = async (src: string, dst: string, rel: string) => {
    await fs.promises.mkdir(dst, { recursive: true });
    for (const e of await fs.promises.readdir(src, { withFileTypes: true })) {
      if (NOT_COPIED.has(rel + e.name)) continue;
      const s = path.join(src, e.name), d = path.join(dst, e.name);
      try {
        if (e.isDirectory()) await walk(s, d, `${rel}${e.name}/`);
        else if (e.isFile()) await fs.promises.copyFile(s, d);
      } catch (err) { console.error('[store] not copied:', s, (err as NodeJS.ErrnoException).code || (err as Error).message); }
    }
  };
  await walk(from, to, '');
}

// A profile's tabs (Kulisa Tabs.json, in its folder: a master's and a task's copy alike), to open them again.
function readTabs(dir: string): SavedTabs {
  const v = readJSON(path.join(dir, TABS_FILE));
  return Array.isArray(v?.urls) ? { urls: v.urls, active: Number.isInteger(v.active) ? v.active : 0 } : { urls: [], active: 0 };
}
function writeTabs(dir: string, tabs: SavedTabs) { fs.mkdirSync(dir, { recursive: true }); writeJSON(path.join(dir, TABS_FILE), tabs); }
function readJSON(f: string) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } }
function writeJSON(f: string, v: unknown) { try { writeFileAtomic(f, JSON.stringify(v, null, 2)); } catch (e) { console.error('[store]', (e as Error).message); } }
export { readTabs, writeTabs, copyProfile, SESSION_COOKIES_FILE };
export type { SavedTabs };
