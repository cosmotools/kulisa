---
name: debug-kulisa
description: How to find the cause of a Kulisa bug that tests and screenshots do not show (a page or pane that does not react, input going nowhere, a native view or dialog misbehaving, something only the author's running app does). Use when the author reports such a bug, before guessing at causes.
---

# Debugging Kulisa

What worked on 2026-10-08, when panes stopped taking clicks after Teams (the cause: a page's drag region,
ROADMAP "Workarounds of Electron bugs"): look inside the running app instead of guessing, make the bug happen on
demand, then take away one difference at a time until it goes.

## 1. Look inside the author's running Kulisa, without restarting it

The bug is there now, maybe not after a restart. Node's inspector can be turned on in a running main process:

```sh
kill -USR1 <pid>   # the main Electron process: ps -eo pid,comm,args, comm == "electron", no --type=
node .claude/skills/debug-kulisa/inspect.mjs 9229 'return require("electron").webContents.getAllWebContents().map((c) => c.getURL())'
```

- It listens on 127.0.0.1:9229 until the app quits; restarting the app (run-kulisa) turns it off.
- Read only, unless the author agrees: their profiles are signed in to real accounts. Never read cookies, tokens or
  page contents that are not needed (CLAUDE.md, Rules).
- Useful to read: the window's views (`BaseWindow.getAllWindows()[0].contentView.children`: bounds, visible, URL),
  every web contents, a page's state (`wc.executeJavaScript`, with a timeout: a hung page never answers), the
  window's HTML (the window's `webContents.executeJavaScript`: `document.elementsFromPoint`, open dialogs).
- Counters, left on `globalThis` and read later: `wc.on('input-event', …)` per web contents tells where the
  author's clicks and keys go (nowhere, the window, the page); listeners inside a page (`addEventListener(…, true)`)
  tell whether they reach it. Ask the author to click, scroll and type, then read them.
- A synthetic event (`wc.sendInputEvent`) reaching the page while real ones do not: the page is fine, something
  between the OS and the page takes them.

## 2. Make it happen on demand: a scratch Kulisa

```sh
.claude/skills/debug-kulisa/scratch.sh start <session scratch folder>   # its own data and ports; stop: scratch.sh stop
```

- Profiles: `act('profile:new', { name })` in the window's page over CDP (9333). Pages: `wc.loadURL` from
  inspect.mjs on 9230, or the MCP tools (`browser_navigate`) on port 4499.
- Change one thing in the running code from inspect.mjs, no edit in the repository, e.g.
  `Profile.prototype.setSigninMode = async function () {}` (no sign-in mode) or `Profile.prototype.connect` (no
  Playwright), before making the profile. Restart the scratch app between experiments: a broken state may stay.
- Third-party sites without signing in are fine to load (the author's rule is about signing in); never type
  credentials.

## 3. Real input (X11): click.sh

Some bugs need the OS's own mouse; `sendInputEvent` goes around the OS.

```sh
.claude/skills/debug-kulisa/click.sh "myshop — Kulisa" 400 320      # left click, relative to the window
.claude/skills/debug-kulisa/click.sh "myshop — Kulisa" 400 320 5    # wheel down
```

- It clicks only if exactly one visible window has that title and it is the active one after raising it. The mouse
  is the author's: a click elsewhere lands in their windows. On 2026-10-08 a search by process id found the author's
  window instead, and clicks went into their screen; never click by a window found another way.
- The scratch window is "myshop — Kulisa"; the author's is "<project> — Kulisa": do not click theirs unless they
  ask. Tell the author before a series of clicks: their windows lose the focus for a few seconds.
- A point in the window: the view's bounds (`view.getBounds()`, content coordinates) plus the frame's offset (the
  window's `getContentBounds()` against `xdotool getwindowgeometry`).

### Installing xdotool

Linux with X11 only (not Wayland, macOS or Windows). `sudo apt install xdotool` is the author's to run (it asks for
their password). Without root, into the session's scratch folder:

```sh
apt-get download xdotool libxdo3 && for f in *.deb; do dpkg -x "$f" root; done
LD_LIBRARY_PATH=$PWD/root/usr/lib/x86_64-linux-gnu $PWD/root/usr/bin/xdotool version
```

## 4. Take away differences: bare Electron

When Kulisa has the bug and the cause is not in sight, write a minimal Electron script (a window, two
`WebContentsView`s, `input-event` counters written to a file) in the scratch folder, run it with
`npx electron --no-sandbox <script>`, and add Kulisa's differences one at a time: `BrowserWindow` vs `BaseWindow`,
`titleBarStyle: 'hidden'`, `mimic-chrome.js`, the session, the Playwright connection. The one that brings the bug is
the cause; that script is also the reproduction for an Electron issue.

## What does not work here

- A screenshot of the whole screen: it shows the author's other windows (private). For Kulisa's window use
  `KULISA_SHOT` or `shell.screenshot` (CLAUDE.md).
- The accessibility tree (AT-SPI) of Electron windows is empty without `--force-renderer-accessibility`; Wnck lists
  only OS windows (an Electron message box shows there as a "dialog").
- `pkill -f`: matches the shell running it (CLAUDE.md, Rules).

## After

- The fix with a test that fails without it (CLAUDE.md); when real input is the only way to see the bug, test the
  mechanism instead and say so.
- A workaround of an Electron or Chromium bug: in ROADMAP, "Workarounds of Electron bugs", with how to check it.
- Stop the scratch app, the inspector goes with a restart; delete the scratch folder's files.
