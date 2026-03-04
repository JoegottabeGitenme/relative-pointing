<script setup>
import { computed } from 'vue';
import { buildJiraUrl, detectJiraBaseUrl } from '../utils/jiraUrlBuilder';
import { getColorClasses, COLOR_OPTIONS } from './taskColors';

const props = defineProps({
  task: {
    type: Object,
    required: true,
  },
  jiraBaseUrl: {
    type: String,
    default: null,
  },
  showDelete: {
    type: Boolean,
    default: false,
  },
  showColor: {
    type: Boolean,
    default: false,
  },
  showInfo: {
    type: Boolean,
    default: false,
  },
  dimmed: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['deleteTask', 'updateColor', 'showInfo']);

const colorClasses = computed(() => getColorClasses(props.task.color_tag));

const displayId = computed(() => props.task.display_id || props.task.id);

const jiraUrl = computed(() => {
  const baseUrl = props.jiraBaseUrl || detectJiraBaseUrl(displayId.value);
  return buildJiraUrl(baseUrl, displayId.value);
});

function handleDelete() {
  emit('deleteTask', props.task.id);
}

function handleColorSelect(colorId) {
  emit('updateColor', props.task.id, colorId);
}

function openJira(e) {
  e.preventDefault();
  e.stopPropagation();
  if (jiraUrl.value) {
    window.open(jiraUrl.value, '_blank', 'noopener,noreferrer');
  }
}
</script>

<template>
  <div
    :class="[
      'p-3 rounded-lg shadow-sm transition-all group relative',
      'bg-white dark:glass-card',
      dimmed
        ? 'opacity-40 pointer-events-none'
        : 'cursor-grab active:cursor-grabbing hover:shadow-md dark:hover:shadow-card-hover',
      task.color_tag
        ? `border-l-4 ${colorClasses.border}`
        : 'border-l-4 border-transparent',
    ]"
  >
    <div class="flex items-start justify-between gap-2">
      <div class="flex-1 min-w-0">
        <a
          v-if="jiraUrl"
          :href="jiraUrl"
          class="no-drag text-sm font-medium text-blue-600 dark:neon-text-cyan hover:text-blue-800 dark:hover:text-cyan-200 hover:underline break-words"
          :title="`Open ${displayId} in Jira`"
          target="_blank"
          rel="noopener noreferrer"
          @click="openJira"
          @pointerdown.stop
          @mousedown.stop
        >
          {{ displayId }}
        </a>
        <p
          v-else
          class="text-sm font-medium text-gray-800 dark:text-gray-100 break-words"
        >
          {{ displayId }}
        </p>
        <p
          v-if="task.title"
          class="text-xs text-gray-600 dark:text-gray-400 mt-1 break-words line-clamp-2"
        >
          {{ task.title }}
        </p>
      </div>
    </div>
    <div
      v-if="showDelete"
      class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
    >
      <button
        class="no-drag flex-shrink-0 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
        title="Delete task"
        aria-label="Delete task"
        @pointerdown.stop
        @click.stop="handleDelete"
      >
        ✕
      </button>
    </div>
    <!-- Inline color pills + details -->
    <div class="flex items-center gap-2 mt-2 flex-wrap">
      <template v-if="showColor">
        <button
          v-for="color in COLOR_OPTIONS"
          :key="color.id || 'none'"
          class="no-drag px-1.5 py-0.5 rounded-full text-[10px] font-medium transition-all cursor-pointer hover:scale-105"
          :class="task.color_tag === color.id ? color.pillActive : color.pill"
          :title="color.name"
          @pointerdown.stop
          @click.prevent.stop="handleColorSelect(color.id)"
        >
          {{ color.name }}
        </button>
      </template>
      <button
        v-if="showInfo"
        class="no-drag text-xs text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-neon-cyan transition-colors ml-auto"
        title="View task details"
        @pointerdown.stop
        @click.prevent.stop="emit('showInfo', task)"
      >
        details
      </button>
    </div>
  </div>
</template>
