// A tasks' window's page (index.html; docs/window.md): its parts (components/App.tsx), and what listens to the main process
// (lib/).
import '@fontsource-variable/inter/wght.css';
import { createRoot } from 'react-dom/client';
import { App } from './components/App';
import './lib/names';
import './lib/keys';
import './lib/test-hooks';

createRoot(document.getElementById('app')!).render(<App />);
void kulisa.invoke('tasks:get'); // the bar's tabs and the shown task (window.ts, sendProjects)
