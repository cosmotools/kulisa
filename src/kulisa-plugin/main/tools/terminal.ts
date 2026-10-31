// Agent handles on Stage terminal environments; actions and validation belong to the task's core.
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { terminalKeys } from '../../../terminal/ipc.ts';
import { TERMINAL_LINES } from '../../../shared/stage-terminal.ts';
import type { Handles } from './handles.ts';

export function terminalTools(server: McpServer, { task, text, done }: Handles) {
  const nameArg = z.string().trim().min(1).describe('Name of the terminal in Stage, separate from development shells');
  const size = z.object({ cols: z.number().int(), rows: z.number().int() }).nullable().describe('Fixed columns/rows, or null to fit the pane');
  server.registerTool('terminal_run', {
    description: 'Run your command in a visible interactive terminal in Stage, shared with the human. Creates the named terminal if needed; otherwise stops its previous process and runs the supplied command with a fresh screen. Uses the user’s shell in this task’s working folder. Build the app and choose the command yourself. Shells share the human’s home and credentials. Omitted size preserves the current size; new terminals fit the pane.',
    inputSchema: { name: nameArg, command: z.string().min(1).max(8192), size: size.optional() },
  }, async ({ name, command, size }) => text(JSON.stringify(done(await task.stageTerminals.run(name, command, size)))));
  server.registerTool('terminal_resize', {
    description: 'Resize an interactive terminal in Stage: 2–500 columns and 2–200 rows, or size: null to fit its pane. Preserves the running process.',
    inputSchema: { name: nameArg, size },
  }, async ({ name, size }) => text(JSON.stringify(done(task.stageTerminals.resize(name, size)))));
  server.registerTool('terminal_stop', {
    description: 'End the process in a Stage terminal, keeping its final screen and setup. Use input with Ctrl+C for a normal keyboard interrupt instead.',
    inputSchema: { name: nameArg },
  }, async ({ name }) => text(JSON.stringify(done(task.stageTerminals.stop(name)))));
  server.registerTool('terminal_close', {
    description: 'Close a Stage terminal: stop its process and remove its pane, saved setup and screen buffers. Source files and saved artifacts stay.',
    inputSchema: { name: nameArg },
  }, async ({ name }) => text(JSON.stringify(done(task.stageTerminals.close(name)))));
  server.registerTool('terminal_read', {
    description: 'Inspect an Stage terminal: current rendered screen by default, including alternate-screen TUIs and cursor position; scrollback: true reads its last lines (default 50, max 500). Without name lists environments and process/exit status. Large output goes to a task artifact; the answer gives its path and a preview. Output is bounded and reflects cursor redraws rather than raw stdout.',
    inputSchema: { name: nameArg.optional(), scrollback: z.boolean().optional(), lines: z.number().int().min(1).max(TERMINAL_LINES).optional() },
  }, async ({ name, scrollback, lines }) => {
    if (!name) return text(JSON.stringify(task.stageTerminals.info()));
    const r = done(await task.stageTerminals.read(name, lines, !scrollback));
    if (r.text.length <= 40000) return text(JSON.stringify(r));
    const file = await task.saveArtifact({ kind: 'stage-terminal', id: r.terminal.id }, 'terminal.txt', r.text);
    return text(JSON.stringify({ terminal: r.terminal, size: r.size, cursor: r.cursor, file, characters: r.text.length, text: r.text.slice(0, 2000), note: 'Full terminal text is in the task artifact. Read the part needed from that file.' }));
  });
  server.registerTool('terminal_input', {
    description: 'Operate a running Stage terminal. Send text (max 16384 characters), paste: true for a paste respecting bracketed-paste mode, or one named key. Enter submits separately. Never automate real-account sign-in: ask the human to take over the visible terminal.',
    inputSchema: { name: nameArg, text: z.string().max(16384).optional(), paste: z.boolean().optional(), key: z.enum(Object.keys(terminalKeys) as [string, ...string[]]).optional() },
  }, async ({ name, ...input }) => text(JSON.stringify(done(task.stageTerminals.input(name, input)))));
}
