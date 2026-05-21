<script setup>
import { computed } from 'vue';
import { buildJiraUrl, detectJiraBaseUrl } from '../utils/jiraUrlBuilder';
import { getTagColorClasses, getTagForTask } from './taskTags';

const props = defineProps({
  task: { type: Object, required: true },
  jiraBaseUrl: { type: String, default: null },
  tags: { type: Array, default: () => [] },
  showInfo: { type: Boolean, default: false },
  highlighted: { type: Boolean, default: false },
  // The most recently pointed card — draws an accent ring so everyone can
  // see what was just placed, even when it isn't their turn.
  lastPointed: { type: Boolean, default: false },
  dragDisabled: { type: Boolean, default: false },
});

const emit = defineEmits(['openActionModal', 'showInfo']);

const taskTag = computed(() => getTagForTask(props.task, props.tags));
const tagColorVar = computed(() => {
  const tag = taskTag.value;
  if (!tag) return null;
  const map = {
    yellow: 'var(--sm-tag-yellow)',
    green: 'var(--sm-tag-green)',
    red: 'var(--sm-tag-red)',
    blue: 'var(--sm-tag-blue)',
    purple: 'var(--sm-tag-purple)',
    orange: 'var(--sm-tag-orange)',
    pink: 'var(--sm-tag-pink)',
    cyan: 'var(--sm-tag-cyan)',
  };
  return map[tag.color] || 'var(--sm-tag-blue)';
});

const displayId = computed(() => props.task.display_id || props.task.id);

const truncatedTagName = computed(() => {
  if (!taskTag.value) return '';
  const name = taskTag.value.name;
  return name.length > 14 ? name.slice(0, 13) + '…' : name;
});

const jiraUrl = computed(() => {
  const baseUrl = props.jiraBaseUrl || detectJiraBaseUrl(displayId.value);
  return buildJiraUrl(baseUrl, displayId.value);
});

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
    class="group relative px-3 py-2.5 transition-all"
    :class="[
      dragDisabled
        ? 'cursor-default no-drag'
        : 'cursor-grab active:cursor-grabbing',
    ]"
    :data-highlighted="highlighted ? 'true' : undefined"
    :style="{
      background: 'var(--sm-card)',
      border:
        highlighted || lastPointed
          ? '1.5px solid var(--sm-accent)'
          : '1px solid var(--sm-border)',
      borderRadius: '2px',
      boxShadow: highlighted
        ? '4px 4px 0 var(--sm-accent)'
        : lastPointed
          ? '0 0 0 2px var(--sm-accent)'
          : 'none',
      opacity: 1,
    }"
  >
    <!-- Tag color stripe -->
    <div
      v-if="taskTag"
      class="absolute left-0 top-0 bottom-0 w-[3px]"
      :style="{ background: tagColorVar }"
    ></div>

    <!-- Hover icons (top-right) -->
    <div
      class="absolute top-1.5 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
    >
      <button
        v-if="!taskTag"
        class="no-drag"
        :style="{ color: 'var(--sm-subtle)' }"
        title="Add tag"
        @pointerdown.stop
        @click.prevent.stop="emit('openActionModal', { task, tab: 'tags' })"
      >
        <svg
          class="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"
          />
        </svg>
      </button>
      <button
        class="no-drag flex items-center gap-0.5"
        :style="{ color: 'var(--sm-muted)' }"
        title="Comments"
        @pointerdown.stop
        @click.prevent.stop="emit('openActionModal', { task, tab: 'comments' })"
      >
        <svg
          class="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <span v-if="task.comment_count > 0" class="font-mono text-[10px]">{{
          task.comment_count
        }}</span>
      </button>
      <button
        class="no-drag font-mono text-[14px] leading-none"
        :style="{ color: 'var(--sm-muted)' }"
        title="Task settings"
        @pointerdown.stop
        @click.prevent.stop="emit('openActionModal', { task, tab: 'settings' })"
      >
        ⚙
      </button>
    </div>

    <!-- ID row -->
    <div class="flex items-baseline justify-between gap-2 pr-12">
      <a
        v-if="jiraUrl"
        :href="jiraUrl"
        class="no-drag font-mono text-[10px] font-semibold uppercase tracking-[0.04em] hover:underline whitespace-nowrap flex-shrink-0"
        :style="{
          color: highlighted ? 'var(--sm-accent)' : 'var(--sm-muted)',
        }"
        :title="`Open ${displayId} in Jira`"
        target="_blank"
        rel="noopener noreferrer"
        @click="openJira"
        @pointerdown.stop
        @mousedown.stop
        >{{ displayId }}</a
      >
      <span
        v-else
        class="font-mono text-[10px] font-semibold uppercase tracking-[0.04em] whitespace-nowrap flex-shrink-0"
        :style="{
          color: highlighted ? 'var(--sm-accent)' : 'var(--sm-muted)',
        }"
        >{{ displayId }}</span
      >
    </div>

    <!-- Title -->
    <div
      v-if="task.title"
      class="mt-1.5 break-words text-[12.5px] font-medium leading-[1.38] tracking-[-0.005em] line-clamp-3"
      :style="{ color: 'var(--sm-text)' }"
    >
      {{ task.title }}
    </div>

    <!-- Bottom row -->
    <div v-if="taskTag || showInfo" class="mt-2 flex items-center gap-2">
      <button
        v-if="showInfo"
        class="no-drag font-mono text-[9.5px] uppercase tracking-[0.08em] hover:underline"
        :style="{ color: 'var(--sm-subtle)' }"
        title="View task details"
        @pointerdown.stop
        @click.prevent.stop="emit('showInfo', task)"
      >
        details
      </button>

      <button
        v-if="taskTag"
        class="no-drag ml-auto flex items-center gap-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.06em] hover:opacity-80"
        :style="{ color: 'var(--sm-muted)' }"
        :title="taskTag.name"
        @pointerdown.stop
        @click.prevent.stop="emit('openActionModal', { task, tab: 'tags' })"
      >
        <span
          class="block h-1.5 w-1.5 flex-shrink-0"
          :style="{ background: tagColorVar }"
        ></span>
        {{ truncatedTagName }}
      </button>
    </div>
  </div>
</template>
