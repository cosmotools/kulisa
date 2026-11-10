# Activity monitor

Measures disk usage from caller-supplied task keys, projects and folders, including unloaded tasks. Presentation
and deletion belong to callers; the Kulisa package imports no core code ([packages.md](../../docs/packages.md)).

Callers: the Artifacts [Side bar](../../docs/ui.md#workbench-terminology) (`Task.artifactsUsage`) and `task_artifacts`.

## Disk (`main/disk.ts`)

`folderUsage(dir)` returns top-level entries with sizes/times and a total, summing nested folders recursively.
Missing folders and entries removed during reading contribute zero. Symbolic links are excluded to avoid counting
external files or recursing through cycles.

## The query (`main/monitor.ts`)

`ActivityMonitor.query({ tasks, projects, metrics, entries })` returns per-task figures and totals. Task and project
filters are additive; omit them for all tasks. `metrics` selects measurements; `entries` includes file lists.
Queries read disk afresh and retain nothing, so figures reflect agent writes.

The metrics are `artifacts` (one folder) and `temporary` (caller-supplied working folders per task). New metrics add
a `METRICS` entry and caller-supplied folders; profile disk usage and tab memory are planned in #113.

## The code

- `main/index.ts`: public `ActivityMonitor` and `folderUsage`.
- `main/disk.ts`, `main/monitor.ts`: disk reads and task queries.
- `monitor.test.ts`: unit coverage; `test/e2e/agent-reports.spec.ts`: artifact integration.
