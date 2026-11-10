// Window transfers must persist the current layout before the source loses the task (docs/window.md, The grid).
import { taskGrid } from './controller';
import { terminalsOf } from './terminals';

export function prepareTaskMove(key: string) {
  taskGrid(key)?.flush();
  return { terminalContents: terminalsOf(key) };
}
