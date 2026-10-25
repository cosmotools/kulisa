// Where the human's pictures go: the OS's own folder of screenshots, and the file's name (../README.md, Where it goes).
import electron from 'electron';
import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

// GNOME's and KDE's tools save into Pictures/Screenshots; Windows' Win+PrtScn into its Screenshots known folder,
// Pictures\Screenshots unless moved (its Properties → Location); macOS into the folder chosen in ⇧⌘5's options, the
// Desktop by default. Electron knows neither of the last two: the registry and `defaults` tell them.
async function screenshotsFolder(): Promise<string> {
  if (process.env.KULISA_SCREENSHOTS) return process.env.KULISA_SCREENSHOTS;
  const { app } = electron;
  const read = (cmd: string, args: string[]) => new Promise<string>((ok) => execFile(cmd, args, (e, out) => ok(e ? '' : out)));
  if (process.platform === 'win32') return movedTo(await read('reg', SCREENSHOTS_KEY), process.env) ?? path.join(app.getPath('pictures'), 'Screenshots');
  if (process.platform !== 'darwin') return path.join(app.getPath('pictures'), 'Screenshots');
  const chosen = (await read('defaults', ['read', 'com.apple.screencapture', 'location'])).trim();
  return chosen ? chosen.replace(/^~(?=$|\/)/, os.homedir()) : app.getPath('desktop');
}
// Where the Screenshots known folder (FOLDERID_Screenshots) was moved, as `reg query` prints it; none until it is.
const SCREENSHOTS_KEY = ['query', String.raw`HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders`, '/v', '{B7BEDE81-DF94-4682-A7D8-57A52620B86F}'];
function movedTo(query: string, env: NodeJS.ProcessEnv): string | null {
  const value = /REG_(?:EXPAND_)?SZ[ \t]+(.+?)\s*$/m.exec(query)?.[1];
  return value ? value.replace(/%(\w+)%/g, (all, name: string) => env[name] ?? all) : null;
}

// "Kulisa <profile> 2026-10-19 14.32.05.png", as the OSes name theirs: by the time, sorted so, with the profile's name;
// no character a file name may not have on any of the three.
function fileName(profile: string, at: Date, n = 1) {
  const two = (x: number) => String(x).padStart(2, '0');
  const day = `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}`;
  const time = `${two(at.getHours())}.${two(at.getMinutes())}.${two(at.getSeconds())}`;
  const name = profile.replace(/[<>:"/\\|?*\p{Cc}]+/gu, ' ').replace(/\s+/g, ' ').trim().replace(/\.+$/, '');
  return `Kulisa ${name ? `${name} ` : ''}${day} ${time}${n > 1 ? ` (${n})` : ''}.png`;
}

// The picture as a file of the user's: made by their action, as a download is, so it stays (not Kulisa's data). The
// folder is made when missing, as the OSes do.
async function saveFile(png: Buffer, profile: string): Promise<string> {
  const dir = await screenshotsFolder();
  fs.mkdirSync(dir, { recursive: true });
  const at = new Date();
  for (let n = 1; ; n++) {
    const file = path.join(dir, fileName(profile, at, n));
    try { fs.writeFileSync(file, png, { flag: 'wx' }); return file; } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
    }
  }
}

// On the clipboard: into a message or the agent's prompt. Electron's clipboard is the W3C Clipboard API's
// (breaking-changes.md): it has no writeImage.
const copy = (png: Buffer) => electron.clipboard.write([new electron.ClipboardItem({ 'image/png': new Blob([new Uint8Array(png)], { type: 'image/png' }) })]);
// The human's picture: on the clipboard and in the folder. Its file.
async function keep(png: Buffer, profile: string): Promise<string> {
  await copy(png);
  return saveFile(png, profile);
}
// Its file on the clipboard again (the thumbnail's Copy): the clipboard may hold something else since.
const copyFile = (file: string) => copy(fs.readFileSync(file));

export { copyFile, fileName, keep, movedTo };
