// The window's page (index.html): its styles, its parts (components/App.vue), and what listens to the main process
// (lib/). The tokens and the shared components' look are global (docs/ui.md); each part's own look is in its file.
import '@fontsource-variable/inter/wght.css';
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
// Templates reach the bridge as kulisa too (master.ts as well).
declare module 'vue' {
  interface ComponentCustomProperties { kulisa: KulisaBridge }
}
app.mount('#app');
void kulisa.invoke('tasks:get'); // the bar's tabs and the shown task (window.ts, sendProjects)
