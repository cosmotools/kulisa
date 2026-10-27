// A list to choose a row of and act on (docs/ui.md, Rows), Fluent UI's DataGrid with single selection: Delete acts on
// the row with the keyboard.
import type { KeyboardEvent, ReactNode } from 'react';
import { DataGrid, DataGridBody, DataGridCell, DataGridHeader, DataGridHeaderCell, DataGridRow, TableCellLayout, createTableColumn,
  type TableColumnId } from '@fluentui/react-components';

export interface Column<T> { label: string; width?: string; cell: (row: T) => ReactNode }

export function List<T>({ label, rows, columns, id, rowLabel, rowTitle, attr, selected, onSelect, onDelete }: {
  label: string; rows: T[]; columns: Column<T>[]; id: (row: T) => string; rowLabel: (row: T) => string;
  rowTitle?: (row: T) => string; // its tooltip: the whole of what its cells cut
  attr: string; // data-<attr> on each row: what a right-click reads
  selected?: string; onSelect: (id: string) => void; onDelete?: (id: string) => void;
}) {
  const defs = columns.map((c, i) => createTableColumn<T>({ columnId: i, renderHeaderCell: () => c.label,
    renderCell: (r) => <TableCellLayout truncate>{c.cell(r)}</TableCellLayout> }));
  // the caller's, per column
  const width = (col: TableColumnId) => { const w = columns[Number(col)]?.width; return w ? { flex: `0 0 ${w}` } : undefined; };
  return <DataGrid items={rows} columns={defs} getRowId={id} selectionMode="single" focusMode="composite" size="small" aria-label={label}
    selectedItems={selected ? [selected] : []} onSelectionChange={(_, d) => { const [k] = d.selectedItems; if (k !== undefined) onSelect(String(k)); }}>
    <DataGridHeader>
      <DataGridRow>{({ renderHeaderCell, columnId }) => <DataGridHeaderCell style={width(columnId)}>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
    </DataGridHeader>
    <DataGridBody<T>>{({ item, rowId }) => {
      const key = String(rowId);
      return <DataGridRow<T> key={key} {...{ [`data-${attr}`]: key }} aria-label={rowLabel(item)} title={rowTitle?.(item)}
        onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Delete' && e.target === e.currentTarget && onDelete) { e.preventDefault(); onDelete(key); } }}>
        {({ renderCell, columnId }) => <DataGridCell style={width(columnId)}>{renderCell(item)}</DataGridCell>}
      </DataGridRow>;
    }}</DataGridBody>
  </DataGrid>;
}
