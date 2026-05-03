<script setup>
import { ref, computed } from 'vue';
import draggable from 'vuedraggable';
import TaskItem from './TaskItem.vue';
import TaskInfoModal from './TaskInfoModal.vue';

const props = defineProps({
  columnId: { type: String, required: true },
  title: { type: String, default: '' },
  tasks: { type: Array, default: () => [] },
  tags: { type: Array, default: () => [] },
  variant: { type: String, default: 'default' },
  jiraBaseUrl: { type: String, default: null },
  dragDisabled: { type: Boolean, default: false },
  stackMode: { type: Boolean, default: false },
  topTaskId: { type: String, default: null },
  columnIndex: { type: Number, default: 0 },
  pointValue: { type: [Number, String, null], default: null },
});

const emit = defineEmits(['openActionModal', 'taskMoved']);

const selectedTask = ref(null);

const localTasks = computed({
  get: () => props.tasks.filter((t) => t && t.id),
  set: () => {},
});

function onDragChange(evt) {
  if (evt.added) {
    emit('taskMoved', {
      task: evt.added.element,
      toColumnId: props.columnId,
    });
  }
}
</script>

<template>
  <div>
    <div class="flex w-[220px] flex-shrink-0 flex-col">
      <!-- Header -->
      <div
        class="mb-2.5 flex items-center justify-between pb-2"
        :style="{ borderBottom: '1px solid var(--sm-border)' }"
      >
        <div class="flex items-baseline gap-2 min-w-0">
          <span
            v-if="variant !== 'tasks'"
            class="font-mono text-[10px] font-semibold flex-shrink-0"
            :style="{ color: 'var(--sm-subtle)' }"
            >{{ String(columnIndex + 1).padStart(2, '0') }}</span
          >
          <span
            class="text-[13px] font-bold tracking-[-0.01em] truncate"
            :style="{ color: 'var(--sm-ink)' }"
            >{{ title }}</span
          >
        </div>
        <div class="flex items-center gap-1.5 flex-shrink-0">
          <span
            v-if="
              variant !== 'tasks' && pointValue !== null && pointValue !== ''
            "
            class="font-mono text-[11px] font-bold px-1.5 py-px"
            :style="{
              background: 'var(--sm-accent)',
              color: '#0a0a0a',
              borderRadius: '2px',
            }"
            >{{ pointValue }}pt</span
          >
          <span
            class="font-mono text-[10px]"
            :style="{ color: 'var(--sm-muted)' }"
            >×{{ localTasks.length }}</span
          >
        </div>
      </div>

      <draggable
        :model-value="localTasks"
        group="tasks"
        item-key="id"
        :filter="'.no-drag'"
        :prevent-on-filter="false"
        :disabled="dragDisabled"
        class="flex-1 flex flex-col gap-1.5 min-h-[400px]"
        ghost-class="opacity-30"
        @change="onDragChange"
      >
        <template #item="{ element, index }">
          <div>
            <TaskItem
              :task="element"
              :jira-base-url="jiraBaseUrl"
              :tags="tags"
              :show-info="true"
              :highlighted="
                stackMode &&
                variant === 'tasks' &&
                topTaskId &&
                String(element.id) === String(topTaskId)
              "
              :drag-disabled="
                dragDisabled ||
                (stackMode &&
                  variant === 'tasks' &&
                  topTaskId &&
                  String(element.id) !== String(topTaskId))
              "
              @open-action-modal="emit('openActionModal', $event)"
              @show-info="selectedTask = $event"
            />
            <!-- Stack mode separator (after the top card) -->
            <div
              v-if="
                stackMode &&
                variant === 'tasks' &&
                index === 0 &&
                localTasks.length > 1
              "
              class="my-2 ml-0.5 mr-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] font-semibold"
              :style="{ color: 'var(--sm-subtle)' }"
            >
              ↓ up next ({{ localTasks.length - 1 }})
            </div>
          </div>
        </template>
        <template #footer>
          <p
            v-if="!localTasks || localTasks.length === 0"
            class="py-4 text-center font-mono text-[10px] uppercase tracking-[0.08em]"
            :style="{ color: 'var(--sm-subtle)' }"
          >
            empty
          </p>
        </template>
      </draggable>
    </div>

    <TaskInfoModal
      v-if="selectedTask"
      :task="selectedTask"
      :tags="tags"
      @close="selectedTask = null"
    />
  </div>
</template>
