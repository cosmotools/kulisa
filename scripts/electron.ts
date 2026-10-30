// npm start's Electron: electron's own cli.js, with --no-sandbox on Linux only (README, Run). The flag must be on
// the command line (Chromium's zygote starts before main: appendSwitch is too late), and npm scripts have no per-OS one.
import { spawn } from 'child_process';
import electron from 'electron';

const argv = [...(process.platform === 'linux' ? ['--no-sandbox'] : []), ...process.argv.slice(2)];
const child = spawn(electron as unknown as string, argv, { stdio: 'inherit', windowsHide: false });
child.on('close', (code, signal) => {
  if (code === null) console.error(`Electron exited with ${signal}`);
  process.exit(code ?? 1);
});
// Ctrl+C or a kill of npm stops Kulisa as it quits (app.ts saves session cookies and tabs on SIGINT and SIGTERM). On
// Windows a signal to the child ends it at once, unsaved, so it is asked by a second start instead (KULISA_QUIT, app.ts).
const stop = (signal: NodeJS.Signals) => {
  if (child.exitCode !== null) return;
  if (process.platform !== 'win32') child.kill(signal);
  else spawn(electron as unknown as string, argv, { stdio: 'inherit', env: { ...process.env, KULISA_QUIT: '1' } });
};
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, stop);
