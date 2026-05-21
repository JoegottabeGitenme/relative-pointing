<script setup>
import { ref, computed, onUnmounted } from 'vue';
import draggable from 'vuedraggable';

const props = defineProps({
  zoneId: {
    type: String,
    default: 'new-column',
  },
});

const emit = defineEmits(['taskDropped']);

// Where the zone sits relative to the columns, derived from its id:
//   left   — far-left edge (before the first column)
//   right  — far-right edge / append (after the last column, and empty board)
//   center — between two existing columns
// Edge zones live in the empty margin beside the columns, so they can be a
// wide, easy target without stealing drops from any column. The between zone
// sits inside the ~28px gap between two columns, so it's kept narrow enough
// (w-5 = 20px, centered) to stay fully within that gap and never overlap a
// column's body — otherwise it would steal drops aimed at a column edge.
const placement = computed(() => {
  if (props.zoneId === 'new-column-left') return 'left';
  if (props.zoneId.startsWith('new-column-between')) return 'center';
  return 'right';
});

const zonePosClass = computed(() => {
  if (placement.value === 'center') return 'left-1/2 -translate-x-1/2 w-5';
  if (placement.value === 'left') return 'right-0 w-28';
  return 'left-0 w-28';
});

// Drop zone starts locked — only accepts drops after a short hover delay
// to prevent accidental column creation when dragging past quickly.
const activated = ref(false);
let hoverTimer = null;
// Counter tracks nested dragenter/dragleave events from child elements.
// dragenter fires when entering a child, dragleave fires when leaving the parent
// into that child — the counter ensures we only deactivate when truly leaving.
let enterCount = 0;

const groupConfig = computed(() => ({
  name: 'tasks',
  put: activated.value,
  pull: false,
}));

function onHoverStart() {
  enterCount++;
  if (hoverTimer) return;
  hoverTimer = setTimeout(() => {
    activated.value = true;
  }, 70);
}

function onHoverEnd() {
  enterCount--;
  if (enterCount > 0) return;
  enterCount = 0;
  clearTimeout(hoverTimer);
  hoverTimer = null;
  activated.value = false;
}

onUnmounted(() => {
  clearTimeout(hoverTimer);
  enterCount = 0;
});

// Empty list — drop zone never holds items itself
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
    // A drop consumes the dragenter without a matching dragleave, so reset the
    // full hover state — otherwise the stale hoverTimer would block this zone
    // from ever activating again.
    clearTimeout(hoverTimer);
    hoverTimer = null;
    enterCount = 0;
    activated.value = false;
  }
}
</script>

<template>
  <!-- Zero width in the flex flow so inserting drop zones never displaces the
       existing columns (which would move the user's drop target out from under
       the cursor mid-drag). The droppable strip is an absolutely positioned
       overlay anchored to this point instead. -->
  <div class="relative w-0 flex-shrink-0 self-stretch min-h-[500px] -mx-1.5">
    <!-- Visual indicator layer -->
    <div
      :class="[
        'absolute inset-y-0 flex items-center justify-center pointer-events-none transition-all duration-150',
        zonePosClass,
        activated
          ? 'rounded-lg border-2 border-dashed border-blue-500 bg-blue-100/80 dark:border-accent-cyan/60 dark:bg-accent-cyan/15'
          : '',
      ]"
    >
      <div
        v-if="!activated"
        class="w-0.5 h-full rounded-full bg-gray-300 dark:bg-white/15"
      ></div>
      <span
        v-else
        class="text-2xl text-blue-500 dark:text-accent-cyan select-none"
        >+</span
      >
    </div>

    <!-- Invisible drop target layer. overflow-hidden keeps the ghost card from
         affecting layout. -->
    <draggable
      :model-value="items"
      :group="groupConfig"
      item-key="id"
      :class="['absolute inset-y-0 overflow-hidden opacity-0', zonePosClass]"
      @change="onDragChange"
      @dragenter="onHoverStart"
      @dragleave="onHoverEnd"
    >
      <template #item="{ element }">
        <div></div>
      </template>
    </draggable>
  </div>
</template>
