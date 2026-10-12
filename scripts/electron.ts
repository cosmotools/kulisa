// npm start's Electron: electron's own cli.js, with --no-sandbox on Linux only (README, Run). The flag must be on
// the command line (Chromium's zygote starts before main: appendSwitch is too late), and npm scripts have no per-OS one.
import { spawn } from 'child_process';
import electron from 'electron';

const child = spawn(electron as unknown as string, [...(process.platform === 'linux' ? ['--no-sandbox'] : []), ...process.argv.slice(2)],
  { stdio: 'inherit', windowsHide: false });
child.on('close', (code, signal) => {
  if (code === null) console.error(`Electron exited with ${signal}`);
  process.exit(code ?? 1);
});
// Ctrl+C or a kill of npm stops Kulisa as it quits (app.ts saves session cookies and tabs on SIGINT and SIGTERM).
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { if (child.exitCode === null) child.kill(signal); });
