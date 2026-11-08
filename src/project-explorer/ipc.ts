// Directory entries shared by Project Explorer's halves (README.md).
export interface ProjectFile { name: string; path: string; directory: boolean }
export interface ProjectGitStatus {
  path: string;
  status: 'added' | 'deleted' | 'ignored' | 'modified' | 'renamed' | 'untracked';
}
