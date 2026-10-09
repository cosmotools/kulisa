// Electron Forge: packages Kulisa and builds installers for macOS, Windows and Linux.
//   npm run package   the app folder for this platform, in out/
//   npm run make      installers for this platform, in out/make/
// Each platform's installers are built on that platform (CI matrix later, see docs/ROADMAP.md).
module.exports = {
  packagerConfig: {
    name: 'Kulisa',
    executableName: 'kulisa',
    // sherpa-onnx's native package (voice commands, listen-worker.js) loads its libraries (onnxruntime) from beside its
    // .node file: the whole package outside the archive, not only the .node (the plugin below).
    asar: { unpack: '**/node_modules/sherpa-onnx-{darwin,linux,win}-*/**' },
    // The app icon, rendered from assets/icon.svg (npm run icons); Forge adds .icns on macOS, .ico on Windows.
    icon: 'assets/icon',
    // The Claude Code plugin is read by `claude` from disk, so it sits next to the asar: resources/claude-plugin.
    extraResource: ['src/agent/claude-plugin'],
    // macOS asks for the microphone on Kulisa's behalf when the agent in its terminal records (dictation).
    // So does Kulisa itself, while voice commands are on (listen.js).
    extendInfo: { NSMicrophoneUsageDescription: 'The agent in Kulisa\'s terminal listens when you dictate a task to it, and Kulisa listens for its name while voice commands are on.' },
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
