<script setup>
import { ref, computed, onMounted } from 'vue';
import { useSessionStore } from '../stores/session';
import { useUserStore } from '../stores/user';
import APIService from '../services/api';
import { getTagForTask } from './taskTags';
import Identicon from './Identicon.vue';

const props = defineProps({
  task: { type: Object, required: true },
  tags: { type: Array, default: () => [] },
});

const emit = defineEmits(['close']);

const sessionStore = useSessionStore();
const userStore = useUserStore();
const comments = ref([]);
const loadingComments = ref(false);

const metadata = computed(() => props.task?.metadata);
const originalRow = computed(() => metadata.value?.originalRow);

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

const fields = computed(() => {
  if (!originalRow.value) return [];
  return Object.keys(originalRow.value)
    .filter((key) => {
      const value = originalRow.value[key];
      return value && (typeof value === 'string' ? value.trim() : value);
    })
    .sort();
});

const hasExtras = computed(
  () => fields.value.length > 0 || comments.value.length > 0
);

onMounted(async () => {
  if (sessionStore.roomCode) {
    loadingComments.value = true;
    try {
      comments.value = await APIService.getTaskComments(
        sessionStore.roomCode,
        props.task.id
      );
    } catch (err) {
      console.error('Error loading comments:', err);
    } finally {
      loadingComments.value = false;
    }
  }
});

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const displayId = computed(() => props.task.display_id || props.task.id);

// Find the column the task is in (for "Estimate" + "Move to" highlighting)
const currentColumn = computed(() => {
  const cols = sessionStore.displayColumns || [];
  return cols.find((c) => c.id === props.task.column_id) || null;
});

const currentColumnIndex = computed(() => {
  const cols = (sessionStore.displayColumns || [])
    .slice()
    .sort((a, b) => (a.column_order || 0) - (b.column_order || 0));
  return cols.findIndex((c) => c.id === props.task.column_id);
});

const sortedColumns = computed(() =>
  (sessionStore.displayColumns || [])
    .slice()
    .sort((a, b) => (a.column_order || 0) - (b.column_order || 0))
);

const isMyTurn = computed(() => sessionStore.isMyTurn);

function handleMoveTo(columnId) {
  if (!isMyTurn.value) return;
  if (columnId === props.task.column_id) return;
  sessionStore.moveTaskToColumn(
    String(props.task.id),
    columnId,
    userStore.userId
  );
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center"
    :style="{ background: 'rgba(10,10,10,0.55)', backdropFilter: 'blur(2px)' }"
    @click.self="emit('close')"
  >
    <div
      class="mx-4 flex w-full max-w-[720px] flex-col sm-card sm-shadow-hard"
      style="max-height: 720px"
    >
      <!-- Header -->
      <div
        class="flex items-center justify-between px-6 py-4"
        :style="{ borderBottom: '1px solid var(--sm-border)' }"
      >
        <div class="flex items-center gap-3">
          <span
            class="px-2 py-0.5 font-mono text-[11px] font-bold tracking-[0.04em]"
            :style="{
              color: 'var(--sm-ink)',
              background: 'var(--sm-card-alt)',
              border: '1px solid var(--sm-border)',
              borderRadius: '1px',
            }"
            >{{ displayId }}</span
          >
          <span class="sm-label">Task detail</span>
        </div>
        <button
          @click="emit('close')"
          class="flex h-7 w-7 items-center justify-center font-mono text-[13px]"
          :style="{
            background: 'transparent',
            border: '1px solid var(--sm-border)',
            borderRadius: '2px',
            color: 'var(--sm-muted)',
          }"
        >
          ✕
        </button>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto px-6 py-5" style="min-height: 0">
        <h2
          class="text-[22px] font-bold leading-[1.25] tracking-[-0.02em]"
          :style="{ color: 'var(--sm-ink)' }"
        >
          {{ task.title || 'Untitled task' }}
        </h2>

        <!-- Tag + meta row -->
        <div
          class="mt-3.5 flex items-center gap-2.5 pb-4"
          :style="{ borderBottom: '1px solid var(--sm-hairline)' }"
        >
          <span
            v-if="taskTag"
            class="sm-tag-pill"
            :style="{
              color: tagColorVar,
              background: 'transparent',
              border: '1px solid currentColor',
            }"
          >
            <span
              class="block h-1.5 w-1.5"
              :style="{ background: tagColorVar }"
            ></span>
            {{ taskTag.name }}
          </span>
          <span class="flex-1"></span>
        </div>

        <!-- Two-col body -->
        <div
          class="mt-5 grid gap-7"
          :style="{ gridTemplateColumns: '1fr 200px' }"
        >
          <!-- Left: description + extras -->
          <div>
            <div v-if="task.description">
              <span class="sm-label">Description</span>
              <p
                class="mt-2 whitespace-pre-wrap text-sm leading-[1.6]"
                :style="{ color: 'var(--sm-text)' }"
              >
                {{ task.description }}
              </p>
            </div>
            <p
              v-else
              class="text-sm italic"
              :style="{ color: 'var(--sm-subtle)' }"
            >
              No description.
            </p>

            <!-- Additional metadata fields -->
            <div v-if="fields.length > 0" class="mt-6">
              <span class="sm-label">Metadata</span>
              <div class="mt-2 flex flex-col gap-2">
                <div
                  v-for="key in fields"
                  :key="key"
                  class="flex gap-3 py-1.5"
                  :style="{ borderBottom: '1px solid var(--sm-hairline)' }"
                >
                  <div
                    class="min-w-[120px] font-mono text-[10.5px] uppercase tracking-[0.04em]"
                    :style="{ color: 'var(--sm-muted)' }"
                  >
                    {{ String(key) }}
                  </div>
                  <div
                    class="flex-1 break-words text-[12.5px]"
                    :style="{ color: 'var(--sm-text)' }"
                  >
                    {{ String(originalRow[key]) }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Comments / Discussion -->
            <div v-if="comments.length > 0 || loadingComments" class="mt-7">
              <div class="mb-3 flex items-baseline justify-between">
                <span class="sm-label">Discussion</span>
                <span
                  class="font-mono text-[10px]"
                  :style="{ color: 'var(--sm-subtle)' }"
                  >{{ comments.length }}
                  {{ comments.length === 1 ? 'message' : 'messages' }}</span
                >
              </div>
              <div v-if="loadingComments" class="py-2">
                <span class="sm-label">Loading…</span>
              </div>
              <div v-else class="flex flex-col gap-3.5">
                <div
                  v-for="c in comments"
                  :key="c.id"
                  class="flex items-start gap-2.5"
                >
                  <div
                    class="h-6 w-6 flex-shrink-0 overflow-hidden"
                    :style="{ borderRadius: '2px' }"
                  >
                    <Identicon
                      :seed="c.user_id || c.user_name"
                      class="block h-full w-full"
                    />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="mb-0.5 flex items-baseline gap-2">
                      <span
                        class="text-[12.5px] font-semibold tracking-[-0.005em]"
                        :style="{ color: 'var(--sm-ink)' }"
                        >{{ c.user_name }}</span
                      >
                      <span
                        class="font-mono text-[10px]"
                        :style="{ color: 'var(--sm-subtle)' }"
                        >{{ formatTime(c.created_at) }}</span
                      >
                    </div>
                    <div
                      class="text-[13px] leading-[1.5]"
                      :style="{ color: 'var(--sm-text)' }"
                    >
                      {{ c.content }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right meta -->
          <div class="flex flex-col gap-4">
            <div v-if="currentColumn">
              <span class="sm-label">Estimate</span>
              <div
                class="mt-2 flex items-baseline gap-1.5 px-4 py-3"
                :style="{
                  background: 'var(--sm-active-row)',
                  border: '1px solid var(--sm-accent)',
                  borderRadius: '2px',
                }"
              >
                <span
                  class="font-mono text-[32px] font-bold leading-none tracking-[-0.03em]"
                  :style="{ color: 'var(--sm-ink)' }"
                  >{{ currentColumn.point_value ?? '—' }}</span
                >
                <span
                  class="font-mono text-[11px] font-semibold uppercase tracking-[0.08em]"
                  :style="{ color: 'var(--sm-muted)' }"
                  >points</span
                >
              </div>
            </div>

            <div v-if="sortedColumns.length > 0">
              <span class="sm-label">Move to</span>
              <div
                class="mt-2 grid overflow-hidden"
                :style="{
                  gridTemplateColumns: `repeat(${sortedColumns.length}, 1fr)`,
                  border: '1px solid var(--sm-border)',
                  borderRadius: '2px',
                }"
              >
                <button
                  v-for="(col, i) in sortedColumns"
                  :key="col.id"
                  @click="handleMoveTo(col.id)"
                  :disabled="!isMyTurn"
                  class="flex flex-col items-center gap-0.5 py-3 transition-colors"
                  :style="{
                    background:
                      col.id === task.column_id
                        ? 'var(--sm-accent)'
                        : 'transparent',
                    color:
                      col.id === task.column_id ? '#0a0a0a' : 'var(--sm-text)',
                    borderRight:
                      i === sortedColumns.length - 1
                        ? '0'
                        : '1px solid var(--sm-border)',
                    cursor: isMyTurn ? 'pointer' : 'not-allowed',
                    opacity: isMyTurn ? 1 : 0.6,
                  }"
                >
                  <span
                    class="font-mono text-[16px] font-bold tracking-[-0.02em]"
                    >{{ col.point_value ?? col.name?.[0] ?? '·' }}</span
                  >
                  <span
                    class="font-mono text-[8.5px] font-semibold uppercase tracking-[0.08em]"
                    :style="{ opacity: col.id === task.column_id ? 0.7 : 0.5 }"
                    >pt</span
                  >
                </button>
              </div>
            </div>

            <div v-if="task.jira_key">
              <span class="sm-label">Jira key</span>
              <div
                class="mt-2 font-mono text-[12px] font-semibold"
                :style="{ color: 'var(--sm-ink)' }"
              >
                {{ task.jira_key }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div
        class="flex items-center justify-between px-6 py-3"
        :style="{
          background: 'var(--sm-card-alt)',
          borderTop: '1px solid var(--sm-border)',
        }"
      >
        <span
          class="font-mono text-[10.5px]"
          :style="{ color: 'var(--sm-muted)' }"
        >
          <span :style="{ color: 'var(--sm-ink)', fontWeight: 600 }">esc</span>
          close
        </span>
        <button @click="emit('close')" class="sm-btn">Close</button>
      </div>
    </div>
  </div>
</template>
