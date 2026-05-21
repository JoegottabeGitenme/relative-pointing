<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useThemeStore } from '../stores/theme';
import APIService from '../services/api';
import { buildJiraUrl, detectJiraBaseUrl } from '../utils/jiraUrlBuilder';
import Version from './Version.vue';
import Identicon from './Identicon.vue';

const route = useRoute();
const router = useRouter();
const themeStore = useThemeStore();

const roomCode = computed(() => route.params.roomCode);
const loading = ref(true);
const error = ref(null);

const session = ref(null);
const participants = ref([]);
const columns = ref([]);
const tasks = ref([]);
const tags = ref([]);
const selectedScale = ref('fibonacci');

const userId = localStorage.getItem('userId');
const isCreator = computed(() => userId === session.value?.creator_id);

const SCALE_OPTIONS = [
  { value: 'fibonacci', label: 'Fibonacci (1, 2, 3, 5, 8, 13...)' },
  { value: 'powers_of_2', label: 'Powers of 2 (1, 2, 4, 8, 16...)' },
  { value: 'tshirt', label: 'T-Shirt (1, 2, 3, 5, 8, 13)' },
  { value: 'linear', label: 'Linear (1, 2, 3, 4, 5...)' },
];

const sortedColumns = computed(() =>
  [...columns.value].sort(
    (a, b) => (a.column_order || 0) - (b.column_order || 0)
  )
);

const unsortedTasks = computed(() =>
  tasks.value.filter((t) => t.column_id === 'unsorted' || !t.column_id)
);

function tasksForColumn(columnId) {
  return tasks.value.filter((t) => t.column_id === columnId);
}

// ---------------------------------------------------------------------------
// Hide toggles — per-task and per-column. Hidden tasks are dimmed (opacity-40)
// and excluded from totals and the CSV export, letting the host curate the
// final report without deleting anything.
// ---------------------------------------------------------------------------
const hiddenTaskIds = ref(new Set());
const hiddenColumnIds = ref(new Set());

function toggleTaskHidden(taskId) {
  const id = String(taskId);
  const next = new Set(hiddenTaskIds.value);
  next.has(id) ? next.delete(id) : next.add(id);
  hiddenTaskIds.value = next;
}

function toggleColumnHidden(columnId) {
  const next = new Set(hiddenColumnIds.value);
  next.has(columnId) ? next.delete(columnId) : next.add(columnId);
  hiddenColumnIds.value = next;
}

function isColumnHidden(columnId) {
  return hiddenColumnIds.value.has(columnId);
}

function isTaskHidden(task) {
  return (
    hiddenTaskIds.value.has(String(task.id)) ||
    hiddenColumnIds.value.has(task.column_id)
  );
}

// ---------------------------------------------------------------------------
// Jira deep links — prefer the session's configured base URL, otherwise fall
// back to guessing it from the issue key. Returns null when neither yields a
// valid URL, in which case the template renders plain text.
// ---------------------------------------------------------------------------
function jiraUrlFor(task) {
  const key = task.display_id || task.jira_key || task.id;
  const base = session.value?.jira_base_url ?? detectJiraBaseUrl(key);
  return buildJiraUrl(base, key);
}

function commentsFor(task) {
  return task.comments || [];
}

function getTagForTask(task) {
  if (!task.tag_id) return null;
  return tags.value.find((t) => t.id === task.tag_id);
}

const TAG_COLOR_VARS = {
  yellow: 'var(--sm-tag-yellow)',
  green: 'var(--sm-tag-green)',
  red: 'var(--sm-tag-red)',
  blue: 'var(--sm-tag-blue)',
  purple: 'var(--sm-tag-purple)',
  orange: 'var(--sm-tag-orange)',
  pink: 'var(--sm-tag-pink)',
  cyan: 'var(--sm-tag-cyan)',
};

function tagColorVar(tag) {
  if (!tag) return null;
  return TAG_COLOR_VARS[tag.color] || 'var(--sm-tag-blue)';
}

const sessionDuration = computed(() => {
  if (!session.value?.created_at || !session.value?.ended_at) return '';
  const start = new Date(session.value.created_at + 'Z');
  const end = new Date(session.value.ended_at + 'Z');
  const diffMs = end - start;
  const totalSeconds = Math.floor(diffMs / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
});

const totalPoints = computed(() => {
  let total = 0;
  for (const col of sortedColumns.value) {
    if (isColumnHidden(col.id)) continue;
    const count = tasksForColumn(col.id).filter((t) => !isTaskHidden(t)).length;
    total += (col.point_value || 0) * count;
  }
  return total;
});

const tasksPointed = computed(() => {
  return tasks.value.filter(
    (t) => t.column_id && t.column_id !== 'unsorted' && !isTaskHidden(t)
  ).length;
});

const maxColumnCount = computed(() => {
  let max = 0;
  for (const col of sortedColumns.value) {
    max = Math.max(max, tasksForColumn(col.id).length);
  }
  return Math.max(max, 1);
});

// Sortable pointed-tasks table
const sortKey = ref('points');
const sortDir = ref('desc');

const pointedRows = computed(() => {
  const rows = [];
  for (const col of sortedColumns.value) {
    for (const t of tasksForColumn(col.id)) {
      rows.push({ ...t, columnName: col.name, points: col.point_value || 0 });
    }
  }
  rows.sort((a, b) => {
    let av, bv;
    if (sortKey.value === 'id') {
      av = String(a.display_id || a.id);
      bv = String(b.display_id || b.id);
    } else if (sortKey.value === 'title') {
      av = (a.title || '').toLowerCase();
      bv = (b.title || '').toLowerCase();
    } else if (sortKey.value === 'column') {
      av = a.points;
      bv = b.points;
    } else {
      av = a.points;
      bv = b.points;
    }
    if (av < bv) return sortDir.value === 'asc' ? -1 : 1;
    if (av > bv) return sortDir.value === 'asc' ? 1 : -1;
    return 0;
  });
  return rows;
});

function handleSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = key;
    sortDir.value = key === 'id' || key === 'title' ? 'asc' : 'desc';
  }
}

async function fetchReport() {
  try {
    const data = await APIService.getReport(roomCode.value);
    session.value = data.session;
    participants.value = data.participants || [];
    columns.value = data.columns || [];
    tasks.value = data.tasks || [];
    tags.value = data.tags || [];
    error.value = null;
  } catch (err) {
    error.value = err.message || 'Failed to load report';
  } finally {
    loading.value = false;
  }
}

async function handleApplyScale() {
  try {
    const result = await APIService.applyScale(
      roomCode.value,
      userId,
      selectedScale.value
    );
    if (result.columns) {
      columns.value = result.columns;
    }
  } catch (err) {
    console.error('Error applying scale:', err);
  }
}

async function handlePointValueChange(columnId, value) {
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return;

  columns.value = columns.value.map((c) =>
    c.id === columnId ? { ...c, point_value: numValue } : c
  );

  try {
    await APIService.updateColumnPointValue(
      roomCode.value,
      columnId,
      userId,
      numValue
    );
  } catch (err) {
    console.error('Error updating point value:', err);
    await fetchReport();
  }
}

function exportCSV() {
  const header = ['ID', 'Title', 'Column', 'Points', 'Tag'];
  const rows = pointedRows.value
    .filter((r) => !isTaskHidden(r))
    .map((r) => [
      r.display_id || r.id,
      r.title || '',
      r.columnName,
      r.points,
      getTagForTask(r)?.name || '',
    ]);
  const csv = [header, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? '');
          if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return '"' + s.replace(/"/g, '""') + '"';
          }
          return s;
        })
        .join(',')
    )
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${roomCode.value}-report.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

onMounted(fetchReport);
</script>

<template>
  <!-- Loading -->
  <div
    v-if="loading"
    class="flex min-h-screen items-center justify-center"
    :style="{ background: 'var(--sm-surface)' }"
  >
    <span class="sm-label">Loading report…</span>
  </div>

  <!-- Error -->
  <div
    v-else-if="error"
    class="flex min-h-screen items-center justify-center"
    :style="{ background: 'var(--sm-surface)' }"
  >
    <div class="text-center">
      <p class="mb-4 text-base" :style="{ color: '#ef4444' }">{{ error }}</p>
      <router-link
        to="/"
        class="font-mono text-[11px] uppercase tracking-[0.08em] hover:underline"
        :style="{ color: 'var(--sm-ink)' }"
        >Go home →</router-link
      >
    </div>
  </div>

  <!-- Report -->
  <div
    v-else
    class="flex min-h-screen flex-col"
    :style="{ background: 'var(--sm-surface)' }"
  >
    <!-- Header -->
    <header
      class="flex items-center justify-between px-8 py-5"
      :style="{
        background: 'var(--sm-card)',
        borderBottom: '1px solid var(--sm-border)',
      }"
    >
      <div class="flex items-center gap-3.5 min-w-0">
        <button
          @click="router.push('/')"
          class="flex h-7 w-7 flex-shrink-0 items-center justify-center font-mono text-[13px] font-bold"
          :style="{
            background: 'var(--sm-ink)',
            color: 'var(--sm-surface)',
          }"
          title="Go to home"
        >
          ·
        </button>
        <div class="min-w-0">
          <div class="flex items-baseline gap-2">
            <span class="sm-label">Session report</span>
            <span class="text-[10.5px]" :style="{ color: 'var(--sm-subtle)' }"
              >·</span
            >
            <span
              class="font-mono text-[10.5px]"
              :style="{ color: 'var(--sm-muted)' }"
              >RP/{{ roomCode }}</span
            >
            <Version />
          </div>
          <h1
            class="mt-1 text-[22px] font-bold tracking-[-0.02em]"
            :style="{ color: 'var(--sm-ink)' }"
          >
            Refinement
          </h1>
        </div>
      </div>
      <div class="flex items-center gap-1.5">
        <button @click="exportCSV" class="sm-btn sm-btn-primary">
          Export CSV ↓
        </button>
        <button
          @click="themeStore.toggleTheme()"
          class="flex h-8 w-8 items-center justify-center text-[13px] sm-card"
        >
          {{ themeStore.isDark ? '☀' : '☾' }}
        </button>
      </div>
    </header>

    <!-- Body -->
    <div class="flex-1 overflow-y-auto p-7 lg:p-8">
      <div class="flex flex-col gap-6 lg:flex-row">
        <!-- Left: stats + distribution + participants -->
        <div class="flex w-full flex-col gap-5 lg:w-[420px] lg:flex-shrink-0">
          <!-- Stat cards -->
          <div class="grid grid-cols-2 gap-3">
            <div class="px-5 py-5 sm-card">
              <span class="sm-label">Tasks</span>
              <div class="mt-2 flex items-baseline gap-1.5">
                <span
                  class="font-mono text-[38px] font-bold leading-none tracking-[-0.03em]"
                  :style="{ color: 'var(--sm-ink)' }"
                  >{{ tasksPointed }}</span
                >
                <span
                  class="font-mono text-[13px] font-semibold uppercase tracking-[0.04em]"
                  :style="{ color: 'var(--sm-muted)' }"
                  >pointed</span
                >
              </div>
            </div>
            <div
              class="px-5 py-5"
              :style="{
                background: 'var(--sm-accent)',
                border: '1px solid var(--sm-accent)',
                borderRadius: '2px',
              }"
            >
              <span
                class="font-mono text-[10px] font-semibold uppercase tracking-[0.1em]"
                :style="{ color: '#0a0a0a', opacity: 0.7 }"
                >Total</span
              >
              <div class="mt-2 flex items-baseline gap-1.5">
                <span
                  class="font-mono text-[38px] font-bold leading-none tracking-[-0.03em]"
                  :style="{ color: '#0a0a0a' }"
                  >{{ totalPoints }}</span
                >
                <span
                  class="font-mono text-[13px] font-semibold uppercase tracking-[0.04em]"
                  :style="{ color: '#0a0a0a', opacity: 0.6 }"
                  >pts</span
                >
              </div>
            </div>
            <div class="px-5 py-5 sm-card">
              <span class="sm-label">Duration</span>
              <div class="mt-2 flex items-baseline gap-1.5">
                <span
                  class="font-mono text-[28px] font-bold leading-none tracking-[-0.03em]"
                  :style="{ color: 'var(--sm-ink)' }"
                  >{{ sessionDuration || '—' }}</span
                >
              </div>
            </div>
            <div class="px-5 py-5 sm-card">
              <span class="sm-label">Voters</span>
              <div class="mt-2 flex items-baseline gap-1.5">
                <span
                  class="font-mono text-[38px] font-bold leading-none tracking-[-0.03em]"
                  :style="{ color: 'var(--sm-ink)' }"
                  >{{ participants.length }}</span
                >
                <span
                  class="font-mono text-[13px] font-semibold uppercase tracking-[0.04em]"
                  :style="{ color: 'var(--sm-muted)' }"
                  >in room</span
                >
              </div>
            </div>
          </div>

          <!-- Scale picker (creator only) -->
          <div v-if="isCreator" class="px-5 py-5 sm-card">
            <span class="sm-label">Point scale</span>
            <div class="mt-3 flex flex-wrap items-center gap-2">
              <select
                v-model="selectedScale"
                class="sm-input flex-1 text-[12.5px]"
                style="padding: 8px 10px"
              >
                <option
                  v-for="option in SCALE_OPTIONS"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
              <button @click="handleApplyScale" class="sm-btn">Apply</button>
            </div>
          </div>

          <!-- Distribution -->
          <div class="px-5 py-5 sm-card">
            <div class="mb-4 flex items-baseline justify-between">
              <span class="sm-label">Distribution</span>
              <span
                class="font-mono text-[10px]"
                :style="{ color: 'var(--sm-subtle)' }"
                >by column</span
              >
            </div>
            <div class="flex flex-col gap-3.5">
              <div
                v-for="col in sortedColumns"
                :key="col.id"
                class="transition-opacity"
                :style="{ opacity: isColumnHidden(col.id) ? 0.4 : 1 }"
              >
                <div class="mb-1.5 flex items-baseline justify-between">
                  <div class="flex items-center gap-2">
                    <button
                      class="flex-shrink-0 self-center"
                      :style="{ color: 'var(--sm-subtle)' }"
                      :title="
                        isColumnHidden(col.id)
                          ? 'Show column in report'
                          : 'Hide column from report'
                      "
                      @click="toggleColumnHidden(col.id)"
                    >
                      <svg
                        v-if="!isColumnHidden(col.id)"
                        class="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                      <svg
                        v-else
                        class="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                        />
                      </svg>
                    </button>
                    <span
                      class="text-[12.5px] font-semibold tracking-[-0.005em]"
                      :style="{ color: 'var(--sm-text)' }"
                      >{{ col.name }}</span
                    >
                    <span v-if="isCreator" class="ml-1">
                      <input
                        type="number"
                        :value="col.point_value"
                        @change="
                          handlePointValueChange(col.id, $event.target.value)
                        "
                        class="px-1.5 py-0 font-mono text-[10.5px] font-bold w-14"
                        :style="{
                          background: 'var(--sm-accent)',
                          color: '#0a0a0a',
                          borderRadius: '1px',
                          border: 'none',
                        }"
                        step="any"
                      />
                    </span>
                    <span
                      v-else-if="
                        col.point_value !== null && col.point_value !== ''
                      "
                      class="font-mono text-[10.5px] font-bold px-1.5"
                      :style="{
                        background: 'var(--sm-accent)',
                        color: '#0a0a0a',
                        borderRadius: '1px',
                      }"
                      >{{ col.point_value }}pt</span
                    >
                  </div>
                  <span
                    class="font-mono text-[11px]"
                    :style="{ color: 'var(--sm-muted)' }"
                    >{{ tasksForColumn(col.id).length }}
                    {{
                      tasksForColumn(col.id).length === 1 ? 'task' : 'tasks'
                    }}</span
                  >
                </div>
                <div
                  class="h-2"
                  :style="{
                    background: 'var(--sm-card-alt)',
                    border: '1px solid var(--sm-border)',
                    borderRadius: '1px',
                  }"
                >
                  <div
                    class="h-full transition-[width] duration-300"
                    :style="{
                      width: `${(tasksForColumn(col.id).length / maxColumnCount) * 100}%`,
                      background: 'var(--sm-ink)',
                    }"
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Participants -->
          <div class="px-5 py-5 sm-card">
            <span class="sm-label">Participants</span>
            <div class="mt-3.5 flex flex-col gap-2.5">
              <div
                v-for="(p, i) in participants"
                :key="p.id"
                class="flex items-center gap-2.5"
              >
                <span
                  class="w-4 font-mono text-[10px]"
                  :style="{ color: 'var(--sm-subtle)' }"
                  >{{ String(i + 1).padStart(2, '0') }}</span
                >
                <div
                  class="flex-shrink-0 overflow-hidden"
                  :style="{
                    width: '22px',
                    height: '22px',
                    borderRadius: '2px',
                  }"
                >
                  <Identicon :seed="p.user_id" class="block h-full w-full" />
                </div>
                <span
                  class="flex-1 text-[13px] font-medium tracking-[-0.005em]"
                  :style="{ color: 'var(--sm-text)' }"
                  >{{ p.user_name }}</span
                >
                <span
                  v-if="p.user_id === session?.creator_id"
                  class="font-mono text-[9.5px] font-bold uppercase tracking-[0.08em]"
                  :style="{ color: 'var(--sm-muted)' }"
                  >★ host</span
                >
              </div>
            </div>
          </div>
        </div>

        <!-- Right: pointed-tasks table -->
        <div
          class="flex flex-1 flex-col overflow-hidden sm-card"
          style="min-width: 0"
        >
          <div
            class="flex items-baseline justify-between px-5 py-4"
            :style="{ borderBottom: '1px solid var(--sm-border)' }"
          >
            <span class="sm-label">Pointed tasks</span>
            <span
              class="font-mono text-[11px]"
              :style="{ color: 'var(--sm-muted)' }"
              >{{ pointedRows.length }} rows</span
            >
          </div>

          <!-- Sortable header -->
          <div
            class="grid items-center gap-4 px-5 py-2.5"
            :style="{
              background: 'var(--sm-card-alt)',
              borderBottom: '1px solid var(--sm-border)',
              gridTemplateColumns: '130px 1fr 110px 80px',
            }"
          >
            <button
              v-for="h in [
                { key: 'id', label: 'ID', align: 'left' },
                { key: 'title', label: 'Title', align: 'left' },
                { key: 'column', label: 'Column', align: 'left' },
                { key: 'points', label: 'Points', align: 'right' },
              ]"
              :key="h.key"
              @click="handleSort(h.key)"
              class="inline-flex cursor-pointer items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em]"
              :style="{
                background: 'transparent',
                border: 0,
                padding: 0,
                color: sortKey === h.key ? 'var(--sm-ink)' : 'var(--sm-muted)',
                justifyContent: h.align === 'right' ? 'flex-end' : 'flex-start',
              }"
            >
              <span>{{ h.label }}</span>
              <span
                class="text-[9px]"
                :style="{
                  color:
                    sortKey === h.key ? 'var(--sm-accent)' : 'var(--sm-muted)',
                  opacity: sortKey === h.key ? 1 : 0.35,
                }"
                >{{
                  sortKey === h.key ? (sortDir === 'asc' ? '▲' : '▼') : '↕'
                }}</span
              >
            </button>
          </div>

          <!-- Rows -->
          <div class="flex-1 overflow-y-auto">
            <div
              v-for="r in pointedRows"
              :key="r.id"
              class="grid items-start gap-4 px-5 py-3 transition-opacity"
              :style="{
                gridTemplateColumns: '130px 1fr 110px 80px',
                borderBottom: '1px solid var(--sm-hairline)',
                opacity: isTaskHidden(r) ? 0.4 : 1,
              }"
            >
              <div class="flex items-center gap-1.5 min-w-0">
                <button
                  class="flex-shrink-0"
                  :style="{ color: 'var(--sm-subtle)' }"
                  :title="
                    isTaskHidden(r) ? 'Show in report' : 'Hide from report'
                  "
                  @click="toggleTaskHidden(r.id)"
                >
                  <svg
                    v-if="!isTaskHidden(r)"
                    class="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                  <svg
                    v-else
                    class="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                    />
                  </svg>
                </button>
                <a
                  v-if="jiraUrlFor(r)"
                  :href="jiraUrlFor(r)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="truncate font-mono text-[11px] font-semibold tracking-[0.02em] hover:underline"
                  :style="{ color: 'var(--sm-ink)' }"
                  :title="`Open ${r.display_id || r.id} in Jira`"
                  >{{ r.display_id || r.id }}</a
                >
                <span
                  v-else
                  class="truncate font-mono text-[11px] font-semibold tracking-[0.02em]"
                  :style="{ color: 'var(--sm-ink)' }"
                  >{{ r.display_id || r.id }}</span
                >
              </div>
              <div class="min-w-0">
                <div
                  class="truncate text-[12.5px] font-medium tracking-[-0.005em]"
                  :style="{ color: 'var(--sm-text)' }"
                >
                  {{ r.title || '—' }}
                </div>
                <div
                  v-if="getTagForTask(r)"
                  class="mt-1 flex items-center gap-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.06em]"
                  :style="{ color: 'var(--sm-muted)' }"
                >
                  <span
                    class="block h-1.5 w-1.5 flex-shrink-0"
                    :style="{ background: tagColorVar(getTagForTask(r)) }"
                  ></span>
                  {{ getTagForTask(r).name }}
                </div>
                <!-- Comments -->
                <div v-if="commentsFor(r).length" class="mt-1.5">
                  <div
                    class="font-mono text-[9.5px] font-semibold uppercase tracking-[0.08em]"
                    :style="{ color: 'var(--sm-subtle)' }"
                  >
                    Comments ({{ commentsFor(r).length }})
                  </div>
                  <div
                    v-for="c in commentsFor(r)"
                    :key="c.id"
                    class="mt-1 text-[11.5px] leading-[1.4]"
                    :style="{ color: 'var(--sm-muted)' }"
                  >
                    <span
                      class="font-semibold"
                      :style="{ color: 'var(--sm-text)' }"
                      >{{ c.user_name }}:</span
                    >
                    {{ c.content }}
                  </div>
                </div>
              </div>
              <span
                class="text-[12px] tracking-[-0.005em]"
                :style="{ color: 'var(--sm-muted)' }"
                >{{ r.columnName }}</span
              >
              <span
                class="text-right font-mono text-[13px] font-bold"
                :style="{ color: 'var(--sm-ink)' }"
                >{{ r.points
                }}<span
                  class="ml-0.5 font-mono text-[10px] font-semibold"
                  :style="{ color: 'var(--sm-muted)' }"
                  >pt</span
                ></span
              >
            </div>
            <div v-if="pointedRows.length === 0" class="py-10 text-center">
              <span class="sm-label">No pointed tasks</span>
            </div>
          </div>

          <!-- Footer total -->
          <div
            class="grid items-baseline gap-4 px-5 py-3.5"
            :style="{
              background: 'var(--sm-card-alt)',
              borderTop: '2px solid var(--sm-ink)',
              gridTemplateColumns: '130px 1fr 110px 80px',
            }"
          >
            <span class="sm-label">Total</span>
            <span class="text-[12px]" :style="{ color: 'var(--sm-muted)' }"
              >{{ pointedRows.length }} tasks across
              {{ sortedColumns.length }} columns</span
            >
            <span></span>
            <span
              class="text-right font-mono text-[16px] font-bold"
              :style="{ color: 'var(--sm-ink)' }"
              >{{ totalPoints
              }}<span
                class="ml-0.5 font-mono text-[11px] font-semibold"
                :style="{ color: 'var(--sm-muted)' }"
                >pt</span
              ></span
            >
          </div>
        </div>
      </div>

      <!-- Unsorted (if any) -->
      <div v-if="unsortedTasks.length > 0" class="mt-6 px-5 py-5 sm-card">
        <div class="mb-3 flex items-baseline justify-between">
          <span class="sm-label">Unsorted ({{ unsortedTasks.length }})</span>
          <span
            class="font-mono text-[10px]"
            :style="{ color: 'var(--sm-subtle)' }"
            >not assigned to a column</span
          >
        </div>
        <div class="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="t in unsortedTasks"
            :key="t.id"
            class="px-3 py-2 sm-card-alt"
          >
            <div class="flex items-baseline justify-between gap-2">
              <a
                v-if="jiraUrlFor(t)"
                :href="jiraUrlFor(t)"
                target="_blank"
                rel="noopener noreferrer"
                class="font-mono text-[10px] font-semibold uppercase tracking-[0.04em] hover:underline"
                :style="{ color: 'var(--sm-muted)' }"
                :title="`Open ${t.display_id || t.id} in Jira`"
                >{{ t.display_id || t.id }}</a
              >
              <span
                v-else
                class="font-mono text-[10px] font-semibold uppercase tracking-[0.04em]"
                :style="{ color: 'var(--sm-muted)' }"
                >{{ t.display_id || t.id }}</span
              >
              <span
                v-if="getTagForTask(t)"
                class="flex items-center gap-1 font-mono text-[9px] uppercase"
                :style="{ color: 'var(--sm-muted)' }"
              >
                <span
                  class="block h-1.5 w-1.5"
                  :style="{ background: tagColorVar(getTagForTask(t)) }"
                ></span>
                {{ getTagForTask(t).name }}
              </span>
            </div>
            <div
              class="mt-1 truncate text-[12.5px] font-medium tracking-[-0.005em]"
              :style="{ color: 'var(--sm-text)' }"
            >
              {{ t.title || '—' }}
            </div>
            <!-- Comments -->
            <div v-if="commentsFor(t).length" class="mt-1.5">
              <div
                class="font-mono text-[9px] font-semibold uppercase tracking-[0.08em]"
                :style="{ color: 'var(--sm-subtle)' }"
              >
                Comments ({{ commentsFor(t).length }})
              </div>
              <div
                v-for="c in commentsFor(t)"
                :key="c.id"
                class="mt-1 text-[11px] leading-[1.4]"
                :style="{ color: 'var(--sm-muted)' }"
              >
                <span class="font-semibold" :style="{ color: 'var(--sm-text)' }"
                  >{{ c.user_name }}:</span
                >
                {{ c.content }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
