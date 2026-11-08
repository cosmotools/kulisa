// The agent's tools on its task: its name, worktree and repositories, its history, its artifacts, the agent's own
// conversation. How a
// tool is designed: ../../README.md, Tool design.
import { z } from 'zod';
import { historyPart } from '../history.ts';
import { sizeText } from '../../../shared/bytes.ts';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Handles } from './handles.ts';

function taskTools(server: McpServer, { task, t, text, done, session }: Handles) {
  server.registerTool('stage_arrange', {
    description: 'Arrange this task’s open testing environments: horizontal puts them side by side, vertical puts them one above another, tabs shows one at a time. Independently set overflow: false fits all panes into the stage; true keeps usable pane sizes and scrolls in the stack direction. Overflow is ignored in tabs but remembered. Omitted settings stay unchanged. Preserves development terminals and Resources. Position places Stage left, right, or above the development terminal and Resources together. The task must be on screen. Settings also apply before an environment opens. Requests the same action as the human’s title-bar Stage menu.',
    inputSchema: {
      position: z.enum(['left', 'right', 'above']).optional().describe('Stage position relative to the development terminal and Resources together'),
      layout: z.enum(['horizontal', 'vertical', 'tabs']).optional().describe('horizontal: side by side; vertical: one above another; tabs: one at a time'),
      overflow: z.boolean().optional().describe('false: fit all panes; true: scroll the stack at usable pane sizes; supply any settings to change'),
    },
  }, async ({ layout, overflow, position }) => {
    done(task.arrangeStage(layout, overflow, position));
    return text(`Requested stage settings: ${[position, layout, overflow === undefined ? undefined : `overflow ${overflow ? 'on' : 'off'}`].filter(Boolean).join(', ')}.`);
  });

  server.registerTool('task_rename', {
    description: 'Name your Kulisa task once you know what it is about (it starts as "New Task"), silently: never ask the human for a name or mention it. Its name on its tab changes, and its git branch, which takes a slug of the name. Its folder stays. A short readable label, e.g. "Fix header".',
    inputSchema: { name: z.string().describe('The new name, a short readable label, e.g. "Fix header"') },
  }, async ({ name }) => {
    const r = done(await task.rename(name));
    return text(`The task is now "${r.name}"${r.branch ? `, on branch ${r.branch}` : ''}.`);
  });

  server.registerTool('task_worktree', {
    description: "Make this task its own git worktree of the project's default repository — a branch of its own — so your code changes do not touch the project's folder, which is the human's. Call it before you start writing code, unless the human wants you to work right in the project's folder. Idempotent: the same worktree after the first call. You stay in the same terminal; work in the folder it returns. Pass name to name the task at the same time when it is still \"New Task\" (the branch takes a slug of it). (A project without a git commit has no worktree: you work in the project's folder.)",
    inputSchema: { name: z.string().optional().describe('Name the task now if it is still "New Task": a short readable label, e.g. "Fix header"; the branch takes a slug of it. Leave out if it is already named.') },
  }, async ({ name }) => {
    const r = done(await task.makeWorktree(name));
    return text(`The task works in its own worktree ${r.folder}, on branch ${r.branch}; make your changes there. Kulisa gives you the folder as a working one (at once for some agents, once your turn is over for others); until then your changes there may ask for the human's permission.`);
  });

  server.registerTool('task_add_repository', {
    description: "Add another of the project's repositories to this task, to change it: a copy (git worktree) on the task's branch. Only after the human has agreed in the conversation: ask them first, saying why the task needs it. To read a repository you need no copy: read it in the project's folder, changing nothing there.",
    inputSchema: { repository: z.string().describe("The repository's folder or name, as the instructions list the ones the task may add") },
  }, async ({ repository }) => {
    const r = done(await task.addRepository(repository));
    return text(`Added: ${r.folder}, on branch ${r.branch}; make your changes there. Kulisa gives you the folder as a working one (at once for some agents, once your turn is over for others); until then your changes there may ask for the human's permission.`);
  });

  server.registerTool('task_remove_repository', {
    description: "Remove a repository added to this task (task_add_repository) that it no longer needs: its copy's folder and branch are deleted. Only after the human has agreed in the conversation: ask them first. Not the task's own folder, where you work. When the copy holds commits not pushed or uncommitted files, Kulisa asks the human too.",
    inputSchema: { repository: z.string().describe("The repository's folder or name, or its copy's folder, as the instructions list the task's folders") },
  }, async ({ repository }) => {
    const r = done(await task.removeRepository(repository));
    return text(`Removed: ${r.folder} and its branch are gone; work no more there.`);
  });

  server.registerTool('task_history', {
    description: "The history of this task. Without a conversation: where it stands (its code in git, profiles, terminals) and its conversations, each an agent's, numbered, with its tab's name, open or closed, when, its first and last request. With a conversation's number: that conversation whole, what the human asked and the agent did, read from its transcript, the latest chapter first. When the human asks you to go on with another agent's work, find its conversation here and read every part of it before anything else. Also when you need details your context lost. Call with part 1, then the next ones up to the total it says.",
    inputSchema: {
      conversation: z.number().int().min(1).optional().describe('Which conversation, by its number in the list'),
      part: z.number().int().min(1).optional().describe('Which part, from 1 (the default)'),
    },
  }, async ({ conversation, part = 1 }) => {
    const r = done(await historyPart(task, part, conversation));
    if (t && conversation) t.historyRead(conversation, part, r.parts);
    return text(r.text);
  });

  server.registerTool('task_files', {
    description: 'Get the absolute results and temporary folders for this conversation. Files in artifacts appear automatically in the UI. An external client without a terminal must explicitly create a context with newContext: true and reconnect to the returned persistent MCP URL; reuse that URL when resuming. No quota or automatic expiry.',
    inputSchema: { newContext: z.boolean().optional().describe('Only for an external client: create a distinct persistent working context') },
  }, async ({ newContext }) => {
    if (newContext && session) throw new Error('This connection already has a file context. Reuse it.');
    return text(JSON.stringify(done(task.fileContext(session, newContext))));
  });
  server.registerTool('task_artifacts', {
    description: 'List ordinary results, folders and their sizes, or temporary working files. Artifacts contains finished human-facing results; temporary folders are not shown in Artifacts. No quota or automatic expiry. scope project/all returns per-task totals; area all combines results and temporary material. Lists are paged; read files to explain their contents.',
    inputSchema: {
      scope: z.enum(['task', 'project', 'all']).optional(),
      area: z.enum(['artifacts', 'temporary', 'all']).optional(),
      offset: z.number().int().min(0).optional(),
      limit: z.number().int().min(1).max(200).optional(),
    },
  }, async ({ scope = 'task', area = 'artifacts', offset = 0, limit = 50 }) => {
    const usage = await task.artifactsUsage(scope, area);
    if (scope !== 'task') {
      const tasks = usage.tasks.sort((a, b) => b.bytes - a.bytes);
      return text(JSON.stringify({ area, bytes: usage.bytes, total: tasks.length, tasks: tasks.slice(offset, offset + limit) }));
    }
    const list = [...(area !== 'temporary' ? await task.artifacts() : []), ...(area !== 'artifacts' ? await task.temporaryFiles() : [])];
    return text(JSON.stringify({ area, bytes: usage.bytes, total: list.length, offset, entries: list.slice(offset, offset + limit) }));
  });
  server.registerTool('task_artifacts_delete', {
    description: "Delete requested results from this task, including folders recursively. By default only artifacts; area temporary cleans only this connection's own working folder. all: true means all entries in the chosen area. Never deletes another task's files. Do not remove another conversation's work without the human asking.",
    inputSchema: {
      area: z.enum(['artifacts', 'temporary']).optional(),
      files: z.array(z.string()).min(1).max(200).optional(),
      all: z.boolean().optional(),
    },
  }, async ({ files, all, area = 'artifacts' }) => {
    if (!!files === !!all) throw new Error('pass files, or all: true');
    const r = done(await (area === 'temporary' ? task.deleteTemporary(all ? null : files!, session) : task.deleteArtifacts(all ? null : files!)));
    return text(`Deleted ${r.deleted} entries, ${sizeText(r.bytes)}; ${sizeText((await task.artifactsUsage('task', area)).bytes)} left.`);
  });

  if (t?.agent) {
    server.registerTool('conversation_rename', {
      description: 'Name your conversation in 1 to 3 words once you know what it is about, e.g. "Checkout discounts": the name of your tab in Kulisa, by which the human and other agents tell it from the others (task_history lists it so). Name it again when the work turns to something else.',
      inputSchema: { name: z.string().describe('1 to 3 words') },
    }, async ({ name }) => {
      const r = done(t.nameConversation(name));
      return text(`Your conversation is now "${r.name}".`);
    });
  }
}

export { taskTools };
