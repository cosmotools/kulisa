// A question before something that cannot be undone, before closing, or with two ways to go (components/Ask.tsx), the same look
// on every OS. Questions asked while one is open wait their turn.
//   ask({ message, detail, ok, other, danger })   resolves 'ok' or 'other' (the button clicked); '' for Cancel, Esc, ×,
//                                                 a click outside, or the dialog closed by the window
import { createStore, useStore } from 'zustand';
import type { Question } from '../../shared/types';

const asking = createStore<{ q: Question; answer: (value: string) => void } | null>()(() => null);
export const useAsking = () => useStore(asking);
let turn: Promise<string> = Promise.resolve('');
export function ask(q: Question): Promise<string> {
  const answer = turn.then(() => new Promise<string>((resolve) => asking.setState({ q, answer: (v) => { asking.setState(null, true); resolve(v); } }, true)));
  turn = answer;
  return answer;
}
// A question from the main process (shell.ask in app.ts): the window asks it and sends back the answer.
kulisa.on('ask', async ({ id, ...q }) => kulisa.send('ask:answer', { id, answer: await ask(q) }));
