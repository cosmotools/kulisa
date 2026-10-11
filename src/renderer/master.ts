// A master's window (master.html; main/master.ts): its bar. Its theme and the profile's name come in the URL.
import './tokens.css';
import './components.css';
import { createApp } from 'vue';
import Master from './components/Master.vue';

document.documentElement.dataset.theme = new URLSearchParams(location.search).get('theme') || 'dark';
const app = createApp(Master);
app.config.globalProperties.kulisa = kulisa;
app.mount('#app');
