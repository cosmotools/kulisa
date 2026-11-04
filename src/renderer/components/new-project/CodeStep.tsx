// One initial code source; projects can acquire more folders later (docs/tasks.md, Projects).
import { useId } from 'react';
import { FolderGit2Icon, FolderOpenIcon, FolderPlusIcon } from 'lucide-react';
import { Button, Card, CardHeader, CardContent, Field, FieldContent, FieldDescription, FieldLabel, FieldTitle, Input, Label, RadioGroup, RadioGroupItem } from '@ui';
import { destination, useProjectDraft, type From, type ProjectDraft } from './draft';
import { MAX } from '../../../shared/names';

const sources = [
  { value: 'new', title: 'Start a new project', description: 'A new folder for the idea you want to build.', icon: FolderPlusIcon },
  { value: 'folder', title: 'Open a folder', description: 'Work with code that is already on your computer.', icon: FolderOpenIcon },
  { value: 'clone', title: 'Clone a repository', description: 'Get your code from GitHub or another Git host.', icon: FolderGit2Icon },
] as const;

export function CodeStep({ draft: d }: { draft: ProjectDraft }) {
  const s = useProjectDraft(d, (x) => x), id = useId();
  return <div className="flex flex-col gap-5">
    <RadioGroup aria-label="Code source" value={s.from} onValueChange={(from) => d.change({ from: from as From })}>
      {sources.map(({ value, title, description, icon: Icon }) => <Card key={value} size="sm">
        <CardHeader>
          <Label htmlFor={`${id}-${value}`} className="w-full">
            <RadioGroupItem id={`${id}-${value}`} value={value} aria-label={title}
              aria-controls={s.from === value ? `${id}-${value}-fields` : undefined} />
            <Icon className="size-5 shrink-0" />
            <FieldContent><FieldTitle>{title}</FieldTitle><FieldDescription>{description}</FieldDescription></FieldContent>
          </Label>
        </CardHeader>
        {s.from === value && <CardContent id={`${id}-${value}-fields`}>
          <div className="flex min-w-0 flex-col gap-4">
            {value !== 'new' && <Field>
              <FieldLabel htmlFor={`${id}-source`}>{value === 'folder' ? 'Folder on disk' : 'Repository URL'}</FieldLabel>
              <div className="flex gap-2">
                <Input id={`${id}-source`} spellCheck={false} value={value === 'folder' ? s.folder : s.url}
                  placeholder={value === 'folder' ? 'Full path to your folder' : 'git@github.com:you/my-project.git'}
                  onChange={(e) => d.change(value === 'folder' ? { folder: e.target.value } : { url: e.target.value })} />
                {value === 'folder' && <Button type="button" variant="outline" aria-label="Browse folder" onClick={() => void d.browse(true)}><FolderOpenIcon />Browse</Button>}
              </div>
              {value === 'folder' && <FieldDescription>Your files stay where they are.</FieldDescription>}
            </Field>}
            {value !== 'folder' && <>
              <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
                <Field><FieldLabel htmlFor={`${id}-directory`}>Folder name</FieldLabel>
                  <Input id={`${id}-directory`} value={s.directoryName} spellCheck={false} maxLength={MAX} placeholder="my-project"
                    aria-describedby={`${id}-directory-hint`} onChange={(e) => d.change({ directoryName: e.target.value })} />
                  <FieldDescription id={`${id}-directory-hint`}>A–Z, a–z, 0–9, - _ .</FieldDescription>
                </Field>
                <Field><FieldLabel htmlFor={`${id}-location`}>Create in</FieldLabel>
                  <div className="flex gap-2">
                    <Input id={`${id}-location`} value={s.place} spellCheck={false} onChange={(e) => d.change({ place: e.target.value })} />
                    <Button type="button" variant="outline" aria-label="Browse location" onClick={() => void d.browse()}><FolderOpenIcon />Browse</Button>
                  </div>
                </Field>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium">{value === 'clone' ? 'Clone destination' : 'Project folder'}</p>
                <p data-selectable role="status" aria-label="Project folder path" className="mt-1 text-xs break-all text-muted-foreground">
                  {destination(s) || (value === 'clone' ? 'Enter a repository URL to suggest a folder.' : 'Enter a folder name to see its full path.')}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">Browse chooses the parent folder. {value === 'clone' ? 'Cloning starts when you create the project.' : 'The new folder is created when you create the project.'}</p>
              </div>
            </>}
          </div>
        </CardContent>}
      </Card>)}
    </RadioGroup>
    <p className="text-xs text-muted-foreground">Start with one folder. You can add other folders to the same project later.</p>
  </div>;
}
