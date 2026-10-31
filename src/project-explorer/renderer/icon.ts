// VS Code file-icon association precedence, independent of the editor (../README.md).
import type { Manifest } from 'material-icon-theme';

export function fileIcon(theme: Manifest, path: string, directory = false, expanded = false, light = false): string {
  const parts = path.replaceAll('\\', '/').toLowerCase().split('/');
  const name = parts.at(-1)!;
  const parent = parts.slice(-2).join('/');
  const own = (map: Record<string, string> | undefined, key: string) => map && Object.hasOwn(map, key) ? map[key] : undefined;
  const lookup = (key: 'fileNames' | 'fileExtensions' | 'folderNames' | 'folderNamesExpanded', value: string) =>
    (light ? own(theme.light?.[key], value) : undefined) ?? own(theme[key], value);
  if (directory) {
    const key = expanded ? 'folderNamesExpanded' : 'folderNames';
    return lookup(key, parent) ?? lookup(key, name)
      ?? (light ? theme.light?.[expanded ? 'folderExpanded' : 'folder'] : undefined)
      ?? theme[expanded ? 'folderExpanded' : 'folder'] ?? theme.folder ?? 'folder';
  }
  const exact = lookup('fileNames', parent) ?? lookup('fileNames', name);
  if (exact) return exact;
  // Longest suffix first: declarations and tests have their own icons, ahead of the language's.
  for (let dot = name.indexOf('.'); dot !== -1; dot = name.indexOf('.', dot + 1)) {
    const extension = name.slice(dot + 1);
    const icon = lookup('fileExtensions', `${parts.at(-2)}/${extension}`) ?? lookup('fileExtensions', extension);
    if (icon) return icon;
  }
  return (light ? theme.light?.file : undefined) ?? theme.file ?? 'file';
}
