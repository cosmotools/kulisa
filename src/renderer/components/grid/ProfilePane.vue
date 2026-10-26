<script setup lang="ts">
// A profile's pane, as a Chrome window (docs/profiles.md; docs/window.md, The grid). The page itself is a native view
// the main process lays over its content (lib/grid.ts tells it where); while a panel is dragged or a menu is open, a
// picture of the page stands in for it.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { DockviewPanelApi } from 'dockview-vue';
import { DialogContent, DialogDescription, DialogRoot, DialogTitle } from 'reka-ui';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toggle } from '@/components/ui/toggle';
import ButtonMenu from '../menu/ButtonMenu.vue';
import RightClickMenu from '../menu/RightClickMenu.vue';
import { act, screenshot, store, togglePick } from '../../lib/store';
import { keyText, withKeys } from '../../lib/common';
import type { MenuItem } from '../../lib/menu';
import { panes, scheduleLayout, type PaneHandle } from '../../lib/grid';
import { useStrip } from '../../lib/strip';
import { ArrowLeftIcon, ArrowRightIcon, EllipsisVerticalIcon, GlobeIcon, PlusIcon, RotateCwIcon, SquareMousePointerIcon, XIcon } from '@lucide/vue';

const props = defineProps<{ params: { api: DockviewPanelApi } }>();
const key = props.params.api.id.slice('profile:'.length);
const profile = computed(() => store.profiles.find((p) => p.id === key));
const active = computed(() => profile.value?.tabs.find((t) => t.id === profile.value!.active));
const content = ref<HTMLElement>(), strip = ref<HTMLElement>(), address = ref<{ $el: HTMLInputElement }>();
const addr = computed(() => address.value?.$el), text = ref('');
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
  if (document.activeElement !== addr.value) text.value = shortUrl(active.value?.url || '');
  focusTyped();
}, { immediate: true, flush: 'post' });
let clickedIn = false;
const addrFocus = async () => { text.value = url(); await nextTick(); addr.value!.select(); };
const addrBlur = () => { text.value = shortUrl(url()); };
const addrDown = () => { clickedIn = document.activeElement !== addr.value; };
function addrUp(e: MouseEvent) {
  if (clickedIn && addr.value!.selectionStart === addr.value!.selectionEnd) { e.preventDefault(); addr.value!.select(); }
  clickedIn = false;
}
function go() { void act('tab:navigate', { profile: id(), tab: tab(), url: text.value }); addr.value!.blur(); }

// The tab strip, shadcn-vue's Tabs: a tab is chosen on the press, as in Chrome (not on its ×), the arrows move between
// them and Enter chooses. The active tab is kept in sight (lib/strip.ts, with the wheel and the faded edges).
useStrip(strip, () => profile.value?.active);
const activate = (t: string | number) => act('tab:activate', { profile: id(), tab: String(t) });
// A tab's right-click menu (the strip's: for the tab it was on).
function tabMenu(e: MouseEvent): MenuItem[] | null {
  const t = (e.target as Element).closest<HTMLElement>('[data-tab]')?.dataset.tab, p = profile.value;
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
// ⋮ at the end of the bar, as Chrome's: what a pane does less often; and the buttons a narrow pane hides (the bar's
// container queries).
const bar = ref<HTMLElement>();
const hidden = (name: string) => !bar.value?.querySelector<HTMLElement>(`[aria-label="${name}"]`)?.checkVisibility();
const more = (): MenuItem[] => {
  const nav: MenuItem[] = [
    ...hidden('Back') ? [{ label: 'Back', keys: keyText('tab.back'), enabled: !!active.value?.canBack, run: () => act('tab:back', { profile: id(), tab: tab() }) },
      { label: 'Forward', keys: keyText('tab.forward'), enabled: !!active.value?.canFwd, run: () => act('tab:forward', { profile: id(), tab: tab() }) }] : [],
    ...hidden('Reload') ? [{ label: 'Reload', keys: keyText('tab.reload'), run: () => act('tab:reload', { profile: id(), tab: tab() }) }] : [],
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
const focusOk = (e: Event) => { e.preventDefault(); (e.currentTarget as HTMLElement).querySelector<HTMLElement>('[data-ok]')?.focus(); };

let observer: ResizeObserver;
const handle: PaneHandle = { get content() { return content.value!; }, focusAddress, newTab };
onMounted(() => {
  panes.set(key, handle);
  observer = new ResizeObserver(scheduleLayout);
  if (content.value) observer.observe(content.value);
});
onBeforeUnmount(() => { observer.disconnect(); if (panes.get(key) === handle) panes.delete(key); });
</script>

<template>
  <div v-if="profile" class="flex h-full min-w-0 flex-col" role="region" :aria-label="profile.name" :data-profile="profile.id">
    <!-- The tabs scroll in their strip; + is next to it, never over a tab, as in Chrome -->
    <Tabs as-child class="shrink-0 items-center gap-1 px-2 data-horizontal:flex-row" :model-value="profile.active ?? undefined" activation-mode="manual"
      @update:model-value="activate"><nav aria-label="Tabs">
      <RightClickMenu :items="tabMenu"><TabsList as-child :loop="false" class="no-scrollbar max-w-full scroll-fade-x scroll-px-10 justify-start overflow-x-auto">
        <div ref="strip">
          <TabsTrigger v-for="t in profile.tabs" :key="t.id" :value="t.id" as-child class="flex-none">
            <div :data-tab="t.id" :aria-label="t.title || t.url || 'New tab'" :title="t.url">
              <img v-if="t.favicon" class="size-4" alt="" :src="t.favicon"><GlobeIcon v-else />
              <span class="max-w-40 truncate">{{ t.title || t.url || 'New tab' }}</span>
              <!-- Not a press on the tab: it is not chosen first. -->
              <Button as="span" variant="ghost" size="icon-xs" title="Close tab" @mousedown.prevent @click="act('tab:close', { profile: profile.id, tab: t.id })"><XIcon /></Button>
            </div>
          </TabsTrigger>
        </div>
      </TabsList></RightClickMenu>
      <Button variant="ghost" size="icon-sm" :title="withKeys('New tab', 'tab.new')" aria-label="New tab" @click="newTab"><PlusIcon /></Button>
    </nav></Tabs>
    <!-- A narrow pane gives up Back and Forward, then Reload (into ⋮; their keys stay), never Pick or ⋮: in order, else the
         buttons at the end go out of reach first. -->
    <div ref="bar" class="@container/bar flex h-10 shrink-0 items-center gap-0.5 border-b px-2" role="toolbar" aria-label="Page">
      <Button variant="ghost" size="icon-sm" class="@max-[244px]/bar:hidden" :title="withKeys('Back', 'tab.back')" aria-label="Back" :disabled="!active?.canBack"
        @click="act('tab:back', { profile: id(), tab: tab() })"><ArrowLeftIcon /></Button>
      <Button variant="ghost" size="icon-sm" class="@max-[244px]/bar:hidden" :title="withKeys('Forward', 'tab.forward')" aria-label="Forward" :disabled="!active?.canFwd"
        @click="act('tab:forward', { profile: id(), tab: tab() })"><ArrowRightIcon /></Button>
      <Button variant="ghost" size="icon-sm" class="@max-[184px]/bar:hidden" :title="withKeys('Reload', 'tab.reload')" aria-label="Reload"
        @click="act('tab:reload', { profile: id(), tab: tab() })"><RotateCwIcon /></Button>
      <Input ref="address" v-model="text" class="flex-1" aria-label="Address" spellcheck="false"
        @keydown.enter="go" @focus="addrFocus" @blur="addrBlur" @mousedown="addrDown" @mouseup="addrUp" />
      <!-- The site's own zoom in this profile, when it differs from the Kulisa zoom; a click resets it. -->
      <Button variant="ghost" size="sm" class="text-muted-foreground" :hidden="!active || active.zoom === 1" title="This site's zoom in this profile (Ctrl + / − / 0 in the page). Click to reset."
        @click="act('tab:zoom', { profile: id(), tab: tab(), dir: 0 })">{{ active ? Math.round(active.zoom * 100) : 100 }}%</Button>
      <!-- Pick needs a page to point at: off on an empty tab (about:blank), unless picking already. -->
      <Toggle size="sm" :model-value="picking" :title="withKeys('Pick an element on the page to mention it to the agent (again or Esc: cancel)', 'pick')"
        aria-label="Pick an element" :disabled="!picking && (!active?.url || active.url === 'about:blank')" @update:model-value="togglePick(profile.id)"><SquareMousePointerIcon /></Toggle>
      <ButtonMenu :items="more" end><Button variant="ghost" size="icon-sm" title="More: DevTools" aria-label="More"><EllipsisVerticalIcon /></Button></ButtonMenu>
    </div>
    <div ref="content" class="relative flex-1 overflow-hidden" data-testid="page" :style="{ '--picture': shownDialog?.picture ? `url(${JSON.stringify(shownDialog.picture)})` : 'none' }">
      <!-- A page's dialog, right under the address bar on a dimmed picture of the page, as Chrome shows it -->
      <div v-if="shownDialog" class="absolute inset-0 bg-(image:--picture) bg-size-[100%_100%]"><div class="size-full bg-black/10 backdrop-blur-xs" /></div>
      <DialogRoot :open="!!shownDialog" :modal="false" @update:open="(o) => o || answer(false)">
        <DialogContent as-child @interact-outside.prevent @open-auto-focus="focusOk">
          <Card class="absolute inset-x-0 top-2 mx-auto w-sm max-w-full">
            <CardHeader>
              <DialogTitle as-child><CardTitle>{{ shownDialog?.from }}</CardTitle></DialogTitle>
              <DialogDescription as-child><CardDescription class="wrap-anywhere whitespace-pre-wrap">{{ shownDialog?.message }}</CardDescription></DialogDescription>
            </CardHeader>
            <CardFooter class="justify-end gap-2">
              <Button v-if="shownDialog?.type === 'confirm'" variant="outline" @click="answer(false)">Cancel</Button><Button data-ok @click="answer(true)">OK</Button>
            </CardFooter>
          </Card>
        </DialogContent>
      </DialogRoot>
      <img v-if="store.pictures[profile.id]" class="absolute inset-0 size-full" data-testid="snapshot" alt="" :src="store.pictures[profile.id]">
    </div>
  </div>
</template>
