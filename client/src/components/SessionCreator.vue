<script setup>
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { v4 as uuidv4 } from 'uuid';
import { useUserStore } from '../stores/user';
import { useThemeStore } from '../stores/theme';
import APIService from '../services/api';
import Version from './Version.vue';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const themeStore = useThemeStore();

const userName = ref('');
const roomCode = ref('');
const mode = ref('create');
const loading = ref(false);
const error = ref(null);

if (route.query.join) {
  roomCode.value = route.query.join;
  mode.value = 'join';
}

async function handleCreateSession() {
  if (!userName.value.trim()) {
    error.value = 'Please enter your name';
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    const userId = userStore.userId || uuidv4();
    const result = await APIService.createSession(
      userId,
      userName.value.trim()
    );
    userStore.login(userId, userName.value.trim());
    router.push(`/session/${result.roomCode}`);
  } catch (err) {
    console.error('Error creating session:', err);
    error.value = 'Failed to create session. Please try again.';
    loading.value = false;
  }
}

async function handleJoinSession() {
  if (!userName.value.trim()) {
    error.value = 'Please enter your name';
    return;
  }
  if (!roomCode.value.trim()) {
    error.value = 'Please enter a room code';
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    const userId = userStore.userId || uuidv4();
    const code = roomCode.value.toLowerCase();
    await APIService.joinSession(code, userId, userName.value.trim());
    userStore.login(userId, userName.value.trim());
    router.push(`/session/${code}`);
  } catch (err) {
    console.error('Error joining session:', err);
    error.value = err.message || 'Failed to join session. Check the room code.';
    loading.value = false;
  }
}

function submit() {
  if (mode.value === 'create') return handleCreateSession();
  return handleJoinSession();
}
</script>

<template>
  <div
    class="relative min-h-screen overflow-hidden bg-[var(--sm-surface)] text-[var(--sm-text)]"
  >
    <!-- Soft radial grid backdrop -->
    <div
      class="pointer-events-none absolute inset-0 opacity-60 dark:opacity-40"
      :style="{
        backgroundImage:
          'linear-gradient(var(--sm-border) 1px, transparent 1px), linear-gradient(90deg, var(--sm-border) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
        maskImage:
          'radial-gradient(ellipse at center, black 30%, transparent 80%)',
        WebkitMaskImage:
          'radial-gradient(ellipse at center, black 30%, transparent 80%)',
      }"
    />

    <!-- Top bar -->
    <header class="relative flex items-center justify-between px-8 py-5">
      <div class="flex items-center gap-3">
        <div
          class="flex h-7 w-7 items-center justify-center font-mono text-sm font-bold"
          :style="{
            background: 'var(--sm-ink)',
            color: 'var(--sm-surface)',
          }"
        >
          ·
        </div>
        <span
          class="font-mono text-[11px] font-bold uppercase tracking-[0.06em]"
          :style="{ color: 'var(--sm-ink)' }"
          >Relative Pointing</span
        >
        <Version />
      </div>
      <div class="flex items-center gap-4">
        <button
          @click="themeStore.toggleTheme()"
          class="flex h-8 w-8 items-center justify-center text-[13px] sm-card"
          :title="
            themeStore.isDark ? 'Switch to light mode' : 'Switch to dark mode'
          "
        >
          {{ themeStore.isDark ? '☀' : '☾' }}
        </button>
      </div>
    </header>

    <!-- Centre content -->
    <main
      class="relative mx-auto flex max-w-[1100px] flex-col items-stretch gap-12 px-8 pb-16 pt-6 lg:flex-row lg:items-start lg:gap-16"
    >
      <!-- Left pitch -->
      <section class="flex-1 lg:pt-12">
        <div class="sm-label mb-4">
          Async-friendly · turn-based · Jira-aware
        </div>
        <h1
          class="text-[56px] leading-[0.98] font-bold tracking-[-0.04em] sm:text-[64px]"
          :style="{ color: 'var(--sm-ink)' }"
        >
          Point stories,<br />
          <span
            class="inline-block px-2"
            :style="{
              background: 'var(--sm-accent)',
              color: '#0a0a0a',
              lineHeight: '1.05',
            }"
            >relatively.</span
          >
        </h1>
        <p
          class="mt-6 max-w-md text-base leading-[1.55]"
          :style="{ color: 'var(--sm-muted)' }"
        >
          Drag tickets into complexity columns, one team member at a time. No
          numbers to argue about up front — just relative size, agreed by the
          room.
        </p>
        <ol class="mt-8 flex max-w-md flex-col gap-2.5 list-none p-0">
          <li
            v-for="(step, i) in [
              'Create a room. Share the code.',
              'Import a Jira CSV or add tasks by hand.',
              'Take turns dragging tasks into columns.',
              'End the session, get a report.',
            ]"
            :key="i"
            class="flex items-baseline gap-3.5"
          >
            <span
              class="font-mono text-[11px] font-semibold"
              :style="{ color: 'var(--sm-subtle)' }"
              >{{ String(i + 1).padStart(2, '0') }}</span
            >
            <span
              class="text-sm tracking-[-0.005em]"
              :style="{ color: 'var(--sm-text)' }"
              >{{ step }}</span
            >
          </li>
        </ol>
      </section>

      <!-- Right form card -->
      <section class="lg:w-[420px] lg:flex-shrink-0">
        <div class="relative p-7 sm-card sm-shadow-hard">
          <!-- Tab strip -->
          <div
            class="-mx-7 flex border-b px-7 mb-6"
            :style="{ borderColor: 'var(--sm-border)' }"
          >
            <button
              v-for="m in ['create', 'join']"
              :key="m"
              type="button"
              @click="
                mode = m;
                error = null;
              "
              class="-mb-px mr-6 cursor-pointer py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] transition-colors"
              :style="{
                color: mode === m ? 'var(--sm-ink)' : 'var(--sm-muted)',
                borderBottom:
                  mode === m
                    ? '2px solid var(--sm-accent)'
                    : '2px solid transparent',
              }"
            >
              {{ m === 'create' ? '◆ New session' : '↩ Join session' }}
            </button>
          </div>

          <!-- Headline -->
          <div class="mb-6">
            <div
              class="text-xl font-bold tracking-[-0.02em]"
              :style="{ color: 'var(--sm-ink)' }"
            >
              {{ mode === 'create' ? 'Spin up a room' : 'Drop into a room' }}
            </div>
            <div
              class="mt-1 text-[13px] leading-[1.4]"
              :style="{ color: 'var(--sm-muted)' }"
            >
              {{
                mode === 'create'
                  ? 'You become the host. Share the room code with your team.'
                  : "You'll need the room code from whoever started the session."
              }}
            </div>
          </div>

          <form @submit.prevent="submit" class="flex flex-col gap-4">
            <div>
              <label for="userName" class="sm-label mb-2 block"
                >Your name</label
              >
              <input
                id="userName"
                v-model="userName"
                type="text"
                placeholder="Type a name…"
                maxlength="50"
                :disabled="loading"
                autofocus
                class="sm-input"
              />
            </div>

            <div v-if="mode === 'join'">
              <div class="mb-2 flex items-baseline justify-between">
                <span class="sm-label">Room code</span>
              </div>
              <input
                id="roomCode"
                v-model="roomCode"
                @input="roomCode = roomCode.toLowerCase()"
                type="text"
                placeholder="adjective-animal"
                :disabled="loading"
                class="sm-input font-mono"
              />
            </div>

            <div
              v-if="error"
              class="px-3 py-2 text-[12.5px] sm-card"
              :style="{
                color: '#ef4444',
                borderColor: '#ef4444',
              }"
            >
              {{ error }}
            </div>

            <button
              type="submit"
              :disabled="
                loading ||
                !userName.trim() ||
                (mode === 'join' && !roomCode.trim())
              "
              class="sm-btn sm-btn-primary mt-1 w-full justify-between px-4 py-3 text-[11px] tracking-[0.1em]"
            >
              <span>
                {{
                  loading
                    ? mode === 'create'
                      ? 'Creating…'
                      : 'Joining…'
                    : mode === 'create'
                      ? 'Create session'
                      : 'Join session'
                }}
              </span>
              <span>↵</span>
            </button>
          </form>

          <div
            v-if="mode === 'create'"
            class="mt-4 border-t pt-4 text-center font-mono text-[10.5px] tracking-[0.04em]"
            :style="{
              borderColor: 'var(--sm-hairline)',
              color: 'var(--sm-muted)',
            }"
          >
            You'll get a code like
            <span :style="{ color: 'var(--sm-ink)', fontWeight: 600 }"
              >curious-otter</span
            >
          </div>
        </div>
      </section>
    </main>

    <div
      class="pointer-events-none absolute bottom-5 right-8 hidden gap-4 sm:flex"
    >
      <span class="sm-label">MIT licensed</span>
      <span class="sm-label">SQLite + Vue 3 + Express</span>
    </div>
  </div>
</template>
