// Electron Forge: packages Kulisa and builds installers for macOS, Windows and Linux.
//   npm run package   the app folder for this platform, in out/
//   npm run make      installers for this platform, in out/make/
// Each platform's installers are built on that platform (CI matrix later, see docs/ROADMAP.md).
module.exports = {
  packagerConfig: {
    name: 'Kulisa',
    executableName: 'kulisa',
    asar: true,
    // The app icon, rendered from assets/icon.svg (npm run icons); Forge adds .icns on macOS, .ico on Windows.
    icon: 'assets/icon',
    // The Claude Code plugin is read by `claude` from disk, so it sits next to the asar: resources/claude-plugin.
    extraResource: ['src/agent/claude-plugin'],
    // macOS asks for the microphone on Kulisa's behalf when the agent in its terminal records (dictation).
    extendInfo: { NSMicrophoneUsageDescription: 'The agent in Kulisa\'s terminal listens when you dictate a task to it.' },
    // Only what the app runs; Forge also leaves out devDependencies.
    ignore: [/^\/(test|docs|out|scripts)(\/|$)/, /^\/\.kulisa(\/|$)/, /^\/forge\.config\.js$/],
  },
  makers: [
    { name: '@electron-forge/maker-squirrel', platforms: ['win32'], config: { setupIcon: 'assets/icon.ico' } },
    { name: '@electron-forge/maker-dmg', platforms: ['darwin'], config: { icon: 'assets/icon.icns' } },
    { name: '@electron-forge/maker-zip', platforms: ['darwin'] },
    { name: '@electron-forge/maker-deb', platforms: ['linux'], config: { options: { categories: ['Development'], icon: 'assets/icon.png' } } },
  ],
  // node-pty is native: keep its .node files outside the asar archive so they can be loaded.
  plugins: [{ name: '@electron-forge/plugin-auto-unpack-natives', config: {} }],
};
