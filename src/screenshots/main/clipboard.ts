// A screenshot on the clipboard, for a message or the agent's prompt (../README.md).
import electron from 'electron';

// Electron's clipboard follows the W3C API (breaking-changes.md).
const copy = (png: Buffer) => electron.clipboard.write([new electron.ClipboardItem({ 'image/png': new Blob([new Uint8Array(png)], { type: 'image/png' }) })]);
// Its file on the clipboard again (the thumbnail's Copy): the clipboard may hold something else since.
const copyFile = (file: string) => copy(electron.nativeImage.createFromPath(file).toPNG());

export { copy, copyFile };
