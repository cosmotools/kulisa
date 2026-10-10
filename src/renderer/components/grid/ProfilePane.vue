<script setup lang="ts">
// A profile's pane, as a Chrome window (its header is ProfileHeader.vue): the tabs on the island's color, the active
// one of a piece with the toolbar (back, forward, reload, the address, the site's zoom, Pick, ⋮) a step lighter; the
// page below to the island's edges. The page itself is a native view the main process lays over .content (lib/grid.ts
// tells it where); while a panel is dragged or a menu is open, a picture of the page stands in for it.
import { computed, onBeforeUnmount, onMounted, onUpdated, reactive, ref, watch } from 'vue';
import type { DockviewPanelApi } from 'dockview-vue';
import Icon from '../Icon.vue';
import { act, store, togglePick } from '../../lib/store';
import { keyText, withKeys } from '../../lib/common';
import { openMenu } from '../../lib/menu';
import { panes, scheduleLayout, type PaneHandle } from '../../lib/grid';

const props = defineProps<{ params: { api: DockviewPanelApi } }>();
const key = props.params.api.id.slice('profile:'.length);
const profile = computed(() => store.profiles.find((p) => p.key === key));
const active = computed(() => profile.value?.tabs.find((t) => t.id === profile.value!.active));
const content = ref<HTMLElement>(), addr = ref<HTMLInputElement>(), strip = ref<HTMLElement>(), pageDialog = ref<HTMLDialogElement>();
const id = () => profile.value!.id;
const tab = () => profile.value!.active;

// An address as Chrome shows it in the omnibox when not editing: no http(s)://, no www., no lone trailing /.
const shortUrl = (u: string) => (u === 'about:blank' ? '' : u).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/^([^/?#]+)\/$/, '$1');
const url = () => { const u = active.value?.url || ''; return u === 'about:blank' ? '' : u; };

// A tab the human opened (+, New tab, Ctrl+T): the address gets the focus once the tab is the active one, as in Chrome.
let typeInto: string | null = null;
async function newTab() { typeInto = await act<string>('tab:new', { profile: id() }); focusTyped(); }
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
function go() { act('tab:navigate', { profile: id(), tab: tab(), url: addr.value!.value }); addr.value!.blur(); }

// The tab strip: a tab opened in a strip already shown grows in from the left, as Chrome's (.tab.opening); the active
// tab in sight, as Chrome scrolls to it. Tabs are kept by id: an element stays as its tab does.
const opening = reactive(new Set<string>());
let known: Set<string> | null = null;
watch(() => profile.value?.tabs.map((t) => t.id) || [], (ids) => {
  if (known?.size) for (const t of ids) if (!known.has(t)) opening.add(t);
  known = new Set(ids);
}, { immediate: true });
function activeInSight() {
  const a = strip.value?.querySelector('.tab.active')?.getBoundingClientRect();
  if (!a) return;
  const { left: start, right: end } = strip.value!.getBoundingClientRect();
  if (a.left < start) strip.value!.scrollLeft -= start - a.left;
  else if (a.right > end) strip.value!.scrollLeft += a.right - end;
}
onUpdated(activeInSight);
const grown = (t: string) => { opening.delete(t); activeInSight(); };
function tabClick(e: MouseEvent, t: string) {
  if ((e.target as Element).closest('.x')) act('tab:close', { profile: id(), tab: t });
  else act('tab:activate', { profile: id(), tab: t });
}
function tabMenu(e: MouseEvent, t: string) {
  const p = profile.value!, profileId = p.id, url = p.tabs.find((x) => x.id === t)?.url;
  openMenu([
    { label: 'Reload', keys: keyText('tab.reload'), run: () => act('tab:reload', { profile: profileId, tab: t }) },
    { label: 'Duplicate', run: () => act('tab:new', { profile: profileId, url }) },
    '-',
    { label: 'Close tab', keys: keyText('tab.close'), run: () => act('tab:close', { profile: profileId, tab: t }) },
    { label: 'Close other tabs', enabled: p.tabs.length > 1,
      run: () => { for (const x of p.tabs) if (x.id !== t) act('tab:close', { profile: profileId, tab: x.id }); } },
  ], e);
}
// ⋮ at the end of the bar, as Chrome's: what a pane does less often.
const more = (e: MouseEvent) => openMenu([
  { label: 'DevTools', keys: keyText('devtools.tab'), run: () => act('tab:devtools', { profile: id(), tab: tab() }) },
], e.currentTarget as Element);
const picking = computed(() => !!profile.value && !!store.picking[profile.value.id]);

// The active tab's alert or confirm (profiles.js), over a picture of its page; the human's answer goes back when they
// close it (OK, Cancel, Esc), not when it is closed for them (answered by the agent, the page gone: data-id emptied). One
// answered is not shown again by a state sent before the answer arrived.
let answered: number | null = null;
const shownDialog = computed(() => { const d = active.value?.dialog; return d && d.id !== answered ? d : null; });
watch(() => [shownDialog.value?.id, active.value?.id], () => {
  const dialog = pageDialog.value, d = shownDialog.value;
  if (!dialog) return;
  if (!d) { if (dialog.open) { dialog.dataset.id = ''; dialog.close(); } return; }
  if (dialog.dataset.id === String(d.id)) return;
  Object.assign(dialog.dataset, { id: String(d.id), tab: active.value!.id });
  dialog.returnValue = '';
  if (!dialog.open) dialog.show();
}, { flush: 'post' });
function dialogClosed() {
  const dialog = pageDialog.value!, { id: d, tab: t } = dialog.dataset;
  dialog.dataset.id = '';
  if (!d) return;
  answered = Number(d);
  act('tab:dialog', { profile: id(), tab: t, dialog: answered, ok: dialog.returnValue === 'ok' });
}

let observer: ResizeObserver;
const handle: PaneHandle = { get content() { return content.value!; }, focusAddress, newTab };
onMounted(() => {
  panes.set(key, handle);
  observer = new ResizeObserver(scheduleLayout);
  if (content.value) observer.observe(content.value);
  if (addr.value) addr.value.value = shortUrl(active.value?.url || '');
  activeInSight();
});
onBeforeUnmount(() => { observer.disconnect(); if (panes.get(key) === handle) panes.delete(key); });
</script>

<template>
  <div v-if="profile" class="pane" :data-profile="profile.id">
    <!-- The tabs scroll in .strip; + is next to it, never over a tab, as in Chrome -->
    <nav class="tabs">
      <div ref="strip" class="strip" @wheel="(e) => { if (!e.deltaX) strip!.scrollLeft += e.deltaY; }">
        <div v-for="t in profile.tabs" :key="t.id" class="tab" :class="{ active: t.id === profile.active, opening: opening.has(t.id) }" :data-tab="t.id"
          :title="t.url" @click="tabClick($event, t.id)" @contextmenu.prevent="tabMenu($event, t.id)" @animationend="grown(t.id)">
          <img alt="" :hidden="!t.favicon" :src="t.favicon || undefined"><Icon class="globe" name="i-globe" />
          <span class="title">{{ (t.loading ? '⟳ ' : '') + (t.title || t.url || 'New tab') }}</span>
          <span class="x icon small" title="Close tab"><Icon name="i-close" /></span>
        </div>
      </div>
      <button class="add icon" :title="withKeys('New tab', 'tab.new')" aria-label="New tab" @click="newTab"><Icon name="i-plus" /></button>
    </nav>
    <div class="bar">
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
      <button class="pick icon" :class="{ active: picking }" :title="withKeys('Pick an element on the page to mention it to the agent (again or Esc: cancel)', 'pick')"
        aria-label="Pick an element" :disabled="!picking && (!active?.url || active.url === 'about:blank')" @click="togglePick(profile.id)"><Icon name="i-pick" /></button>
      <button class="more icon" data-menu-end title="More: DevTools" aria-label="More" @click="more"><Icon name="i-more" /></button>
    </div>
    <div ref="content" class="content" :style="{ '--picture': shownDialog?.picture ? `url(${JSON.stringify(shownDialog.picture)})` : 'none' }">
      <dialog ref="pageDialog" class="pagedialog" closedby="closerequest" @close="dialogClosed">
        <header><h2>{{ shownDialog?.from }}</h2></header>
        <div class="body"><p class="message">{{ shownDialog?.message }}</p></div>
        <form method="dialog"><footer><button value="" class="cancel" :hidden="shownDialog?.type !== 'confirm'">Cancel</button><button value="ok" class="primary" autofocus>OK</button></footer></form>
      </dialog>
      <img v-if="store.pictures[profile.id]" class="snapshot" alt="" :src="store.pictures[profile.id]">
    </div>
  </div>
</template>

<style>
.pane { height: 100%; display: flex; flex-direction: column; min-width: 0; background: var(--toolbar);
  border-radius: 0 0 var(--island-radius) var(--island-radius); }
.tabs { display: flex; align-items: end; padding: 0 var(--gap); flex: none; background: var(--island);
  .strip { display: flex; align-items: end; min-width: 0; overflow-x: auto; scrollbar-width: none; }
  .add { align-self: center; margin-inline-start: 4px; }
}
/* Many tabs shrink as Chrome's: narrow ones show their icon alone; the active one keeps its ×; past that the strip
   scrolls (the wheel too). */
.tab { position: relative; display: flex; align-items: center; gap: 6px; width: 220px; flex: 0 1 auto; min-width: 40px; /* a width, not a basis: size containment leaves it no other */ height: 32px; padding: 0 8px 0 12px;
  container-type: inline-size;
  border-radius: var(--tab-radius) var(--tab-radius) 0 0; color: var(--text-dim);
  &:hover:not(.active) { background: color-mix(in srgb, var(--toolbar) 50%, var(--island)); }
  &.active { background: var(--toolbar); color: var(--text-strong); min-width: 64px; } /* its icon and × */
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
@container (max-width: 80px) {
  .tab:not(.active) :is(.title, .x), .tab.active .title { display: none; }
  .tab:not(.active) :is(img, .globe) { margin-inline: auto; }
}
.bar { display: flex; align-items: center; gap: 2px; padding: 4px var(--gap); flex: none;
  /* the site's zoom, when not 100% */
  .tool { padding: 0 8px; background: none; color: var(--text-dim); &:hover { background: var(--hover); } }
  .more svg { stroke-width: 2.5; }
  .pick.active { background: var(--accent); color: var(--on-accent); }
  /* the omnibox: a pill a step darker than the toolbar; focused, an accent ring */
  .addr { flex: 1; min-width: 0; margin-inline: 4px; padding: 0 14px; border: none; border-radius: calc(var(--control) / 2);
    background: var(--island); color: var(--text); transition: background-color .15s; /* a hover fades in, as Chrome's */
    &:hover { background: color-mix(in srgb, var(--island) 80%, var(--text)); }
    &:focus { outline: 2px solid var(--accent); outline-offset: -2px; background: var(--island); color: var(--text-strong); } }
}
.content { flex: 1; position: relative; overflow: hidden; border-radius: calc(var(--island-radius) - 2px); background: var(--page);
  .snapshot { position: absolute; inset: 0; width: 100%; height: 100%; }
  /* A page's dialog, right under the address bar on a dimmed picture of the page, as Chrome shows it */
  &:has(.pagedialog[open]) { background: linear-gradient(var(--backdrop), var(--backdrop)), var(--picture, none) 0 0 / 100% 100%, var(--page); }
  /* As Chrome's (its size, shape and blue), not Kulisa's own dialogs: the page's */
  .pagedialog { inset-block-start: 0; width: 450px; border-radius: calc(var(--island-radius) + 2px);
    header { padding: var(--pad) var(--pad) 0; }
    h2 { font-size: 1.15em; font-weight: 500; }
    .body { padding-block: var(--inset) 0; }
    footer { border-top: none; padding-block: var(--pad); }
    footer button { height: calc(var(--control) + 8px); border-radius: calc(var(--control) / 2 + 4px); }
    .primary { background: var(--page-button); border-color: var(--page-button); color: var(--on-page-button);
      &:hover { background: color-mix(in srgb, var(--page-button) 85%, white); } }
    .cancel { background: none; color: var(--page-button); }
    .message { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; } }
}
</style>
