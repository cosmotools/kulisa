// A master's window (master.html; main/master.ts): its bar (fluent/Master.tsx). Its theme and the profile's name come
// in the URL.
import '@fontsource-variable/inter/wght.css';
import { createRoot } from 'react-dom/client';
import { Master } from './fluent/Master';

document.head.insertAdjacentHTML('beforeend', '<style>body { margin: 0; user-select: none; } .lucide { width: 1em; height: 1em; }</style>');
createRoot(document.getElementById('app')!).render(<Master />);
