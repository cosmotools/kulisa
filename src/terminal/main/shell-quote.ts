// An argument of a command typed into the user's shell (index.ts), quoted as that shell reads it.
import path from 'path';

const shellName = (shell: string) => path.basename(shell).toLowerCase().replace(/\.exe$/, '');

// sh's quoting (bash, zsh): nothing is special inside '…', a ' ends it. fish reads `\\` and `\'` there: quoted the sh
// way, a backslash is lost, and `\'` leaves the quote open, the line waiting and the agent not started. PowerShell:
// its own '…' (a ' doubled), around what the program is to get on its command line (psArgument).
const shellQuote = (shell: string, a: string) => {
  const name = shellName(shell);
  if (name === 'pwsh' || name === 'powershell') return /^[\w./:=+\\-]+$/.test(a) ? a : `'${psArgument(a).replace(/'/g, "''")}'`;
  return /^[\w@%+=:,./-]+$/.test(a) ? a
    : name === 'fish' ? `'${a.replace(/[\\']/g, '\\$&')}'`
    : `'${a.replace(/'/g, `'\\''`)}'`;
};

// What a program on Windows reads back as the argument a (its C runtime's rules: a " escaped by a backslash, the
// backslashes before one doubled), as Windows PowerShell 5.1 passes it on: it puts an argument with a space in "…"
// itself, unless the space is inside quotes by its own count, which takes an escaped \" for a quote too (a JSON with
// a space would be cut there). So such an argument is quoted here whole, its quotes doubled (inside "…" the runtime
// reads "" as one "), which keeps that count even. PowerShell 7 does the same with its passing set to Legacy
// (shellLine): one rule for both.
function psArgument(a: string) {
  if (a === '') return '""'; // else dropped
  const space = /\s/.test(a);
  if (space && a.includes('"')) return `"${a.replace(/(\\*)("|$)/g, (_, b: string, q: string) => b + b + (q ? '""' : ''))}"`;
  const escaped = a.replace(/(\\*)"/g, '$1$1\\"');
  return space ? escaped.replace(/(\\+)$/, '$1$1') : escaped; // PowerShell's "…" around it: its last backslashes doubled
}

// A command with its arguments and the variables pinned before it (`VAR=… cmd`), as a line for that shell.
// PowerShell: the variables set first ($env:), the command run by &, its passing of arguments Legacy in 7 (5.1's), in a
// script block of its own, so the setting stays there.
function shellLine(shell: string, command: string, args: string[], pinned: Record<string, string> = {}) {
  const quote = (a: string) => shellQuote(shell, a), name = shellName(shell);
  if (name === 'pwsh' || name === 'powershell') {
    const vars = Object.entries(pinned).map(([k, v]) => `$env:${k}='${v.replace(/'/g, "''")}'; `).join('');
    return `& { $PSNativeCommandArgumentPassing='Legacy'; ${vars}& ${[command, ...args].map(quote).join(' ')} }`;
  }
  return [...Object.entries(pinned).map(([k, v]) => `${k}=${quote(v)}`), ...[command, ...args].map(quote)].join(' ');
}

export { shellQuote, shellLine };
