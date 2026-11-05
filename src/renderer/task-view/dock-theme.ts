import type { DockviewTheme } from 'dockview-react';
export const dockTheme: DockviewTheme = { name: 'kulisa', className: 'dockview-theme-kulisa', gap: 6, dndOverlayMounting: 'absolute' };
export const developmentTheme: DockviewTheme = { ...dockTheme, gap: 0 };
