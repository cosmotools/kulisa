// An argument of a command typed into the user's shell (terminal.ts), quoted as that shell reads it.
import path from 'path';

// sh's quoting (bash, zsh): nothing is special inside '…', a ' ends it. fish reads `\\` and `\'` there: quoted the sh
// way, a backslash was lost, and `\'` left the quote open, the line waiting and the agent not started (2026-10-18).
const shellQuote = (shell: string, a: string) => (/^[\w@%+=:,./-]+$/.test(a) ? a
  : path.basename(shell) === 'fish' ? `'${a.replace(/[\\']/g, '\\$&')}'`
  : `'${a.replace(/'/g, `'\\''`)}'`);

export { shellQuote };
