<script setup lang="ts">
// The icons (docs/ui.md, Icons): each drawn once here, on a 16 × 16 grid in lines of the text's color, and used as
// <Icon name="i-…">. Their size is the place's (components.css, .icon).
</script>

<template>
  <svg class="sprite" aria-hidden="true">
    <symbol id="i-close" viewBox="0 0 16 16"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></symbol>
    <symbol id="i-plus" viewBox="0 0 16 16"><path d="M8 3v10M3 8h10"/></symbol>
    <symbol id="i-menu" viewBox="0 0 16 16"><path d="M2 4h12M2 8h12M2 12h12"/></symbol>
    <symbol id="i-more" viewBox="0 0 16 16"><path d="M8 3.5h.01M8 8h.01M8 12.5h.01"/></symbol>
    <!-- Back, forward, reload: Chrome's -->
    <symbol id="i-back" viewBox="0 0 16 16"><path d="M13 8H3.5M7.5 4 3.5 8l4 4"/></symbol>
    <symbol id="i-forward" viewBox="0 0 16 16"><path d="M3 8h9.5M8.5 4l4 4-4 4"/></symbol>
    <symbol id="i-down" viewBox="0 0 16 16"><path d="m4 6 4 4 4-4"/></symbol>
    <symbol id="i-reload" viewBox="0 0 16 16"><path d="M13 8a5 5 0 1 1-1.46-3.54M12.5 1.8v3h-3"/></symbol>
    <!-- Pick: DevTools' inspect icon, a square and an arrow at its corner -->
    <symbol id="i-pick" viewBox="0 0 16 16"><path d="M13.5 7V3.5a1 1 0 0 0-1-1h-9a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1H7"/><path fill="currentColor" d="M9 9l5.5 2-2.4.9-.9 2.4z"/></symbol>
    <!-- A site without an icon of its own, as Chrome's globe -->
    <symbol id="i-globe" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c-2.2 2.6-2.2 9.4 0 12M8 2c2.2 2.6 2.2 9.4 0 12"/></symbol>
    <!-- ☰'s rows, from Lucide (lucide.dev, ISC; zoom-in, sun-moon, layout-panel-left, bot, log-out): drawn on 24 × 24,
         their lines as thick as the others' at 16 px -->
    <symbol id="i-zoom" viewBox="0 0 24 24"><g stroke-width="2.25"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M11 8v6M8 11h6"/></g></symbol>
    <symbol id="i-theme" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="M12 2v2M16 12a4 4 0 0 0-4-4M19 5l-1.256 1.256M20 12h2"/><path d="M14.837 16.385a6 6 0 1 1-7.223-7.222c.624-.147.97.66.715 1.248a4 4 0 0 0 5.26 5.259c.589-.255 1.396.09 1.248.715"/></g></symbol>
    <symbol id="i-arrange" viewBox="0 0 24 24"><g stroke-width="2.25"><rect width="7" height="18" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/></g></symbol>
    <symbol id="i-agent" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="M12 8V4H8M2 14h2M20 14h2M15 13v2M9 13v2"/><rect width="16" height="12" x="4" y="8" rx="2"/></g></symbol>
    <!-- An agent's state on a tab (components.css .state), from Lucide too (sparkles, bell, check) -->
    <symbol id="i-working" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4M22 4h-4"/><circle cx="4" cy="20" r="2"/></g></symbol>
    <symbol id="i-waiting" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="M10.268 21a2 2 0 0 0 3.464 0M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/></g></symbol>
    <symbol id="i-done" viewBox="0 0 24 24"><g stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></g></symbol>
    <symbol id="i-mic" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="M12 19v3M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/></g></symbol>
    <symbol id="i-users" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/></g></symbol>
    <symbol id="i-exit" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/></g></symbol>
    <!-- The links in ☰ (Lucide's book-open, github, bug) -->
    <symbol id="i-docs" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></g></symbol>
    <symbol id="i-github" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4M9 18c-4.51 2-5-2-7-2"/></g></symbol>
    <symbol id="i-bug" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="m8 2 1.88 1.88M14.12 3.88 16 2M9 7.13v-1a3.003 3.003 0 1 1 6 0v1M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4"/></g></symbol>
    <!-- Projects' icons to choose from (Project Settings…, New Project…; Lucide's shopping-cart, briefcase, globe,
         flask-conical, rocket, code, building-2, users-round, book-open-text, heart) -->
    <symbol id="i-p-cart" viewBox="0 0 24 24"><g stroke-width="2.25"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></g></symbol>
    <symbol id="i-p-briefcase" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/></g></symbol>
    <symbol id="i-p-globe" viewBox="0 0 24 24"><g stroke-width="2.25"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/></g></symbol>
    <symbol id="i-p-flask" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2M8.5 2h7M7 16h10"/></g></symbol>
    <symbol id="i-p-rocket" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2zM9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></g></symbol>
    <symbol id="i-p-code" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/></g></symbol>
    <symbol id="i-p-building" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18ZM6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2M10 6h4M10 10h4M10 14h4M10 18h4"/></g></symbol>
    <symbol id="i-p-people" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="M18 21a8 8 0 0 0-16 0M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/><circle cx="10" cy="8" r="5"/></g></symbol>
    <symbol id="i-p-book" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="M12 7v14M16 12h2M16 8h2M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3zM6 12h2M6 8h2"/></g></symbol>
    <symbol id="i-p-heart" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></g></symbol>
    <!-- The app icon (assets/icon.svg) with its curtain in any color: currentColor (the project's, --color or --project
         of the place), its folds a shadow over it, the same for every color (a gradient of the color itself would be
         one for all: a <use> takes the sprite's, not its own). In the title bar and on a project's label. -->
    <defs>
      <linearGradient id="logo-folds" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-opacity=".4"/><stop offset=".3" stop-opacity="0"/><stop offset=".55" stop-opacity=".3"/><stop offset=".8" stop-opacity="0"/><stop offset="1" stop-opacity=".4"/>
      </linearGradient>
      <clipPath id="logo-body"><rect x="100" y="100" width="824" height="824" rx="185"/></clipPath>
    </defs>
    <symbol id="i-logo" viewBox="100 100 824 824">
      <g clip-path="url(#logo-body)" stroke="none">
        <rect x="100" y="100" width="824" height="824" fill="#17181b"/>
        <path d="M100 100 H466 C438 390 374 630 318 924 H100 Z" fill="currentColor"/>
        <path d="M924 100 H558 C586 390 650 630 706 924 H924 Z" fill="currentColor"/>
        <path d="M100 100 H466 C438 390 374 630 318 924 H100 Z" fill="url(#logo-folds)"/>
        <path d="M924 100 H558 C586 390 650 630 706 924 H924 Z" fill="url(#logo-folds)"/>
      </g>
      <path d="M446 390 L446 740 L529 659 L584 777 L641 751 L586 635 L700 629 Z" fill="#ffd27a" stroke="#17181b" stroke-width="26" stroke-linejoin="round"/>
    </symbol>
    <!-- Keyboard Shortcuts in ☰: Lucide's keyboard -->
    <symbol id="i-keyboard" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="M10 8h.01M12 12h.01M14 8h.01M16 12h.01M18 8h.01M6 8h.01M7 16h10M8 12h.01"/><rect width="20" height="16" x="2" y="4" rx="2"/></g></symbol>
    <!-- The bar's Search Tasks: Lucide's search -->
    <symbol id="i-search" viewBox="0 0 24 24"><g stroke-width="2.25"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></g></symbol>
    <!-- The projects' manager: Lucide's folder-open -->
    <symbol id="i-settings" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></g></symbol>
    <symbol id="i-projects" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/></g></symbol>
  </svg>
</template>
