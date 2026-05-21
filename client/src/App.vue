<script setup>
import { useThemeStore } from './stores/theme';

const themeStore = useThemeStore();
</script>

<template>
  <div class="min-h-screen bg-[var(--sm-surface)] text-[var(--sm-text)]">
    <router-view />
  </div>
</template>
