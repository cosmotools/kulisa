// One Lucide sprite uses inherited status variables because Trees remaps icons by filename, not Git status.
import { createElement, FileDiff, FileInput, FileMinusCorner, FilePlusCorner } from 'lucide';
import type { FileTreeIconConfig } from '@pierre/trees';

export const treeIcons: FileTreeIconConfig = {
  set: 'none',
  remap: { 'file-tree-icon-file': { name: 'diff-file', viewBox: '0 0 24 24' } },
  spriteSheet: `<svg xmlns="http://www.w3.org/2000/svg" style="display:none"><symbol id="diff-file" viewBox="0 0 24 24">${
    Object.entries({ modified: FileDiff, added: FilePlusCorner, deleted: FileMinusCorner, renamed: FileInput })
      .map(([status, icon]) => `<g style="display:var(--diff-icon-${status},none)">${createElement(icon).outerHTML}</g>`).join('')
  }</symbol></svg>`,
};
