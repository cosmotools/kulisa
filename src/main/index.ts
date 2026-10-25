// Kulisa entry point.
//   npm start                       opens the windows and tasks open last; at first start none (New Project opens)
//   KULISA_PROJECT=<dir> npm start  opens a task of the project in <dir> (made if new)
// Environment:
//   KULISA_AGENT="cmd args…"   run this agent CLI in every task, without asking which (agents/); it gets
//                              KULISA_MCP_URL, but no Claude Code plugin
//   KULISA_SIGNIN_HOSTS=a,b    more sign-in hosts for the automatic sign-in pause
//   KULISA_DATA=<dir>          data folder instead of the OS default (a second instance, a try-out)
//   KULISA_MCP_PORT=<port>     MCP server port (default 4450; 0 picks a free one)
//   KULISA_QUIT=1              only ask the Kulisa running on the same data to quit, its tabs and sign-ins saved, as
//                              SIGINT does (Windows has no signal for it)
import { start } from './app.ts';
import { squirrelEvent, updates } from './updates.ts';

const agent = process.env.KULISA_AGENT ? (([command, ...args]) => ({ command: command!, args }))(process.env.KULISA_AGENT.split(/\s+/)) : undefined;
const quit = !!process.env.KULISA_QUIT;

if (!squirrelEvent) {
  if (!quit) updates();
  void start({
    userData: process.env.KULISA_DATA,
    mcpPort: process.env.KULISA_MCP_PORT ? Number(process.env.KULISA_MCP_PORT) : undefined,
    project: process.env.KULISA_PROJECT,
    agent,
    signinHosts: (process.env.KULISA_SIGNIN_HOSTS || '').split(',').filter(Boolean),
    quit,
  });
}

