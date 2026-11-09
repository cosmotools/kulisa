// Public session and lazy view entry (../README.md).
import { lazy } from 'react';
export { createEditorSession } from './session';
export const CodeEditor = lazy(() => import('./Editor').then((m) => ({ default: m.CodeEditor })));
// Host-owned read-only code surfaces share the palette without importing the saving editor eagerly.
export async function loadCodeTheme() { return (await import('./appearance')).editorTheme; }
