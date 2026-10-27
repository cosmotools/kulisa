// A list to choose a row of and act on (docs/ui.md, Rows), on Fluent UI's Table: its columns, the selected row lit, the
// arrows move and choose, Delete acts on the chosen one.
import type { ReactNode } from 'react';
import { Table, TableBody, TableCell, TableCellLayout, TableHeader, TableHeaderCell, TableRow, makeStyles, useArrowNavigationGroup } from '@fluentui/react-components';

const useStyles = makeStyles({ table: { tableLayout: 'fixed' } });

export interface Column<T> { label: string; width?: string; cell: (row: T) => ReactNode }

export function List<T>({ label, rows, columns, id, rowLabel, rowTitle, attr, selected, onSelect, onDelete }: {
  label: string; rows: T[]; columns: Column<T>[]; id: (row: T) => string; rowLabel: (row: T) => string;
  rowTitle?: (row: T) => string; // its tooltip: the whole of what its cells cut
  attr: string; // data-<attr> on each row: what a right-click reads
  selected?: string; onSelect: (id: string) => void; onDelete?: () => void;
}) {
  const styles = useStyles();
  const arrows = useArrowNavigationGroup({ axis: 'vertical', memorizeCurrent: true });
  return <Table size="small" aria-label={label} className={styles.table}>
    <TableHeader><TableRow>{columns.map((c) => <TableHeaderCell key={c.label} style={{ width: c.width }} /* the caller's, per column */>{c.label}</TableHeaderCell>)}</TableRow></TableHeader>
    <TableBody {...arrows}>
      {rows.map((r) => {
        const key = id(r), chosen = key === selected;
        return <TableRow key={key} {...{ [`data-${attr}`]: key }} tabIndex={0} aria-label={rowLabel(r)} title={rowTitle?.(r)} aria-selected={chosen}
          appearance={chosen ? 'neutral' : 'none'} onFocus={() => onSelect(key)} onClick={() => onSelect(key)}
          onKeyDown={(e) => { if (e.key === 'Delete' && onDelete) { e.preventDefault(); onDelete(); } }}>
          {columns.map((c) => <TableCell key={c.label}><TableCellLayout truncate>{c.cell(r)}</TableCellLayout></TableCell>)}
        </TableRow>;
      })}
    </TableBody>
  </Table>;
}
