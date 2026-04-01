<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { AppMetadata } from '../db';
import { handleBridgeMessage } from '../services/bridge';
import { useAppStore } from '../stores/apps';
import { useWindowFrame } from '../composables/useWindowFrame';

const props = defineProps<{
  app: AppMetadata;
  isOpen: boolean;
  zIndex: number;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'focus'): void;
  (e: 'open-app', appId: string): void;
}>();

const appStore = useAppStore();
const iframeRef = ref<HTMLIFrameElement | null>(null);
const APP_POPUP_SIZE_RATIO = 0.65;

const {
  isDragging,
  isResizing,
  isMaximized,
  windowStyle,
  saveState,
  startDrag,
  startTouchDrag,
  startResize,
  startTouchResize,
  toggleMaximize
} = useWindowFrame(props.app, () => props.zIndex, () => props.isOpen);

const appUrl = computed(() => `./app/${props.app.id}/index.html`);

const externalLaunchUrl = computed(() => {
  if (props.app.launchMode !== 'external') return '';
  return props.app.officialWebsite?.trim() || '';
});

const focusWindow = () => {
  emit('focus');
};

const handleWindowDragStart = (event: MouseEvent) => {
  focusWindow();
  startDrag(event);
};

const handleWindowTouchDragStart = (event: TouchEvent) => {
  focusWindow();
  startTouchDrag(event);
};

const handleWindowResizeStart = () => {
  focusWindow();
  startResize();
};

const handleWindowTouchResizeStart = (event: TouchEvent) => {
  focusWindow();
  startTouchResize(event);
};

const handleClose = () => {
  void saveState();
  emit('close');
};

const openInPopup = () => {
  const screenW = window.screen.availWidth;
  const screenH = window.screen.availHeight;
  const width = Math.floor(screenW * APP_POPUP_SIZE_RATIO);
  const height = Math.floor(screenH * APP_POPUP_SIZE_RATIO);
  const left = (screenW - width) / 2;
  const top = (screenH - height) / 2;

  window.open(
    externalLaunchUrl.value || appUrl.value,
    '_blank',
    `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`
  );
  handleClose();
};

const onMessage = async (event: MessageEvent) => {
  if (!iframeRef.value || event.source !== iframeRef.value.contentWindow) return;

  const result = await handleBridgeMessage(
    event,
    props.app.id,
    iframeRef.value.contentWindow as WindowProxy,
    {
      onOpenApp: (appId) => emit('open-app', appId)
    }
  );

  if (result?.success && (result.type === 'system.installApp' || result.type === 'system.uninstallApp')) {
    await appStore.loadApps();
  }
};

onMounted(() => {
  window.addEventListener('message', onMessage);
});

onUnmounted(() => {
  window.removeEventListener('message', onMessage);
});
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed bg-white dark:bg-gray-800 rounded-lg shadow-2xl overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700 glass-panel"
    :style="windowStyle"
    @mousedown="focusWindow"
    @contextmenu.stop.prevent
  >
    <div
      class="h-9 bg-gray-100/90 dark:bg-gray-900/90 backdrop-blur flex items-center justify-between px-3 cursor-grab active:cursor-grabbing select-none border-b border-gray-200 dark:border-gray-700"
      @mousedown="handleWindowDragStart"
      @touchstart="handleWindowTouchDragStart"
      @dblclick="toggleMaximize"
      @contextmenu.stop.prevent
    >
      <div class="flex items-center gap-2 overflow-hidden">
        <img v-if="app.icon" :src="app.icon" class="w-4 h-4 rounded-sm shrink-0" />
        <span class="text-xs font-bold text-gray-700 dark:text-gray-200 truncate">{{ app.title }}</span>
      </div>
      <div class="flex items-center gap-2 pl-2">
        <button
          @click.stop="openInPopup"
          title="在新窗口打开"
          class="w-6 h-6 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 shadow-sm transition-colors flex items-center justify-center cursor-pointer mr-1"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6M10 14L20 4" />
          </svg>
        </button>
        <button
          @click.stop="toggleMaximize"
          :title="isMaximized ? '还原' : '最大化'"
          class="w-6 h-6 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 shadow-sm transition-colors flex items-center justify-center cursor-pointer mr-1"
        >
          <svg v-if="!isMaximized" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4h4M9 9L4 4 M20 8V4h-4M15 9L20 4 M4 16v4h4M9 15L4 20 M20 16v4h-4M15 15L20 20" />
          </svg>
          <svg v-else class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 14v6h6M4 20L10 14M20 10V4h-6M20 4L14 10" />
          </svg>
        </button>
        <button
          @click.stop="handleClose"
          class="w-6 h-6 rounded-md bg-red-500 hover:bg-red-600 shadow-sm transition-colors group flex items-center justify-center cursor-pointer"
        >
          <svg class="w-3 h-3 text-white opacity-80 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <div class="flex-1 relative bg-white dark:bg-gray-900 w-full h-full overflow-hidden">
      <slot>
        <iframe
          ref="iframeRef"
          :src="appUrl"
          class="w-full h-full border-0"
          :class="{ 'pointer-events-none': isDragging || isResizing }"
        ></iframe>
      </slot>
    </div>

    <div
      v-if="!isMaximized"
      class="absolute bottom-0 right-0 w-8 h-8 cursor-se-resize z-20 flex items-end justify-end p-1 touch-none"
      @mousedown.stop.prevent="handleWindowResizeStart"
      @touchstart.stop.prevent="handleWindowTouchResizeStart"
    >
      <div class="w-2 h-2 border-r-2 border-b-2 border-gray-300 dark:border-gray-600"></div>
    </div>
  </div>
</template>

<style scoped>
</style>
