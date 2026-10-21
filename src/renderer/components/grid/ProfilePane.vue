<script setup lang="ts">
// A profile's pane, as a Chrome window (docs/profiles.md; docs/window.md, The grid). The page itself is a native view
// the main process lays over .content (lib/grid.ts tells it where); while a panel is dragged or a menu is open, a
// picture of the page stands in for it.
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import type { DockviewPanelApi } from 'dockview-vue';
import { DialogContent, DialogDescription, DialogRoot, DialogTitle, TabsList, TabsRoot, TabsTrigger, Toggle } from 'reka-ui';
import Icon from '../Icon.vue';
import ButtonMenu from '../menu/ButtonMenu.vue';
import RightClickMenu from '../menu/RightClickMenu.vue';
import { act, screenshot, store, togglePick } from '../../lib/store';
import { keyText, reducedMotion, withKeys } from '../../lib/common';
import type { MenuItem } from '../../lib/menu';
import { panes, scheduleLayout, type PaneHandle } from '../../lib/grid';
import { useStrip } from '../../lib/strip';

const props = defineProps<{ params: { api: DockviewPanelApi } }>();
const key = props.params.api.id.slice('profile:'.length);
const profile = computed(() => store.profiles.find((p) => p.id === key));
const active = computed(() => profile.value?.tabs.find((t) => t.id === profile.value!.active));
const content = ref<HTMLElement>(), addr = ref<HTMLInputElement>(), strip = ref<HTMLElement>();
const id = () => profile.value!.id;
const tab = () => profile.value!.active;

// An address as Chrome shows it in the omnibox when not editing: no http(s)://, no www., no lone trailing /.
const shortUrl = (u: string) => (u === 'about:blank' ? '' : u).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/^([^/?#]+)\/$/, '$1');
const url = () => { const u = active.value?.url || ''; return u === 'about:blank' ? '' : u; };

// A tab the human opened (+, New tab, Ctrl+T): the address gets the focus once the tab is the active one, as in Chrome.
let typeInto: string | null = null;
async function newTab() { const r = await act('tab:new', { profile: id() }); typeInto = typeof r === 'string' ? r : null; focusTyped(); }
function focusTyped() { if (typeInto && typeInto === profile.value?.active) { typeInto = null; addr.value!.focus(); } }
function focusAddress() { addr.value!.focus(); addr.value!.select(); }

// The address: shown short unless being edited; getting the focus shows the whole address, selected; a click while
// editing places the caret, a drag selects. Enter goes there.
watch(() => [active.value?.id, active.value?.url], () => {
  if (addr.value && document.activeElement !== addr.value) addr.value.value = shortUrl(active.value?.url || '');
  focusTyped();
}, { flush: 'post' });
let clickedIn = false;
const addrFocus = () => { addr.value!.value = url(); addr.value!.select(); };
const addrBlur = () => { addr.value!.value = shortUrl(url()); };
const addrDown = () => { clickedIn = document.activeElement !== addr.value; };
function addrUp(e: MouseEvent) {
  if (clickedIn && addr.value!.selectionStart === addr.value!.selectionEnd) { e.preventDefault(); addr.value!.select(); }
  clickedIn = false;
}
function go() { void act('tab:navigate', { profile: id(), tab: tab(), url: addr.value!.value }); addr.value!.blur(); }

// The tab strip, Reka's Tabs: a tab is chosen on the press, as in Chrome (not on its ×), the arrows move between them
// and Enter chooses. A tab opened in a strip already shown grows in from the left, as Chrome's (.tab.opening); the
// active tab in sight, as Chrome scrolls to it (lib/strip.ts, with the wheel and the faded edges). Tabs are kept by
// id: an element stays as its tab does. With reduced motion it does not grow, so no animation ends: brought into sight
// at once (else it stays .opening, and out of sight).
const opening = reactive(new Set<string>());
let known: Set<string> | null = null;
watch(() => profile.value?.tabs.map((t) => t.id) || [], (ids) => {
  if (known?.size) for (const t of ids) if (!known.has(t)) { if (reducedMotion.matches) void nextTick(() => reveal()); else opening.add(t); }
  known = new Set(ids);
}, { immediate: true });
const { reveal } = useStrip(strip, () => profile.value?.active);
const grown = (t: string) => { opening.delete(t); reveal(); };
const activate = (t: string | number) => act('tab:activate', { profile: id(), tab: String(t) });
// A tab's right-click menu (the strip's: for the tab it was on).
function tabMenu(e: MouseEvent): MenuItem[] | null {
  const t = (e.target as Element).closest<HTMLElement>('.tab')?.dataset.tab, p = profile.value;
  if (!t || !p) return null;
  const profileId = p.id, url = p.tabs.find((x) => x.id === t)?.url;
  return [
    { label: 'Reload', keys: keyText('tab.reload'), run: () => act('tab:reload', { profile: profileId, tab: t }) },
    { label: 'Duplicate', run: () => act('tab:new', { profile: profileId, url }) },
    '-',
    { label: 'Close tab', keys: keyText('tab.close'), run: () => act('tab:close', { profile: profileId, tab: t }) },
    { label: 'Close other tabs', enabled: p.tabs.length > 1,
      run: () => { for (const x of p.tabs) if (x.id !== t) void act('tab:close', { profile: profileId, tab: x.id }); } },
  ];
}
// ⋮ at the end of the bar, as Chrome's: what a pane does less often; and the buttons a narrow pane hides (the bar's CSS).
const bar = ref<HTMLElement>();
const hidden = (cls: string) => !bar.value?.querySelector<HTMLElement>(`.${cls}`)?.checkVisibility();
const more = (): MenuItem[] => {
  const nav: MenuItem[] = [
    ...hidden('back') ? [{ label: 'Back', keys: keyText('tab.back'), enabled: !!active.value?.canBack, run: () => act('tab:back', { profile: id(), tab: tab() }) },
      { label: 'Forward', keys: keyText('tab.forward'), enabled: !!active.value?.canFwd, run: () => act('tab:forward', { profile: id(), tab: tab() }) }] : [],
    ...hidden('reload') ? [{ label: 'Reload', keys: keyText('tab.reload'), run: () => act('tab:reload', { profile: id(), tab: tab() }) }] : [],
  ];
  // Nothing to take on an empty tab, as nothing to pick.
  const blank = !active.value?.url || active.value.url === 'about:blank';
  return [...nav, ...nav.length ? ['-' as const] : [],
    { submenu: 'Screenshot', items: [
      { label: 'Element', keys: keyText('screenshot'), enabled: !blank, run: () => screenshot(id(), 'element') },
      { label: 'Visible Part', enabled: !blank, run: () => screenshot(id(), 'visible') },
      { label: 'Full Page', enabled: !blank, run: () => screenshot(id(), 'full') }] },
    { label: 'DevTools', keys: keyText('devtools.tab'), run: () => act('tab:devtools', { profile: id(), tab: tab() }) }];
};
const picking = computed(() => !!profile.value && !!store.picking[profile.value.id]);

// The active tab's alert or confirm (profiles.ts), over a picture of its page, as Chrome shows it: Reka's Dialog, not
// modal (the other panes and the rest of the window go on), in the pane. The human's answer goes back when they close
// it (OK, Cancel, Esc; a click outside does nothing), not when it goes for them (answered by the agent, the page gone:
// the state has it no more). One answered is not shown again by a state sent before the answer arrived. OK has the
// keyboard, as in Chrome.
const answered = ref<number | null>(null);
const shownDialog = computed(() => { const d = active.value?.dialog; return d && d.id !== answered.value ? d : null; });
function answer(ok: boolean) {
  const d = shownDialog.value;
  if (!d) return;
  answered.value = d.id;
  void act('tab:dialog', { profile: id(), tab: tab(), dialog: d.id, ok });
}
const focusOk = (e: Event) => { e.preventDefault(); (e.currentTarget as HTMLElement).querySelector<HTMLElement>('.primary')?.focus(); };

let observer: ResizeObserver;
const handle: PaneHandle = { get content() { return content.value!; }, focusAddress, newTab };
onMounted(() => {
  panes.set(key, handle);
  observer = new ResizeObserver(scheduleLayout);
  if (content.value) observer.observe(content.value);
  if (addr.value) addr.value.value = shortUrl(active.value?.url || '');
});
onBeforeUnmount(() => { observer.disconnect(); if (panes.get(key) === handle) panes.delete(key); });
</script>

<template>
  <div v-if="profile" class="pane" :data-profile="profile.id">
    <!-- The tabs scroll in .strip; + is next to it, never over a tab, as in Chrome -->
    <TabsRoot as-child :model-value="profile.active ?? undefined" activation-mode="manual" @update:model-value="activate"><nav class="tabs">
      <RightClickMenu :items="tabMenu"><TabsList as-child :loop="false"><div ref="strip" class="strip tabstrip">
        <TabsTrigger v-for="t in profile.tabs" :key="t.id" :value="t.id" as-child>
          <div class="tab" :class="{ active: t.id === profile.active, opening: opening.has(t.id) }" :data-tab="t.id" :title="t.url" @animationend="grown(t.id)">
            <img alt="" :hidden="!t.favicon" :src="t.favicon || undefined"><Icon class="globe" name="i-globe" />
            <span class="title">{{ t.title || t.url || 'New tab' }}</span>
            <!-- Not a press on the tab: it is not chosen first. -->
            <span class="x icon small" title="Close tab" @mousedown.prevent @click="act('tab:close', { profile: profile.id, tab: t.id })"><Icon name="i-close" /></span>
          </div>
        </TabsTrigger>
      </div></TabsList></RightClickMenu>
      <button class="add icon" :title="withKeys('New tab', 'tab.new')" aria-label="New tab" @click="newTab"><Icon name="i-plus" /></button>
    </nav></TabsRoot>
    <div ref="bar" class="bar">
      <button class="back icon" :title="withKeys('Back', 'tab.back')" aria-label="Back" :disabled="!active?.canBack"
        @click="act('tab:back', { profile: id(), tab: tab() })"><Icon name="i-back" /></button>
      <button class="fwd icon" :title="withKeys('Forward', 'tab.forward')" aria-label="Forward" :disabled="!active?.canFwd"
        @click="act('tab:forward', { profile: id(), tab: tab() })"><Icon name="i-forward" /></button>
      <button class="reload icon" :title="withKeys('Reload', 'tab.reload')" aria-label="Reload" @click="act('tab:reload', { profile: id(), tab: tab() })"><Icon name="i-reload" /></button>
      <input ref="addr" class="addr" spellcheck="false" @keydown.enter="go" @focus="addrFocus" @blur="addrBlur" @mousedown="addrDown" @mouseup="addrUp">
      <!-- The site's own zoom in this profile, when it differs from the Kulisa zoom; a click resets it. -->
      <button class="zoom tool" :hidden="!active || active.zoom === 1" title="This site's zoom in this profile (Ctrl + / − / 0 in the page). Click to reset."
        @click="act('tab:zoom', { profile: id(), tab: tab(), dir: 0 })">{{ active ? Math.round(active.zoom * 100) : 100 }}%</button>
      <!-- Pick needs a page to point at: off on an empty tab (about:blank), unless picking already. -->
      <Toggle class="pick icon" :model-value="picking" :title="withKeys('Pick an element on the page to mention it to the agent (again or Esc: cancel)', 'pick')"
        aria-label="Pick an element" :disabled="!picking && (!active?.url || active.url === 'about:blank')" @update:model-value="togglePick(profile.id)"><Icon name="i-pick" /></Toggle>
      <ButtonMenu :items="more" end><button class="more icon" title="More: DevTools" aria-label="More"><Icon name="i-more" /></button></ButtonMenu>
    </div>
    <div ref="content" class="content" :style="{ '--picture': shownDialog?.picture ? `url(${JSON.stringify(shownDialog.picture)})` : 'none' }">
      <DialogRoot :open="!!shownDialog" :modal="false" @update:open="(o) => o || answer(false)">
        <DialogContent class="pagedialog dialog" @interact-outside.prevent @open-auto-focus="focusOk">
          <header><DialogTitle>{{ shownDialog?.from }}</DialogTitle></header>
          <div class="body"><DialogDescription class="message">{{ shownDialog?.message }}</DialogDescription></div>
          <footer><button v-if="shownDialog?.type === 'confirm'" class="cancel" @click="answer(false)">Cancel</button><button class="primary" @click="answer(true)">OK</button></footer>
        </DialogContent>
      </DialogRoot>
      <img v-if="store.pictures[profile.id]" class="snapshot" alt="" :src="store.pictures[profile.id]">
    </div>
  </div>
</template>

<style>
.pane { height: 100%; display: flex; flex-direction: column; min-width: 0; background: var(--toolbar);
  border-radius: 0 0 var(--island-radius) var(--island-radius); }
.tabs { display: flex; align-items: end; padding: 0 var(--gap); flex: none; background: var(--island);
  .strip { display: flex; align-items: end; min-width: 0; }
  .add { align-self: center; margin-inline-start: 4px; }
}
/* Many tabs shrink as Chrome's, to their icon and × (64 px): every tab keeps its ×, not the active one alone as
   Chrome's (the author's choice, as in the tasks' bar); past that the strip scrolls (.tabstrip). */
.tab { position: relative; display: flex; align-items: center; gap: 6px; width: 220px; flex: 0 1 auto; min-width: 64px; /* a width, not a basis: size containment leaves it no other */ height: 32px; padding: 0 8px 0 12px;
  container-type: inline-size;
  border-radius: var(--tab-radius) var(--tab-radius) 0 0; color: var(--text-dim);
  &:hover:not(.active) { background: color-mix(in srgb, var(--toolbar) 50%, var(--island)); }
  &.active { background: var(--toolbar); color: var(--text-strong); }
  /* a short line between two tabs, as Chrome's, where neither is lit */
  &:not(.active, :hover) + &:not(.active, :hover)::before { content: ''; position: absolute; inset-inline-start: 0; inset-block: 9px;
    border-inline-start: 1px solid var(--line); }
  /* opened: it grows in from the left, as Chrome's */
  &.opening { overflow: hidden; animation: tab-open .2s cubic-bezier(.2, .8, .2, 1);
    @media (prefers-reduced-motion: reduce) { animation: none; } }
  img { width: 16px; height: 16px; flex: none; }
  .globe { stroke-width: 1.2; }
  img:not([hidden]) + .globe { display: none; }
  .title { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
}
@keyframes tab-open { from { width: 0; min-width: 0; padding-inline: 0; } }
@container (max-width: 80px) { .tab .title { display: none; } }
/* A narrow pane gives up Back and Forward, then Reload (into ⋮; their keys stay), never Pick or ⋮: in order, else the
   buttons at the end go out of reach first. The widths are the pane's less the bar's padding. */
.bar { display: flex; align-items: center; gap: 2px; padding: 4px var(--gap); flex: none; container: bar / inline-size;
  /* the site's zoom, when not 100% */
  .tool { padding: 0 8px; background: none; color: var(--text-dim); &:hover { background: var(--hover); } }
  .more svg { stroke-width: 2.5; }
  .pick[data-state="on"] { background: var(--accent); color: var(--on-accent); }
  /* the omnibox: a pill a step darker than the toolbar; focused, an accent ring */
  .addr { flex: 1; min-width: 0; margin-inline: 4px; padding: 0 14px; border: none; border-radius: calc(var(--control) / 2);
    background: var(--island); color: var(--text); transition: background-color .15s; /* a hover fades in, as Chrome's */
    &:hover { background: color-mix(in srgb, var(--island) 80%, var(--text)); }
    &:focus { outline: 2px solid var(--accent); outline-offset: -2px; background: var(--island); color: var(--text-strong); } }
  @container bar (width < 244px) { .back, .fwd { display: none; } }
  @container bar (width < 184px) { .reload { display: none; } }
  @container bar (width < 100px) { .addr { padding-inline: 6px; } } /* dockview's narrowest (a group of 100 px) */
}
.content { flex: 1; position: relative; overflow: hidden; border-radius: calc(var(--island-radius) - 2px); background: var(--page);
  .snapshot { position: absolute; inset: 0; width: 100%; height: 100%; }
  /* A page's dialog, right under the address bar on a dimmed picture of the page, as Chrome shows it */
  &:has(.pagedialog) { background: linear-gradient(var(--backdrop), var(--backdrop)), var(--picture, none) 0 0 / 100% 100%, var(--page); }
  /* As Chrome's (its size, shape and blue), not Kulisa's own dialogs: the page's */
  .pagedialog { position: absolute; inset: 0 0 auto; margin-inline: auto; width: 450px; border-radius: calc(var(--island-radius) + 2px);
    header { padding: var(--page-pad) var(--page-pad) 0; }
    h2 { font-size: 1.15em; font-weight: 500; }
    .body { padding: var(--inset) var(--page-pad) 0; }
    footer { border-top: none; padding: var(--page-pad); }
    footer button { height: calc(var(--control) + 8px); border-radius: calc(var(--control) / 2 + 4px); }
    .primary { background: var(--page-button); border-color: var(--page-button); color: var(--on-page-button);
      &:hover { background: color-mix(in srgb, var(--page-button) 85%, white); } }
    .cancel { background: none; color: var(--page-button); }
    .message { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; } }
}
</style>
