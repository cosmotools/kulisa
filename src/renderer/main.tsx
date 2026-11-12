// A tasks' window's page (index.html; docs/window.md): its parts (components/App.tsx), and what listens to the main process
// (lib/).
import './window.css';
import { createRoot } from 'react-dom/client';
import { App } from './components/App';
import './lib/names';
import './lib/shell-keys';
import './lib/shell-cover';
import { keyText } from './lib/common';
Object.assign(window, { keyText });

// TaskBoundary reports caught errors without React's default dump of the thrown object to the window log.
createRoot(document.getElementById('app')!, { onCaughtError: () => {} }).render(<App />);
void kulisa.invoke('project:refresh'); // the bar's tabs and the shown task (window.ts, sendProjects)
