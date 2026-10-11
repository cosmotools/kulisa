// The window's page (index.html): its styles, its parts (components/App.vue), and what listens to the main process
// (lib/). The tokens and the shared components' look are global (docs/ui.md); each part's own look is in its file.
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import '@xterm/xterm/css/xterm.css';
import './tokens.css';
import './components.css';
import { createApp } from 'vue';
import App from './components/App.vue';
import './lib/names';
import './lib/keys';
import './lib/test-hooks';

const app = createApp(App);
app.config.globalProperties.kulisa = kulisa;
app.mount('#app');
kulisa.invoke('tasks:get'); // the shown task's tabs and terminal (window.ts, sendTasks)
