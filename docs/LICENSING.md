# Licensing

What Kulisa's license covers, and what it does not. The license itself: [LICENSE](../LICENSE) (GPL-3.0); in short:
[README](../README.md#license). Decided with the author on 2026-10-07.

## Kulisa: GPL-3.0-or-later

Copyright (C) 2026 Orudzhali Nagaev.

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public
License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later
version. This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the
implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
details.

It covers everything in this repository unless a file says otherwise: the app (`src/main`, `src/renderer`,
`src/preload`), its MCP server and CDP proxy, the Kulisa plugin for Claude Code (`src/agent/claude-plugin`), the
tests, the scripts and the docs.

## What is a separate program, under its own license

They work with Kulisa through a terminal, a protocol (MCP, HTTP, CDP) or files, and the GPL does not reach them:

- the agents the human chooses (Claude Code, Codex, others) and their own plugins, skills and MCP servers;
- the web apps tested in Kulisa's profiles;
- services Kulisa may talk to (a cloud service of Kulisa's one day: its own terms).

## Extensions

Kulisa has no API for extensions yet (ROADMAP, Deferred ideas: a store). Code that runs inside Kulisa is part of it
and comes under the GPL. When the API is built, the author means to add an exception to the license so that
extensions using it may be under any license, free or paid (as GCC's Runtime Library Exception does).

## The name and the logo

"Kulisa" and its logo (`assets/icon.svg`) are not licensed under the GPL. A fork or a product built on Kulisa's code
must have a name of its own and must not present itself as the official Kulisa; "based on Kulisa" is fine.

## What Kulisa ships from others

Its dependencies keep their own licenses, all of which allow being part of a GPL-3.0 program: MIT, ISC, BSD,
Apache-2.0 (npm packages), ISC (icons from Lucide, copied into `index.html`), Apache-2.0 (the profiles' pictures from
Google's Noto Emoji, in `src/renderer/avatars/` with their license), the SIL Open Font License (JetBrains Mono, the terminal's font) and Chromium's licenses
(in Electron; packaged builds carry `LICENSE` and `LICENSES.chromium.html`). A new dependency must have a license
compatible with GPL-3.0.

## Contributions

Contributions are accepted under the same license (GPL-3.0-or-later): [CONTRIBUTING.md](../CONTRIBUTING.md). Should
the author ever need to offer a contributed part under other terms as well (e.g. in a paid module), contributors will
be asked to agree first (a contributor license agreement); nothing is assumed.
