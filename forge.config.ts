// Electron Forge: packages Kulisa, builds installers for macOS, Windows and Linux, publishes a release.
//   npm run package   the app folder for this platform, in out/
//   npm run make      installers for this platform, in out/make/ (Linux: rpmbuild for the .rpm, `apt install rpm`)
//   npm run publish   made and uploaded to a draft release on GitHub (GITHUB_TOKEN; the CI does it on a tag)
// Each platform's installers are built on that platform. docs/window.md, "The app icon, installers and updates".
import { execSync } from 'child_process';
import type { ForgeConfig } from '@electron-forge/shared-types';

// macOS signed and notarized only when its secrets are there: an unsigned app does not update (Squirrel.Mac).
const apple = process.env.APPLE_API_KEY ? {
  osxSign: {},
  osxNotarize: { appleApiKey: process.env.APPLE_API_KEY, appleApiKeyId: process.env.APPLE_API_KEY_ID ?? '', appleApiIssuer: process.env.APPLE_API_ISSUER ?? '' },
} : {};

const config: ForgeConfig = {
  packagerConfig: {
    ...apple,
    name: 'Kulisa',
    executableName: 'kulisa',
    // macOS's id of the app (the author's, 2026-10-06), its helpers' after it (app.kulisa.helper …): what the OS keys
    // the app's preferences, caches, permissions (the microphone) and signing by. Packager's default is com.electron.kulisa.
    appBundleId: 'app.kulisa',
    // node-pty starts a shell through its spawn-helper, a program run from outside the archive (unixTerminal.js:
    // app.asar.unpacked); in it, the terminal failed (posix_spawnp failed). The plugin below adds the .node files.
    asar: { unpack: '**/node_modules/node-pty/prebuilds/*/spawn-helper' },
    // The app icon, rendered from assets/icon.svg (npm run icons); Forge adds .icns on macOS, .ico on Windows.
    icon: 'assets/icon',
    // Kulisa's packages for the agents are read from disk (by `claude`, or copied into an account's folder), so they sit
    // next to the asar: resources/claude-plugin, resources/skills (app.ts, AGENT_PACKAGES).
    extraResource: ['src/agent/claude-plugin', 'src/agent/skills'],
    // macOS asks for the microphone on Kulisa's behalf when the agent in its terminal records (dictation).
    extendInfo: { NSMicrophoneUsageDescription: 'The agent in Kulisa\'s terminal listens when you dictate a task to it.' },
    // Only what the app runs; Forge also leaves out devDependencies. The window is its build (dist/renderer), not its
    // sources (src/renderer), without source maps.
    ignore: [/^\/(test|docs|out|scripts)(\/|$)/, /^\/\.kulisa(\/|$)/, /^\/src\/renderer(\/|$)/, /^\/(forge\.config\.ts|vite\.config\.mts|tsconfig\.json|knip\.jsonc|\.dependency-cruiser\.ts)$/, /\.map$/],
  },
  makers: [
    { name: '@electron-forge/maker-squirrel', platforms: ['win32'], config: { setupIcon: 'assets/icon.ico' } },
    { name: '@electron-forge/maker-dmg', platforms: ['darwin'], config: { icon: 'assets/icon.icns' } },
    { name: '@electron-forge/maker-zip', platforms: ['darwin'], config: {} },
    { name: '@electron-forge/maker-deb', platforms: ['linux'], config: { options: { categories: ['Development'], icon: 'assets/icon.png' } } },
    { name: '@electron-forge/maker-rpm', platforms: ['linux'], config: { options: { categories: ['Development'], icon: 'assets/icon.png' } } },
  ],
  // A draft: the author publishes it, and update.electronjs.org takes only published releases (update-electron-app).
  publishers: [{ name: '@electron-forge/publisher-github', config: { repository: { owner: 'cosmotools', name: 'kulisa' }, draft: true } }],
  // The window built (type checked, then Vite: vite.config.mts) before it is packaged.
  hooks: { generateAssets: async () => { execSync('npm run build', { stdio: 'inherit' }); } },
  // node-pty is native: keep its .node files outside the asar archive so they can be loaded.
  plugins: [{ name: '@electron-forge/plugin-auto-unpack-natives', config: {} }],
  // macOS: node-pty's own prebuilt binary (N-API, for any Electron; npm start loads it too), not built again: building
  // needs a working compiler, and a Mac's Command Line Tools may have none (the author's, 2026-10-16).
  rebuildConfig: process.platform === 'darwin' ? { ignoreModules: ['node-pty'] } : {},
};

export default config;
