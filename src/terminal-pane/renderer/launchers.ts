// Application-terminal opening action shared by Stage buttons and shell menus (../README.md).
import type { PaneLauncher } from '../../shared/stage-pane';
export const terminalLauncher = (open: () => unknown): PaneLauncher => ({ id: 'terminal', label: 'Stage Terminal', run: open });
