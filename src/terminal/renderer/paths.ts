// The paths a terminal's line may name (README, Links): each a candidate the window checks, as only it knows the
// folder and the disk. Absolute (/…, ~/…, C:\…, \\server\share\…) or relative (src/main/tasks.ts, README.md), a
// :line[:column] after it left out of the path but kept in the link. Where each is: xterm-link-provider's computeLink
// (the web-links addon's own, for any pattern), the rows xterm wrapped a line into joined, wide characters counted.
import { computeLink } from 'xterm-link-provider';
import type { IBufferRange, Terminal } from '@xterm/xterm';

export interface PathLink { path: string; text: string; range: IBufferRange }

// A word, brackets, quotes and the like around it not part of it, nor punctuation after it; or a quoted string with
// spaces in it (a path with spaces; the words inside are candidates too, as an apostrophe pairs with anything).
const WORD = /(?<=^|[\s"'`()<>[\]{},;|])([^\s"'`()<>[\]{},;|]*[^\s"'`()<>[\]{},;|.:!?])/;
const QUOTED = /(["'`])([^"'`]*\s[^"'`]*)\1/;
const AT_LINE = /:\d+(?::\d+)?$/;
// Absolute, or with a folder in it, or a file's name with its extension (letters after the dot: not 1.5).
const PATH = /^(?:~[/\\]|[/\\]|[A-Za-z]:[/\\])|[/\\]|^[\w.-]*\w\.[A-Za-z]\w*$/;
const MAX = 50; // a line of hundreds of words is not asked about word by word

// y: the buffer's row, from 1, as xterm's link providers are given it.
export function pathsAt(term: Terminal, y: number): PathLink[] {
  const quoted = computeLink(y, QUOTED, term, 2).filter((l) => l.text.trim() === l.text); // not " a b "
  return [...quoted, ...computeLink(y, WORD, term)].flatMap(({ text, range }) => {
    const path = text.replace(AT_LINE, '');
    if (text.includes('://')) return []; // an address: the web-links addon's
    return PATH.test(path) && !/^[/\\~.]+$/.test(path) ? [{ path, text, range }] : [];
  }).slice(0, MAX);
}

// A path an agent marks as a link (OSC 8: Claude Code gives a file's path as it is, others a file:// address), or
// null for any other address.
export function fileOf(uri: string): string | null {
  if (/^file:\/\//i.test(uri)) {
    try {
      const p = decodeURIComponent(new URL(uri).pathname);
      return /^\/[A-Za-z]:/.test(p) ? p.slice(1) : p; // file:///C:/… on Windows
    } catch { return null; }
  }
  return /^[a-z][\w+.-]+:/i.test(uri) ? null : uri; // a scheme of its own (javascript:, mailto:); C:\ is a drive
}
