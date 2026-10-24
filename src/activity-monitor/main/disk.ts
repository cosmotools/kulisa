// What a folder takes on the disk: its entries with their sizes, a folder within it summed whole (README, Disk).
import fs from 'fs';
import path from 'path';

// A file or a folder at the folder's top; time: when it last changed.
interface Entry { name: string; bytes: number; time: number }
interface FolderUsage { bytes: number; entries: Entry[] }

// Missing, or an entry gone while it is read (a file deleted meanwhile): nothing, not an error.
async function folderUsage(dir: string): Promise<FolderUsage> {
  const names = await fs.promises.readdir(dir).catch((): string[] => []);
  const entries = (await Promise.all(names.map(async (name): Promise<Entry | null> => {
    const s = await fs.promises.stat(path.join(dir, name)).catch((): null => null);
    if (!s) return null;
    return { name, bytes: s.isDirectory() ? (await folderUsage(path.join(dir, name))).bytes : s.size, time: s.mtimeMs };
  }))).filter((e) => e !== null);
  return { bytes: entries.reduce((sum, e) => sum + e.bytes, 0), entries };
}

export type { Entry };
export { folderUsage };
