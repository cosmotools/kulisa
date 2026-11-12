# Menus

Shared DropdownMenu wrappers and one point-menu model; callers supply rows/actions. Fixed menus inside Dockview
can be clipped. Native profile-page menus belong to [window](../../docs/window.md#menus).

Menus wait for [Layers](../layers/README.md) coverage readiness. Close without fading: fading layers steal focus
and Escape from dialogs opened by their rows. Check native window focus before closing on blur; renderer blur can
come from a profile taking focus, and delayed blur may arrive after the window regains focus.

## The code

`renderer/Menus.tsx` renders button/area/point menus; `menu.ts` owns page-local rows and point state.
