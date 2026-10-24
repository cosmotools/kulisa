// The paths a terminal's line may name (README, Links): each a candidate the window checks, as only it knows the
// folder and the disk. Absolute (/…, ~/…, C:\…, \\server\share\…) or relative (src/main/tasks.ts, README.md), a
// :line[:column] after it left out of the path but kept in the link.
import type { IBufferCellPosition, IBufferRange, Terminal } from '@xterm/xterm';

export interface PathLink { path: string; text: string; range: IBufferRange }

// A word, brackets, quotes and the like around it not part of it, nor punctuation after it; or a quoted string with
// spaces in it (a path with spaces; the words inside are candidates too, as an apostrophe pairs with anything).
const WORD = /(?<=^|[\s"'`()<>[\]{},;|])[^\s"'`()<>[\]{},;|]*[^\s"'`()<>[\]{},;|.:!?]/g;
const QUOTED = /(["'`])([^"'`]*\s[^"'`]*)\1/g;
const AT_LINE = /:\d+(?::\d+)?$/;
// Absolute, or with a folder in it, or a file's name with its extension (letters after the dot: not 1.5).
const PATH = /^(?:~[/\\]|[/\\]|[A-Za-z]:[/\\])|[/\\]|^[\w.-]*\w\.[A-Za-z]\w*$/;
const MAX = 50; // a line of hundreds of words is not asked about word by word

// A line as its program wrote it: the rows xterm wrapped it into joined (isWrapped), with each character's cell, so a
// path broken by the terminal's width is one link and wide characters before it (Claude Code's ⏺) do not shift it.
// y: the buffer's row, from 1, as xterm's link providers are given it.
function lineAt(term: Terminal, y: number) {
  const buf = term.buffer.active;
  let first = y - 1, last = y - 1;
  while (first > 0 && buf.getLine(first)?.isWrapped) first--;
  while (buf.getLine(last + 1)?.isWrapped) last++;
  let text = '';
  const at: IBufferCellPosition[] = [];
  for (let row = first; row <= last; row++) {
    const line = buf.getLine(row)!;
    for (let x = 0; x < line.length; x++) {
      const cell = line.getCell(x)!;
      if (!cell.getWidth()) continue; // the second half of a wide character
      const chars = cell.getChars() || ' ';
      for (let i = 0; i < chars.length; i++) at.push({ x: x + 1, y: row + 1 });
      text += chars;
    }
  }
  return { text, at };
}

export function pathsAt(term: Terminal, y: number): PathLink[] {
  const { text: line, at } = lineAt(term, y), found: PathLink[] = [];
  const add = (text: string, start: number) => {
    const path = text.replace(AT_LINE, '');
    if (text.includes('://')) return; // an address: the web-links addon's
    if (PATH.test(path) && !/^[/\\~.]+$/.test(path)) found.push({ path, text, range: { start: at[start]!, end: at[start + text.length - 1]! } });
  };
  for (const m of line.matchAll(QUOTED)) if (m[2]!.trim() === m[2]) add(m[2], m.index + 1); // not " a b "
  for (const m of line.matchAll(WORD)) add(m[0], m.index);
  return found.slice(0, MAX);
}

// What an agent marks as a link (OSC 8) that may be a file: a path as it is (Claude Code's), or a file:// address
// (whether its host is this computer is for termHooks.files to tell); null for any other address.
export const fileOf = (uri: string) => (/^file:\/\//i.test(uri) || !/^[a-z][\w+.-]+:/i.test(uri) ? uri : null); // C:\ is a drive
