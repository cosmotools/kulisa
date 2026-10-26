# Activity monitor

What Kulisa takes on the computer, for the human and the agent to see and decide what to clean up: a Kulisa package
([docs/packages.md](../../docs/packages.md)). It measures; what to show and what to delete are its callers'. It knows
of tasks only what the caller tells it: each task's key, its project and its folders (`Tasks`, given by `app.ts` from
the store: every task of every project, open or not, since a task not loaded keeps its files too).

Its callers:
- the Resources island's heading over the artifacts, what they take (`Task.artifactsUsage`; docs/tasks.md, The
  Resources island);
- the agent's `task_artifacts`: its task's, its project's or every task's (`kulisa-plugin/tools/task.ts`);
- the artifacts themselves: listed and kept under their limit from its folder's usage (`kulisa-plugin/artifacts.ts`),
  so a figure, a list and the limit come from one reading of the disk.

## Disk (`main/disk.ts`)

`folderUsage(dir)`: the entries at a folder's top with their sizes and times, a folder within it summed whole, and
their total. A missing folder or an entry gone while it is read counts as nothing: tasks' folders change while the
agent works.

## The query (`main/monitor.ts`)

`ActivityMonitor.query({ tasks, projects, metrics, entries })` answers for every task, one, a project's or any group
(a task in `tasks` or in `projects` is taken), with every metric or the ones named: each task's figures and their
total. `entries` adds each metric's files; by default only the figures, so the island's heading reads no list it does
not show. Measured at each query, nothing kept: a folder's size is a readdir and a stat per file, and a figure kept
would go stale as the agent works.

The metrics: `artifacts`, a task's folder of what the agent's tools kept of its pages. A new one is a name in
`METRICS` and its folder in what the caller gives (a task's profiles, issue #113); the memory of each tab, also there,
is a metric of its own way of measuring.

## The code

| File | What |
|---|---|
| `main/index.ts` | its entry: `ActivityMonitor`, `folderUsage` |
| `main/disk.ts` | a folder's usage |
| `main/monitor.ts` | the query over the tasks |
| `monitor.test.ts` | its unit tests |

Its e2e test is in `test/e2e/agent-reports.spec.ts` ("artifacts: what they take …").
