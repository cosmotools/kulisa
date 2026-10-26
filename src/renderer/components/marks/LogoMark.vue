<script setup lang="ts">
// The app icon (assets/icon.svg) with its curtain in the text's color (a project's: text-(--project)), its folds a
// shadow over it, the same for every color. Ids of its own: a gradient or clip path another copy holds is not drawn
// while that copy is hidden.
import { useId } from 'vue';

const id = useId();
</script>

<template>
  <svg data-icon="logo" viewBox="100 100 824 824" width="16" height="16" aria-hidden="true">
    <defs>
      <linearGradient :id="`${id}-folds`" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-opacity=".4" /><stop offset=".3" stop-opacity="0" /><stop offset=".55" stop-opacity=".3" /><stop offset=".8" stop-opacity="0" /><stop offset="1" stop-opacity=".4" />
      </linearGradient>
      <clipPath :id="`${id}-body`"><rect x="100" y="100" width="824" height="824" rx="185" /></clipPath>
    </defs>
    <g :clip-path="`url(#${id}-body)`">
      <rect x="100" y="100" width="824" height="824" fill="#17181b" />
      <path d="M100 100 H466 C438 390 374 630 318 924 H100 Z" fill="currentColor" />
      <path d="M924 100 H558 C586 390 650 630 706 924 H924 Z" fill="currentColor" />
      <path d="M100 100 H466 C438 390 374 630 318 924 H100 Z" :fill="`url(#${id}-folds)`" />
      <path d="M924 100 H558 C586 390 650 630 706 924 H924 Z" :fill="`url(#${id}-folds)`" />
    </g>
    <path d="M446 390 L446 740 L529 659 L584 777 L641 751 L586 635 L700 629 Z" fill="#ffd27a" stroke="#17181b" stroke-width="26" stroke-linejoin="round" />
  </svg>
</template>
