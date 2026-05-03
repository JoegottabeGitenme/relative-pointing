<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSessionStore } from '../stores/session';
import { useUserStore } from '../stores/user';
import { useThemeStore } from '../stores/theme';
import APIService from '../services/api';
import Column from './Column.vue';
import CreateColumnDropZone from './CreateColumnDropZone.vue';
import ParticipantList from './ParticipantList.vue';
import CreateTaskModal from './CreateTaskModal.vue';
import DropZoneOverlay from './DropZoneOverlay.vue';
import TaskActionModal from './TaskActionModal.vue';
import TurnTimer from './TurnTimer.vue';
import Version from './Version.vue';
import Snowflakes from './Snowflakes.vue';

const route = useRoute();
const router = useRouter();
const sessionStore = useSessionStore();
const userStore = useUserStore();
const themeStore = useThemeStore();

const roomCode = computed(() => route.params.roomCode);

const showCreateTask = ref(false);
const showEndSessionConfirm = ref(false);
const actionModalTask = ref(null);
const actionModalTab = ref('tags');
const copied = ref(false);
const isDragging = ref(false);
const jiraBaseUrl = ref('');
const jiraUrlInput = ref('');
const showJiraUrlInput = ref(false);
const sidebarCollapsed = ref(false);
const boardAreaRef = ref(null);
const dropZoneRef = ref(null);

// Auto-collapse sidebar on narrow viewports
const COLLAPSE_BREAKPOINT = 1024;
function checkViewportWidth() {
  if (window.innerWidth < COLLAPSE_BREAKPOINT) {
    sidebarCollapsed.value = true;
  }
}
onMounted(() => {
  checkViewportWidth();
  window.addEventListener('resize', checkViewportWidth);
});
onUnmounted(() => {
  window.removeEventListener('resize', checkViewportWidth);
});

// Sand timer turn history tracking
const turnHistory = ref([]);
const draining = ref(false);
let previousTurnUserId = null;
let previousTurnStartedAt = null;

const isCreator = computed(
  () => userStore.userId === sessionStore.session?.creator_id
);

const dragDisabled = computed(
  () => !sessionStore.isMyTurn || sessionStore.isCurrentUserDisabled
);

// Whether any participants are enabled (not in skipped list)
const hasActiveParticipants = computed(() => {
  const skipped = new Set(sessionStore.session?.skipped_participants || []);
  return sessionStore.participants.some((p) => !skipped.has(p.user_id));
});
const topTaskId = computed(() =>
  sessionStore.topUnsortedTask ? String(sessionStore.topUnsortedTask.id) : null
);

// Participant colors (same as ParticipantList)
const COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#FFA07A',
  '#98D8C8',
  '#F7DC6F',
  '#BB8FCE',
  '#85C1E2',
];

function getColorForUserId(userId) {
  const idx = sessionStore.participants.findIndex((p) => p.user_id === userId);
  return idx >= 0 ? COLORS[idx % COLORS.length] : '#4ECDC4';
}

const currentTurnColor = computed(() => {
  if (!sessionStore.currentTurnUserId) return '#4ECDC4';
  return getColorForUserId(sessionStore.currentTurnUserId);
});

const turnActive = computed(() => !!sessionStore.currentTurnParticipant);

// Update Jira URL when session changes
watch(
  () => sessionStore.session?.jira_base_url,
  (val) => {
    if (val) {
      jiraBaseUrl.value = val;
      jiraUrlInput.value = val;
    }
  }
);

// Track turn changes for sand timer
watch(
  () => sessionStore.currentTurnUserId,
  (newUserId, oldUserId) => {
    // Record the previous turn's sand if there was one
    if (oldUserId && previousTurnStartedAt) {
      const elapsed = Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(previousTurnStartedAt).getTime()) / 1000
        )
      );
      // Convert seconds to particle count (matches spawn rate: ~1/sec base)
      const particleCount = Math.floor(elapsed * 1);
      const color = getColorForUserId(oldUserId);
      turnHistory.value = [
        ...turnHistory.value,
        { userId: oldUserId, color, particleCount },
      ];

      // Sand accumulates for everyone — no drain between turns
    }

    previousTurnUserId = newUserId;
    previousTurnStartedAt = newUserId ? sessionStore.turnStartedAt : null;
  }
);

// Keep previousTurnStartedAt in sync when turnStartedAt updates
watch(
  () => sessionStore.turnStartedAt,
  (val) => {
    if (sessionStore.currentTurnUserId) {
      previousTurnStartedAt = val;
    }
  }
);

// Watch for session ending → redirect all participants to report
watch(
  () => sessionStore.session?.ended_at,
  (endedAt) => {
    if (endedAt) {
      sessionStore.stopPolling();
      router.push(`/session/${roomCode.value}/report`);
    }
  },
  { immediate: true }
);

// Ensure current user is a participant, then start polling
onMounted(async () => {
  try {
    await APIService.joinSession(
      roomCode.value,
      userStore.userId,
      userStore.userName
    );
  } catch {
    // Already a participant or other non-fatal error
  }
  sessionStore.startPolling(roomCode.value);
});

onUnmounted(() => {
  sessionStore.stopPolling();
  sessionStore.resetState();
});

const sortedColumns = computed(() =>
  [...sessionStore.displayColumns].sort(
    (a, b) => (a.column_order || 0) - (b.column_order || 0)
  )
);

const unsortedTasks = computed(() =>
  sessionStore.displayTasks.filter((t) => t.column_id === 'unsorted')
);

function tasksForColumn(columnId) {
  return sessionStore.displayTasks.filter((t) => t.column_id === columnId);
}

// Complexity header scroll navigation
function getColumnElements() {
  if (!boardAreaRef.value) return [];
  return Array.from(boardAreaRef.value.querySelectorAll('[data-column-index]'));
}

function scrollToColumnIndex(index) {
  const cols = getColumnElements();
  if (index < 0 || index >= cols.length || !boardAreaRef.value) return;
  const col = cols[index];
  const container = boardAreaRef.value;
  const colRect = col.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const scrollLeft =
    container.scrollLeft +
    (colRect.left - containerRect.left) -
    (containerRect.width / 2 - colRect.width / 2);
  container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
}

function getCurrentColumnIndex() {
  const cols = getColumnElements();
  if (!cols.length || !boardAreaRef.value) return 0;
  const containerCenter =
    boardAreaRef.value.getBoundingClientRect().left +
    boardAreaRef.value.clientWidth / 2;
  let closest = 0;
  let minDist = Infinity;
  for (let i = 0; i < cols.length; i++) {
    const rect = cols[i].getBoundingClientRect();
    const colCenter = rect.left + rect.width / 2;
    const dist = Math.abs(colCenter - containerCenter);
    if (dist < minDist) {
      minDist = dist;
      closest = i;
    }
  }
  return closest;
}

function scrollColumnLeft() {
  const idx = getCurrentColumnIndex();
  scrollToColumnIndex(idx - 1);
}

function scrollColumnRight() {
  const idx = getCurrentColumnIndex();
  scrollToColumnIndex(idx + 1);
}

function handleComplexityBarClick(e) {
  const bar = e.currentTarget;
  const rect = bar.getBoundingClientRect();
  const fraction = (e.clientX - rect.left) / rect.width;
  const cols = getColumnElements();
  if (!cols.length) return;
  const targetIndex = Math.round(fraction * (cols.length - 1));
  scrollToColumnIndex(targetIndex);
}

async function handleCopyRoomCode() {
  try {
    await navigator.clipboard.writeText(roomCode.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch (err) {
    console.error('Failed to copy room code:', err);
  }
}

async function handleSaveJiraUrl() {
  try {
    await APIService.updateSessionJiraUrl(roomCode.value, jiraUrlInput.value);
    jiraBaseUrl.value = jiraUrlInput.value;
    showJiraUrlInput.value = false;
  } catch (err) {
    console.error('Error saving Jira URL:', err);
    alert('Failed to save Jira URL: ' + err.message);
  }
}

function handleTaskMoved({ task, toColumnId }) {
  sessionStore.moveTaskToColumn(String(task.id), toColumnId, userStore.userId);
}

function handleDropZoneTask({ task, zoneId }) {
  sessionStore.moveTaskToColumn(String(task.id), zoneId, userStore.userId);
}

function handleDeleteTask(taskId) {
  sessionStore.deleteTask(taskId);
}

function handleUpdateTaskTag(taskId, tagId) {
  sessionStore.updateTaskTag(taskId, tagId);
}

// Live-lookup: keep the modal task in sync with optimistic/backend state
const liveActionModalTask = computed(() => {
  if (!actionModalTask.value) return null;
  const taskId = String(actionModalTask.value.id);
  return (
    sessionStore.displayTasks.find((t) => String(t.id) === taskId) ||
    actionModalTask.value
  );
});

function handleOpenActionModal({ task, tab }) {
  actionModalTask.value = task;
  actionModalTab.value = tab || 'tags';
}

function handleTaskCreated() {
  showCreateTask.value = false;
}

async function handleStartSession() {
  try {
    await sessionStore.startSession({ autoMoveTopTask: true });
  } catch (err) {
    alert('Failed to start session: ' + err.message);
  }
}

async function handleEndSession() {
  try {
    await sessionStore.endSession();
    showEndSessionConfirm.value = false;
    router.push(`/session/${roomCode.value}/report`);
  } catch (err) {
    alert('Failed to end session: ' + err.message);
  }
}

function handleLogout() {
  router.push('/');
  userStore.logout();
}

// Track drag state across the whole board
function onDragStart() {
  isDragging.value = true;
}

function onDragEnd() {
  isDragging.value = false;
}

// Add/remove document-level listeners for drag detection
onMounted(() => {
  document.addEventListener('dragstart', onDragStart);
  document.addEventListener('dragend', onDragEnd);
});

onUnmounted(() => {
  document.removeEventListener('dragstart', onDragStart);
  document.removeEventListener('dragend', onDragEnd);
});
</script>

<template>
  <!-- Loading state -->
  <div
    v-if="sessionStore.loading"
    class="flex items-center justify-center min-h-screen"
    :style="{ background: 'var(--sm-surface)' }"
  >
    <div class="text-center">
      <p
        class="font-mono text-[11px] uppercase tracking-[0.12em]"
        :style="{ color: 'var(--sm-muted)' }"
      >
        Loading session…
      </p>
    </div>
  </div>

  <!-- Session not found -->
  <div
    v-else-if="!sessionStore.session"
    class="flex items-center justify-center min-h-screen"
    :style="{ background: 'var(--sm-surface)' }"
  >
    <div class="text-center">
      <p class="text-xl" :style="{ color: 'var(--sm-text)' }">
        Session not found
      </p>
      <router-link
        to="/"
        class="mt-4 inline-block font-mono text-[11px] uppercase tracking-[0.08em] hover:underline"
        :style="{ color: 'var(--sm-ink)' }"
        >Create new session →</router-link
      >
    </div>
  </div>

  <!-- Main board -->
  <div
    v-else
    class="flex h-screen"
    :style="{ background: 'var(--sm-surface)' }"
  >
    <!-- Christmas Snowflakes -->
    <Snowflakes v-if="themeStore.isChristmas" :count="50" />

    <!-- Participant Sidebar -->
    <ParticipantList
      :participants="sessionStore.participants"
      :current-user="userStore.currentUser"
      :is-creator="isCreator"
      :skipped-participants="sessionStore.session?.skipped_participants || []"
      :room-code="roomCode"
      :current-turn-user-id="sessionStore.currentTurnUserId"
      :collapsed="sidebarCollapsed"
      :is-my-turn="sessionStore.isMyTurn"
      :turn-active="turnActive"
      :current-turn-color="currentTurnColor"
      :turn-started-at="sessionStore.turnStartedAt"
      :accumulated-sand="turnHistory"
      :draining="draining"
      :creator-id="sessionStore.session?.creator_id"
      @toggle-collapse="sidebarCollapsed = !sidebarCollapsed"
    />

    <!-- Main content area -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Header -->
      <header
        :style="{
          background: 'var(--sm-card)',
          borderBottom: '1px solid var(--sm-border)',
        }"
      >
        <div class="flex items-center justify-between px-6 py-3.5">
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
                <h1
                  class="text-base font-bold tracking-[-0.02em]"
                  :style="{ color: 'var(--sm-ink)' }"
                >
                  Relative Pointing
                </h1>
                <Version />
              </div>
              <div class="mt-0.5 flex items-center gap-2.5 flex-wrap">
                <span
                  @click="handleCopyRoomCode"
                  class="cursor-pointer font-mono text-[10.5px] font-bold uppercase tracking-[0.06em] hover:underline"
                  :style="{ color: 'var(--sm-ink)' }"
                  title="Click to copy"
                  >RP/{{ roomCode }}<template v-if="copied"> ✓</template></span
                >
                <span class="text-[11px]" :style="{ color: 'var(--sm-subtle)' }"
                  >·</span
                >
                <span class="sm-label">Refinement</span>
                <template v-if="isCreator">
                  <span
                    class="text-[11px]"
                    :style="{ color: 'var(--sm-subtle)' }"
                    >·</span
                  >
                  <template v-if="showJiraUrlInput">
                    <input
                      type="text"
                      v-model="jiraUrlInput"
                      placeholder="https://company.atlassian.net"
                      class="px-2 py-0.5 font-mono text-[10.5px]"
                      :style="{
                        background: 'var(--sm-card)',
                        border: '1px solid var(--sm-border)',
                        borderRadius: '2px',
                        color: 'var(--sm-text)',
                      }"
                      autofocus
                    />
                    <button
                      @click="handleSaveJiraUrl"
                      class="sm-btn sm-btn-primary px-2 py-0.5 text-[10px]"
                    >
                      Save
                    </button>
                    <button
                      @click="showJiraUrlInput = false"
                      class="sm-btn px-2 py-0.5 text-[10px]"
                    >
                      Cancel
                    </button>
                  </template>
                  <span
                    v-else
                    @click="
                      jiraUrlInput = jiraBaseUrl;
                      showJiraUrlInput = true;
                    "
                    class="cursor-pointer font-mono text-[10.5px] hover:underline"
                    :style="{ color: 'var(--sm-muted)' }"
                    title="Click to edit Jira base URL"
                  >
                    {{ jiraBaseUrl || 'set jira url'
                    }}<template v-if="jiraBaseUrl"> ✎</template>
                  </span>
                </template>
                <template v-else-if="jiraBaseUrl">
                  <span
                    class="text-[11px]"
                    :style="{ color: 'var(--sm-subtle)' }"
                    >·</span
                  >
                  <span
                    class="font-mono text-[10.5px]"
                    :style="{ color: 'var(--sm-muted)' }"
                    >{{ jiraBaseUrl.replace(/^https?:\/\//, '') }}</span
                  >
                </template>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-1.5">
            <button
              v-if="isCreator && !sessionStore.isStarted"
              @click="handleStartSession"
              :disabled="!hasActiveParticipants"
              class="sm-btn sm-btn-primary"
              :title="
                hasActiveParticipants
                  ? 'Start the session and begin turn rotation'
                  : 'Enable at least one participant first'
              "
            >
              Start session
            </button>
            <button
              v-if="isCreator && sessionStore.isStarted"
              @click="showEndSessionConfirm = true"
              class="sm-btn"
              title="End this session and generate a report"
            >
              End session
            </button>
            <button
              @click="themeStore.toggleChristmas()"
              class="flex h-8 w-8 items-center justify-center text-[13px] sm-card"
              :title="themeStore.isChristmas ? 'Disable snow' : 'Let it snow!'"
            >
              {{ themeStore.isChristmas ? '🎄' : '❄' }}
            </button>
            <button
              @click="themeStore.toggleTheme()"
              class="flex h-8 w-8 items-center justify-center text-[13px] sm-card"
              :title="
                themeStore.isDark
                  ? 'Switch to light mode'
                  : 'Switch to dark mode'
              "
            >
              {{ themeStore.isDark ? '☀' : '☾' }}
            </button>
            <button @click="handleLogout" class="sm-btn" title="Logout">
              Logout
            </button>
          </div>
        </div>
      </header>

      <!-- Pre-start banners -->
      <!-- Host: prompt to enable participants or start session -->
      <div
        v-if="
          isCreator &&
          !sessionStore.isStarted &&
          sessionStore.participants.length > 0 &&
          !sessionStore.loading
        "
        class="flex items-center justify-between px-6 py-3"
        :style="{
          background: hasActiveParticipants
            ? 'var(--sm-card)'
            : 'var(--sm-active-row)',
          borderBottom: '1px solid var(--sm-border)',
        }"
      >
        <span
          class="font-mono text-[11px] font-bold uppercase tracking-[0.08em]"
          :style="{ color: 'var(--sm-ink)' }"
        >
          <template v-if="hasActiveParticipants">
            ◆ Ready — click Start session to begin
          </template>
          <template v-else>
            ! Enable at least one participant to begin
          </template>
        </span>
      </div>
      <!-- Participant: waiting for session to begin -->
      <div
        v-if="
          !isCreator &&
          !sessionStore.isStarted &&
          sessionStore.participants.length > 0 &&
          !sessionStore.loading
        "
        class="flex items-center px-6 py-3"
        :style="{
          background: 'var(--sm-card)',
          borderBottom: '1px solid var(--sm-border)',
        }"
      >
        <span
          class="font-mono text-[11px] font-bold uppercase tracking-[0.08em]"
          :style="{ color: 'var(--sm-ink)' }"
          >· Waiting for the session to begin</span
        >
      </div>
      <!-- Post-start: all participants disabled -->
      <div
        v-if="
          sessionStore.isStarted &&
          !sessionStore.currentTurnParticipant &&
          sessionStore.participants.length > 0 &&
          !sessionStore.loading
        "
        class="flex items-center px-6 py-3"
        :style="{
          background: '#fef2f2',
          color: '#991b1b',
          borderBottom: '1px solid #fca5a5',
        }"
      >
        <span
          class="font-mono text-[11px] font-bold uppercase tracking-[0.08em]"
        >
          ! All participants disabled — enable one to continue
        </span>
      </div>

      <!-- Turn Banner — Studio Mono inverse -->
      <div
        v-if="sessionStore.currentTurnParticipant"
        class="flex items-center justify-between px-6 py-3"
        :style="{
          background: themeStore.isDark ? 'var(--sm-accent)' : 'var(--sm-ink)',
          color: themeStore.isDark ? '#0a0a0a' : 'var(--sm-surface)',
        }"
      >
        <div class="flex items-center gap-3 min-w-0">
          <span
            class="font-mono text-[10px] font-bold uppercase tracking-[0.12em] pr-3 flex-shrink-0"
            :style="{
              color: themeStore.isDark ? '#0a0a0a' : 'var(--sm-accent)',
              borderRight: themeStore.isDark
                ? '1px solid rgba(0,0,0,0.2)'
                : '1px solid rgba(255,255,255,0.2)',
            }"
          >
            {{ sessionStore.isMyTurn ? '◆ Your turn' : '· Waiting' }}
          </span>
          <span class="text-[13px] font-medium tracking-[-0.005em] truncate">
            <template v-if="sessionStore.isMyTurn">
              Drop a task into a column.
            </template>
            <template v-else>
              {{ sessionStore.currentTurnParticipant.user_name }} is pointing.
            </template>
          </span>
        </div>
        <div class="flex items-center gap-3.5 flex-shrink-0">
          <TurnTimer
            v-if="sessionStore.turnStartedAt"
            :turn-started-at="sessionStore.turnStartedAt"
            :style="{
              color: themeStore.isDark ? '#0a0a0a' : 'var(--sm-surface)',
            }"
          />
          <button
            v-if="sessionStore.isMyTurn"
            @click="sessionStore.endTurn()"
            class="px-3.5 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] cursor-pointer"
            :style="{
              borderRadius: '2px',
              background: themeStore.isDark ? '#0a0a0a' : 'var(--sm-accent)',
              color: themeStore.isDark ? 'var(--sm-accent)' : '#0a0a0a',
              border: themeStore.isDark ? '1px solid #0a0a0a' : 'none',
            }"
          >
            End turn ↵
          </button>
          <button
            v-if="isCreator && !sessionStore.isMyTurn"
            @click="sessionStore.endTurn()"
            class="px-3.5 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] cursor-pointer"
            :style="{
              borderRadius: '2px',
              background: 'transparent',
              color: themeStore.isDark ? '#0a0a0a' : 'var(--sm-surface)',
              border: themeStore.isDark
                ? '1px solid rgba(0,0,0,0.4)'
                : '1px solid rgba(255,255,255,0.4)',
            }"
          >
            Skip turn
          </button>
        </div>
      </div>

      <!-- Complexity scale -->
      <div
        class="flex items-center gap-4 px-6 py-3.5"
        :style="{
          background: 'var(--sm-card)',
          borderBottom: '1px solid var(--sm-border)',
        }"
      >
        <button
          class="sm-label cursor-pointer hover:underline"
          title="Scroll left one column"
          @click="scrollColumnLeft"
        >
          ← simpler
        </button>
        <div
          class="relative flex-1 cursor-pointer"
          style="height: 18px"
          title="Click to scroll to relative position"
          @click="handleComplexityBarClick"
        >
          <div
            class="absolute left-0 right-0 top-2"
            :style="{ height: '1px', background: 'var(--sm-border)' }"
          ></div>
          <div
            v-for="(n, i) in [1, 2, 3, 5, 8]"
            :key="n"
            class="absolute top-0 flex flex-col items-center"
            :style="{
              left: `${(i / 4) * 100}%`,
              transform: 'translateX(-50%)',
            }"
          >
            <div
              :style="{
                width: '1px',
                height: '8px',
                background: 'var(--sm-muted)',
              }"
            ></div>
            <span
              class="mt-0.5 font-mono text-[10px]"
              :style="{ color: 'var(--sm-muted)' }"
              >{{ n }}</span
            >
          </div>
        </div>
        <button
          class="sm-label cursor-pointer hover:underline"
          title="Scroll right one column"
          @click="scrollColumnRight"
        >
          more complex →
        </button>
      </div>

      <!-- Main Content -->
      <div class="flex-1 overflow-hidden">
        <!-- Task Board Area -->
        <div
          ref="boardAreaRef"
          class="board-no-scrollbar relative z-10 h-full overflow-y-auto overflow-x-hidden px-6 py-5"
          :style="{ background: 'var(--sm-surface)' }"
        >
          <div
            :class="[
              'flex min-h-full gap-3 w-fit',
              isDragging && sessionStore.isMyTurn && sortedColumns.length > 0
                ? 'min-w-full'
                : 'mx-auto',
            ]"
          >
            <template
              v-if="
                sessionStore.displayTasks &&
                sessionStore.displayTasks.length > 0
              "
            >
              <!-- No columns yet, show single drop zone when dragging -->
              <template
                v-if="
                  sortedColumns.length === 0 &&
                  isDragging &&
                  sessionStore.isMyTurn
                "
              >
                <CreateColumnDropZone
                  zone-id="new-column"
                  @task-dropped="handleDropZoneTask"
                />
              </template>

              <template v-else>
                <!-- Left drop zone -->
                <CreateColumnDropZone
                  v-if="
                    sortedColumns.length > 0 &&
                    isDragging &&
                    sessionStore.isMyTurn
                  "
                  zone-id="new-column-left"
                  :expand="true"
                  indicator-position="right"
                  @task-dropped="handleDropZoneTask"
                />

                <!-- Columns with slide animation -->
                <template
                  v-for="(column, index) in sortedColumns"
                  :key="`col-${column.id}`"
                >
                  <div :data-column-index="index">
                    <Column
                      :column-id="column.id"
                      :title="column.name"
                      :tasks="tasksForColumn(column.id)"
                      :tags="sessionStore.tags"
                      :jira-base-url="jiraBaseUrl"
                      :drag-disabled="dragDisabled"
                      :column-index="index"
                      :point-value="column.point_value"
                      @open-action-modal="handleOpenActionModal"
                      @task-moved="handleTaskMoved"
                    />
                  </div>
                  <!-- Between columns drop zone -->
                  <CreateColumnDropZone
                    v-if="
                      isDragging &&
                      sessionStore.isMyTurn &&
                      sortedColumns.length > 1 &&
                      index < sortedColumns.length - 1
                    "
                    :zone-id="`new-column-between-${column.id}`"
                    @task-dropped="handleDropZoneTask"
                  />
                </template>

                <!-- Right drop zone -->
                <CreateColumnDropZone
                  v-if="
                    sortedColumns.length > 0 &&
                    isDragging &&
                    sessionStore.isMyTurn
                  "
                  zone-id="new-column"
                  :expand="true"
                  indicator-position="left"
                  @task-dropped="handleDropZoneTask"
                />
              </template>
            </template>

            <div
              v-else
              class="w-full py-12 text-center"
              :style="{ color: 'var(--sm-subtle)' }"
            >
              <p class="mb-2 sm-label">No tasks yet</p>
              <p
                class="font-mono text-[11px]"
                :style="{ color: 'var(--sm-muted)' }"
              >
                Upload a CSV or create a task to get started
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tasks Queue Panel — right sidebar -->
    <aside
      class="relative z-20 flex w-72 flex-col overflow-hidden"
      :style="{
        background: 'var(--sm-card)',
        borderLeft: '1px solid var(--sm-border)',
      }"
    >
      <!-- Queue header -->
      <div
        class="px-4 py-3.5"
        :style="{ borderBottom: '1px solid var(--sm-border)' }"
      >
        <div class="flex items-baseline justify-between">
          <span
            class="text-[13px] font-bold tracking-[-0.01em]"
            :style="{ color: 'var(--sm-ink)' }"
            >Queue</span
          >
          <span
            class="font-mono text-[11px]"
            :style="{ color: 'var(--sm-muted)' }"
            >[{{ unsortedTasks.length }}]</span
          >
        </div>
        <div class="mt-1">
          <span class="sm-label"
            >Stack mode · {{ sessionStore.stackMode ? 'on' : 'off' }}</span
          >
        </div>
      </div>

      <!-- Queue body -->
      <div class="flex-1 overflow-y-auto px-3 py-3">
        <Column
          column-id="unsorted"
          title="Queue"
          :tasks="unsortedTasks"
          :tags="sessionStore.tags"
          variant="tasks"
          :jira-base-url="jiraBaseUrl"
          :drag-disabled="dragDisabled"
          :stack-mode="sessionStore.stackMode"
          :top-task-id="topTaskId"
          @open-action-modal="handleOpenActionModal"
          @task-moved="handleTaskMoved"
        />
      </div>

      <!-- Queue footer -->
      <div
        class="flex flex-col gap-1.5 px-3 py-3"
        :style="{ borderTop: '1px solid var(--sm-border)' }"
      >
        <label
          v-if="isCreator"
          class="flex cursor-pointer items-center gap-2 px-1 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.04em]"
          :style="{ color: 'var(--sm-ink)' }"
        >
          <input
            type="checkbox"
            :checked="sessionStore.stackMode"
            @change="sessionStore.toggleStackMode()"
            :style="{ accentColor: 'var(--sm-accent)' }"
          />
          Stack mode
        </label>
        <button
          v-if="
            sessionStore.stackMode &&
            sessionStore.isMyTurn &&
            sessionStore.topUnsortedTask
          "
          @click="sessionStore.skipTopTask()"
          class="sm-btn sm-btn-outline-strong w-full"
        >
          Skip task
        </button>
        <button
          v-if="isCreator"
          @click="showCreateTask = true"
          class="sm-btn w-full"
          title="Add a new task manually"
        >
          + Create
        </button>
        <button
          v-if="isCreator"
          @click="dropZoneRef?.openFilePicker()"
          class="sm-btn sm-btn-primary w-full"
          title="Import tasks from a Jira or Linear CSV export"
        >
          Import CSV ↑
        </button>
      </div>
    </aside>

    <!-- Create Task Modal -->
    <CreateTaskModal
      v-if="showCreateTask"
      :room-code="roomCode"
      @task-created="handleTaskCreated"
      @close="showCreateTask = false"
    />

    <!-- Task Action Modal (Tags & Comments) -->
    <TaskActionModal
      v-if="liveActionModalTask"
      :task="liveActionModalTask"
      :tags="sessionStore.tags"
      :initial-tab="actionModalTab"
      @update-tag="handleUpdateTaskTag"
      @delete-task="handleDeleteTask"
      @close="actionModalTask = null"
    />

    <!-- Drop Zone Overlay for CSV import -->
    <DropZoneOverlay
      ref="dropZoneRef"
      :room-code="roomCode"
      :is-creator="isCreator"
    />

    <!-- End Session Confirmation Modal -->
    <Teleport to="body">
      <div
        v-if="showEndSessionConfirm"
        class="fixed inset-0 z-50 flex items-center justify-center"
        :style="{
          background: 'rgba(10,10,10,0.55)',
          backdropFilter: 'blur(2px)',
        }"
        @click.self="showEndSessionConfirm = false"
      >
        <div class="mx-4 w-full max-w-md p-6 sm-card sm-shadow-hard">
          <div class="mb-4 flex items-baseline gap-2">
            <span class="sm-label">Confirm</span>
          </div>
          <h3
            class="mb-2 text-lg font-bold tracking-[-0.02em]"
            :style="{ color: 'var(--sm-ink)' }"
          >
            End session?
          </h3>
          <p
            class="mb-6 text-sm leading-[1.5]"
            :style="{ color: 'var(--sm-muted)' }"
          >
            This will end the pointing session for all participants and generate
            a report. This action cannot be undone.
          </p>
          <div class="flex justify-end gap-2">
            <button @click="showEndSessionConfirm = false" class="sm-btn">
              Cancel
            </button>
            <button @click="handleEndSession" class="sm-btn sm-btn-danger">
              End session
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
