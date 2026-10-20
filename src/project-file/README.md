# The project's file

A project's file in its repository, `.kulisa/project.json`: what is described once for every computer the
repository is on, kept in git (issue #112, where the decisions are written down). A Kulisa package
([docs/packages.md](../../docs/packages.md)): it reads and writes the file and knows nothing of projects, tasks or
agents; the team that uses it is the core's ([docs/tasks.md](../../docs/tasks.md), The team).

## The file

A folder `.kulisa/` at the root of the project's default repository, as `.claude/`, `.vscode/`, `.idea/` are: now
`project.json`; later files beside it without renaming anything. Not one `.kulisa.json`: it will grow (the author,
2026-10-20: the file is for more than the team), and moving from a file to a folder later would break the copies of
Kulisa that read the file.

- **Sections**, one per ability: `team` now (who each profile is, how the app runs: later). Kulisa rewrites only the
  section it changes (`writeTeam`) and keeps the others as they are, those it does not know too, and in a section each
  role's fields it does not know.
- **Read by other versions of Kulisa**: an older or newer Kulisa on another computer reads the same file, so a section
  changes only compatibly (fields added, none renamed or given another meaning). The exception to "no data migrations"
  (the author, 2026-10-10), which is about Kulisa's own data; this file is in git, read by every computer.
- **A file that is not JSON** (the human's, half edited) is read as having no team, and never written over: a change is
  refused, saying so.
- **Read once per change** (its time and size): the team is asked for on every draw of the window.
- **Written by Kulisa only on the human's action** (a role changed in Settings) and committed by the human: the one
  thing Kulisa writes into a project's folder besides a new project's first commit.

## The team section

Each role: its `id`, `agent` (its entry's id in `agents/`: `claude`, `codex`), `name`, `about` (what it does, the
human's words), `model`, `os` (`linux`, `macos`, `windows`: the OS it works on; none: any) and `default` (a new task
starts it). Never its account: accounts are each computer's own, and an email has no place in a shared repository. A
role without an `id` or an `agent` (a hand edit gone wrong) is left out; the words are cut to their lengths.

A new role's `id` is random (`r` and six hex digits, `newId`): two computers each adding a role would both count up to
the same number.

## Outside it

What uses it, and why there: the team's roles kept in the file or on this computer, who plays one here, the default,
and trusting a repository's file before reading it are the project's (`src/main/projects.ts`: `rolesOf`, `saveTeam`,
`askRepoTeam`), with the question asked in its window; the OS of this computer is the partners' (`src/main/partners.ts`:
`thisOs`); Settings' Kept in, Played by, Works on and Use It are the window's (`ProjectEditor.vue`).

## The code

| File | What |
|---|---|
| `main/index.ts` | its entry: the team read (`teamIn`) and written (`writeTeam`), the rest kept; whether the file is there, its path, a new role's id |
| `project-file.test.ts` | its unit tests |

Its e2e test: `test/tasks.ts` ("team: a role is kept in the repository …").
