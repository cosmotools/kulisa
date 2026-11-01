// The window supplies task selection and typography to Diffs (src/diffs/README.md).
import { useMemo } from 'react';
import { Diffs, DiffPanel } from '../../diffs/renderer';
import { diffsFor } from '../lib/diffs';
import { developmentScreen } from '../lib/grid';
import { useWindow, type DevelopmentDiff } from '../lib/store';
import { uiTextSize, useShade } from '../lib/theme';

export function TaskDiffs({ task, roots }: { task: string; roots: { folder: string; label: string }[] }) {
  const selection = useWindow((s) => s.developmentDiff);
  return <Diffs key={task} session={diffsFor(task)} roots={roots} selection={selection?.task === task ? selection : null}
    reviewing={developmentScreen() === 'diffs'} />;
}

export function TaskDiff({ selection }: { selection: DevelopmentDiff }) {
  const shade = useShade(), fontSize = useMemo(() => uiTextSize(), []);
  return <DiffPanel key={selection.task} session={diffsFor(selection.task)} selection={selection} shade={shade} fontSize={fontSize} />;
}
