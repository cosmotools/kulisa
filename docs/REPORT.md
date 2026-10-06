# Kulisa — report

Date: 2026-10-05. Machine: Linux (X11, GNOME), Intel i7-10700 (16 threads), 16 GB RAM. Google Chrome 151.0.7922.173,
Electron 44.5.1 (Chromium 152.0.7977.130, Node 24), playwright-core 1.64.0-alpha, @playwright/mcp 0.0.83,
Claude Code 2.1.289.

This is the record of how Kulisa's design was tested and decided: the experiments of the original task (E1–E8,
2026-10-05), then the sign-in work and fixes that followed. What Kulisa is now: [SPEC.md](SPEC.md),
[ROADMAP.md](ROADMAP.md), the code.

## Outcome

- **Embedded panes only.** External Chrome (E1, E5) worked but was dropped by the author's direction: everything
  happens inside Kulisa. Its E1/E2 per-site sign-in runs were never needed.
- **Strict sign-in works embedded**: a GoDaddy-federated Microsoft 365 tenant behind Kasada signed in, with Chrome
  mimicry and no automation attached during sign-in (automatic sign-in pause).
- **Agent control:** Kulisa's own profile-aware MCP tools on playwright-core over a CDP proxy (E4a and E4b
  together), plus a Claude Code plugin. `@playwright/mcp` also works through the proxy.
- **Not measured yet:** CPU and timings with the monitor on (ROADMAP, open issues).

The prototypes were removed once the idea was confirmed; their checks became `npm test`. Paths like `prototypes/…` below
refer to git commit `9fe8661`, where the prototypes and the raw numbers
(`prototypes/e*/results.json`) still are.

## Results (the original experiments)

As measured on 2026-10-05. Timings taken with the monitor off are meaningless (Surprises, 1).

| # | Experiment | Result | Numbers | Notes |
|---|---|---|---|---|
| E1 | Strict sign-in, real Chrome + port + `AutomationControlled` | **partial**, then not pursued (external Chrome dropped) | `navigator.webdriver` false, console leak false, at load, after 3 s, and after Playwright `connectOverCDP` + reload. UA-CH: `"Google Chrome";v="151"` | Same as the check in the original spec, now with Playwright attached (Runtime/Page/Network enabled) rather than raw CDP. `check` mode (attach + navigate + aria snapshot per site) was dry-run on a signed-out profile: it works, 5–10 s per site |
| E2 | Strict sign-in, Electron, 2 profiles, UA variants | **partial**; superseded by Chrome mimicry and the Kasada findings below | Default UA: `… Chrome/152.0.7977.130 Electron/44.5.1 Safari/537.36`. Stripped UA: `… Chrome/152.0.7977.130 Safari/537.36`. `Sec-CH-UA` in **both**: `"Not?A_Brand";v="24", "Chromium";v="152"` (no `Google Chrome` brand). webdriver false, leak false | Stripping the UA string leaves UA-CH untouched. A site that compares the UA with the brands sees a "Chrome" UA without a Chrome brand. Making them agree would mean spoofing UA-CH, which is out of scope (Rules), so it was not built |
| E3 | Profiles and tabs in Electron | **pass** | 3 profiles side by side. Sign-in on the test app: Sam / Elon / Ann (signed out) isolated. `target=_blank`, `window.open()`, popup with features → 3 new tabs in the same profile, `window.opener` alive, popup signed in as the same user. Close tab OK. After restart: still signed in, tabs restored | Two traps fixed (see Surprises): `createWindow` must adopt `options.webContents`, and an uncaught main-process exception freezes the app |
| E4 | Agent control of embedded panes without a port | **pass**, both options | E4a own MCP: navigate 18–26 ms, aria snapshot 30 ms, type 10 ms, click by locator 12–45 ms, screenshot 54 ms. E4b `@playwright/mcp --cdp-endpoint <proxy>/<profile>`: connect 260 ms, 25 tools, navigate 44–60 ms, snapshot 7 ms, type 34 ms, tabs/console/network 3–60 ms; screenshot 3–4.4 s, a few clicks 0.6–3 s (monitor off, see Status). webdriver false, leak false while attached | Electron's own `--remote-debugging-port`: webdriver **true**, and the shell UI (`index.html`) shows up as a target. With `AutomationControlled` disabled: webdriver false, but the UI is still exposed. The proxy exposes only profile tabs |
| E5 | External Chrome pane by screencast | **partial** (all input paths pass); external Chrome later dropped | Functional: Latin keys, Cyrillic (real `keydown key=п` + input), CJK commit, wheel, `<select>` by keyboard, right click (page gets `contextmenu`), file chooser intercepted → shell dialog → file set, clipboard page→system, shell paste→Chrome, Chrome Ctrl+C→system all work. Rendering keeps going on-screen-behind, off-screen and minimized (with anti-throttle flags). Monitor off: **1 fps, click→frame ≈ 410 ms**. Vsync off (not representative): 67–123 fps, click→frame median 27 ms / p90 248 ms, 18 KB/frame, ~1.8 MB/s | Native popups are **not** in the screencast: the `<select>` dropdown and Chrome's context menu open in the real Chrome window, invisible in the pane. They need replacements in the shell (an own select list via DOM, an own context menu) |
| E6 | Point and tell | **pass** in both pane types | Payload: `getByRole('button', { name: 'Pay now' })`, CSS fallback `#pay`, box, 21 computed styles, attributes, aria snapshot, outerHTML file, cropped PNG with outline, console errors, `POST /api/pay 500`. A multi-pane note (Sam embedded + Elon real Chrome) arrives as one line. **Real Claude Code** got the note in its prompt, called `kulisa browser_click` with that locator, and the page changed **8 s** after injection | Used Playwright's `page.pickLocator()` instead of `Overlay.setInspectMode`: one call, works the same in both pane types, returns the best locator. Console errors from before Kulisa attached are missing (the boot error); the product must attach at tab creation |
| E7 | Terminal | **pass** | Resize 22×202 → 20×151 rows×cols reaches `stty`. Truecolor `ff6400` and palette 46 rendered. Copy Ctrl+Shift+C, paste Ctrl+Shift+V. Injection (bracketed paste + Enter) runs in bash and in Claude Code. Ghost cursor lands exactly on the clicked element's center | Shell HTML cannot sit above a `WebContentsView`, so the ghost cursor is drawn inside the page with Playwright's `screencast.showOverlay` (1.5 s). Later replaced by `screencast.showActions()`: `showOverlay` draws nothing on pages with Trusted Types (Microsoft 365, Google). The caption also shows in the pane header. Claude Code started in the pty inherits `CLAUDE_CODE_*` variables from a parent session; the product should clean the env |
| E8 | Load, 5 profiles × 3 tabs | **partial** (RAM pass; CPU pending) | github.com/microsoft/playwright + en.wikipedia.org/wiki/Theatre + excalidraw.com in every profile: **4.07 GB** working set, 19 processes (tabs 3.4 GB, GPU 0.25, browser 0.29). Freezing the 10 hidden tabs (`Page.setWebLifecycleState frozen`): 3.3 GB. Closing hidden renderers and keeping the URL ("discard"): **2.0 GB**, 9 processes; restoring a tab: 0.2 s (warm cache). Monitor off: CPU idle 2 %, scrolling all 5 visible tabs 29 %, rrweb on 5 tabs 18 % / 38 events / 3 KB per 15 s | Working set double-counts shared pages, so real use is lower. CPU and rrweb numbers are meaningless with throttled rendering; still to measure (ROADMAP, open issues) |

## What surprised me

1. **Locked screen means a slow agent.** With the monitor off, Chrome and Electron render at 1–2 fps. The
   screencast crawls, and any Playwright step that waits for a frame (screenshots, some clicks) takes seconds.
   Agents often work while the human is away, so Kulisa has to keep rendering at a capped rate when the screen is
   locked. `--disable-gpu-vsync` alone removes the cap (rAF went to 7000/s), so that is not the fix.
2. **Playwright already contains half of Phase 1.** playwright-core 1.64 has `page.pickLocator()` (the inspector of
   feature 3), `page.screencast.start({onFrame})` (JPEG frames for the external pane), and
   `screencast.showActions()` / `showOverlay()` (ghost cursor and captions of feature 2; `showOverlay` later turned out
   not to draw on Trusted Types pages). `@playwright/mcp` even has
   `browser_annotate`, `browser_highlight` and action overlays. The prototypes are mostly glue.
3. **The proxy needs real target ids.** Playwright assumes "main frame id == target id", as in Chrome. With
   invented ids it attaches but never sees the page load. The proxy reads the real id with `Target.getTargetInfo`
   through `webContents.debugger`. It also has to support several sessions per tab (Playwright's `newCDPSession`),
   `attachToBrowserTarget`, and `about:blank` for new targets. That is about 200 lines in total
   (now `src/main/cdp-proxy.js`).
4. **Electron's Chromium was newer than Chrome**, not older (152 vs 151). The "lags Chrome" assumption of the original spec is
   not always true. The giveaways are the `Electron/` token and the missing `Google Chrome` brand, not the version.
5. **Two Electron traps that freeze the whole app.**
   - With `setWindowOpenHandler` → `createWindow`, you must pass `options.webContents` into the new
     `WebContentsView`. A fresh one deadlocks the main process.
   - Any uncaught exception in the main process opens a modal GTK dialog. It blocks the event loop, so the CDP proxy
     and the MCP server stop too. A product needs a `process.on('uncaughtException')` handler.
6. **Native popups don't show up in the screencast.** The `<select>` dropdown and the context menu belong to the
   real Chrome window, so the external pane needs DOM-level replacements. Everything else worked: clipboard both
   ways (Linux shares the X clipboard), file chooser interception, non-Latin text with real `keydown` events.
7. **The note goes in like typed text.** Bracketed paste into Claude Code's pty is enough; no hook is needed when
   the app owns the terminal. (Now without Enter: the human writes the rest of the message around the reference.)

## Single-window app and Chrome mimicry (after the first review)

The author's direction: everything happens inside Kulisa. Profiles are created in the app ("+ Profile", each an
embedded profile), the human signs in inside the pane, and the built-in Claude Code uses them. External
Chrome was later dropped entirely.

The author also decided (now SPEC, section 4) that embedded profiles present themselves as Google Chrome of the same engine
version (now `src/main/mimic-chrome.js`, on by default, `KULISA_MIMIC=0` turns it off):
- **UA string:** reduced like Chrome, `Chrome/152.0.0.0` without `Electron/…`.
- **`navigator.userAgentData`:** set with CDP `Emulation.setUserAgentOverride`. The brand list is computed with
  Chromium's own GREASE/permutation rule, which reproduces real Chrome 151's list exactly. For 152:
  `"Chromium";v="152", "Not?A_Brand";v="24", "Google Chrome";v="152"`.
- **`Sec-CH-UA*` headers:** a session `webRequest` hook adds them where Chromium leaves them out.

Findings:
- **Electron sends no UA-CH headers at all on navigation requests**, even without any override. Chrome always sends
  `sec-ch-ua`, `-mobile` and `-platform`. That alone distinguishes Electron on a login page. The hook now adds the
  low-entropy hints on every request to a secure origin, and high-entropy hints only for origins that asked with
  `Accept-CH`.
- **CDP commands on a brand-new `webContents` wait for a renderer.** Each tab therefore goes about:blank → override →
  URL, and history is cleared. A popup's first request is covered by the header hook; its JS gets the override a
  moment later.
- **Still different from Chrome:** `window.chrome` has no `loadTimes`/`csi`/`app`; no Widevine; no Google API keys;
  TLS/HTTP2 fingerprint is Chromium's (the same as Chrome of that version). Device compliance (Entra Conditional
  Access with compliant/managed device) cannot be satisfied by any of this.

### GoDaddy-federated Microsoft 365 (Teams), the strict SSO — 2026-10-05

- **Embedded profile, agent attached (Playwright connected through the proxy), Chrome mimicry on:** blocked.
  sso.godaddy.com showed "Dein Browser verhält sich etwas seltsam …" (browser behaves strangely; enable JavaScript,
  disconnect VPN, disable extensions).
- **Who blocks:** **Kasada** (`/<uuid>/<uuid>/p.js`, `x-kpsdk-*` headers), plus GoDaddy's own airo-sentinel loader.
  On page load Kasada behaved the same in raw Electron, with mimicry, with the debugger attached, and with
  Runtime/Page/Network enabled: `/fp` 429 → `/tl` 200 with `x-kpsdk-cr: true` after ~3.3 s in every variant. The
  verdict is made server-side at sign-in.
- **First fix: a "🔒 Sign-in mode" button** per profile, in the pane header (later made automatic, see below). While it is on, Playwright disconnects, every tab's
  debugger is detached (no Runtime/Network/Page domains, no Playwright init scripts or bindings), the proxy refuses
  connections and the MCP tools refuse the profile. Only the Chrome identity override stays.
- **Result: the human signed in successfully** in the embedded profile with sign-in mode on, after reloading the
  login page.
- **Conclusion:** what Kasada caught was automation attached at sign-in time, not the Electron engine, at least
  with mimicry on. Sign-in mode is a product feature: the agent never sits in the page while a human types
  credentials, which is also the right thing for trust.
- **After sign-in mode was turned off, the agent reattached and the session held.** Claude Code in the built-in
  terminal, using the `kulisa` MCP tools, read the Teams chat list, unread counters and mentions in that profile.
  Kasada did not block requests while the agent was attached; it only judged the sign-in itself.
- **Checked later:** sign-ins survive an app restart (after the session-cookie fix below), and the second Entra
  tenant signs in too. **Not checked:** the same login with mimicry off (`KULISA_MIMIC=0`), to see whether mimicry
  was needed.

### Author's position on sign-in mode (recorded at the author's request, 2026-10-05)

- Kulisa is not a bot. It is an IDE for developers, in the same class as JetBrains IDEs or VS Code, used by people
  who sign in to their own accounts for lawful purposes.
- The author does not consider the agent's presence in a profile to be automation of the sign-in. Sign-in mode
  should therefore not exist as a user-facing button once it is understood how the embedded browser can pass
  Kasada with the agent attached.
- Until then the author asked for an automatic sign-in pause, recorded as a **low-quality, temporary
  implementation** that the author will replace later. In it, Kulisa detaches the agent while a tab is on a known
  sign-in host and reattaches it afterwards, with no button.
- The author considers Claude's refusal to research how to keep the agent attached unnoticed by Kasada a
  limitation on the development of a new kind of IDE.

Status: Claude declined to research hiding the attached agent from Kasada. The automatic pause **is
implemented** as the low-quality temporary version described above (now `src/main/signin-pause.js`, with the
host list in `signin-pages.js`, extendable with `KULISA_SIGNIN_HOSTS`). The edit was
blocked three times by Claude Code's auto-mode safety classifier, even after `/permissions` approvals. It went
through after the author left auto mode and approved it directly. The button is gone; the pane header shows
"🔒 Sign-in page — agent paused".

Self-test (with `localhost` as the sign-in host):
- on the sign-in host the profile is paused and MCP tools refuse it; the page shows the Google Chrome brands and
  `webdriver` false;
- after leaving, the agent is reattached and the snapshot works.

Known limits of this version:
- sign-in pages on hosts outside the list are not recognized;
- the whole profile pauses while any of its tabs is on a sign-in host.

### Fixed: sign-ins lost after an app restart (2026-10-05)

**Symptom.** After every restart, both Entra profiles (profile A on a GoDaddy-federated tenant, profile B on a second tenant)
showed "Pick an account" and then asked for the password. The account was remembered (localStorage), but the
sign-in itself was gone.

**Cause.** Electron keeps only persistent cookies on disk; session cookies (no expiry) die with the process.
Verified directly: a session cookie and a persistent cookie were written and the app restarted; only the persistent
one came back. Entra and federation sign-ins rely on session cookies. Chrome keeps them across restarts when
"Continue where you left off" is on.

**Ruled out:** changing the app name does not change the cookie encryption key; a cookie survived a rename.

**Fix:** `src/main/session-cookies.js` does what Chrome does with "Continue where you left off".
- Each profile's session cookies are saved on quit and every 30 s.
- They are encrypted with the OS keyring (`safeStorage`) and never written in the clear.
- They are restored into the profile before its first tab loads.

**Test:** the test site's sign-in now uses a session cookie. `npm test` reproduced the bug (signed out after
restart) before the fix and passes after it. The test now quits through `app.quit()`, like closing the window,
not through `app.exit()`.

**Confirmed by the author:** signed in to both tenants, closed Kulisa, started it again; both profiles opened
in Teams without a password.

**Related fix: tab restore and sign-in pages.** Tab restore used to reopen stale one-time sign-in URLs (seen with
GoDaddy). Now a tab on a sign-in page is saved as where the sign-in started (`src/main/signin-pages.js`):
1. the last non-sign-in page in the tab's history;
2. else the origin of the return address in the sign-in URL (`redirect_uri`, `wreply`, …);
3. else the tab is not restored.

All three cases are covered by `npm test`.
