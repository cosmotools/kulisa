---
name: debug-kulisa
description: How to find the cause of a Kulisa bug that tests and screenshots do not show (a page or pane that does not react, input going nowhere, a native view or dialog misbehaving, something only the author's running app does). Use when the author reports such a bug, before guessing at causes.
---

# Debugging Kulisa

Inspect the live failure, reproduce it in isolation, then remove differences to identify its cause.

## 1. Inspect without restarting

Restarting may erase the failure. On Linux/macOS enable the running main process's inspector:

```sh
kill -USR1 <pid>   # ps -eo pid,comm,args: electron without --type=
node .agents/skills/debug-kulisa/inspect.mjs 9229 'return require("electron").webContents.getAllWebContents().map((c) => c.getURL())'
```

It listens on `127.0.0.1:9229` until restart. Keep the author's app read-only unless they authorize changes; avoid
cookies, tokens and unnecessary page contents.

Inspect native views/bounds/visibility, web contents, open dialogs and `document.elementsFromPoint`. Bound
`executeJavaScript` calls: hung pages never answer. With authorization, input counters on `globalThis`,
`wc.on('input-event', …)` and capture listeners show whether real input reaches a view/page. Ask the author to
reproduce, then read counters. If synthetic `sendInputEvent` works but real input fails, inspect the OS-to-page path.

## 2. Reproduce in scratch Kulisa

```sh
.agents/skills/debug-kulisa/scratch.sh start <session scratch folder>
# stop with: .agents/skills/debug-kulisa/scratch.sh stop
```

Use MCP 4499 (`profile_create`, `browser_navigate`), inspector 9230, window CDP 9333. Patch one runtime difference
through `inspect.mjs`, e.g. disable sign-in mode or Playwright before profile creation; restart scratch between trials.
Third-party pages may be loaded without signing in; never enter credentials.

## 3. Real input (X11)

```sh
.agents/skills/debug-kulisa/click.sh "myshop — Kulisa" 400 320
.agents/skills/debug-kulisa/click.sh "myshop — Kulisa" 400 320 5  # wheel down
```

Use only the script's exact-title/unique-visible-window/focus checks. PID searches can find the author's window;
never substitute a different search. Do not click their window unless asked. Warn before a click series because it
takes OS focus. Convert view content coordinates using `getContentBounds()` and `xdotool getwindowgeometry`.

Linux X11 only. The author can install xdotool with `sudo apt install xdotool`. Without root, use the session scratch
folder:

```sh
apt-get download xdotool libxdo3 && for f in *.deb; do dpkg -x "$f" root; done
LD_LIBRARY_PATH=$PWD/root/usr/lib/x86_64-linux-gnu $PWD/root/usr/bin/xdotool version
```

## 4. Reduce to bare Electron

Create a scratch script with one window, two `WebContentsView`s and input counters. Add relevant differences one at
a time: BrowserWindow/BaseWindow, hidden title bar, session, Playwright. Run Linux with
`npx electron --no-sandbox <script>`; keep the minimal reproduction for upstream reporting.

## Constraints and cleanup

- Capture Kulisa only (`KULISA_SHOT` or `shell.screenshot`); whole-screen images expose private windows.
- AT-SPI needs `--force-renderer-accessibility`; Wnck lists OS windows, including native dialogs.
- Never use `pkill -f`. Restart the author's app only with `run-kulisa`.
- Add a failing regression, or test the mechanism and explain why real input is required.
- Document Electron/Chromium workarounds and recheck steps in `docs/testing.md`, Upgrading Electron.
- Stop scratch, remove its files; a normal app restart removes the inspector.
