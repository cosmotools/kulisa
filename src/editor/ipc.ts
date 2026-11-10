// Documents and their actions, shared by the editor's two halves (README.md).
export const MAX_FILE_BYTES = 1024 * 1024;
export const MAX_DOCUMENTS = 12;
export interface EditorDocument {
  path: string;
  text: string;
  base: string;
  version: number;
  dirty: boolean;
  conflict: boolean;
  disk?: { text: string; revision: string };
  error?: string;
}
export interface EditorSnapshot {
  tabs: { path: string; dirty: boolean; conflict: boolean; error?: string }[];
  selected: string | null;
  document?: EditorDocument;
  external?: string;
  notice?: string;
}
export type EditorAction = { type: 'list' } | { type: 'open' | 'select' | 'refresh' | 'retry'; path: string }
  | { type: 'edit'; path: string; text: string }
  | { type: 'close'; path: string; discard?: boolean }
  | { type: 'resolve'; path: string; choice: 'disk' | 'mine'; revision: string };
