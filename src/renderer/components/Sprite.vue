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
    <!-- ☰'s rows, from Lucide (lucide.dev, ISC; zoom-in, sun-moon, languages, chevron-right, layout-panel-left, bot, log-out): drawn on 24 × 24,
         their lines as thick as the others' at 16 px -->
    <symbol id="i-zoom" viewBox="0 0 24 24"><g stroke-width="2.25"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M11 8v6M8 11h6"/></g></symbol>
    <symbol id="i-theme" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="M12 2v2M16 12a4 4 0 0 0-4-4M19 5l-1.256 1.256M20 12h2"/><path d="M14.837 16.385a6 6 0 1 1-7.223-7.222c.624-.147.97.66.715 1.248a4 4 0 0 0 5.26 5.259c.589-.255 1.396.09 1.248.715"/></g></symbol>
    <symbol id="i-language" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="m5 8 6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6"/></g></symbol>
    <symbol id="i-chevron" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="m9 18 6-6-6-6"/></g></symbol>
    <symbol id="i-arrange" viewBox="0 0 24 24"><g stroke-width="2.25"><rect width="7" height="18" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/></g></symbol>
    <symbol id="i-agent" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="M12 8V4H8M2 14h2M20 14h2M15 13v2M9 13v2"/><rect width="16" height="12" x="4" y="8" rx="2"/></g></symbol>
    <!-- An agent's state on a tab (components.css .state), from Lucide too (sparkles, bell, check) -->
    <symbol id="i-working" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4M22 4h-4"/><circle cx="4" cy="20" r="2"/></g></symbol>
    <symbol id="i-waiting" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="M10.268 21a2 2 0 0 0 3.464 0M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/></g></symbol>
    <symbol id="i-done" viewBox="0 0 24 24"><g stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></g></symbol>
    <symbol id="i-mic" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="M12 19v3M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/></g></symbol>
    <symbol id="i-exit" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/></g></symbol>
    <!-- The links in ☰ (Lucide's book-open, github, bug) -->
    <symbol id="i-docs" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></g></symbol>
    <symbol id="i-github" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4M9 18c-4.51 2-5-2-7-2"/></g></symbol>
    <symbol id="i-bug" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="m8 2 1.88 1.88M14.12 3.88 16 2M9 7.13v-1a3.003 3.003 0 1 1 6 0v1M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4"/></g></symbol>
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
    <!-- The makers' own marks, in their own colors: not under the GPL (docs/LICENSING.md) -->
    <symbol id="i-agent-claude" viewBox="0 0 248 248"><path stroke="none" fill="#D97757" d="M52.4285 162.873L98.7844 136.879L99.5485 134.602L98.7844 133.334H96.4921L88.7237 132.862L62.2346 132.153L39.3113 131.207L17.0249 130.026L11.4214 128.844L6.2 121.873L6.7094 118.447L11.4214 115.257L18.171 115.847L33.0711 116.911L55.485 118.447L71.6586 119.392L95.728 121.873H99.5485L100.058 120.337L98.7844 119.392L97.7656 118.447L74.5877 102.732L49.4995 86.1905L36.3823 76.62L29.3779 71.7757L25.8121 67.2858L24.2839 57.3608L30.6515 50.2716L39.3113 50.8623L41.4763 51.4531L50.2636 58.1879L68.9842 72.7209L93.4357 90.6804L97.0015 93.6343L98.4374 92.6652L98.6571 91.9801L97.0015 89.2625L83.757 65.2772L69.621 40.8192L63.2534 30.6579L61.5978 24.632C60.9565 22.1032 60.579 20.0111 60.579 17.4246L67.8381 7.49965L71.9133 6.19995L81.7193 7.49965L85.7946 11.0443L91.9074 24.9865L101.714 46.8451L116.996 76.62L121.453 85.4816L123.873 93.6343L124.764 96.1155H126.292V94.6976L127.566 77.9197L129.858 57.3608L132.15 30.8942L132.915 23.4505L136.608 14.4708L143.994 9.62643L149.725 12.344L154.437 19.0788L153.8 23.4505L150.998 41.6463L145.522 70.1215L141.957 89.2625H143.994L146.414 86.7813L156.093 74.0206L172.266 53.698L179.398 45.6635L187.803 36.802L193.152 32.5484H203.34L210.726 43.6549L207.415 55.1159L196.972 68.3492L188.312 79.5739L175.896 96.2095L168.191 109.585L168.882 110.689L170.738 110.53L198.755 104.504L213.91 101.787L231.994 98.7149L240.144 102.496L241.036 106.395L237.852 114.311L218.495 119.037L195.826 123.645L162.07 131.592L161.696 131.893L162.137 132.547L177.36 133.925L183.855 134.279H199.774L229.447 136.524L237.215 141.605L241.8 147.867L241.036 152.711L229.065 158.737L213.019 154.956L175.45 145.977L162.587 142.787H160.805V143.85L171.502 154.366L191.242 172.089L215.82 195.011L217.094 200.682L213.91 205.172L210.599 204.699L188.949 188.394L180.544 181.069L161.696 165.118H160.422V166.772L164.752 173.152L187.803 207.771L188.949 218.405L187.294 221.832L181.308 223.959L174.813 222.777L161.187 203.754L147.305 182.486L136.098 163.345L134.745 164.2L128.075 235.42L125.019 239.082L117.887 241.8L111.902 237.31L108.718 229.984L111.902 215.452L115.722 196.547L118.779 181.541L121.58 162.873L123.291 156.636L123.14 156.219L121.773 156.449L107.699 175.752L86.304 204.699L69.3663 222.777L65.291 224.431L58.2867 220.768L58.9235 214.27L62.8713 208.48L86.304 178.705L100.44 160.155L109.551 149.507L109.462 147.967L108.959 147.924L46.6977 188.512L35.6182 189.93L30.7788 185.44L31.4156 178.115L33.7079 175.752L52.4285 162.873Z"/></symbol>
    <symbol id="i-agent-codex" viewBox="0 0 24 24"><circle stroke="none" cx="12" cy="12" r="12" fill="#0080F7"/><path stroke="none" fill="#fff" d="M9.94494 9.59163V8.13227C9.94494 8.00935 9.99105 7.91713 10.0985 7.85575L13.0327 6.16599C13.4321 5.93558 13.9083 5.8281 14.3998 5.8281C16.2432 5.8281 17.4108 7.25677 17.4108 8.77751C17.4108 8.885 17.4108 9.00792 17.3953 9.13083L14.3537 7.34884C14.1694 7.24135 13.985 7.24135 13.8007 7.34884L9.94494 9.59163ZM16.7963 15.2755V11.7883C16.7963 11.5732 16.704 11.4196 16.5197 11.3121L12.664 9.0693L13.9236 8.34725C14.0311 8.28587 14.1234 8.28587 14.2308 8.34725L17.165 10.037C18.0099 10.5287 18.5782 11.5732 18.5782 12.587C18.5782 13.7544 17.887 14.8298 16.7963 15.2753V15.2755ZM9.03861 12.2031L7.77896 11.4658C7.67146 11.4045 7.62535 11.3122 7.62535 11.1893V7.8098C7.62535 6.16613 8.88501 4.92176 10.5902 4.92176C11.2354 4.92176 11.8344 5.13689 12.3415 5.52089L9.31526 7.27218C9.13097 7.37968 9.03875 7.53328 9.03875 7.74841V12.2033L9.03861 12.2031ZM11.75 13.77L9.94494 12.7562V10.6056L11.75 9.59178L13.5549 10.6056V12.7562L11.75 13.77ZM12.9098 18.44C12.2645 18.44 11.6655 18.2249 11.1585 17.8409L14.1847 16.0896C14.369 15.9821 14.4612 15.8285 14.4612 15.6134V11.1585L15.7363 11.8958C15.8438 11.9572 15.8899 12.0494 15.8899 12.1723V15.5519C15.8899 17.1955 14.6148 18.44 12.9098 18.44ZM9.26901 15.0144L6.33486 13.3246C5.4899 12.833 4.92161 11.7885 4.92161 10.7746C4.92161 9.59177 5.62824 8.53183 6.71886 8.0863V11.5887C6.71886 11.8039 6.81109 11.9575 6.99538 12.065L10.8359 14.2923L9.57621 15.0144C9.46872 15.0758 9.37649 15.0758 9.26901 15.0144ZM9.10013 17.5337C7.36426 17.5337 6.08919 16.2279 6.08919 14.6149C6.08919 14.492 6.1046 14.3691 6.11988 14.2462L9.1461 15.9975C9.33039 16.105 9.51483 16.105 9.69912 15.9975L13.5549 13.7702V15.2295C13.5549 15.3524 13.5088 15.4446 13.4013 15.506L10.4671 17.1958C10.0677 17.4262 9.59148 17.5337 9.09999 17.5337H9.10013ZM12.9098 19.3616C14.7685 19.3616 16.32 18.0406 16.6735 16.2893C18.3939 15.8438 19.5 14.2308 19.5 12.5872C19.5 11.5118 19.0391 10.4673 18.2096 9.71454C18.2864 9.39192 18.3326 9.0693 18.3326 8.74682C18.3326 6.55014 16.5505 4.90634 14.4921 4.90634C14.0774 4.90634 13.6779 4.96772 13.2785 5.10605C12.5872 4.43011 11.6347 4 10.5902 4C8.7314 4 7.17996 5.32103 6.8265 7.07232C5.10605 7.51786 4 9.13083 4 10.7745C4 11.8498 4.4608 12.8944 5.29035 13.6471C5.21354 13.9697 5.16743 14.2923 5.16743 14.6148C5.16743 16.8114 6.94941 18.4552 9.00792 18.4552C9.42261 18.4552 9.82204 18.3939 10.2215 18.2556C10.9127 18.9315 11.8651 19.3616 12.9098 19.3616Z"/></symbol>
    <symbol id="i-agent-shell" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="m7 11 2-2-2-2M11 13h4"/><rect width="18" height="18" x="3" y="3" rx="2"/></g></symbol>
    <!-- Keyboard Shortcuts in ☰: Lucide's keyboard -->
    <symbol id="i-keyboard" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="M10 8h.01M12 12h.01M14 8h.01M16 12h.01M18 8h.01M6 8h.01M7 16h10M8 12h.01"/><rect width="20" height="16" x="2" y="4" rx="2"/></g></symbol>
    <!-- The projects' manager: Lucide's folder-open -->
    <symbol id="i-settings" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></g></symbol>
    <symbol id="i-projects" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/></g></symbol>
    <!-- A project's code (New Project, a project's Code): Lucide's folder, folder-plus, git-branch; a list's toolbar: −,
         and Lucide's star (Make Default) -->
    <symbol id="i-folder" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></g></symbol>
    <symbol id="i-folder-plus" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="M12 10v6M9 13h6"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></g></symbol>
    <symbol id="i-git" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></g></symbol>
    <symbol id="i-file" viewBox="0 0 24 24"><g stroke-width="2.25"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"/></g></symbol>
    <symbol id="i-trash" viewBox="0 0 24 24"><g stroke-width="2"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></g></symbol>
    <symbol id="i-minus" viewBox="0 0 16 16"><path d="M3 8h10"/></symbol>
    <symbol id="i-star" viewBox="0 0 24 24"><g stroke-width="2"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></g></symbol>
  </svg>
</template>
