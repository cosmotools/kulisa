// The window supplies task selection and typography to Diff (src/diff/README.md).
import { useMemo } from 'react';
import { Diff, DiffPanel } from '../../diff/renderer';
import { diffFor } from '../lib/diff';
import { developmentScreen } from '../lib/grid';
import { useWindow, type DevelopmentDiff } from '../lib/store';
import { uiTextSize, useShade } from '../lib/theme';

export function TaskDiffTree({ task, roots }: { task: string; roots: { folder: string; label: string }[] }) {
  const selection = useWindow((s) => s.developmentDiff);
  return <Diff key={task} session={diffFor(task)} roots={roots} selection={selection?.task === task ? selection : null}
    reviewing={developmentScreen() === 'diff'} />;
}

export function TaskDiff({ selection }: { selection: DevelopmentDiff }) {
  const shade = useShade(), fontSize = useMemo(() => uiTextSize(), []);
  return <DiffPanel key={selection.task} session={diffFor(selection.task)} selection={selection} shade={shade} fontSize={fontSize} />;
}
