# Appearance

Shared theme, native drawing colors and identity presentation. Core supplies preferences/project facts.
The first-paint script `src/renderer/public/theme.js` owns initial/System theme application; shade subscriptions
must run after its media listener.

## The code

`renderer/page.css` owns shared page styles; shell transparency stays in `src/renderer/window.css`.
`theme.ts` supplies shade/native styles; `ProjectIcon.tsx` and `project-color.ts` supply identity.
