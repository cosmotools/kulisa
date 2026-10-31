// Theme-aware SVG assets; CSS loads only the icon for the window's current shade (../README.md).
import type { CSSProperties } from 'react';
import { icons, manifest } from 'virtual:project-file-icons';
import { fileIcon } from './icon';

export function FileIcon({ path, directory, expanded }: { path: string; directory: boolean; expanded: boolean }) {
  const dark = icons[fileIcon(manifest, path, directory, expanded)];
  const light = icons[fileIcon(manifest, path, directory, expanded, true)];
  return <span aria-hidden="true" className="size-4 shrink-0 bg-contain bg-center bg-no-repeat bg-[image:var(--file-icon-light)] dark:bg-[image:var(--file-icon)]"
    style={{ '--file-icon': `url("${dark}")`, '--file-icon-light': `url("${light}")` } as CSSProperties} />;
}
