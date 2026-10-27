// An agent's state, from its hooks: one icon each wherever it shows (docs/ui.md), not told by color alone.
import { Spinner, tokens } from '@fluentui/react-components';
import { CircleCheckIcon, MessageCircleQuestionIcon } from 'lucide-react';
import type { AgentState as State } from '../../shared/types';

export const STATES: Record<NonNullable<State>, string> = { working: 'is working', waiting: 'waits for you', done: 'is done' };

// room: its place kept while there is no state, so that rows under each other stay aligned.
export function AgentState({ state, room }: { state: State | undefined; room?: boolean }) {
  const icon = state === 'working' ? <Spinner size="extra-tiny" />
    : state === 'waiting' ? <MessageCircleQuestionIcon size={14} color={tokens.colorStatusWarningForeground1} />
      : state === 'done' ? <CircleCheckIcon size={14} color={tokens.colorStatusSuccessForeground1} /> : null;
  return <span data-state={state || ''} role={state ? 'img' : undefined} aria-label={state ? `The agent ${STATES[state]}` : undefined}
    title={state ? `The agent ${STATES[state]}` : undefined}
    style={{ display: icon || room ? 'inline-flex' : 'none', flex: 'none', width: 16, justifyContent: 'center' }}>{icon}</span>;
}
