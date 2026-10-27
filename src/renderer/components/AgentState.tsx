// An agent's state, from its hooks: one icon each wherever it shows (docs/ui.md), not told by color alone.
import { Spinner, makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import { ChatHelp16Regular, CheckmarkCircle16Regular } from '@fluentui/react-icons';
import type { AgentState as State } from '../../shared/types';

export const STATES: Record<NonNullable<State>, string> = { working: 'is working', waiting: 'waits for you', done: 'is done' };

const useStyles = makeStyles({
  root: { display: 'inline-flex', flex: 'none', width: '16px', justifyContent: 'center' },
  none: { display: 'none' },
  waiting: { color: tokens.colorStatusWarningForeground1 },
  done: { color: tokens.colorStatusSuccessForeground1 },
});

// room: its place kept while there is no state, so that rows under each other stay aligned.
export function AgentState({ state, room }: { state: State | undefined; room?: boolean }) {
  const styles = useStyles();
  const icon = state === 'working' ? <Spinner size="extra-tiny" />
    : state === 'waiting' ? <ChatHelp16Regular className={styles.waiting} />
      : state === 'done' ? <CheckmarkCircle16Regular className={styles.done} /> : null;
  return <span data-state={state || ''} role={state ? 'img' : undefined} aria-label={state ? `The agent ${STATES[state]}` : undefined}
    title={state ? `The agent ${STATES[state]}` : undefined} className={mergeClasses(styles.root, !icon && !room && styles.none)}>{icon}</span>;
}
