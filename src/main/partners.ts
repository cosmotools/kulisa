// Partners on the human's other computers (issue #49, step 6; docs/tasks.md, Partners on other computers): a task's
// card next to its branch on the remote, the other computers' cards, and the talk through the task's pull request,
// watched here. No server of Kulisa's and no connection between the computers: the remote and GitHub, as two people
// working on one branch share them.
import os from 'os';
import { pushCard, fetchCards, cardOf, dropCard, onRemote } from './worktrees.ts';
import { log } from './log.ts';
import type { Shell } from './shell.ts';
import type { Task, TaskTerminal } from './tasks.ts';
import type { ProjectEntry, TaskEntry } from './store.ts';
import type { Os, TaskElsewhere } from '../shared/types.ts';

// A computer's part of a card: who it is (its id, made once: store.computer), its name and OS, the roles its
// conversations of the task play.
interface Part { id: string; name: string; os: Os; roles: { id: string; name: string; agent: string }[] }
interface Card { name: string; branch: string; at: number; computers: Part[] }
const OS_NAMES: Record<Os, string> = { linux: 'Linux', macos: 'macOS', windows: 'Windows' };

// This computer's OS, as a role names it.
const thisOs = (): Os => (process.platform === 'darwin' ? 'macos' : process.platform === 'win32' ? 'windows' : 'linux');
const me = (shell: Shell) => ({ id: shell.store.computer(), name: os.hostname(), os: thisOs() });
const asCard = (c: Record<string, unknown> | null): Card | null => (c && typeof c.branch === 'string' && Array.isArray(c.computers) ? c as unknown as Card : null);
function partOf(task: Task): Part {
  const roles = new Map<string, Part['roles'][number]>();
  for (const c of task.conversations()) {
    const r = task.project.role(c.role);
    if (r) roles.set(r.id, { id: r.id, name: task.roleName(r), agent: task.shell.agentFor(r.account)?.cli ?? '' });
  }
  return { ...me(task.shell), roles: [...roles.values()] };
}

// What this Kulisa knows of a task's card: the one pushed last (unchanged: not pushed again), the other computers'
// parts as last fetched.
const known = new WeakMap<Task, { pushed?: string; others: Part[] }>();
const of = (task: Task) => { let k = known.get(task); if (!k) known.set(task, k = { others: [] }); return k; };

// The card pushed once the task's branch is on the remote (its agent pushed it), at the end of its agent's turns and
// when it is joined: this computer's part replaced in the card the remote has, the others' kept.
async function share(task: Task) {
  const c = task.entry.copies?.[0];
  if (!c || !(await onRemote(c.repo, c.branch))) return;
  const had = asCard(await cardOf(c.repo, c.branch)), mine = partOf(task), k = of(task);
  k.others = (had?.computers ?? []).filter((x) => x.id !== mine.id);
  const card: Card = { name: task.name, branch: c.branch, at: Date.now(), computers: [...k.others, mine] };
  const same = JSON.stringify({ ...card, at: 0 });
  if (k.pushed === same) return;
  await pushCard(c.repo, c.branch, card);
  k.pushed = same;
  log.info(`[partners] ${task.key}: its card pushed (${card.computers.length} computer${card.computers.length > 1 ? 's' : ''})`);
}
const shareQuietly = (task: Task) => share(task).catch((e: Error) => log.warn(`[partners] ${task.key}: its card not pushed: ${e.message}`));

// A task deleted: this computer's part goes from its card; the card with it when no other computer is on it.
async function leave(shell: Shell, entry: TaskEntry) {
  const c = entry.copies?.[0];
  if (!c) return;
  const had = asCard(await cardOf(c.repo, c.branch).catch((): null => null));
  if (!had) return;
  const rest = had.computers.filter((x) => x.id !== me(shell).id);
  if (rest.length === had.computers.length) return;
  if (rest.length) await pushCard(c.repo, c.branch, { ...had, at: Date.now(), computers: rest }).catch(() => {});
  else await dropCard(c.repo, c.branch);
}

// The project's tasks on the human's other computers that this one has no task of (the board's On Your Other
// Computers): fetched from the remote of its default repository.
async function elsewhere(shell: Shell, p: ProjectEntry, repo: string): Promise<TaskElsewhere[]> {
  const mine = me(shell).id, here = new Set(shell.store.tasksOf(p).list.map((e) => e.branch).filter(Boolean));
  return (await fetchCards(repo)).map(asCard).filter((c): c is Card => !!c && !c.computers.some((x) => x.id === mine) && !here.has(c.branch))
    .sort((a, b) => b.at - a.at).map(({ name, branch, at, computers }) => ({ name, branch, at, computers: computers.map(({ name: n, os: o, roles }) => ({ name: n, os: o, roles: roles.map((r) => r.name) })) }));
}

// A role played on another computer, by its name (agent_message to it), as the task's card says.
function partnerRole(task: Task, name: string) {
  for (const p of of(task).others) for (const r of p.roles) if (r.name.toLowerCase() === name) return { role: r, part: p };
  return null;
}
// Where a role of the task is played on another computer, as its card says (team_list); null: not.
function playedElsewhere(task: Task, role: string) {
  for (const p of of(task).others) if (p.roles.some((r) => r.id === role)) return `${p.name} (${OS_NAMES[p.os]})`;
  return null;
}
// The thread is the pull request's of the task's branch, in the default repository on GitHub, as its account.
async function threadOf(task: Task) {
  const g = (await task.project.githubRepos())[0], branch = task.entry.copies?.[0]?.branch;
  if (!g?.account || !branch) return null;
  const pr = await task.shell.github.pullOf(g.account, g.repo, branch);
  return pr ? { ...g, account: g.account, pr } : null;
}
// A message to a partner on another computer: a comment on the task's pull request, saying who it is from (the
// comments go up under the human's account) and, for the Kulisa there, from which computer to which role.
async function send(task: Task, from: TaskTerminal, to: string): Promise<{ error: string } | ((text: string) => Promise<{ to: string }>) | null> {
  const p = partnerRole(task, to.trim().toLowerCase());
  if (!p) return null;
  const thread = await threadOf(task);
  if (!thread) return { error: `${p.role.name} works on ${p.part.name} (${OS_NAMES[p.part.os]}): you talk through the task's pull request, which there is none of yet. Push the branch and open one (create_pull_request), then message again.` };
  return async (text) => {
    const head = `**From ${task.label(from)} (${from.agent!.cli} on ${OS_NAMES[thisOs()]}) to ${p.role.name}:**`;
    await task.shell.github.comment(thread.account, thread.repo, thread.pr, `${head}\n\n${text}\n\n<!-- kulisa ${JSON.stringify({ from: me(task.shell).id, to: p.role.id })} -->`);
    return { to: `${p.role.name} on ${p.part.name}` };
  };
}

// The task's thread read: new comments of the human's own account, each typed to whom it is for (a partner's: its
// role here; the human's own: every agent of the task), once its turn is over. Others' never: anyone may comment on
// a public repository, and a comment typed into a terminal is a prompt (#49, Only the team wakes an agent). The last
// one read is kept with the task (prSeen): none read before, the thread's past is not typed.
const threads = new WeakMap<Task, { etag?: string }>();
async function read(task: Task) {
  if (!of(task).others.length) return;
  const thread = await threadOf(task);
  if (!thread) return;
  const t = threads.get(task) ?? {}, login = task.shell.github.login(thread.account);
  threads.set(task, t);
  const seen = task.entry.prSeen?.pr === thread.pr ? task.entry.prSeen.id : null;
  const { list, etag } = await task.shell.github.comments(thread.account, thread.repo, thread.pr, seen ?? 0, seen === null ? undefined : t.etag);
  t.etag = etag;
  if (!list.length) return;
  task.markSeen({ pr: thread.pr, id: list.at(-1)!.id });
  if (seen === null) return;
  for (const c of list) {
    if (c.login !== login) { log.info(`[partners] ${task.key}: a comment of ${c.login} on #${thread.pr}, not the human's account: not given to the agents`); continue; }
    const m = /<!-- kulisa (\{.*?\}) -->/.exec(c.body), meta = m ? JSON.parse(m[1]!) as { from?: string; to?: string } : null;
    if (meta?.from === me(task.shell).id) continue; // this computer's own
    const text = c.body.replace(/\n*<!-- kulisa .*? -->\s*$/s, '').trim();
    if (meta) task.fromPartner(meta.to ?? null, text.replace(/^\*\*(.*?)\*\*\s*/s, '$1 '));
    else task.fromPartner(null, `From you, on the pull request: ${text}`);
  }
}

// Every loaded task with partners, its thread read every half minute (an unchanged one costs nothing of GitHub's
// limit: its ETag), its card fetched again every five minutes (a computer that joined).
function watch(shell: Shell) {
  let tick = 0;
  setInterval(() => {
    tick++;
    for (const p of shell.open.values()) for (const task of p.tasks.values()) {
      if (!task.loaded || !task.entry.copies?.length) continue;
      if (tick % 10 === 0) void shareQuietly(task);
      void read(task).catch((e: Error) => log.warn(`[partners] ${task.key}: its thread not read: ${e.message}`));
    }
  }, 30_000).unref();
}

export { thisOs, playedElsewhere, shareQuietly, leave, elsewhere, send, read as readThread, watch as watchPartners };
