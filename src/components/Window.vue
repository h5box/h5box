<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import type { AppMetadata } from '../db';
import { db } from '../db';
import { handleBridgeMessage } from '../services/bridge';
import { useAppStore } from '../stores/apps';

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
const APP_POPUP_SIZE_RATIO = 0.65;
const iframeRef = ref<HTMLIFrameElement | null>(null);
const x = ref(100);
const y = ref(100);
const width = ref(800);
const height = ref(600);

const isDragging = ref(false);
const isResizing = ref(false);
const isMaximized = ref(false);
const dragOffset = { x: 0, y: 0 };

const appUrl = computed(() => {
  // Use relative path to support deployment in subdirectories (e.g. GitHub Pages)
  // This assumes the app is running at the root of the relative path
  return `./app/${props.app.id}/index.html`;
});

const windowStyle = computed(() => {
  if (isMaximized.value) {
    return {
      left: '0px',
      top: '0px',
      width: '100%',
      height: '100%',
      zIndex: props.zIndex,
      borderRadius: '0'
    };
  }
  return {
    left: x.value + 'px',
    top: y.value + 'px',
    width: width.value + 'px',
    height: height.value + 'px',
    zIndex: props.zIndex
  };
});

// Persistence
const loadState = async () => {
  try {
    const state = await db.getWindowState(props.app.id);
    if (state) {
      // Check for mobile first - if mobile, force full screen regardless of saved state
      if (window.innerWidth < 768) {
          isMaximized.value = true;
          width.value = window.innerWidth;
          height.value = window.innerHeight;
          x.value = 0;
          y.value = 0;
      } else {
          x.value = state.x;
          y.value = Math.max(0, state.y);
          width.value = state.width;
          height.value = state.height;
      }
      // We could also store isMaximized in DB if we wanted to restore that state
    } else {
      // Check for mobile
      if (window.innerWidth < 768) {
          isMaximized.value = true;
          width.value = window.innerWidth;
          height.value = window.innerHeight;
          x.value = 0;
          y.value = 0;
      } else {
          // Center-ish default
          width.value = 800;
          height.value = 600;
          x.value = Math.max(0, (window.innerWidth - 800) / 2 + (Math.random() * 40 - 20));
          y.value = Math.max(0, (window.innerHeight - 600) / 2 + (Math.random() * 40 - 20));
      }
    }
  } catch (e) {
    console.error('Failed to load window state', e);
  }
};

const saveState = async () => {
  try {
    await db.saveWindowState(props.app.id, {
      x: x.value,
      y: y.value,
      width: width.value,
      height: height.value
    });
  } catch (e) {
    console.error('Failed to save window state', e);
  }
};

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    loadState();
  }
});

// Dragging
const startDrag = (e: MouseEvent) => {
  isDragging.value = true;
  dragOffset.x = e.clientX - x.value;
  dragOffset.y = e.clientY - y.value;
  emit('focus');
  window.addEventListener('mousemove', onDrag);
  window.addEventListener('mouseup', stopDrag);
};

const onDrag = (e: MouseEvent) => {
  if (!isDragging.value) return;
  x.value = e.clientX - dragOffset.x;
  y.value = Math.max(0, e.clientY - dragOffset.y);
};

const stopDrag = () => {
  isDragging.value = false;
  window.removeEventListener('mousemove', onDrag);
  window.removeEventListener('mouseup', stopDrag);
  saveState();
};

// Touch Dragging
const startTouchDrag = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    isDragging.value = true;
    dragOffset.x = touch.clientX - x.value;
    dragOffset.y = touch.clientY - y.value;
    emit('focus');
    window.addEventListener('touchmove', onTouchDrag, { passive: false });
    window.addEventListener('touchend', stopTouchDrag);
};

const onTouchDrag = (e: TouchEvent) => {
    if (!isDragging.value) return;
    e.preventDefault(); // Prevent scrolling while dragging window
    const touch = e.touches[0];
    x.value = touch.clientX - dragOffset.x;
    y.value = Math.max(0, touch.clientY - dragOffset.y);
};

const stopTouchDrag = () => {
    isDragging.value = false;
    window.removeEventListener('touchmove', onTouchDrag);
    window.removeEventListener('touchend', stopTouchDrag);
    saveState();
};

// Resizing
const startResize = () => {
  isResizing.value = true;
  emit('focus');
  window.addEventListener('mousemove', onResize);
  window.addEventListener('mouseup', stopResize);
};

const onResize = (e: MouseEvent) => {
  if (!isResizing.value) return;
  width.value = Math.max(200, e.clientX - x.value);
  height.value = Math.max(200, e.clientY - y.value);
};

const stopResize = () => {
  isResizing.value = false;
  window.removeEventListener('mousemove', onResize);
  window.removeEventListener('mouseup', stopResize);
  saveState();
};

const startTouchResize = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    isResizing.value = true;
    emit('focus');
    window.addEventListener('touchmove', onTouchResize, { passive: false });
    window.addEventListener('touchend', stopTouchResize);
};

const onTouchResize = (e: TouchEvent) => {
    if (!isResizing.value) return;
    e.preventDefault();
    const touch = e.touches[0];
    width.value = Math.max(200, touch.clientX - x.value);
    height.value = Math.max(200, touch.clientY - y.value);
};

const stopTouchResize = () => {
    isResizing.value = false;
    window.removeEventListener('touchmove', onTouchResize);
    window.removeEventListener('touchend', stopTouchResize);
    saveState();
};

const toggleMaximize = () => {
  isMaximized.value = !isMaximized.value;
};

const handleClose = () => {
    saveState();
    emit('close');
};

const openInPopup = () => {
    const screenW = window.screen.availWidth;
    const screenH = window.screen.availHeight;
    const w = Math.floor(screenW * APP_POPUP_SIZE_RATIO);
    const h = Math.floor(screenH * APP_POPUP_SIZE_RATIO);
    const left = (screenW - w) / 2;
    const top = (screenH - h) / 2;
    
    window.open(
        appUrl.value, 
        '_blank', 
        `width=${w},height=${h},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`
    );
    handleClose();
};

const onMessage = async (event: MessageEvent) => {
    if (iframeRef.value && event.source === iframeRef.value.contentWindow) {
        const result = await handleBridgeMessage(
            event, 
            props.app.id, 
            iframeRef.value.contentWindow as WindowProxy,
            {
                onOpenApp: (appId) => emit('open-app', appId)
            }
        );
        
        if (result && result.success) {
            if (result.type === 'system.installApp' || result.type === 'system.uninstallApp') {
                await appStore.loadApps();
            }
        }
    }
};

onMounted(() => {
    if (props.isOpen) loadState();
    window.addEventListener('message', onMessage);
});

onUnmounted(() => {
    window.removeEventListener('message', onMessage);
});

</script>

<template>
  <div v-if="isOpen" 
       class="fixed bg-white dark:bg-gray-800 rounded-lg shadow-2xl overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700 glass-panel"
       :style="windowStyle"
       @mousedown="$emit('focus')"
       @contextmenu.stop.prevent>
    
    <!-- Title Bar -->
    <div class="h-9 bg-gray-100/90 dark:bg-gray-900/90 backdrop-blur flex items-center justify-between px-3 cursor-grab active:cursor-grabbing select-none border-b border-gray-200 dark:border-gray-700"
         @mousedown="startDrag"
         @touchstart="startTouchDrag"
         @dblclick="toggleMaximize"
         @contextmenu.stop.prevent>
      <div class="flex items-center gap-2 overflow-hidden">
        <img v-if="app.icon" :src="app.icon" class="w-4 h-4 rounded-sm shrink-0" />
        <span class="text-xs font-bold text-gray-700 dark:text-gray-200 truncate">{{ app.title }}</span>
      </div>
      <div class="flex items-center gap-2 pl-2">
         <!-- Window Controls -->
         <button @click.stop="openInPopup" 
                 title="在新窗口打开"
                 class="w-6 h-6 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 shadow-sm transition-colors flex items-center justify-center cursor-pointer mr-1">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6M10 14L20 4" />
            </svg>
         </button>
         <button @click.stop="toggleMaximize" 
                 :title="isMaximized ? '还原' : '最大化'"
                 class="w-6 h-6 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 shadow-sm transition-colors flex items-center justify-center cursor-pointer mr-1">
            <svg v-if="!isMaximized" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4h4M9 9L4 4 M20 8V4h-4M15 9L20 4 M4 16v4h4M9 15L4 20 M20 16v4h-4M15 15L20 20" />
            </svg>
            <svg v-else class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 14v6h6M4 20L10 14M20 10V4h-6M20 4L14 10" />
            </svg>
         </button>
         <button @click.stop="handleClose" 
                 class="w-6 h-6 rounded-md bg-red-500 hover:bg-red-600 shadow-sm transition-colors group flex items-center justify-center cursor-pointer">
            <svg class="w-3 h-3 text-white opacity-80 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12" />
            </svg>
         </button>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 relative bg-white dark:bg-gray-900 w-full h-full overflow-hidden">
      <!-- iframe needs pointer-events-none while dragging to avoid capturing mouse events -->
      <slot>
          <iframe ref="iframeRef"
              :src="appUrl" 
              class="w-full h-full border-0"
              :class="{ 'pointer-events-none': isDragging || isResizing }"></iframe>
      </slot>
      
      <!-- Loading indicator or background if transparent -->
    </div>

    <!-- Resize Handle -->
    <div v-if="!isMaximized"
         class="absolute bottom-0 right-0 w-8 h-8 cursor-se-resize z-20 flex items-end justify-end p-1 touch-none"
         @mousedown.stop.prevent="startResize"
         @touchstart.stop.prevent="startTouchResize">
         <div class="w-2 h-2 border-r-2 border-b-2 border-gray-300 dark:border-gray-600"></div>
    </div>
  </div>
</template>>

<style scoped>

</style>
