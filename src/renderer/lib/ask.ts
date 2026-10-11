// A question before something that cannot be undone, before closing, or with two ways to go (Ask.vue), the same look
// on every OS. Questions asked while one is open wait their turn.
//   ask({ message, detail, ok, other, danger })   resolves 'ok' or 'other' (the button clicked); '' for Cancel, Esc, ×,
//                                                 a click outside, or the dialog closed by the window
import { shallowRef } from 'vue';
import type { Question } from '../types';

export const asking = shallowRef<{ q: Question; answer: (value: string) => void } | null>(null);
let turn: Promise<string> = Promise.resolve('');
export function ask(q: Question): Promise<string> {
  const answer = turn.then(() => new Promise<string>((resolve) => { asking.value = { q, answer: resolve }; }));
  turn = answer;
  return answer;
}
// A question from the main process (shell.ask in app.ts): the window asks it and sends back the answer.
kulisa.on<Question & { id: number }>('ask', async ({ id, ...q }) => kulisa.send('ask:answer', { id, answer: await ask(q) }));
