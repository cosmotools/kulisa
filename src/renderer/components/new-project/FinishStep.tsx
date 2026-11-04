// Final project details and starter guidance (docs/tasks.md, Projects). The app choice never limits environments.
import { useId, useState } from 'react';
import { GlobeIcon, PencilIcon, SparklesIcon, SquareTerminalIcon } from 'lucide-react';
import { Button, Field, FieldContent, FieldDescription, FieldLabel, FieldTitle, Input, RadioGroup, RadioGroupItem } from '@ui';
import { useProjectDraft, type ProjectDraft, type ProjectDraftState } from './draft';

const guidance = {
  web: { title: 'Try a first request', text: '“Build a small online store. Help me set up browser profiles to try it as a customer and an admin.”', detail: 'Browser profiles let you and your agent check the app as different users.' },
  cli: { title: 'Try a first request', text: '“Help me build my own coding agent. Start with a terminal chat that can read files and run commands.”', detail: 'Stage terminals let you and your agent use the app’s prompts, keyboard controls and output.' },
  unsure: { title: 'Start with your idea', text: 'Tell your agent what you want to build, or ask it to explain the code you already have.', detail: 'Every project can use browser profiles and Stage terminals. Choose what you need as you work.' },
};
export function FinishStep({ draft: d }: { draft: ProjectDraft }) {
  const s = useProjectDraft(d, (x) => x), id = useId();
  const [editName, setEditName] = useState(false);
  const hint = guidance[s.kind];
  return <div className="flex flex-col gap-6">
    <Field>
      <FieldLabel htmlFor={`${id}-name`}>Project name</FieldLabel>
      {editName ? <Input id={`${id}-name`} autoFocus value={s.name} maxLength={64} placeholder="My next project" spellCheck={false}
        onChange={(e) => d.change({ name: e.target.value })} />
        : <div className="flex items-center gap-3"><h3 className="min-w-0 flex-1 truncate text-xl font-semibold">{s.name}</h3>
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditName(true)}><PencilIcon />Edit name</Button></div>}
      <FieldDescription>A display name for Kulisa. Changing it leaves the folder name as it is.</FieldDescription>
    </Field>
    <Field>
      <FieldTitle id={`${id}-kind`}>What will you develop?</FieldTitle>
      <FieldDescription>Choose some starting ideas. You can use all of Kulisa’s tools with any choice.</FieldDescription>
      <div className="sm:*:grid-cols-3"><RadioGroup aria-labelledby={`${id}-kind`} value={s.kind} onValueChange={(kind) => d.change({ kind: kind as ProjectDraftState['kind'] })}>
        {([{ value: 'web', title: 'Web app', icon: GlobeIcon }, { value: 'cli', title: 'CLI app', icon: SquareTerminalIcon }, { value: 'unsure', title: 'Not sure yet', icon: SparklesIcon }] as const)
          .map(({ value, title, icon: Icon }) => <FieldLabel key={value} htmlFor={`${id}-${value}`}><Field orientation="horizontal">
            <RadioGroupItem id={`${id}-${value}`} value={value} /><Icon className="size-4 shrink-0" /><FieldContent><FieldTitle>{title}</FieldTitle></FieldContent>
          </Field></FieldLabel>)}
      </RadioGroup></div>
    </Field>
    <div className="rounded-xl border bg-muted/30 p-4">
      <p className="text-sm font-medium">{hint.title}</p><p className="mt-2 text-sm">{hint.text}</p>
      <p className="mt-2 text-xs text-muted-foreground">{hint.detail}</p>
    </div>
  </div>;
}
