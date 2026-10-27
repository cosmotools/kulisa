// A master's window (master.html; main/master.ts): its bar (components/Master.tsx). Its theme and the profile's name come
// in the URL.
import './window.css';
import { createRoot } from 'react-dom/client';
import { Master } from './components/Master';
import './lib/theme';

createRoot(document.getElementById('app')!).render(<Master />);
