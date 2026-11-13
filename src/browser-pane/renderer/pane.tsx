// Browser pane adapters; sessions, sign-ins and native views remain in Browser/core (../README.md).
import { PlusIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage, Button, Item, ItemContent, ItemMedia, ItemTitle } from '@ui';
import { ProfilePane, ProfileHeader } from './ProfilePane';
import { profileLaunchers } from './launchers';
import { BrowserPanes, panelId } from './state';
import { useStore } from 'zustand';
import type { BrowserPaneHost } from './state';
import { pageRects } from './pages';
import { avatarSrc } from '../../appearance/renderer';
import type { LauncherMode, StagePaneKind } from '../../shared/stage-pane';

function BrowserLaunchers({ mode, browser }: { mode: LauncherMode; browser: BrowserPanes }) {
  const act = browser.host.act, closed = useStore(browser.host.facts, (s) => s.closedProfiles);
  return profileLaunchers(act, closed).map((p) => mode === 'tile'
    ? <Button key={p.id} data-launcher data-profile={p.id} variant="outline" aria-label={p.label} title={p.title}
      className="h-auto w-60 justify-start" onClick={() => void p.run()}>
      <Item size="sm"><ItemMedia>{p.avatar ? <Avatar size="lg" aria-hidden><AvatarImage src={avatarSrc(p.avatar)} alt="" /><AvatarFallback><PlusIcon /></AvatarFallback></Avatar> : <PlusIcon className="size-8" />}</ItemMedia>
        <ItemContent className="min-w-0"><ItemTitle>{p.label}</ItemTitle></ItemContent></Item>
    </Button>
    : <Button key={p.id} variant="ghost" size="sm" data-profile={p.id} aria-label={p.label} title={p.title}
      className="max-w-72 flex-none" onClick={() => void p.run()}>
      {p.avatar && <Avatar className="size-5"><AvatarImage src={avatarSrc(p.avatar)} alt="" /><AvatarFallback><PlusIcon /></AvatarFallback></Avatar>}
      <span className="min-w-0 truncate">{p.label}</span><PlusIcon />
    </Button>);
}
export function createBrowserPane(host: BrowserPaneHost) {
  const browser = new BrowserPanes(host);
  const definition: StagePaneKind = {
    kind: 'browser', component: 'profile',
    pane: (props) => <ProfilePane browser={browser} {...props} />,
    header: (props) => <ProfileHeader browser={browser} {...props} />,
    panes: () => browser.getState().profiles.map((p) => ({ id: panelId(p.id), title: p.name })),
    launcherOrder: 1,
    Launchers: (props) => <BrowserLaunchers browser={browser} {...props} />,
    bind: browser.bind,
    command: (event) => {
      if (event.command !== 'profile:show' || !event.profile) return false;
      browser.show(event.profile); return true;
    },
    layout: ({ api, viewport }) => pageRects(api, viewport, browser.getState().profiles, browser.panes),
    dismiss: browser.dismiss,
    reset: browser.reset,
  };
  return { definition, pane: browser.pane, screenshot: browser.screenshot };
}
