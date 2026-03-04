<script setup>
import { computed } from 'vue';
import draggable from 'vuedraggable';

const props = defineProps({
  zoneId: {
    type: String,
    default: 'new-column',
  },
  isFirst: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['taskDropped']);

const widthClass = computed(() =>
  props.isFirst ? 'min-w-[50px]' : 'min-w-[20px]'
);

// Empty list for the drop zone
const items = computed({
  get: () => [],
  set: () => {},
});

function onDragChange(evt) {
  if (evt.added) {
    emit('taskDropped', {
      task: evt.added.element,
      zoneId: props.zoneId,
    });
  }
}
</script>

<template>
  <draggable
    :model-value="items"
    :group="{ name: 'tasks', put: true, pull: false }"
    item-key="id"
    :class="[
      'rounded-lg flex-shrink-0 min-h-[500px] border-2 border-dashed flex items-center justify-center text-center transition-all duration-300 ease-out transform',
      widthClass,
      'border-gray-300 bg-gray-50 dark:border-neon-cyan/20 dark:bg-neon-cyan/5 dark:animate-border-glow',
    ]"
    ghost-class="opacity-0"
    @change="onDragChange"
  >
    <template #item="{ element }">
      <div></div>
    </template>
  </draggable>
</template>
