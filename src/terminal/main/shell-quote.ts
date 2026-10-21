// An argument of a command typed into the user's shell (index.ts), quoted as that shell reads it.
import path from 'path';

// sh's quoting (bash, zsh): nothing is special inside '…', a ' ends it. fish reads `\\` and `\'` there: quoted the sh
// way, a backslash is lost, and `\'` leaves the quote open, the line waiting and the agent not started.
const shellQuote = (shell: string, a: string) => (/^[\w@%+=:,./-]+$/.test(a) ? a
  : path.basename(shell) === 'fish' ? `'${a.replace(/[\\']/g, '\\$&')}'`
  : `'${a.replace(/'/g, `'\\''`)}'`);

export { shellQuote };
