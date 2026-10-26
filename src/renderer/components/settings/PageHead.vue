<script setup lang="ts">
// A Settings page's head (docs/window.md, Settings): where the page is in the nav, and what acts on it at its end.
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';

defineOptions({ inheritAttrs: false }); // its attributes are its title's (an id to find it by)
defineProps<{ section?: string; title: string }>();
</script>

<template>
  <header class="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 bg-background">
    <Breadcrumb class="min-w-0 flex-1">
      <BreadcrumbList class="flex-nowrap">
        <template v-if="section"><BreadcrumbItem>{{ section }}</BreadcrumbItem><BreadcrumbSeparator /></template>
        <BreadcrumbItem class="min-w-0"><BreadcrumbPage class="truncate font-medium" v-bind="$attrs">{{ title }}</BreadcrumbPage></BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
    <slot />
  </header>
</template>
