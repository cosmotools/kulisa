# Layers

Page-local Radix layer/keyboard-zone observation. Callers supply `coverUnder`: shell raise/lower or task capture/hide.
Global coverage cancels task transients without waiting for task JS or screenshots; local snapshot ordering belongs to
[Task view](../task-view/README.md#the-grid). Tooltips do not cover pages; Settings uses `coverPage` outside Radix.

Mark poppers ready only after native coverage completes; retain coverage through exit and restore focus after removal.
Task switches dismiss local layers/menus; shell dialogs and Settings keep their lifetime. Blur closes menus through
Escape, preserving dialogs that reject dismissal. Native order/focus policy stays in [window](../../docs/window.md#native-ownership).

## The code

`renderer/cover.ts`/`cover.css` coordinate readiness/exit; `key-zone.ts` reports zones/last pane for core routing.
