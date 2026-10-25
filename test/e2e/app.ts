// Kulisa as the e2e tests start it (fixtures.ts, Playwright's _electron): in the test's folder, with a fake agent (cat in
// bash), its core on globalThis for the tests' core() (driver.ts).
import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { start } from '../../src/main/app.ts';
import { driver } from './driver.ts';
import type { Kulisa } from './driver.ts';

declare global { var __kulisa: Kulisa | undefined }

// The motion the tests check (a tab growing in, the grid's slide) whatever the OS's setting: a CI machine may reduce
// motion, and nothing moves then. Reduced motion is checked where it matters, emulated.
app.commandLine.appendSwitch('force-prefers-no-reduced-motion');

const root = process.env.KULISA_TEST_ROOT;
const userData = path.join(root, 'data'), project = path.join(root, 'project');
fs.mkdirSync(project, { recursive: true });
// direnv's list of allowed .envrc files (tasks copy and allow them): the test's own, not the user's.
process.env.XDG_DATA_HOME = path.join(root, 'xdg-data');
// The agent: cat, typed into a bash started as a terminal would start the user's shell, in the project's folder; its
// startup file sets an environment of the project, as direnv's .envrc does. On Windows the folder as Windows writes it
// (Git's bash says /c/…).
const bashrc = path.join(root, 'bashrc');
const pwd = process.platform === 'win32' ? '$(cygpath -w "$PWD")' : '$PWD';
fs.writeFileSync(bashrc, `PS1='$ '\nexport FROM_RC="rc of ${pwd}"\n`);
const agent = { command: 'bash', args: ['-c', 'echo "agent: $FROM_RC"; exec cat -v'], shell: { command: 'bash', args: ['--rcfile', bashrc, '-i'] } };

// Uncaught in the main process: app.ts logs it and goes on (an error dialog would block everything); the test it came
// in fails (fixtures.ts).
const uncaught = (e: unknown) => globalThis.__kulisa?.errors.push(`main: ${(e as Error)?.stack ?? String(e)}`);
process.on('uncaughtException', uncaught);
process.on('unhandledRejection', uncaught);

// Not awaited at the top: Electron finishes loading an ES module main before it gets ready, and start waits for ready.
void start({ userData, project, projectsHome: path.join(root, 'KulisaProjects'), agent, mcpPort: 0, signinHosts: ['localhost'] }).then((shell) => {
  globalThis.__kulisa = driver(shell);
  // macOS gives the keyboard only to the active app's windows, and the run starts from another (a terminal).
  if (process.platform === 'darwin') app.focus({ steal: true });
});
