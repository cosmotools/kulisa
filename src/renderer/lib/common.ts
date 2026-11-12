// Shell bootstrap facts and labels; task bootstrap stays in task-view (docs/window.md).
import type { ProjectsInfo } from '../../shared/types';
const query = new URLSearchParams(location.search);
export const initialProjects: ProjectsInfo | null = query.get('projects') ? JSON.parse(query.get('projects')!) : null;
export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;
