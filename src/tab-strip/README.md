# Tab strip

Browser-like task/profile tabs and overflow mechanics; callers own selection, close and drag/drop actions.
Preserve the human's scroll on title/loading/state updates; reveal selection only after choosing, growing or resizing.
Keep the strip mounted during address editing.

## The code

`renderer/Tabs.tsx` adapts generated Tabs; `strip.ts` owns overflow/growth and mount-scoped observers/listeners.
