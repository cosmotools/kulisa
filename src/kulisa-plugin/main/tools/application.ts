// Agent handles on application terminal environments; actions and validation belong to the task's core.
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { terminalKeys } from '../../../terminal/ipc.ts';
import { TERMINAL_LINES } from '../../../shared/application-terminal.ts';
import type { Handles } from './handles.ts';

export function applicationTools(server: McpServer, { task, text, done }: Handles) {
  const appName = z.string().describe('Application terminal name, separate from development terminals');
  const command = z.string().max(8192).describe("Command in the user's shell in this task's working folder");
  server.registerTool('application_create', {
    description: 'Create a visible application terminal environment in the testing stage. Saves its name and launch command; starts no process. Use for developing and testing interactive CLIs and TUIs while the human watches or takes over. Shells share the human’s home and credentials.',
    inputSchema: { name: appName, command: command.optional() },
  }, async ({ name, command }) => text(JSON.stringify(done(task.applications.create(name, command)))));
  server.registerTool('application_configure', {
    description: 'Save an application terminal launch command or name, or set its fixed size (2–500 columns, 2–200 rows); size: null follows the pane. Does not launch a process. Human and agent operate the same terminal.',
    inputSchema: { name: appName, rename: z.string().optional(), command: command.optional(), size: z.object({ cols: z.number().int(), rows: z.number().int() }).nullable().optional() },
  }, async ({ name, rename, command, size }) => text(JSON.stringify(done(task.applications.configure(name, { ...(rename !== undefined && { name: rename }), ...(command !== undefined && { command }), ...(size !== undefined && { size }) })))));
  for (const action of ['start', 'stop', 'restart', 'close'] as const) server.registerTool(`application_${action}`, {
    description: `${action === 'start' ? 'Launch the saved command in' : action === 'restart' ? 'Stop the process and launch the saved or supplied command again in' : action === 'stop' ? 'End the process in' : 'Close and forget'} an application terminal environment. A stopped or exited environment stays in the stage until closed. Starting and restarting clear the previous screen. Processes start only on request, never on task restore.`,
    inputSchema: { name: appName, ...((action === 'start' || action === 'restart') && { command: command.optional() }) },
  }, async ({ name, command }) => text(JSON.stringify(done(await task.applications[action](name, command)))));
  server.registerTool('application_read', {
    description: 'Inspect an application terminal: current rendered screen by default, including alternate-screen TUIs and cursor position; scrollback: true reads its last lines (default 50, max 500). Without name lists environments and process/exit status. Large output goes to a task artifact; the answer gives its path and a preview. Output is bounded and reflects cursor redraws rather than raw stdout.',
    inputSchema: { name: appName.optional(), scrollback: z.boolean().optional(), lines: z.number().int().min(1).max(TERMINAL_LINES).optional() },
  }, async ({ name, scrollback, lines }) => {
    if (!name) return text(JSON.stringify(task.applications.info()));
    const r = done(await task.applications.read(name, lines, !scrollback));
    if (r.text.length <= 40000) return text(JSON.stringify(r));
    const file = await task.saveArtifact({ kind: 'application', id: r.terminal.id }, 'terminal.txt', r.text);
    return text(JSON.stringify({ terminal: r.terminal, size: r.size, cursor: r.cursor, file, characters: r.text.length, text: r.text.slice(0, 2000), note: 'Full terminal text is in the task artifact. Read the part needed from that file.' }));
  });
  server.registerTool('application_input', {
    description: 'Operate a running application terminal. Send text (max 16384 characters), paste: true for a paste respecting bracketed-paste mode, or one named key. Enter submits separately. Never automate real-account sign-in: ask the human to take over the visible terminal.',
    inputSchema: { name: appName, text: z.string().max(16384).optional(), paste: z.boolean().optional(), key: z.enum(Object.keys(terminalKeys) as [string, ...string[]]).optional() },
  }, async ({ name, ...input }) => text(JSON.stringify(done(task.applications.input(name, input)))));
}
