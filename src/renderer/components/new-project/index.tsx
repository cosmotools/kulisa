// Public UI entry for project creation (docs/tasks.md, Projects). Draft state and step components stay inside this module.
import { useState } from 'react';
import { projectDraft } from './draft';
import { ProjectFlow } from './ProjectFlow';

export { NewProject } from './NewProject';

export function ProjectSetup({ onBack }: { onBack: () => void }) {
  const [draft] = useState(projectDraft);
  return <ProjectFlow draft={draft} back={onBack} />;
}
