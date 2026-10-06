# Kulisa — product spec

Name: **Kulisa**, from the Russian *кулиса*, the wings of a theatre stage. The metaphor: the agent is the director working from the wings, the profiles are the actors, the panes are the stage, and the developer watches from the audience and stops the scene when something is wrong. Website: [kulisa.app](https://kulisa.app) (the domain the author's choice, 2026-10-05; live since 2026-10-06), its code in the separate repo `cosmotools/kulisa-site`.

What is built so far and what comes next: [ROADMAP.md](ROADMAP.md). How the decisions below were reached: [REPORT.md](REPORT.md).

## 1. Problem

A web developer builds an app where several people interact: a shop (buyer, seller, admin), a chat (Sam sends, Elon receives), any SaaS with roles. A coding agent (Claude Code in a terminal) writes the code and tests it in browsers.

Today that means a terminal, several Chrome windows (one per person, each logged in, often through corporate SSO: Microsoft Entra, Okta, GoDaddy), a mailbox for invitation emails, and DevTools. The developer keeps switching windows and holds the connections in their head.

The author already built **cast** (a Claude Code plugin: one persistent Chrome profile per person, driven by Claude through Playwright MCP, https://github.com/cosmotools/claude-cast). It solves logins and control, but every person is still a separate window. Kulisa is a separate product, not a cast feature.

## 2. Concept

One desktop app per project, an IDE for multi-user web apps (in the class of VS Code or JetBrains IDEs, not a bot). Everything happens inside Kulisa; no external browser windows. On one screen:

- **Profiles**: persistent identities of the app's users, each an embedded browser profile with its own cookies, storage and tabs, and later its own mailbox, locale, timezone and device. The human creates them in the app and signs in by hand.
- **Panes**: each profile's browser, side by side, live, with its own tab strip.
- **Terminal**: any CLI coding agent (Claude Code, Codex, …) runs unchanged in a real pty inside the app. The app does not replace the agent; it gives the agent an MCP server to drive profiles.
- **Timeline**: one feed of everything that happens across all profiles.

```
┌─ Shop project ─────────────────────────────────────────────────┐
│ ◉ Sam · seller         │ ◉ Elon · buyer        │ ✉ Inbox       │
│ [orders][+]            │ [cart][catalog][+]    │               │
│ ┌────────────────────┐ │ ┌───────────────────┐ │ Elon: "Order  │
│ │ /orders            │ │ │ /cart     ↖ agent │ │  #12"         │
│ │  [Order #12] NEW   │ │ │ [Checkout]        │ │               │
│ └────────────────────┘ │ └───────────────────┘ │               │
├────────────────────────┴───────────────────────┴───────────────┤
│ ⏱ ──●──────●──●─────────●──────▶  12:01:03 Elon click Checkout │
├────────────────────────────────────────────────────────────────┤
│ $ claude   > Checking that Sam received the order…             │
└────────────────────────────────────────────────────────────────┘
```

### Features (all wanted, built in phases)

1. **Profiles instead of tabs**: persistent identities that live as long as the project.
2. **See what the agent does**: where the agent acts, in the profile's color, and a caption of the current action over the pane. The agent can also point back: outline elements for the human.
3. **Point and tell**: the human picks an element like DevTools' inspector and says what is wrong. The agent gets a reference it can act on (profile, tab, locator) and looks at the element on the live page with its tools: snapshot, screenshot, the tab's recent console errors and failed requests. Nothing is saved into the project. Picks from several panes go into one message: "sent here, did not appear there".
4. **Timeline**: synchronized recording of DOM (rrweb-like), network, console and agent actions for all profiles. Scrub back to the moment a bug happened, pick an element in the past, tell the agent to fix it.
5. **Run to test**: a multi-profile run the agent did by hand is saved as a Playwright test.
6. **Profile mail**: a local mail catcher (Mailpit-like) with a mailbox per profile, shown next to the panes and readable by the agent.
7. **Profile reset and creation**: a clean profile for sign-up tests, reset state, seeded test users (the agent writes the seed for the project).

Phases: **1** = features 1, 2, 3 + terminal + MCP. **2** = 4, 6. **3** = 5, "pick in the past", 7. Phase 1 is done when the author stops opening separate Chrome windows.

## 3. Market (searched 2026-10-04)

No product combines profiles + agent + live panes + a shared timeline for multi-user apps. Pieces exist:

| Product | Has | Lacks |
|---|---|---|
| Claude Code Desktop (built-in browser, Oct 2026) | browser pane, element picker to Claude | one clean profile, not several |
| Cursor (browser, Design Mode 3.7) | agent drives browser, multi-element select | one browser, one user |
| Polypane (Electron) | panes with separate sessions side by side | no agent |
| Jam.dev + MCP | bug capture (console, network, video) for agents | one user, after the fact |
| Replay.io + MCP | time-travel recording for agents | one browser, debugging/CI |
| Pane (open source) | any CLI agent in terminals + browser tab | one identity |
| AgentMux (github.com/agentmuxai/agentmux, alpha, CEF) | terminals + browser panes | per-pane identities only proposed (issue #3546, 2026-09-22) |
| MultiZen (MIT) | 50 isolated Chromium profiles + MCP | multi-account ops / anti-detect, not a dev workspace |

Point-and-tell alone is already standard. The differentiator is **all of the app's users at once**.

## 4. Architecture decisions

- **Platforms: macOS, Windows and Linux (Ubuntu first)**, all three first-class. Developers use all three. Installers are built with Electron Forge.
- **Shell: Electron** (Node main process; same stack as cast). Rejected: Tauri (WebKit on Linux/macOS, no CDP), Qt WebEngine (CDP only through a port), Chromium fork (team-years). CEF is the only same-class alternative; move to it only if Electron hits a hard limit.
- **Panes are embedded**: an Electron `WebContentsView` per tab, a session per profile on a folder of its own (`session.fromPath`, laid out as Chrome's `Profile N`); the tab strip drawn in HTML; `window.open`/`_blank` become tabs of the same profile. A second pane type, the person's real Google Chrome shown by screencast, was prototyped and dropped (REPORT): everything happens inside Kulisa.
- **Profiles present as Google Chrome** of the same engine version (UA, UA-CH, `userAgentData`; the author's decision). Electron is Chromium + Node, not Google Chrome: out of the box sites see `Electron/…` in the User-Agent and only a `Chromium` brand, and Google sign-in blocks embedded browsers. Not covered by any mimicry: Widevine, Google services, device compliance (Entra Conditional Access with managed devices).
- **A human signs in**, never the agent. While a tab is on a sign-in page, the agent is detached from that profile (automatically; a temporary implementation, see REPORT).
- **Agent control without a remote-debugging port**: a CDP proxy per profile over `webContents.debugger` exposes only that profile's tabs (no shell UI, `navigator.webdriver` stays false). On top of it, Kulisa's own MCP server with profile-aware tools (playwright-core); `@playwright/mcp` also works through the proxy.
- **Kulisa plugin** (between the agent and the profiles): for Claude Code, a plugin passed with `--plugin-dir` carries the MCP config, a skill on working with profiles, and hooks. The MCP server itself stays agent-agnostic.
- **Window**: a grid of peer panels (dockview), as in JetBrains IDEs: each profile's pane and the terminal (later
  the timeline and mail) can be moved, stacked as tabs and resized; ready-made arrangements; the grid is saved.
- **Terminal**: xterm.js + node-pty running the agent CLI unchanged.
- **Point-and-tell delivery**: a short reference typed into the agent's prompt without Enter; the human writes the rest of the message around it.
- **Event bus**: agent commands pass through the main process; the pane captions and later the timeline subscribe to it.

## 5. Open questions

- Business model: likely free/open core (panes, profiles, picker) and paid team features (shared recordings, shared profiles, CI runs).
