# Releases

Packaging and updates. Release authorization and merging: AGENTS.md, Releases.

## The app icon

`assets/icon.svg` is the curtain and agent pointer; `npm run icons` generates platform assets.
Linux source runs have a generic GNOME icon: the installed `.desktop` supplies the `kulisa` window class and Kulisa
name (`assets/linux.desktop.ejs`). On macOS source runs set `app.dock.setIcon`; packaged bundles carry the icon.

## Installers

`npm run make` uses Electron Forge (`forge.config.ts`) on each target OS:

| OS | Formats and requirements |
|---|---|
| Linux | `.deb`, `.rpm`; installed `chrome-sandbox` is setuid root. RPM uses the maker's absolute staging path (`assets/linux.spec.ejs`); its regression checks files and sandbox mode. |
| Windows | Squirrel `.exe`; bundled ConPTY DLL/helper stay beside node-pty outside the archive. |
| macOS | `.dmg`, `.zip`; Apple secrets enable signing/notarization (#206). `appdmg` needs Command Line Tools; `.zip`/package remain available without it. node-pty's executable spawn-helper stays outside the archive. |

Forge ships main-process dependencies, Vite output and agent resources. Renderer libraries are devDependencies,
bundled by Vite; main's headless xterm is a runtime dependency. `prunePrebuilds` removes node-pty binaries for other
platforms; macOS/Windows use prebuilt N-API binaries, Linux builds its own.

`electron-squirrel-startup` handles install/update/remove shortcut events and exits before app startup. Skip update
checks on Squirrel's locked first run. Use shortcut AppUserModelID `com.squirrel.kulisa.kulisa` for taskbar pinning.

### Not made, and why

AppImage's nosuid mount and Ubuntu namespace restrictions require disabling Chromium's sandbox; real sign-ins
require it. Snap/Flatpak confinement conflicts with user shells, CLIs, git and direnv; Snap classic needs review.
Alternative updater frameworks do not fit the Forge installers.

## Publishing a release

`npm run publish` uploads installers to a GitHub draft. `.github/workflows/release.yml` releases a `main` merge:

1. Create draft `v<version>` at the merged commit with PR-body release notes; reject an already released version.
2. Build on Ubuntu/Windows, upload via Forge, and attest every file including updater `.nupkg` files with Sigstore.
3. Install the `.deb` and start it under Xvfb: MCP must listen, no uncaught exception, process alive after 5 s.
4. Publish only after checks pass, with the tag at that commit. Failures leave the draft unpublished.
5. Redeploy `kulisa-site` with `SITE_DEPLOY_TOKEN`, then update/check the apt repository.

Verify provenance with `gh attestation verify <file> -R cosmotools/kulisa`. macOS release work: #206; update work: #207.

## Updates

Packaged Windows/macOS builds use `update-electron-app` over Electron's Squirrel `autoUpdater`, checking
update.electronjs.org at startup and every six hours. Downloads install on a later start; `notifyUser: false`
prevents OS prompts. Checks disclose version, OS and IP; downloads come from GitHub. Source runs do not update.

Linux uses the package manager. `.deb` installs an apt source/key (`assets/deb/postinst`), retained by remove and
deleted by purge (`postrm`). A signed flat index lives in the `apt` prerelease and points to the latest published
`.deb`; `APT_SIGNING_KEY` signs it. CI installs from the repository and purges to verify it. RPM updates require
manual installation; dnf repository: #207. Formats update only through their own mechanism.

### A new version ready while Kulisa runs

`updateNotices` asks once per version in the foreground task window: Restart or Later, naming affected agents.
Events come from `update-downloaded`, or Linux's archive-directory watcher (`installed.ts`). Read the on-disk
version with `process.noAsar`, because Electron keeps the startup archive open.

Restart saves cookies, tabs and windows before `quitAndInstall` or `app.relaunch`. Set `quitting` first because
Squirrel closes windows before `before-quit`. Later leaves the app running; next start uses the new version.

## The code

| File | What |
|---|---|
| `assets/icon.svg`, `scripts/icons.ts` (`npm run icons`) | the app icon and its renderings for each OS |
| `forge.config.ts`, `assets/linux.desktop.ejs`, `assets/linux.spec.ejs`, `assets/deb/` | the installers: what the package holds, the `.desktop` entry, the RPM spec, the `.deb`'s apt repository |
| `.github/workflows/release.yml` | a merge into `main` built, attested, checked and published; the apt repository's index |
| `src/main/updates.ts`, `installed.ts` | updates, Squirrel's events, a new version ready while Kulisa runs (the version installed on disk) |
