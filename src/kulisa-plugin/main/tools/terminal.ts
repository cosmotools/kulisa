// The agent's tools on the shells next to its terminal (Task.openTerminal): what keeps running, where the human sees
// it. How a tool is designed: ../../README.md, Tool design.
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TERMINAL_LINES } from '../../../shared/application-terminal.ts';
import type { Handles } from './handles.ts';

// What an agent can read back of a shell (terminal_read; terminalTail in src/terminal/main): its last lines as the screen shows them, kept
// by a terminal without a window (xterm's own parser), so lines a program redraws in place (a progress, a container's
// state) are what they became; the output with its codes left out had every frame. Its scrollback is what the agent
// may ask for at most: the memory is lines × columns × 12 bytes (about 1 MB at 200 columns). Its buffer is a proposed
// API in the headless build (allowProposedApi), the one xterm's serialize addon reads too.
const READ_MAX = TERMINAL_LINES;

function terminalTools(server: McpServer, { task, text, done }: Handles) {
  const nameArg = z.string().describe('The terminal\'s name, e.g. "dev server"');
  server.registerTool('terminal_run', {
    description: "Run a command that keeps running (the app's dev server, docker compose up, a watcher) in a terminal of its own next to yours, where the human sees it: the user's shell in the task's folder, with your environment. A terminal of that name already open gets the command typed in: stop what runs there first (terminal_stop). Then read its output with terminal_read.",
    inputSchema: { name: nameArg, command: z.string().describe('A command line for the user\'s shell (PowerShell on Windows), e.g. "npm run dev -- --port 3100"') },
  }, async ({ name, command }) => {
    const r = done(await task.runInTerminal(name, command));
    return text(`${r.again ? 'Typed into' : 'Started in'} terminal "${r.name}": ${command}. Read its output with terminal_read.`);
  });
  server.registerTool('terminal_read', {
    description: 'The last lines a terminal next to yours shows, as plain text (a server\'s errors, the address it listens on). Without a name: the terminals open.',
    inputSchema: { name: nameArg.optional(), lines: z.number().int().min(1).max(READ_MAX).optional().describe('Default 50') },
  }, async ({ name, lines }) => {
    if (!name) {
      const list = task.terminalsInfo().list.filter((x) => !x.agent);
      return text(list.length ? list.map((x) => `"${x.name}" (${x.by === 'agent' ? "an agent's" : "the human's"})${x.command ? `: ${x.command}` : ''}`).join('\n') : 'No terminals open besides the agents\'.');
    }
    return text(done(task.readTerminal(name, lines)).text || '(nothing yet)');
  });
  server.registerTool('terminal_stop', {
    description: 'Stop what runs in a terminal next to yours (Ctrl+C); close: true closes the terminal too. The human\'s own terminals: only when they ask.',
    inputSchema: { name: nameArg, close: z.boolean().optional() },
  }, async ({ name, close }) => {
    done(close ? task.closeTerminal(name) : task.interruptTerminal(name));
    return text(close ? `Closed terminal "${name}".` : `Pressed Ctrl+C in terminal "${name}".`);
  });
}

export { terminalTools };
