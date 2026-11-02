// The window supplies task selection and typography to Diff (src/diff/README.md).
import { useMemo } from 'react';
import { Diff, DiffPanel } from '../../diff/renderer';
import { useTask, useTaskActive, useTaskGrid, type DevelopmentDiff } from './state';
import { uiTextSize, useShade } from '../lib/theme';

export function TaskDiffTree({ task, roots }: { task: string; roots: { folder: string; label: string }[] }) {
  const selection = useTask((s) => s.developmentDiff);
  const active = useTaskActive(), grid = useTaskGrid();
  const session = useMemo(() => ({ ...grid.development.review, active }), [grid, active]);
  if (selection?.task !== task) return null;
  return <Diff key={task} session={session} roots={roots} selection={selection} reviewing />;
}

export function TaskDiff({ selection }: { selection: DevelopmentDiff }) {
  const shade = useShade(), fontSize = useMemo(() => uiTextSize(), []);
  const active = useTaskActive(), task = selection.task;
  const grid = useTaskGrid(), session = useMemo(() => ({ ...grid.development.review, active }), [grid, active]);
  return <DiffPanel key={task} session={session} selection={selection} shade={shade} fontSize={fontSize} />;
}
