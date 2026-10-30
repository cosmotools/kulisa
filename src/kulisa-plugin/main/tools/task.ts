// The agent's tools on its task: its name, worktree and repositories, its history, its artifacts, the agent's own
// conversation. How a
// tool is designed: ../../README.md, Tool design.
import { z } from 'zod';
import { historyPart } from '../history.ts';
import { sizeText } from '../../../shared/bytes.ts';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Handles } from './handles.ts';

function taskTools(server: McpServer, { task, t, text, done }: Handles) {
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

  const KINDS: Record<string, string> = { screenshot: 'screenshot', snapshot: 'snapshot', request: 'request body', response: 'response body' };
  const profileName = (id: string) => task.profiles.get(id)?.name ?? task.closed.get(id)?.cfg.name ?? `profile ${id} (deleted)`;
  server.registerTool('task_artifacts', {
    description: `What the task's artifacts take and what they are: the files Kulisa's tools kept of its pages (screenshots, snapshots and bodies too large for an answer), in a folder of Kulisa's (never the project's). Past ${sizeText(task.artifactLimit)} a task's oldest go by themselves. Use it when the human asks what they are, how much room they take, or to clean them up (task_artifacts_delete). Each file with its path (read it to say what it shows), its kind, its profile, when and its size, the newest first. scope "project" or "all" gives each task's total instead.`,
    inputSchema: {
      scope: z.enum(['task', 'project', 'all']).optional().describe("Whose: this task's files (the default), or the totals of each task of the project or of every project"),
      limit: z.number().int().min(1).optional().describe('How many files at most, the newest first (default 50)'),
    },
  }, async ({ scope = 'task', limit = 50 }) => {
    const usage = await task.artifactsUsage(scope);
    if (scope !== 'task') {
      return text(`Artifacts: ${sizeText(usage.bytes)} in ${usage.tasks.length} task(s)${scope === 'project' ? ' of this project' : ''}.\n${usage.tasks.sort((a, b) => b.bytes - a.bytes)
        .map((u) => `- ${u.project} / ${u.name}${u.key === task.key ? ' (this task)' : ''}: ${sizeText(u.bytes)}`).join('\n')}`);
    }
    const list = await task.artifacts();
    const when = (ms: number) => new Date(ms).toLocaleString('sv').slice(0, 16);
    return text(`This task's artifacts: ${sizeText(usage.bytes)} in ${list.length} file(s).${list.slice(0, limit)
      .map((a) => `\n- ${a.file}: ${KINDS[a.kind] ?? a.kind}, ${a.source.kind === 'profile' ? profileName(a.source.id) : task.applications.info().find((t) => t.id === a.source.id)?.name ?? `application ${a.source.id} (closed)`}, ${when(a.time)}, ${sizeText(a.bytes)}`).join('')}${list.length > limit ? `\n${list.length - limit} older not listed (limit).` : ''}`);
  });

  server.registerTool('task_artifacts_delete', {
    description: "Delete this task's artifacts (task_artifacts): the files named, or all of them. Only this task's; another task's agent may still be reading its own. Delete what the human asked for.",
    inputSchema: {
      files: z.array(z.string()).optional().describe('Their paths, as task_artifacts gives them'),
      all: z.boolean().optional().describe('true: every artifact of this task'),
    },
  }, async ({ files, all }) => {
    if (!!files === !!all) throw new Error('pass files, or all: true');
    const r = done(await task.deleteArtifacts(all ? null : files!));
    return text(`Deleted ${r.deleted} file(s), ${sizeText(r.bytes)}; ${sizeText((await task.artifactsUsage()).bytes)} left.`);
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
