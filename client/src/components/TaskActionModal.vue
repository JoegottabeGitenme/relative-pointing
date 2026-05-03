<script setup>
import { ref, onMounted, computed } from 'vue';
import { useSessionStore } from '../stores/session';
import { useUserStore } from '../stores/user';
import APIService from '../services/api';
import { TAG_COLOR_PALETTE } from './taskTags';

const props = defineProps({
  task: { type: Object, required: true },
  tags: { type: Array, default: () => [] },
  initialTab: { type: String, default: 'tags' },
});

const emit = defineEmits(['close', 'updateTag', 'deleteTask']);

const sessionStore = useSessionStore();
const userStore = useUserStore();

const activeTab = ref(props.initialTab);
const confirmDelete = ref(false);
const comments = ref([]);
const loadingComments = ref(false);
const commentText = ref('');
const submittingComment = ref(false);

const showCreateTag = ref(false);
const newTagName = ref('');
const newTagColor = ref('blue');

const currentTagId = computed(() => props.task.tag_id || null);

const BUILTIN_ORDER = ['Ready for Dev', 'Needs Updates', 'Blocked'];
const orderedTags = computed(() => {
  const sorted = [...props.tags];
  sorted.sort((a, b) => {
    const aIdx = BUILTIN_ORDER.indexOf(a.name);
    const bIdx = BUILTIN_ORDER.indexOf(b.name);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return 0;
  });
  return sorted;
});

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

function tagColorVar(color) {
  return TAG_COLOR_VARS[color] || 'var(--sm-tag-blue)';
}

onMounted(() => {
  loadComments();
});

async function loadComments() {
  if (!sessionStore.roomCode) return;
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

function selectTag(tagId) {
  const newTagId = tagId === currentTagId.value ? null : tagId;
  emit('updateTag', props.task.id, newTagId);
}

async function handleCreateTag() {
  if (!newTagName.value.trim()) return;
  try {
    const tag = await sessionStore.createTag(
      newTagName.value.trim(),
      newTagColor.value
    );
    showCreateTag.value = false;
    newTagName.value = '';
    newTagColor.value = 'blue';
    if (tag) {
      emit('updateTag', props.task.id, tag.id);
    }
  } catch (err) {
    console.error('Error creating tag:', err);
  }
}

async function handleDeleteTag(tagId) {
  try {
    await sessionStore.deleteTag(tagId);
  } catch (err) {
    console.error('Error deleting tag:', err);
  }
}

async function handleAddComment() {
  if (!commentText.value.trim() || submittingComment.value) return;
  submittingComment.value = true;
  try {
    const comment = await APIService.addTaskComment(
      sessionStore.roomCode,
      props.task.id,
      userStore.userId,
      userStore.userName,
      commentText.value.trim()
    );
    comments.value = [...comments.value, comment];
    commentText.value = '';
  } catch (err) {
    console.error('Error adding comment:', err);
  } finally {
    submittingComment.value = false;
  }
}

function handleDeleteTask() {
  if (!confirmDelete.value) {
    confirmDelete.value = true;
    return;
  }
  emit('deleteTask', props.task.id);
  emit('close');
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const displayId = computed(() => props.task.display_id || props.task.id);
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center"
    :style="{ background: 'rgba(10,10,10,0.55)', backdropFilter: 'blur(2px)' }"
    @click.self="emit('close')"
  >
    <div
      class="mx-4 flex w-full max-w-md flex-col sm-card sm-shadow-hard"
      style="max-height: 80vh"
    >
      <!-- Header -->
      <div
        class="flex items-center justify-between px-5 py-3.5 flex-shrink-0"
        :style="{ borderBottom: '1px solid var(--sm-border)' }"
      >
        <div class="flex items-center gap-2.5 min-w-0">
          <span
            class="px-2 py-0.5 font-mono text-[10.5px] font-bold tracking-[0.04em] flex-shrink-0"
            :style="{
              color: 'var(--sm-ink)',
              background: 'var(--sm-card-alt)',
              border: '1px solid var(--sm-border)',
              borderRadius: '1px',
            }"
            >{{ displayId }}</span
          >
          <span
            class="text-[12.5px] font-medium truncate"
            :style="{ color: 'var(--sm-text)' }"
            >{{ task.title || 'Untitled' }}</span
          >
        </div>
        <button
          @click="emit('close')"
          class="ml-2 flex h-7 w-7 flex-shrink-0 items-center justify-center font-mono text-[13px]"
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

      <!-- Tabs -->
      <div
        class="flex flex-shrink-0"
        :style="{ borderBottom: '1px solid var(--sm-border)' }"
      >
        <button
          v-for="tab in [
            { id: 'tags', label: 'Tags' },
            { id: 'comments', label: 'Comments' },
            { id: 'settings', label: 'Settings' },
          ]"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="flex-1 py-2.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] transition-colors"
          :style="{
            color: activeTab === tab.id ? 'var(--sm-ink)' : 'var(--sm-muted)',
            borderBottom:
              activeTab === tab.id
                ? '2px solid var(--sm-accent)'
                : '2px solid transparent',
            marginBottom: '-1px',
          }"
        >
          {{ tab.label }}
          <span
            v-if="tab.id === 'comments' && comments.length > 0"
            class="ml-1 px-1.5 py-px text-[9.5px] font-mono"
            :style="{
              background: 'var(--sm-card-alt)',
              borderRadius: '1px',
              color: 'var(--sm-ink)',
            }"
            >{{ comments.length }}</span
          >
        </button>
      </div>

      <!-- Tab content -->
      <div class="flex-1 overflow-y-auto p-5">
        <!-- Tags tab -->
        <div v-if="activeTab === 'tags'" class="flex flex-col gap-2.5">
          <button
            v-for="tag in orderedTags"
            :key="tag.id"
            :data-active="currentTagId === tag.id ? 'true' : undefined"
            class="flex items-center gap-2.5 px-3 py-2 transition-all cursor-pointer"
            :style="{
              background:
                currentTagId === tag.id
                  ? 'var(--sm-active-row)'
                  : 'transparent',
              border:
                currentTagId === tag.id
                  ? '1px solid var(--sm-accent)'
                  : '1px solid var(--sm-border)',
              borderRadius: '2px',
              boxShadow:
                currentTagId === tag.id ? '2px 2px 0 var(--sm-accent)' : 'none',
            }"
            @click="selectTag(tag.id)"
          >
            <span
              class="block h-2 w-2 flex-shrink-0"
              :style="{ background: tagColorVar(tag.color) }"
            ></span>
            <span
              class="flex-1 text-left text-[13px] font-medium tracking-[-0.005em]"
              :style="{ color: 'var(--sm-text)' }"
              >{{ tag.name }}</span
            >
            <span
              v-if="currentTagId === tag.id"
              class="font-mono text-[10px] font-bold"
              :style="{ color: 'var(--sm-ink)' }"
              >✓</span
            >
            <button
              v-if="!tag.is_builtin"
              class="font-mono text-[10px]"
              :style="{ color: 'var(--sm-muted)' }"
              title="Delete tag"
              @click.stop="handleDeleteTag(tag.id)"
            >
              ✕
            </button>
          </button>

          <button
            v-if="currentTagId"
            class="mt-1 self-start font-mono text-[10.5px] uppercase tracking-[0.08em] hover:underline"
            :style="{ color: 'var(--sm-muted)' }"
            @click="selectTag(null)"
          >
            Clear tag
          </button>

          <!-- Create tag -->
          <div
            v-if="showCreateTag"
            class="mt-2 flex flex-col gap-2 pt-3"
            :style="{ borderTop: '1px solid var(--sm-hairline)' }"
          >
            <input
              v-model="newTagName"
              type="text"
              placeholder="Tag name"
              class="sm-input text-[13px]"
              @keyup.enter="handleCreateTag"
            />
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="color in TAG_COLOR_PALETTE"
                :key="color.id"
                class="h-6 w-6 transition-all"
                :style="{
                  background: tagColorVar(color.id),
                  borderRadius: '2px',
                  outline:
                    newTagColor === color.id
                      ? '2px solid var(--sm-ink)'
                      : 'none',
                  outlineOffset: '2px',
                }"
                :title="color.name"
                @click="newTagColor = color.id"
              ></button>
            </div>
            <div class="flex gap-2">
              <button
                class="sm-btn sm-btn-primary text-[10px]"
                @click="handleCreateTag"
              >
                Save
              </button>
              <button class="sm-btn text-[10px]" @click="showCreateTag = false">
                Cancel
              </button>
            </div>
          </div>
          <button
            v-else
            class="self-start font-mono text-[10.5px] uppercase tracking-[0.08em] hover:underline"
            :style="{ color: 'var(--sm-ink)' }"
            @click="showCreateTag = true"
          >
            + Create tag
          </button>
        </div>

        <!-- Comments tab -->
        <div v-if="activeTab === 'comments'" class="flex flex-col gap-3">
          <div class="flex gap-2">
            <input
              v-model="commentText"
              type="text"
              placeholder="Add a comment…"
              class="sm-input flex-1 text-[13px]"
              @keyup.enter="handleAddComment"
            />
            <button
              class="sm-btn sm-btn-primary text-[10px]"
              :disabled="!commentText.trim() || submittingComment"
              @click="handleAddComment"
            >
              Add
            </button>
          </div>

          <div v-if="loadingComments" class="py-3 text-center">
            <span class="sm-label">Loading…</span>
          </div>
          <div v-else-if="comments.length === 0" class="py-3 text-center">
            <span class="sm-label">No comments yet</span>
          </div>
          <div v-else class="flex flex-col gap-2.5">
            <div
              v-for="c in comments"
              :key="c.id"
              class="px-3 py-2 sm-card-alt"
            >
              <div class="mb-1 flex items-center justify-between">
                <span
                  class="text-[12px] font-semibold tracking-[-0.005em]"
                  :style="{ color: 'var(--sm-ink)' }"
                  >{{ c.user_name }}</span
                >
                <span
                  class="font-mono text-[10px]"
                  :style="{ color: 'var(--sm-subtle)' }"
                  >{{ formatTime(c.created_at) }}</span
                >
              </div>
              <p
                class="text-[13px] leading-[1.5]"
                :style="{ color: 'var(--sm-text)' }"
              >
                {{ c.content }}
              </p>
            </div>
          </div>
        </div>

        <!-- Settings tab -->
        <div v-if="activeTab === 'settings'" class="flex flex-col gap-4">
          <div
            class="p-4"
            :style="{
              border: '1px solid #ef4444',
              borderRadius: '2px',
            }"
          >
            <div class="mb-1.5 flex items-center gap-2">
              <span class="sm-label" :style="{ color: '#ef4444' }"
                >Danger zone</span
              >
            </div>
            <p
              class="mb-3 text-[12px] leading-[1.5]"
              :style="{ color: 'var(--sm-muted)' }"
            >
              Permanently delete this task. This action cannot be undone.
            </p>
            <button
              class="sm-btn sm-btn-danger"
              :style="
                confirmDelete ? { background: '#ef4444', color: '#fff' } : {}
              "
              @click="handleDeleteTask"
            >
              {{ confirmDelete ? 'Click again to confirm' : 'Delete task' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
