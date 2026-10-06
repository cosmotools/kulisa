// Kulisa entry point.
//   npm start                       opens the project used last; at first start none (the window offers to open one)
//   KULISA_PROJECT=<dir> npm start  opens the project in <dir> (made if new)
// Environment:
//   KULISA_AGENT="cmd args…"   run this agent CLI in every workspace, without asking which (agents.js); it gets
//                              KULISA_MCP_URL, but no Claude Code plugin
//   KULISA_MIMIC=0             do not present profiles as Google Chrome
//   KULISA_SIGNIN_HOSTS=a,b    more sign-in hosts for the automatic sign-in pause
//   KULISA_DATA=<dir>          data folder instead of the OS default (a second instance, a try-out)
//   KULISA_MCP_PORT=<port>     MCP server port (default 4450; 0 picks a free one)
const { start } = require('./app');

const agent = process.env.KULISA_AGENT ? (([command, ...args]) => ({ command, args }))(process.env.KULISA_AGENT.split(/\s+/)) : undefined;

start({
  userData: process.env.KULISA_DATA,
  mcpPort: process.env.KULISA_MCP_PORT ? Number(process.env.KULISA_MCP_PORT) : undefined,
  project: process.env.KULISA_PROJECT,
  agent,
  mimicChrome: process.env.KULISA_MIMIC !== '0',
  signinHosts: (process.env.KULISA_SIGNIN_HOSTS || '').split(',').filter(Boolean),
});

