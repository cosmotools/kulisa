// Electron Forge: packages Kulisa, builds installers for macOS, Windows and Linux, publishes a release.
//   npm run package   the app folder for this platform, in out/
//   npm run make      installers for this platform, in out/make/ (Linux: rpmbuild for the .rpm, `apt install rpm`)
//   npm run publish   made and uploaded to a draft release on GitHub (GITHUB_TOKEN; a merge into main runs the CI)
// Each platform's installers are built on that platform. docs/releases.md, Installers.
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import type { ForgeConfig } from '@electron-forge/shared-types';

// node-pty ships prebuilt binaries for macOS and Windows (58 MB, the Windows ones 28 MB each) and loads only the one of
// the platform and architecture it runs on (its lib/utils.js; on Linux the one built at install, build/Release): the
// others are left out of the package. docs/releases.md, Installers.
export function prunePrebuilds(buildPath: string, platform: string, arch: string) {
  const dir = path.join(buildPath, 'node_modules/node-pty/prebuilds');
  if (!fs.existsSync(dir)) return;
  for (const d of fs.readdirSync(dir)) if (d !== `${platform}-${arch}`) fs.rmSync(path.join(dir, d), { recursive: true });
}

// macOS signed and notarized only when its secrets are there: an unsigned app does not update (Squirrel.Mac).
const apple = process.env.APPLE_API_KEY ? {
  osxSign: {},
  osxNotarize: { appleApiKey: process.env.APPLE_API_KEY, appleApiKeyId: process.env.APPLE_API_KEY_ID ?? '', appleApiIssuer: process.env.APPLE_API_ISSUER ?? '' },
} : {};

// Linux's menu entry: named Kulisa, not by the package (kulisa), the makers' default; the makers' own template would
// make its window class Kulisa too, and the window's is kulisa (GNOME's dock matches them).
const linux = { productName: 'Kulisa', desktopTemplate: 'assets/linux.desktop.ejs', categories: ['Development'], icon: 'assets/icon.png' };

const config: ForgeConfig = {
  packagerConfig: {
    ...apple,
    name: 'Kulisa',
    executableName: 'kulisa',
    // macOS's id of the app (the author's choice), its helpers' after it (app.kulisa.helper …): what the OS keys
    // the app's preferences, caches, permissions (the microphone) and signing by. Packager's default is com.electron.kulisa.
    appBundleId: 'app.kulisa',
    // node-pty starts a shell through its spawn-helper, a program run from outside the archive (unixTerminal.js:
    // app.asar.unpacked); in it, the terminal failed (posix_spawnp failed). The plugin below adds the .node files.
    asar: { unpack: '**/node_modules/node-pty/prebuilds/*/spawn-helper' },
    // The app icon, rendered from assets/icon.svg (npm run icons); Forge adds .icns on macOS, .ico on Windows.
    icon: 'assets/icon',
    // Kulisa's packages for the agents are read from disk (by `claude`, or copied into an account's folder), so they sit
    // next to the asar: resources/claude-plugin, resources/skills (app.ts, AGENT_PACKAGES).
    extraResource: ['src/kulisa-plugin/resources/claude-plugin', 'src/kulisa-plugin/resources/skills'],
    // macOS asks for the microphone on Kulisa's behalf when the agent in its terminal records (dictation).
    extendInfo: { NSMicrophoneUsageDescription: 'The agent in Kulisa\'s terminal listens when you dictate a task to it.' },
    // Only what the app runs; Forge also leaves out devDependencies, which is where the window's libraries are (Vite
    // bundles them into dist/renderer; the main process imports none of them, @xterm/headless apart). The window is its
    // build (dist/renderer), not its sources (src/renderer, a Kulisa package's renderer/), without source maps; a Kulisa
    // package without its tests and docs (docs/packages.md).
    ignore: [/^\/(test|docs|out|scripts)(\/|$)/, /^\/\.kulisa(\/|$)/, /^\/src\/([^/]+\/)?renderer(\/|$)/, /\.test\.ts$/, /^\/src\/[^/]+\/resources(\/|$)/, /^\/src\/[^/]+\/(README|AGENTS|CLAUDE)\.md$/, /^\/(forge\.config\.ts|vite\.config\.mts|tsconfig\.json|knip\.jsonc|\.dependency-cruiser\.ts)$/, /\.map$/],
  },
  makers: [
    { name: '@electron-forge/maker-squirrel', platforms: ['win32'], config: { setupIcon: 'assets/icon.ico' } },
    { name: '@electron-forge/maker-dmg', platforms: ['darwin'], config: { icon: 'assets/icon.icns' } },
    { name: '@electron-forge/maker-zip', platforms: ['darwin'], config: {} },
    // The .deb adds Kulisa's apt repository, which updates it (assets/deb).
    { name: '@electron-forge/maker-deb', platforms: ['linux'], config: { options: { ...linux, scripts: { postinst: 'assets/deb/postinst', postrm: 'assets/deb/postrm' } } } },
    // An absolute staging path: RPM chooses its own working directory (electron-installer-redhat#343).
    { name: '@electron-forge/maker-rpm', platforms: ['linux'], config: { options: { ...linux, specTemplate: 'assets/linux.spec.ejs' } } },
  ],
  // The release workflow publishes the draft once its installers build and the installed app starts.
  publishers: [{ name: '@electron-forge/publisher-github', config: { repository: { owner: 'cosmotools', name: 'kulisa' }, draft: true } }],
  // The window built (type checked, then Vite: vite.config.mts) before it is packaged.
  hooks: {
    generateAssets: async () => { execSync('npm run build', { stdio: 'inherit' }); },
    packageAfterCopy: async (_config, buildPath, _electronVersion, platform, arch) => prunePrebuilds(buildPath, platform, arch),
  },
  // node-pty is native: keep its .node files outside the asar archive so they can be loaded.
  plugins: [{ name: '@electron-forge/plugin-auto-unpack-natives', config: {} }],
  // macOS and Windows: node-pty's own prebuilt binary (N-API, for any Electron; npm start loads it too), not built
  // again: building needs a compiler (a Mac's Command Line Tools, Visual Studio's C++ tools), which may be missing.
  rebuildConfig: process.platform === 'linux' ? {} : { ignoreModules: ['node-pty'] },
};

export default config;
