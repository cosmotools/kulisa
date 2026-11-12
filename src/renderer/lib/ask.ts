// Questions from a task are queued and answered in its window's healthy shell (docs/window.md).
import type { Question } from '../../shared/types';
export const ask = (question: Question): Promise<string> => kulisa.invoke('shell:ask', question).then((answer) => answer ?? '');
