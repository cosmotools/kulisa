# Screenshots

Read `README.md` and `docs/packages.md`.

- Entries: `main/index.ts`, `renderer/index.ts`, `ipc.ts`. Allowed core imports: `ipc.ts`, `log.ts`.
- Callers supply the Playwright page, capture owner and file callbacks. Tab checks belong to `Profile.screenshot`;
  MCP to `kulisa-plugin/main/tools/browser.ts`; human controls to the window; element selection to `picker.ts`.
- Own the thumbnail's lifecycle, placement, UI and channels. The window supplies pane bounds, covered-page and
  task-close events, menus and agent-prompt callbacks.
- Integration tests: README, The code.
