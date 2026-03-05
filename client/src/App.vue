<script setup>
import { useThemeStore } from './stores/theme';

const themeStore = useThemeStore();
</script>

<template>
  <div
    class="min-h-screen bg-gray-50 dark:bg-neon-bg-900 transition-colors neon-grid-bg"
  >
    <router-view />
  </div>
</template>
