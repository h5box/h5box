<script setup lang="ts">
import type { AppMetadata } from '../db';
import { onBeforeUnmount, nextTick, ref } from 'vue';

const props = defineProps<{
  app: AppMetadata
}>();

defineEmits<{
  (e: 'open'): void;
  (e: 'contextmenu', event: MouseEvent): void;
}>();

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  const digits = i === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[i]}`;
}

const iconRef = ref<HTMLElement | null>(null);
const tooltipRef = ref<HTMLElement | null>(null);
const isTooltipOpen = ref(false);
const tooltipPosition = ref({ left: 0, top: 0 });

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const updateTooltipPosition = () => {
  const iconEl = iconRef.value;
  const tooltipEl = tooltipRef.value;
  if (!iconEl || !tooltipEl) return;

  const iconRect = iconEl.getBoundingClientRect();
  const tooltipRect = tooltipEl.getBoundingClientRect();

  const margin = 8;
  const gap = 8;

  const desiredLeft = iconRect.left + iconRect.width / 2 - tooltipRect.width / 2;
  const left = clamp(desiredLeft, margin, window.innerWidth - tooltipRect.width - margin);

  const belowTop = iconRect.bottom + gap;
  const aboveTop = iconRect.top - gap - tooltipRect.height;
  const desiredTop = belowTop + tooltipRect.height > window.innerHeight - margin ? aboveTop : belowTop;
  const top = clamp(desiredTop, margin, window.innerHeight - tooltipRect.height - margin);

  tooltipPosition.value = { left, top };
};

const attachTooltipListeners = () => {
  window.addEventListener('resize', updateTooltipPosition);
  window.addEventListener('scroll', updateTooltipPosition, true);
};

const detachTooltipListeners = () => {
  window.removeEventListener('resize', updateTooltipPosition);
  window.removeEventListener('scroll', updateTooltipPosition, true);
};

const isLongPress = ref(false);
const longPressTimer = ref<number | undefined>(undefined);

const handleTouchStart = (e: TouchEvent) => {
  if (e.touches.length !== 1) return;
  e.stopPropagation(); // Prevent triggering desktop long press
  isLongPress.value = false;
  longPressTimer.value = window.setTimeout(() => {
    isLongPress.value = true;
    e.target?.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      clientX: e.touches[0].clientX,
      clientY: e.touches[0].clientY
    }));
  }, 500);
};

const handleTouchMove = () => {
  clearTimeout(longPressTimer.value);
};

const handleTouchEnd = (e: TouchEvent) => {
  clearTimeout(longPressTimer.value);
  if (isLongPress.value) e.preventDefault();
};

const tooltipTimer = ref<number | undefined>(undefined);

const handleMouseEnter = () => {
  // Disable tooltip on touch devices/mobile
  // Simple check: if width < 768 (Tailwind md breakpoint)
  if (window.innerWidth < 768) return;

  if (tooltipTimer.value) clearTimeout(tooltipTimer.value);
  tooltipTimer.value = window.setTimeout(async () => {
      isTooltipOpen.value = true;
      await nextTick();
      updateTooltipPosition();
      attachTooltipListeners();
  }, 600); // 600ms delay
};

const handleMouseLeave = () => {
  if (tooltipTimer.value) {
      clearTimeout(tooltipTimer.value);
      tooltipTimer.value = undefined;
  }
  isTooltipOpen.value = false;
  detachTooltipListeners();
};

onBeforeUnmount(() => {
  detachTooltipListeners();
});
</script>

<template>
  <div
       ref="iconRef"
       class="group relative flex flex-col items-center p-1 md:p-2 cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-all w-full"
       @click="$emit('open')"
       @contextmenu.prevent="$emit('contextmenu', $event)"
       @touchstart="handleTouchStart"
       @touchend="handleTouchEnd"
       @touchmove="handleTouchMove"
       @mouseenter="handleMouseEnter"
       @mouseleave="handleMouseLeave">
    <div class="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-white dark:bg-gray-700 shadow-md overflow-hidden flex items-center justify-center transition-transform group-hover:scale-105 group-active:scale-95 relative">
      <img v-if="app.icon && app.icon.startsWith('data:')" :src="app.icon" class="w-full h-full object-cover" />
      <!-- If icon is URL but not data URI, we might need proxy or just try loading. 
           But our installer converts to base64 for Zip icons. External URLs are passed as is. -->
      <img v-else-if="app.icon" :src="app.icon" class="w-full h-full object-cover" />
      <div v-else class="text-2xl md:text-2xl font-bold text-gray-400 select-none">{{ (app.title || '?').substring(0, 1).toUpperCase() }}</div>
    </div>
    <div class="mt-1 md:mt-2 flex items-center justify-center gap-1 w-full">
      <div v-if="app.isNew" class="w-2 h-2 bg-blue-500 rounded-full animate-pulse shrink-0"></div>
      <span class="text-[11px] md:text-xs text-gray-700 dark:text-gray-200 font-medium text-center line-clamp-2 break-words select-none leading-tight">{{ app.title || 'Unknown' }}</span>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-show="isTooltipOpen"
      ref="tooltipRef"
      class="fixed z-[2500] w-48 p-3 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-lg shadow-xl transition-opacity duration-150 pointer-events-none text-xs text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-gray-600"
      :class="isTooltipOpen ? 'opacity-100' : 'opacity-0'"
      :style="{ left: tooltipPosition.left + 'px', top: tooltipPosition.top + 'px' }"
    >
       <div class="font-bold text-gray-800 dark:text-white mb-1 text-sm">{{ props.app.title }}</div>
       <div class="text-[10px] text-gray-400 font-mono mb-1 select-all">ID: {{ props.app.id }}</div>
       <div v-if="props.app.version" class="text-[10px] text-gray-500 mb-1">Version: {{ props.app.version }}</div>
       <div v-if="props.app.author && props.app.author !== 'Unknown'" class="mb-1">By: {{ props.app.author }}</div>
       <div v-if="props.app.description" class="line-clamp-3 mb-2 text-gray-500 dark:text-gray-400 italic">{{ props.app.description }}</div>
       <div v-if="props.app.installSource" class="text-indigo-500 dark:text-indigo-400 text-[10px] font-medium mb-1">Source: {{ props.app.installSource }}</div>
       <div class="text-gray-400 text-[10px]">Installed: {{ new Date(props.app.installTime).toLocaleDateString() }}</div>
       <div class="text-gray-400 text-[10px]">Size: {{ formatBytes(props.app.zipBlob?.size ?? 0) }}</div>
       <div v-if="props.app.keywords && props.app.keywords.length" class="flex flex-wrap gap-1 mt-2">
          <span v-for="k in props.app.keywords" :key="k" class="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-[10px]">{{ k }}</span>
       </div>
    </div>
  </Teleport>
</template>
