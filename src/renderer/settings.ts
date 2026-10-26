// Settings' window (settings.html; main/settings-window.ts): its styles and its page (components/settings/Settings.vue). Nothing
// of a tasks' window: no grid, no profiles' views, no keys of its own.
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import '@xterm/xterm/css/xterm.css';
import './app.css';
import './tokens.css';
import './components.css';
import { createApp } from 'vue';
import Settings from './components/settings/Settings.vue';
import './lib/names';
import { setTheme } from './lib/theme';

kulisa.on('theme', setTheme);
const app = createApp(Settings);
app.config.globalProperties.kulisa = kulisa;
app.mount('#app');
