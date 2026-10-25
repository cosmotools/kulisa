// A folder with the home folder as ~, as a terminal shows it: in the log (log.ts: a user's log shared holds their name
// less often) and in the window (where an agent is: the renderer's lib/agents.ts). sep: the OS's separator, Windows' \
// too, which the window cannot ask Node for.
const tilde = (p: string, home: string, sep: string) => (p === home || p.startsWith(home + sep) ? `~${p.slice(home.length)}` : p);

export { tilde };
