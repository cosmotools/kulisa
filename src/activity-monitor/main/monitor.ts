// The activity monitor's query: what Kulisa's tasks take, all of them or some, a metric or all (README, The query).
import { folderUsage, type Entry } from './disk.ts';

const METRICS = ['artifacts'] as const;
type Metric = typeof METRICS[number];
// A task as the caller knows it: its key, its project, the folder of each metric.
interface MonitoredTask { key: string; project: string; artifacts: string }
// What the monitor needs of Kulisa's tasks, implemented by the caller: every task, loaded or not.
interface Tasks { list(): MonitoredTask[] }
// No field: everything. tasks and projects narrow by key (a task in either is taken); entries: each metric's files too.
interface Query { tasks?: string[]; projects?: string[]; metrics?: Metric[]; entries?: boolean }
interface Usage { bytes: number; entries?: Entry[] }
interface TaskUsage { key: string; project: string; metrics: Partial<Record<Metric, Usage>> }
interface Report { total: Partial<Record<Metric, number>>; tasks: TaskUsage[] }

class ActivityMonitor {
  tasks: Tasks;
  constructor(tasks: Tasks) { this.tasks = tasks; }

  async query({ tasks, projects, metrics = [...METRICS], entries = false }: Query = {}): Promise<Report> {
    const narrowed = !!(tasks || projects);
    const chosen = this.tasks.list().filter((t) => !narrowed || tasks?.includes(t.key) || projects?.includes(t.project));
    const measured = await Promise.all(chosen.map(async (t): Promise<TaskUsage> => ({
      key: t.key, project: t.project,
      metrics: Object.fromEntries(await Promise.all(metrics.map(async (m) => {
        const u = await folderUsage(t[m]);
        return [m, entries ? { bytes: u.bytes, entries: u.entries } : { bytes: u.bytes }];
      }))),
    })));
    const total = Object.fromEntries(metrics.map((m) => [m, measured.reduce((sum, t) => sum + (t.metrics[m]?.bytes ?? 0), 0)]));
    return { total, tasks: measured };
  }
}

export { ActivityMonitor };
