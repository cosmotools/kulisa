// An argument of a command typed into the user's shell (index.ts), quoted as that shell reads it.
import path from 'path';

// win32's basename: it splits at / and \ both, so a Windows path is read on every OS.
const shellName = (shell: string) => path.win32.basename(shell).toLowerCase().replace(/\.exe$/, '');

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
// backslashes before one doubled), as PowerShell passes it on (Legacy in 7: shellLine). An argument with a space is
// quoted here whole, not left to PowerShell: it puts its own "…" around one unless the space is inside quotes by its
// count, which takes an escaped \" for a quote too (a JSON with a space would be cut there), and Windows PowerShell and
// PowerShell 7 differ on the backslashes before that closing quote. Inside "…" the runtime reads "" as one ", which
// keeps the count even.
function psArgument(a: string) {
  if (a === '') return '""'; // else dropped
  if (/\s/.test(a)) return `"${a.replace(/(\\*)("|$)/g, (_, b: string, q: string) => b + b + (q ? '""' : ''))}"`;
  return a.replace(/(\\*)"/g, '$1$1\\"');
}

// A command with its arguments and the variables pinned before it (`VAR=… cmd`), as a line for that shell.
// PowerShell: the variables set first ($env:), the command run by &, its passing of arguments Legacy in 7 (5.1's), in a
// script block of its own, so the setting stays there. The command is PowerShell's to find, not on a command line: in
// its '…' alone (a folder with a space, C:\Program Files\…).
function shellLine(shell: string, command: string, args: string[], pinned: Record<string, string> = {}) {
  const quote = (a: string) => shellQuote(shell, a), name = shellName(shell);
  if (name === 'pwsh' || name === 'powershell') {
    const ps = (v: string) => `'${v.replace(/'/g, "''")}'`;
    const vars = Object.entries(pinned).map(([k, v]) => `$env:${k}=${ps(v)}; `).join('');
    return `& { $PSNativeCommandArgumentPassing='Legacy'; ${vars}& ${[ps(command), ...args.map(quote)].join(' ')} }`;
  }
  return [...Object.entries(pinned).map(([k, v]) => `${k}=${quote(v)}`), ...[command, ...args].map(quote)].join(' ');
}

export { shellQuote, shellLine };
