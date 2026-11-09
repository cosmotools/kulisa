# Licensing

What Kulisa's license covers, and what it does not. The license itself: [LICENSE](../LICENSE).

## Kulisa: GPL-3.0-or-later

Copyright (C) 2026 Orudzhali Nagaev.

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public
License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later
version. This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the
implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
details.

It covers everything in this repository unless a file says otherwise: the app (`src/main`, `src/renderer`,
`src/preload`), its MCP server and CDP proxy, the Kulisa plugin for Claude Code (`src/kulisa-plugin/resources/claude-plugin`), the
tests, the scripts and the docs.

## What is a separate program, under its own license

They work with Kulisa through a terminal, a protocol (MCP, HTTP, CDP) or files, and the GPL does not reach them:

- the agents the human chooses (Claude Code, Codex, others) and their own plugins, skills and MCP servers;
- the web apps tested in Kulisa's profiles;
- services Kulisa may talk to (a cloud service of Kulisa's one day: its own terms).

## The name and the logo

"Kulisa" and its logo (`assets/icon.svg`) are not licensed under the GPL. A fork or a product built on Kulisa's code
must have a name of its own and must not present itself as the official Kulisa; "based on Kulisa" is fine.

## What Kulisa ships from others

The agents' marks in `AgentMark.tsx` (Claude's, Anthropic's; Codex's, OpenAI's) are their makers' trademarks, not
licensed under the GPL: they name the agent a row is of, as an IDE shows them, and nothing else.

Its dependencies keep their own licenses, all of which allow being part of a GPL-3.0 program: npm packages (MIT, ISC,
BSD, Apache-2.0; shadcn/ui's components, Radix and Lucide's icons, MIT and ISC), the profiles' pictures from Google's Noto Emoji in
`src/renderer/public/avatars/` with their license (Apache-2.0), the fonts Geist and JetBrains Mono (SIL Open Font
License) and Chromium's licenses (in Electron; packaged builds carry `LICENSE` and `LICENSES.chromium.html`).
The shared Git client uses simple-git under MIT.
Image preview reads dimensions with image-size under MIT; its notice ships as `dist/renderer/image-size-LICENSE.txt`.
Markdown rendering uses react-markdown and remark-gfm under MIT; their dependency notices ship together in
`dist/renderer/markdown-LICENSES.txt`.
The installed-version check uses @electron/asar under MIT.
The @pierre/diffs review renderer, editor and read-only file viewer carry their Apache-2.0 license in `dist/renderer/pierre-diffs-LICENSE.txt`.
The @pierre/trees navigation and @pierre/theming carry Apache-2.0 licenses in `dist/renderer/pierre-*-LICENSE.txt`,
with Trees' attribution in `pierre-trees-NOTICE.txt`. Preact and its string renderer carry MIT licenses in
`dist/renderer/preact*-LICENSE`; the Lucide sprite carries ISC in `dist/renderer/lucide-LICENSE`.
TanStack Query and its core carry their MIT licenses in `dist/renderer/tanstack-*-LICENSE.txt`.

A new dependency must have a license compatible with GPL-3.0. The CI checks it (`dependencies` in
`.github/workflows/test.yml`, GitHub's dependency review): a pull request whose lockfile brings a package under a
license not on this list fails. The list: GPL-3.0, GPL-2.0-or-later, LGPL-2.1 and 3.0 (or later), MIT, ISC, 0BSD,
BSD-2-Clause, BSD-3-Clause, Apache-2.0, MPL-2.0, Blue Oak 1.0.0, Unlicense, CC0-1.0, Zlib, Boost, Python-2.0 and the
SIL Open Font License. A license not on it is a conversation with the author: if compatible (the FSF's list), it is
added to the workflow and here. One the dependency graph cannot read (a `license` that is not an SPDX expression) is
reported, not refused. The check covers changed dependencies; existing dependencies require separate review.

The welcome's fictional shop includes three product photographs in `src/renderer/components/welcome/assets/` under the
[Unsplash License](https://unsplash.com/license), separately from Kulisa's code. Source URLs and terms are listed in
that folder's `CREDITS.txt`, emitted as `dist/renderer/welcome-photography-CREDITS.txt` with the bundled pictures. These are illustrative assets,
not software dependencies; they are not relicensed under the GPL.

## Contributions

Contributions use GPL-3.0-or-later ([CONTRIBUTING.md](../CONTRIBUTING.md)). Offering contributed code under additional
terms requires the contributor's agreement.
