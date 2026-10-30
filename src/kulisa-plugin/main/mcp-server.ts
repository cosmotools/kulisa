// Kulisa's MCP server for the agent: the tools of every group (tools/), each taking a profile by its name (Kulisa's
// own ids stay inside: tasks.ts, named). Streamable HTTP, one URL per task: http://127.0.0.1:<port>/task/<project>/<task>/mcp
// (the parts percent-encoded); its agents see that task's profiles only. Each agent's terminal has its own under it
// (/task/<project>/<task>/t/<id>/mcp), the same tools and its own tab to name. Stateless (a new server per request).
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import http from 'http';
import { handleDictationHook, handleHookRequest, taskContext, ONLY_BROWSER } from './agent-hooks.ts';
import { handles } from './tools/handles.ts';
import { profileTools } from './tools/profile.ts';
import { taskTools } from './tools/task.ts';
import { browserTools, clearHighlights } from './tools/browser.ts';
import { applicationTools } from './tools/application.ts';
import { terminalTools } from './tools/terminal.ts';
import pkg from '../../../package.json' with { type: 'json' };
import type { AddressInfo } from 'net';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { PluginHost } from './core.ts';
import type { TaskAccess as Task, TerminalAccess as TaskTerminal } from './core.ts';
import { bare, log, summary } from '../../main/log.ts';

// For every agent, those without the profiles skill too (one run by hand): what it must know before the first call.
const INSTRUCTIONS = 'Kulisa profiles are the users of the app under test, each a browser profile the human signed in to by hand. ' +
  ONLY_BROWSER + ' ' +
  'Choose a profile by its description (profile_list), not by guessing from its name: when no description tells ' +
  'which profile a task means, or several do, ask the human once and save their answer with profile_describe. ' +
  'Never sign in to a real account, type its password or a one-time code, or read cookies or tokens: ask the human ' +
  'with profile_ask_signin. A test user of the app under test on this computer with a saved pair (testLogin in ' +
  'profile_list) you sign in to yourself, with browser_type_login (you never see its password). ' +
  'Run what keeps running (the app\'s dev server, docker compose up, a watcher) with terminal_run, not in your own ' +
  'shell or its background: the human sees it in a terminal next to yours, and you read its output with terminal_read. ' +
  'Test interactive CLI and TUI apps in application terminal environments in the stage: create and explicitly start one, read its rendered screen, send input, then restart after code changes. Your own development terminal stays separate. ' +
  'What was said and done in this task, by you or other agents (each conversation an agent had in it), is in ' +
  'task_history: read the one the human points you to ("go on with what Claude did") before anything else, and read ' +
  'yours when you need details your context lost. Name your conversation with conversation_rename once you know what ' +
  'it is about.';
// task: the task (tasks.ts) whose profiles the tools act on; t: the agent's terminal, when it came by its own URL.
function buildServer(task: Task, t: TaskTerminal | null) {
  const server = new McpServer({ name: 'kulisa', version: pkg.version }, { instructions: `${INSTRUCTIONS} ${taskContext(task)}` });
  // Every tool call is logged (its name, the task, a summary of its first argument), as the core's actions are.
  type Handler = (...a: unknown[]) => Promise<CallToolResult>;
  const register = server.registerTool.bind(server) as unknown as (name: string, config: object, cb: Handler) => unknown;
  server.registerTool = ((name: string, config: object, cb: Handler) => register(name, config, async (...a) => {
    log.info(`[mcp] ${name} ${task.key}${t ? `#${t.id}` : ''} ${summary(a[0])}`);
    try { return await cb(...a); } catch (e) { log.info(`[mcp] ${name} failed: ${bare((e as Error).message)}`); throw e; }
  })) as unknown as typeof server.registerTool;
  const h = handles(task, t);
  profileTools(server, h);
  taskTools(server, h);
  browserTools(server, h);
  terminalTools(server, h);
  applicationTools(server, h);
  return server;
}

const safeDecode = (s: string) => { try { return decodeURIComponent(s); } catch { return ''; } };

async function startMcpServer(host: PluginHost, cfg: { port?: number }) {
  // The core says when a profile is unloaded (tasks.ts) and does not reach into its agent's handle.
  host.onProfileUnloading((key) => void clearHighlights(key));
  const srv = http.createServer(async (req, res) => {
    if (!host.allowRequest(req)) { res.writeHead(403); return res.end(); }
    if (handleDictationHook((text) => host.dictated(text), req.url!, req, res)) return;
    // /task/<project>/<task id>[/t/<terminal id>]/…: a task of an open project, loaded; an agent's terminal of it.
    const m = req.url!.match(/^\/task\/([^/]+)\/([^/]+)(?:\/t\/(\d+))?(\/.*)$/);
    const found = m && host.resolve(safeDecode(m[1]!), safeDecode(m[2]!), m[3] ? Number(m[3]) : undefined);
    if (!found) { res.writeHead(404); return res.end(); }
    const { task, terminal: t } = found;
    if (handleHookRequest(task, t, m[4]!, req, res)) return;
    if (!m[4]!.startsWith('/mcp')) { res.writeHead(404); return res.end(); }
    // The transport reads the body itself (with a size limit) and answers a malformed one.
    const server = buildServer(task, t);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { void transport.close(); void server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res);
  });
  await new Promise<void>((r) => srv.listen(cfg.port || 0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  console.log('[kulisa] MCP server:', `${base}/task/<project>/<task>/mcp`);
  return { base, srv };
}

export { startMcpServer };
