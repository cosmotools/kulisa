// Browser pane adapters; sessions, sign-ins and native views remain in Browser/core (../README.md).
import { PlusIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage, Button, Item, ItemContent, ItemMedia, ItemTitle } from '@ui';
import { ProfilePane, ProfileHeader } from './ProfilePane';
import { profileLaunchers } from './profiles';
import { useTask } from './state';
import { panelId } from './layout';
import { pageRects } from './pages';
import { avatarSrc } from '../../appearance/renderer';
import type { LauncherMode, StagePaneKind } from './pane-contract';

function BrowserLaunchers({ mode }: { mode: LauncherMode }) {
  const task = useTask((s) => s.key), closed = useTask((s) => s.closedProfiles);
  return profileLaunchers(task, closed).map((p) => mode === 'tile'
    ? <Button key={p.id} data-launcher data-profile={p.id} variant="outline" aria-label={p.name} title={p.title}
      className="h-auto w-60 justify-start" onClick={() => void p.run()}>
      <Item size="sm"><ItemMedia>{p.avatar ? <Avatar size="lg" aria-hidden><AvatarImage src={avatarSrc(p.avatar)} alt="" /><AvatarFallback><PlusIcon /></AvatarFallback></Avatar> : <PlusIcon className="size-8" />}</ItemMedia>
        <ItemContent className="min-w-0"><ItemTitle>{p.name}</ItemTitle></ItemContent></Item>
    </Button>
    : <Button key={p.id} variant="ghost" size="sm" data-profile={p.id} aria-label={p.name} title={p.title}
      className="max-w-72 flex-none" onClick={() => void p.run()}>
      {p.avatar && <Avatar className="size-5"><AvatarImage src={avatarSrc(p.avatar)} alt="" /><AvatarFallback><PlusIcon /></AvatarFallback></Avatar>}
      <span className="min-w-0 truncate">{p.name}</span><PlusIcon />
    </Button>);
}
export const browserPane: StagePaneKind = {
  kind: 'browser', component: 'profile', pane: ProfilePane, header: ProfileHeader,
  panes: (state) => state.profiles.map((p) => ({ id: panelId(p.id), title: p.name })),
  launcherOrder: 1, Launchers: BrowserLaunchers,
  bind: (host) => kulisa.on('agent:caption', ({ task, profile, caption }) => {
    if (caption) host.activity(task, panelId(profile));
  }),
  command: (event, _state, host) => {
    if (event.command !== 'profile:show' || !event.profile) return false;
    host.show(panelId(event.profile)); return true;
  },
  layout: ({ state, api, viewport, panes }) => pageRects(api, viewport, state.profiles, panes),
};
