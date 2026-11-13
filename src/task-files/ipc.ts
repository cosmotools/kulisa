// File records shared by Task Files halves (README.md). Task-specific channels stay in core.
// A task result, including directories and ordinary files without pane provenance.
export interface Artifact {
  file: string;
  path: string; // relative, forward slashes; directories end in /
  directory: boolean;
  revision: string;
  source?: { kind: 'profile'; id: string; tab: string } | { kind: 'stage-terminal'; id: number };
  kind: string; // file, folder or a tool result's kind
  time: number;
  bytes: number;
  thumb: string | null; // bounded raster preview, a data: URL
}
