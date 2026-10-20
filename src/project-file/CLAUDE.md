# The project's file: working in this folder

All of reading and writing `.kulisa/project.json` is here: a Kulisa package (`docs/packages.md`: what one is, its
rules). How it works and why: `README.md`; the decisions behind it: issue #112. Keep the README current with the code,
as the docs in `docs/`.

- From outside only through `main/index.ts`. `main/` uses nothing of `src/main`; `npm run deps` refuses any import.
- It knows nothing of projects or the team's rules: which roles go into the file, who plays one, trusting the file, are
  `src/main/projects.ts`'s.
- **A section changes only compatibly** (fields added, none renamed): other computers' Kulisas read the same file.
  Never drop what it does not know.
- Its unit tests are `project-file.test.ts`; its e2e test is in `test/tasks.ts`.
