// The task grid supplied to its nested React panels.
import { createContext, useContext } from 'react';
import type { TaskGrid } from '../../lib/grid/task-grid';
export const GridContext = createContext<TaskGrid | null>(null);
export function useTaskGrid() {
  const grid = useContext(GridContext);
  if (!grid) throw new Error('A grid panel requires its TaskView');
  return grid;
}
