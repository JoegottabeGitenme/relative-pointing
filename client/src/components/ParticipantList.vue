<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import APIService from '../services/api';
import SandTimer from './SandTimer.vue';
import { useSessionStore } from '../stores/session';

const sessionStore = useSessionStore();

const props = defineProps({
  participants: { type: Array, default: () => [] },
  currentUser: { type: Object, default: null },
  isCreator: { type: Boolean, default: false },
  skippedParticipants: { type: Array, default: () => [] },
  roomCode: { type: String, default: '' },
  currentTurnUserId: { type: String, default: null },
  collapsed: { type: Boolean, default: false },
  isMyTurn: { type: Boolean, default: false },
  turnActive: { type: Boolean, default: false },
  currentTurnColor: { type: String, default: '#facc15' },
  turnStartedAt: { type: String, default: null },
  accumulatedSand: { type: Array, default: () => [] },
  draining: { type: Boolean, default: false },
  creatorId: { type: String, default: null },
});

const emit = defineEmits(['toggleCollapse']);

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

const confirmTransferId = ref(null);

function getColorForParticipant(index) {
  return COLORS[index % COLORS.length];
}

const disabledParticipants = computed(() => new Set(props.skippedParticipants));

const activeParticipants = computed(() =>
  props.participants.filter((p) => !disabledParticipants.value.has(p.user_id))
);

function isOnline(participant) {
  if (!participant.last_seen_at) return false;
  const lastSeen = new Date(participant.last_seen_at + 'Z').getTime();
  const thresholdMs = sessionStore.serverConfig.offlineThresholdSeconds * 1000;
  return Date.now() - lastSeen < thresholdMs;
}

function toggleParticipant(participantId) {
  const newSkipped = disabledParticipants.value.has(participantId)
    ? props.skippedParticipants.filter((id) => id !== participantId)
    : [...props.skippedParticipants, participantId];

  APIService.updateSkippedParticipants(props.roomCode, newSkipped).catch(
    (err) => {
      console.error('Failed to update skipped participants:', err);
    }
  );
}

const sidebarInnerRef = ref(null);
const sidebarHeight = ref(400);
let resizeObserver = null;

onMounted(() => {
  if (sidebarInnerRef.value) {
    sidebarHeight.value = sidebarInnerRef.value.clientHeight;
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        sidebarHeight.value = entry.contentRect.height;
      }
    });
    resizeObserver.observe(sidebarInnerRef.value);
  }
});

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
});

function handleTransferClick(participantUserId) {
  if (confirmTransferId.value === participantUserId) {
    sessionStore.transferOwnership(participantUserId).catch((err) => {
      console.error('Failed to transfer ownership:', err);
    });
    confirmTransferId.value = null;
  } else {
    confirmTransferId.value = participantUserId;
  }
}

function cancelTransfer() {
  confirmTransferId.value = null;
}

function statusFor(p) {
  if (p.user_id === props.currentTurnUserId)
    return { text: '◆ active', accent: true };
  if (disabledParticipants.value.has(p.user_id))
    return { text: '— skipped', accent: false };
  if (!isOnline(p)) return { text: '○ offline', accent: false };
  return { text: '· waiting', accent: false };
}
</script>

<template>
  <aside
    :class="[
      'h-full flex-shrink-0 transition-[width] duration-300',
      collapsed ? 'w-16' : 'w-60',
    ]"
    :style="{
      background: 'var(--sm-card)',
      borderRight: '1px solid var(--sm-border)',
    }"
  >
    <div
      ref="sidebarInnerRef"
      class="relative flex h-full flex-col overflow-hidden"
    >
      <!-- Sand timer canvas (full sidebar background) -->
      <SandTimer
        v-if="!collapsed && turnActive"
        :is-host="true"
        :is-my-turn="isMyTurn"
        :turn-active="turnActive"
        :current-color="currentTurnColor"
        :turn-started-at="turnStartedAt"
        :accumulated-sand="accumulatedSand"
        :draining="draining"
        :canvas-height="sidebarHeight"
        class="absolute inset-0 z-0 pointer-events-none"
      />

      <!-- Header -->
      <div
        class="relative z-10 flex items-center px-4 py-3.5"
        :class="collapsed ? 'justify-center' : 'justify-between'"
        :style="{ borderBottom: '1px solid var(--sm-border)' }"
      >
        <div v-if="!collapsed">
          <div
            class="font-mono text-[11px] font-bold tracking-[0.04em]"
            :style="{ color: 'var(--sm-ink)' }"
          >
            RP/{{ roomCode }}
          </div>
          <div class="mt-1 flex items-baseline gap-1.5">
            <span class="sm-label">Participants</span>
            <span
              class="font-mono text-[11px]"
              :style="{ color: 'var(--sm-ink)' }"
            >
              [{{ activeParticipants.length }}/{{ participants.length }}]
            </span>
          </div>
        </div>
        <button
          @click="emit('toggleCollapse')"
          class="font-mono text-[10px]"
          :style="{ color: 'var(--sm-muted)' }"
          :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        >
          {{ collapsed ? '▶' : '◀' }}
        </button>
      </div>

      <!-- Participant list -->
      <div class="relative z-10 flex-1 overflow-y-auto">
        <template v-if="participants.length > 0">
          <div
            v-for="(participant, index) in participants"
            :key="participant.id"
            class="group flex items-center gap-3 transition-colors"
            :class="[
              collapsed ? 'justify-center px-2 py-2' : 'px-4 py-2.5',
              disabledParticipants.has(participant.user_id) ? 'opacity-40' : '',
            ]"
            :style="{
              background:
                participant.user_id === currentTurnUserId
                  ? 'var(--sm-active-row)'
                  : 'transparent',
              borderBottom: '1px solid var(--sm-hairline)',
              borderLeft:
                participant.user_id === currentTurnUserId
                  ? '2px solid var(--sm-accent)'
                  : '2px solid transparent',
            }"
          >
            <!-- Index number -->
            <span
              v-if="!collapsed"
              class="w-3.5 font-mono text-[10px] flex-shrink-0"
              :style="{ color: 'var(--sm-subtle)' }"
              >{{ String(index + 1).padStart(2, '0') }}</span
            >

            <!-- Square avatar -->
            <div
              class="flex h-7 w-7 flex-shrink-0 items-center justify-center font-mono text-[12px] font-bold text-white"
              :style="{
                backgroundColor: getColorForParticipant(index),
                borderRadius: '2px',
                outline:
                  participant.user_id === currentTurnUserId
                    ? '2px solid var(--sm-ink)'
                    : 'none',
                outlineOffset: '2px',
                filter: !isOnline(participant)
                  ? 'grayscale(1) opacity(0.45)'
                  : 'none',
              }"
              :title="collapsed ? participant.user_name : undefined"
            >
              {{ participant.user_name?.[0]?.toUpperCase() || '?' }}
            </div>

            <template v-if="!collapsed">
              <div class="min-w-0 flex-1">
                <div
                  class="flex items-center gap-1.5 text-[12.5px] font-semibold tracking-[-0.005em]"
                  :style="{ color: 'var(--sm-text)' }"
                >
                  <span class="truncate">{{ participant.user_name }}</span>
                  <span
                    v-if="participant.user_id === currentUser?.id"
                    class="font-mono text-[10px]"
                    :style="{ color: 'var(--sm-subtle)' }"
                    >(you)</span
                  >
                  <span
                    v-if="participant.user_id === creatorId"
                    class="ml-0.5"
                    :style="{ color: 'var(--sm-accent)' }"
                    title="Session owner"
                    >★</span
                  >
                </div>
                <div
                  class="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.06em]"
                  :style="{
                    color: statusFor(participant).accent
                      ? 'var(--sm-accent)'
                      : 'var(--sm-muted)',
                    fontWeight: statusFor(participant).accent ? 700 : 600,
                  }"
                >
                  {{ statusFor(participant).text }}
                </div>
              </div>

              <!-- Transfer ownership button -->
              <button
                v-if="
                  isCreator &&
                  participant.user_id !== creatorId &&
                  isOnline(participant) &&
                  !disabledParticipants.has(participant.user_id)
                "
                @click.prevent.stop="handleTransferClick(participant.user_id)"
                class="flex h-5 w-5 flex-shrink-0 items-center justify-center transition-opacity"
                :class="
                  confirmTransferId === participant.user_id
                    ? 'opacity-100'
                    : 'opacity-0 group-hover:opacity-100'
                "
                :style="{
                  background:
                    confirmTransferId === participant.user_id
                      ? 'var(--sm-accent)'
                      : 'transparent',
                  color:
                    confirmTransferId === participant.user_id
                      ? '#0a0a0a'
                      : 'var(--sm-muted)',
                  borderRadius: '2px',
                  border:
                    confirmTransferId === participant.user_id
                      ? '1px solid var(--sm-accent)'
                      : '1px solid var(--sm-border)',
                }"
                :title="
                  confirmTransferId === participant.user_id
                    ? 'Click again to confirm'
                    : 'Transfer ownership'
                "
              >
                <span
                  v-if="confirmTransferId === participant.user_id"
                  class="font-mono text-[8px] font-bold"
                  >OK?</span
                >
                <span v-else class="text-[10px] leading-none">★</span>
              </button>
              <span
                v-else-if="!isCreator || participant.user_id === creatorId"
                class="h-5 w-5 flex-shrink-0"
              ></span>

              <!-- Skip toggle -->
              <button
                v-if="isCreator"
                @click.prevent.stop="toggleParticipant(participant.user_id)"
                class="flex h-5 w-5 flex-shrink-0 cursor-pointer items-center justify-center transition-colors"
                :style="{
                  borderRadius: '2px',
                  border: disabledParticipants.has(participant.user_id)
                    ? '1px solid var(--sm-border)'
                    : '1px solid var(--sm-ink)',
                  background: disabledParticipants.has(participant.user_id)
                    ? 'var(--sm-card)'
                    : 'var(--sm-ink)',
                  color: 'var(--sm-surface)',
                }"
                :title="
                  disabledParticipants.has(participant.user_id)
                    ? 'Include in turn order'
                    : 'Skip this participant'
                "
              >
                <svg
                  v-if="!disabledParticipants.has(participant.user_id)"
                  class="h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="3"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </button>
            </template>
          </div>
        </template>
        <p
          v-else
          class="py-4 text-center font-mono text-[10px]"
          :style="{ color: 'var(--sm-subtle)' }"
        >
          {{ collapsed ? '—' : 'No participants' }}
        </p>
      </div>

      <!-- Cancel transfer hint -->
      <div
        v-if="confirmTransferId && !collapsed"
        class="relative z-10 cursor-pointer px-4 pb-2 font-mono text-[10px] uppercase tracking-[0.06em] hover:underline"
        :style="{ color: 'var(--sm-accent)' }"
        @click="cancelTransfer"
      >
        Cancel transfer
      </div>

      <!-- Footer -->
      <div
        v-if="!collapsed && activeParticipants.length < participants.length"
        class="relative z-10 px-4 py-3 text-center font-mono text-[10px] uppercase tracking-[0.08em]"
        :style="{
          borderTop: '1px solid var(--sm-border)',
          color: 'var(--sm-muted)',
        }"
      >
        {{ activeParticipants.length }} / {{ participants.length }} active
      </div>
    </div>
  </aside>
</template>
