// Browser pane state and handles; core facts/actions arrive through the public host (../README.md).
import { createStore } from 'zustand';
import type { Profile, ClosedProfile } from '../../shared/types';
import type { PaneControls, PaneFacts, PaneHost } from '../../shared/stage-pane';
import type { actionsFor } from '../../window-client/renderer';
import { refused } from '../../shared/result';
import type { PaneHandle } from './pages';

interface BrowserPaneFacts {
  active: boolean;
  covered: boolean;
  profiles: Profile[];
  closedProfiles: ClosedProfile[];
  pictures: Record<string, string>;
  stageActivity: string | null;
}
export interface BrowserPaneHost {
  task: string;
  facts: PaneFacts<BrowserPaneFacts>;
  act: ReturnType<typeof actionsFor>;
  controls: PaneControls;
}
interface BrowserUi {
  captions: Record<string, string>;
  picking: Record<string, boolean>;
}
export class BrowserPanes {
  readonly ui = createStore<BrowserUi>()(() => ({ captions: {}, picking: {} }));
  readonly panes = new Map<string, PaneHandle>();
  private captionTimers = new Map<string, number>();
  private stage: PaneHost | null = null;
  constructor(readonly host: BrowserPaneHost) {}
  getState = () => this.host.facts.getState();
  show = (profile: string) => this.stage?.show(panelId(profile));
  reportPages = () => this.stage?.reportLayout();
  pane = (id: string) => this.getState().active ? this.panes.get(id) : undefined;
  dismiss = () => { for (const pane of this.panes.values()) pane.cancelAddress(); };
  reset = () => {
    for (const timer of this.captionTimers.values()) clearTimeout(timer);
    this.captionTimers.clear();
    this.ui.setState({ captions: {}, picking: {} });
  };
  private setIn<K extends 'captions' | 'picking'>(key: K, profile: string, value: BrowserUi[K][string]) {
    this.ui.setState({ [key]: { ...this.ui.getState()[key], [profile]: value } });
  }
  private brief(profile: string, caption: string, sticky?: boolean) {
    this.setIn('captions', profile, caption);
    clearTimeout(this.captionTimers.get(profile)); this.captionTimers.delete(profile);
    if (!sticky) this.captionTimers.set(profile, window.setTimeout(() => {
      this.captionTimers.delete(profile); this.setIn('captions', profile, '');
    }, 4000));
  }
  bind = (stage: PaneHost) => {
    this.stage = stage;
    // Native presses must cancel address drafts without depending on the common grid's implementation.
    kulisa.on('page:press', ({ task }) => { if (task === this.host.task && this.getState().active) this.dismiss(); });
    kulisa.on('agent:caption', (event) => {
      if (event.task !== this.host.task || !this.getState().active) return;
      if (event.caption) stage.activity(event.task, panelId(event.profile));
      const profile = this.getState().profiles.find((p) => p.id === event.profile);
      if (profile && !profile.signinMode) this.brief(event.profile, event.caption ? `↖ agent: ${event.caption}` : '', event.sticky);
    });
  };
  togglePick = async (profile: string) => {
    if (!this.getState().active) return;
    if (this.ui.getState().picking[profile]) return kulisa.invoke('pick:cancel', { profile });
    this.setIn('captions', profile, 'Click an element on the page · Esc to cancel');
    this.setIn('picking', profile, true);
    const res = await kulisa.invoke('pick:start', { profile });
    this.setIn('picking', profile, false);
    this.setIn('captions', profile, res && res.error ? `Pick failed: ${res.error}` : '');
  };
  screenshot = async (profile: string, kind: 'element' | 'visible' | 'full') => {
    if (!this.getState().active) return;
    if (this.ui.getState().picking[profile]) return kulisa.invoke('pick:cancel', { profile });
    if (kind === 'element') {
      this.setIn('captions', profile, 'Click an element for its screenshot · Esc to cancel'); this.setIn('picking', profile, true);
    }
    const res = await this.host.act('tab:screenshot', { profile, kind });
    this.setIn('picking', profile, false);
    this.brief(profile, refused(res) ? `Screenshot failed: ${res.error}` : res.file ? 'Screenshot copied and saved' : '');
  };
}
export const panelId = (id: string) => `profile:${id}`;
