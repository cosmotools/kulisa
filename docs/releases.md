# Releases

How Kulisa is packaged, released and updated on the user's computer: the app icon, the installers, the release
workflow, the updates. When and how a release is asked for and merged: CLAUDE.md, Releases.

## The app icon

The icon is a stage curtain drawn apart with the agent's pointer (`assets/icon.svg`, rendered for each OS by `npm run
icons`): in the title bar, the taskbar and the installers. Run from source, GNOME's dock shows a generic icon, on
purpose: it takes icons from installed `.desktop` files only (the `.deb` installs one matching the window class
`kulisa`, named Kulisa by its own template, `assets/linux.desktop.ejs`: the makers' would name it after the package and
give it the class `Kulisa`). The macOS Dock shows Electron's own icon for a bundle run from source, so Kulisa sets its
own there (`app.dock.setIcon`); a packaged one has it in its bundle.

## Installers

Installers are made with Electron Forge (`npm run make`, `forge.config.ts`), each on its own OS: `.deb` and `.rpm` on
Linux (the `.deb` checked: it installs `chrome-sandbox` setuid root, a menu entry and the icon, and the app starts;
99 MB, about 280 of its 320 MB installed being Electron itself, as VS Code's or Slack's), Squirrel `.exe` on Windows,
`.dmg` and `.zip` on macOS (signed and notarized when the Apple secrets are set; without them unsigned, which runs on
the Mac it was built on; for users: #206). On macOS and Windows node-pty is not built again:
its own prebuilt binary is packaged (N-API, the one `npm start` loads), so no compiler is needed; on macOS its
`spawn-helper`, the program it starts a shell with, is kept outside the archive, where it runs it from (in it, a
packaged Kulisa's terminal fails). **What the package holds** is what the main process runs: its `dependencies`, the
window's build (`dist/renderer`, 3 MB) and the agents' packages. The window's libraries (React, Fluent UI and its
icons, xterm and its addons, the fonts) are `devDependencies`, which Forge leaves out: Vite bundles them, and the main
process imports none of them (but `@xterm/headless`, which keeps each shell's screen). node-pty's prebuilt binaries for
the other platforms (58 MB, mostly Windows's) are removed by a packaging hook (`prunePrebuilds` in `forge.config.ts`):
it loads only its own platform's, on Linux the one built at install; the archive is 40 MB. The `.dmg` needs `appdmg`,
whose native parts npm builds at install with the Command Line Tools: without a working compiler it is left out, and
`npm run package` (the app in `out/`) or the `.zip` do.

On Windows, Squirrel starts the app while installing, updating and removing it (`--squirrel-install` …), to make or
remove its shortcuts: `electron-squirrel-startup` does that and Kulisa quits without starting (Forge's Squirrel.Windows
maker). Its first run after installing checks nothing (Squirrel holds a lock then), and the app's id is the one its
shortcuts carry (`com.squirrel.kulisa.kulisa`), or Windows would not pin it to the taskbar (Electron's
`api/auto-updater.md`).

### Not made, and why

(The guide, Systems, says it to users.) AppImage (on Ubuntu 24.04 and later Electron in an
AppImage starts only with `--no-sandbox`: its FUSE mount is `nosuid` and AppArmor restricts unprivileged user
namespaces; Kulisa's pages hold real accounts; no maker of Forge's own); Snap and Flatpak (their sandbox is in the way
of what Kulisa does: the user's shell, agent CLIs, git, direnv, agents installed in `~/.local/bin`; Snap only with
classic confinement, reviewed by hand). Not Velopack or electron-updater for updates: one leaves Forge's makers and has
AppImage only on Linux, the other needs electron-builder.

## Publishing a release

`npm run publish` makes them and uploads them to a **draft release** on GitHub (`@electron-forge/publisher-github`). A
merge into `main` (CLAUDE.md, Releases) releases them by itself, on GitHub Actions (`.github/workflows/release.yml`;
macOS once its secrets are set): the workflow first makes the draft `v<version>` at the merged commit, its notes the
pull request's text (Forge's own would name no commit, and GitHub would tag whatever `main` is when the draft is
published); Ubuntu and Windows build and Forge uploads into it, finding it by its name, and each file's provenance is
attested (`actions/attest`: a statement signed through Sigstore and kept by GitHub, not in the release, that this
workflow built this very file from this commit; the `.nupkg` the Windows updater downloads too; checked with `gh
attestation verify <file> -R cosmotools/kulisa`); the `.deb` is installed on Ubuntu and started under Xvfb (its MCP
server listening, nothing uncaught, still running after 5 s: the tests run Kulisa from source, and what breaks only
packaged would reach every installed copy, one failing at start never able to update again); then the draft is
published, the tag made at that commit. Before that, and when a step fails, it is a draft nobody is served. A version
released before stops it. Once published, kulisa.app is built again (`kulisa-site`'s deploy, the secret
`SITE_DEPLOY_TOKEN`): its download buttons lead to this release's files. What is left of releases and updates:
#206 (macOS), #207.

## Updates

Forge's way (`updates.ts`, called by `index.ts`): Electron's `autoUpdater` (Squirrel) through the Electron
team's `update-electron-app`, from update.electronjs.org, which serves a public repository's published GitHub releases.
A packaged Kulisa on Windows or macOS checks at start and every 6 hours (not the module's 10 minutes: Kulisa stays open
for days), downloads a newer release in the background, and starts it the next time it is started. It never restarts
by itself nor asks with the OS's dialog (`notifyUser: false`). Not from source (`app.isPackaged`), nor on Linux, where
Electron has no updater: the distribution's package manager updates it, as Electron's docs advise, under the running
Kulisa, which goes on from the old files (dpkg and rpm write each file beside and rename it over).

The `.deb` adds Kulisa's apt repository and its key as Chrome's and VS Code's do (`assets/deb/postinst`; gone with
`purge`, `postrm`), so a new release comes with the system's updates. The repository is a flat one on GitHub Releases,
nothing else to host (GitHub Pages takes no file over 100 MB, and the `.deb` is about that): its index, signed with the
key in the secret `APT_SIGNING_KEY`, is the files of the release `apt` (a prerelease, never the latest: kulisa.app's
buttons are the latest's files), naming the newest `.deb` by its path in its own release,
`v<version>/kulisa_<version>_amd64.deb`, whose address GitHub answers with a redirect apt follows. `release.yml` writes
it once the release is published, then installs the `.deb`, Kulisa again from the repository, and purges it. An `.rpm`
is installed again by hand (a dnf repository: #207). Each format updates its own way only, never one put over
another. A check sends update.electronjs.org the version, the OS and the IP; the download comes from GitHub.

### A new version ready while Kulisa runs

`updateNotices` in `updates.ts`. Downloaded by the updater
(`update-downloaded`), or installed on disk (Linux: the app archive's folder watched, `installed.ts`: the version read
from the archive as it is on disk, `process.noAsar` for that read, since Electron's own reads go to the file it opened
at start), is asked about once per version, in Kulisa's own dialog ([window.md](window.md), Dialogs and questions), in the tasks' window in
front: "Kulisa <version> is ready", Restart or Later, saying which agents it would stop, as quitting does. Restart
(`shell.restart`) saves everything as `before-quit` does (session cookies, tabs, the windows), then Squirrel's
`quitAndInstall` (which closes the windows before `before-quit`, Electron's `api/auto-updater.md`: `quitting` is set
already, so they close without a question) or, on disk, `app.relaunch` (the same path, its files replaced) and quit;
the windows and their tasks come back in the new version. Later: nothing more; the next start is the new version.

## The code

| File | What |
|---|---|
| `assets/icon.svg`, `scripts/icons.ts` (`npm run icons`) | the app icon and its renderings for each OS |
| `forge.config.ts`, `assets/linux.desktop.ejs`, `assets/deb/` | the installers: what the package holds, the `.desktop` entry, the `.deb`'s apt repository |
| `.github/workflows/release.yml` | a merge into `main` built, attested, checked and published; the apt repository's index |
| `src/main/updates.ts`, `installed.ts` | updates, Squirrel's events, a new version ready while Kulisa runs (the version installed on disk) |
