// An agent's state, from its hooks: one icon each wherever it shows (docs/ui.md), not told by color alone.
import { Spinner } from '@fluentui/react-components';
import { ChatHelp16Regular, CheckmarkCircle16Regular } from '@fluentui/react-icons';
import type { AgentState as State } from '../../shared/types';
import css from './AgentState.module.css';

export const STATES: Record<NonNullable<State>, string> = { working: 'is working', waiting: 'waits for you', done: 'is done' };

// room: its place kept while there is no state, so that rows under each other stay aligned.
export function AgentState({ state, room }: { state: State | undefined; room?: boolean }) {
  const icon = state === 'working' ? <Spinner size="extra-tiny" />
    : state === 'waiting' ? <ChatHelp16Regular /> : state === 'done' ? <CheckmarkCircle16Regular /> : null;
  return <span data-state={state || ''} role={state ? 'img' : undefined} aria-label={state ? `The agent ${STATES[state]}` : undefined}
    title={state ? `The agent ${STATES[state]}` : undefined} data-room={room || undefined} className={css.root}>{icon}</span>;
}
