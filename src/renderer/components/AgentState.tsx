// An agent's state, from its hooks: one icon each wherever it shows (docs/ui.md), not told by color alone.
import { CircleCheckIcon, MessageCircleQuestionIcon } from 'lucide-react';
import { Spinner } from '@ui';
import type { AgentState as State } from '../../shared/types';

export const STATES: Record<NonNullable<State>, string> = { working: 'is working', waiting: 'waits for you', done: 'is done' };

// room: its place kept while there is no state, so that rows under each other stay aligned.
export function AgentState({ state, room }: { state: State | undefined; room?: boolean }) {
  const icon = state === 'working' ? <Spinner className="size-3.5" />
    : state === 'waiting' ? <MessageCircleQuestionIcon className="size-4 text-warning" /> : state === 'done' ? <CircleCheckIcon className="size-4 text-success" /> : null;
  return <span data-state={state || ''} role={state ? 'img' : undefined} aria-label={state ? `The agent ${STATES[state]}` : undefined}
    title={state ? `The agent ${STATES[state]}` : undefined} className={icon || room ? 'inline-flex w-4 flex-none justify-center' : 'hidden'}>{icon}</span>;
}
