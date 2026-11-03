# Dictation

Read `README.md` and `docs/packages.md`. Design: #120.

- Entries: `main/index.ts`, `renderer/index.ts`, `ipc.ts`. Allowed core imports: `ipc.ts`, `log.ts`;
  the renderer imports no window code.
- Callers supply the active agent, key events and task/window lifecycle. Agent selection belongs to `Task.holdKey`;
  key configuration to `keys.ts`/`shortcuts.ts`; CLI dictation settings to its `kulisa-plugin/main/agents/` adapter.
- Recognizer accounts and launch configuration come from `src/main/recognizer.ts`; hooks from `agent-hooks.ts`.
  Never log dictated text.
- Tests: `dictation.test.ts` with a fake recognizer; `test/e2e/window.spec.ts`, `agents.spec.ts`.
