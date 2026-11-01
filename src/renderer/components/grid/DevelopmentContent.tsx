// The development area shows the selected terminal or file review (docs/window.md, The grid).
import { useWindow } from '../../lib/store';
import { useEffect } from 'react';
import { DevelopmentTerminals } from './DevelopmentTerminals';
import { DiffPanel } from '../changes/DiffPanel';
import type { DevelopmentParams } from '../../lib/grid';
import type { IDockviewPanelProps } from 'dockview-react';

export function DevelopmentContent(props: IDockviewPanelProps<DevelopmentParams>) {
  const diff = useWindow((s) => s.developmentDiff);
  const reviewing = props.params.screen === 'changes' && !!diff;
  useEffect(() => { props.api.setTitle(reviewing ? 'Changes' : 'Terminal'); }, [props.api, reviewing]);
  return <div className="h-full min-h-0 min-w-0">
    <div hidden={reviewing} className="h-full"><DevelopmentTerminals {...props} reviewing={reviewing} /></div>
    {reviewing && <DiffPanel selection={diff} />}
  </div>;
}
