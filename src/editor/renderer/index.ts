// Public session and lazy view entry (../README.md).
import { lazy } from 'react';
export { createEditorSession } from './session';
export const CodeEditor = lazy(() => import('./Editor').then((m) => ({ default: m.CodeEditor })));
