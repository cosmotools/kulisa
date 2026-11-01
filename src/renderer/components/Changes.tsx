// The window supplies task selection and typography to Changes (src/changes/README.md).
import { useMemo } from 'react';
import { Changes, DiffPanel } from '../../changes/renderer';
import { changesFor } from '../lib/changes';
import { developmentScreen } from '../lib/grid';
import { useWindow, type DevelopmentDiff } from '../lib/store';
import { uiTextSize, useShade } from '../lib/theme';

export function TaskChanges({ task, roots }: { task: string; roots: { folder: string; label: string }[] }) {
  const selection = useWindow((s) => s.developmentDiff);
  return <Changes key={task} session={changesFor(task)} roots={roots} selection={selection?.task === task ? selection : null}
    reviewing={developmentScreen() === 'changes'} />;
}

export function TaskDiff({ selection }: { selection: DevelopmentDiff }) {
  const shade = useShade(), fontSize = useMemo(() => uiTextSize(), []);
  return <DiffPanel key={selection.task} session={changesFor(selection.task)} selection={selection} shade={shade} fontSize={fontSize} />;
}
