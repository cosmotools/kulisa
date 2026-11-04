// Window handles for project membership and task agent choices (docs/tasks.md). Agent management owns discovery,
// installation and sign-in lifecycle; core supplies project context and its account-removal rules.
import { app } from 'electron';
import { addAgent, deleteAccount } from '../projects.ts';
import { installAgentManagement } from '../../agent-management/main/index.ts';
import { refused } from '../../shared/result.ts';
import { handle, on } from '../ipc.ts';
import type { Ipc } from '../ipc.ts';
import type { Shell, AgentChoice } from '../shell.ts';
import type { Task } from '../tasks.ts';

export function registerAgents(ipc: Ipc) {
  const { shell, at, serial } = ipc, manager = shell.accounts;
  const store = shell.store;
  const usedBy = (id: string) => store.projectsWith('agents', id).map((p) => p.name);
  const info = () => manager.info(usedBy);
  installAgentManagement(manager, {
    usedBy, serial, changed: () => shell.sendProjects(),
    choices: (e, details) => {
      const w = at(e), mine = w?.task?.project.agents() || [];
      const rank = (id: string) => mine.includes(id) ? mine.indexOf(id) : mine.length;
      // Task choices are restricted to its project's accounts. Settings/onboarding list CLI providers only.
      const accounts = shell.accounts.all().filter((a) => details ? a.own && a.agent.command : a.choosable && (a.own || mine.includes(a.id)))
        .sort((x, y) => rank(x.id) - rank(y.id));
      return { accounts, cwd: w?.task?.folder || app.getPath('home') };
    },
  });
  handle('account:delete', (e, { id }) => serial(async () => {
    const r = await deleteAccount(shell, id, at(e));
    if (refused(r)) return r;
    shell.sendProjects();
    return info();
  }));
  // A sign-in takes minutes, so it runs outside the serialized project/window queue.
  handle('account:signin:start', async (e, { id, agent, key }) => {
    if (id && !store.projects().some((x) => x.id === id)) return { error: `no project ${id}` };
    const r = await manager.signIn(agent, key, (channel, data) => { if (!e.sender.isDestroyed()) e.sender.send(channel, data); });
    if (refused(r)) return r;
    if (r.existing && !id) return { error: `${shell.accounts.find(r.account)!.name} is an account already` };
    shell.sendProjects();
    return id ? addAgent(shell, id, r.account) : info();
  });
  const choosing = new Map<string, (agent: AgentChoice | null) => void>(); // task key -> resolve(agent or null)
  // Asked in the task's window; Cancel opens none.
  shell.chooseAgent = ((task: Task, agent: AgentChoice | null) => new Promise<AgentChoice | null>((resolve) => {
    choosing.get(task.key)?.(null);
    choosing.set(task.key, resolve);
    task.window?.send('agent:choice:show', { task: task.key, selected: agent?.id ?? null });
  })) as Shell['chooseAgent'];
  shell.chooseAgent.cancel = (task: Task) => { choosing.get(task.key)?.(null); choosing.delete(task.key); };
  on('agent:choice:submit', (_e, { task, id }) => { if (!task) return; const r = choosing.get(task); choosing.delete(task); r?.(id ? shell.agentFor(id) : null); });
}
