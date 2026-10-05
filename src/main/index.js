// Kulisa entry point.
//   npm start                       opens the project used last (at first start: the folder npm was started in)
//   KULISA_PROJECT=<dir> npm start  opens the project in <dir> (made if new)
// Environment:
//   KULISA_AGENT="cmd args…"   run another agent CLI instead of Claude Code (no MCP config is passed then)
//   KULISA_MIMIC=0             do not present profiles as Google Chrome
//   KULISA_SIGNIN_HOSTS=a,b    more sign-in hosts for the automatic sign-in pause
//   KULISA_DATA=<dir>          data folder instead of the OS default (a second instance, a try-out)
//   KULISA_MCP_PORT=<port>     MCP server port (default 4450; 0 picks a free one)
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { start } = require('./app');

const agent = process.env.KULISA_AGENT ? (([command, ...args]) => ({ command, args }))(process.env.KULISA_AGENT.split(/\s+/)) : undefined;

start({
  userData: process.env.KULISA_DATA,
  mcpPort: process.env.KULISA_MCP_PORT ? Number(process.env.KULISA_MCP_PORT) : undefined,
  project: process.env.KULISA_PROJECT,
  defaultFolder: firstFolder(),
  agent,
  mimicChrome: process.env.KULISA_MIMIC !== '0',
  signinHosts: (process.env.KULISA_SIGNIN_HOSTS || '').split(',').filter(Boolean),
});

// The first project: from source, the folder npm was started in; installed (started from a menu, no meaningful
// working folder), ~/Kulisa/Default.
function firstFolder() {
  if (!app.isPackaged) return process.env.INIT_CWD || process.cwd();
  const dir = path.join(app.getPath('home'), 'Kulisa', 'Default');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
