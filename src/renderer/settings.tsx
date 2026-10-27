// Settings' window (settings.html; main/settings-window.ts), the probe: React and Fluent UI (components/Settings.tsx).
// Nothing of a tasks' window: no grid, no profiles' views, no keys of its own.
import '@fontsource-variable/inter/wght.css';
import { createRoot } from 'react-dom/client';
import { Settings } from './components/Settings';
import './lib/names';

// The window is its page; as a desktop app, labels and buttons are not text to select, fields are.
document.head.insertAdjacentHTML('beforeend', `<style>html, body, #app { height: 100%; margin: 0; overflow: hidden; }
body { user-select: none; cursor: default; } input, textarea { user-select: text; }</style>`);
createRoot(document.getElementById('app')!).render(<Settings />);
