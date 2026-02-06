<script setup lang="ts">
import { ref, onMounted, nextTick, onUnmounted, computed } from 'vue';
import { useAppStore } from '../stores/apps';
import { useDropZone } from '@vueuse/core';
import draggable from 'vuedraggable';
import { useToast } from '../composables/useToast';
import { useSettings } from '../composables/useSettings';
import { handleBridgeMessage } from '../services/bridge';
import { DB_VERSION } from '../db';
import AppIcon from './AppIcon.vue';
import Window from './Window.vue';
import EditAppModal from './EditAppModal.vue';
import RenameAppModal from './RenameAppModal.vue';
import UninstallAppModal from './UninstallAppModal.vue';
import PermissionRequestModal from './PermissionRequestModal.vue';
import SettingsModal from './SettingsModal.vue';
import GuideModal from './GuideModal.vue';
import AppUpdateModal from './AppUpdateModal.vue';

const APP_VERSION = '1.0.2';

const appStore = useAppStore();
const draggableApps = computed({
    get: () => appStore.apps,
    set: (value) => {
        appStore.updateAppOrder(value);
    }
});
const { addToast } = useToast();
const { openMethod } = useSettings();
const dropZoneRef = ref<HTMLElement | null>(null);
const installFileInputRef = ref<HTMLInputElement | null>(null);
// const showAppStore = ref(false); // Removed
const showEditModal = ref(false);
const showRenameModal = ref(false);
const showUninstallModal = ref(false);
const showSettingsModal = ref(false);
const showGuideModal = ref(false);
const editAppId = ref('');
const renameAppId = ref('');
const uninstallAppId = ref('');
const uninstallBusy = ref(false);

const isDraggingApp = ref(false);
const isDragOverFiles = ref(false);

// Drop Zone Logic (Install)
// We still use useDropZone for the onDrop handler, but we manage isDragOverFiles manually
// because useDropZone.isOverDropZone is triggered by any drag event (including sorting apps)
useDropZone(dropZoneRef, {
    onDrop: async (files) => {
        isDragOverFiles.value = false;
        if (isDraggingApp.value) return; // Prevent file drop logic if dragging app
        if (!files) return;
        // files is File[] | null
        for (const file of files) {
            if (file.name.toLowerCase().endsWith('.zip')) {
                await appStore.installFromFileSmart(file);
                if (appStore.error) {
                    addToast(`安装失败 "${file.name}": ${appStore.error}`, 'error');
                } else {
                    addToast(`安装成功: ${file.name}`, 'success');
                }
            } else {
                addToast(`无法安装 "${file.name}": 仅支持 .zip 格式的应用包`, 'warning');
            }
        }
    },
    onEnter: (_files, event) => {
        // Check if the dragged item is a file
        if (event && event.dataTransfer && event.dataTransfer.types.includes('Files')) {
            isDragOverFiles.value = true;
        }
    },
    onLeave: () => {
        isDragOverFiles.value = false;
    }
});

// Window Management
const openWindows = ref<string[]>([]);
const windowZIndices = ref<Record<string, number>>({});
const popupWindows = new Map<Window, string>(); // Map<WindowProxy, appId>
let maxZIndex = 100;

const openApp = async (id: string) => {
  if (!openWindows.value.includes(id)) {
    openWindows.value.push(id);
  }
  bringToFront(id);
  // Clear new flag when opening
  await appStore.clearNewFlag(id);
};

const openAppInPopup = (appId: string) => {
     // Popup window instead of new tab
     // Auto-size logic: 85% of screen width/height, centered
     const screenW = window.screen.availWidth;
     const screenH = window.screen.availHeight;
     
     const width = Math.floor(screenW * 0.65);
     const height = Math.floor(screenH * 0.65);
     const left = (screenW - width) / 2;
     const top = (screenH - height) / 2;
     
     // CHANGED: Use relative path for subdirectories
     const win = window.open(`./app/${appId}/index.html`, '_blank', `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`);
     
     if (win) {
         popupWindows.set(win, appId);
         
         // Optional: Poll to clean up closed windows from map?
         // For now, we just keep them. Memory leak is minimal (Window reference).
         // We can use a WeakMap if Window was the key, but we need to iterate or lookup.
         // Actually Map<Window, string> is fine.
     }
};

const handleAppLaunch = async (id: string) => {
    if (openMethod.value === 'popup') {
        openAppInPopup(id);
        await appStore.clearNewFlag(id);
    } else {
        openApp(id);
    }
};

const closeApp = (id: string) => {
  openWindows.value = openWindows.value.filter(w => w !== id);
  delete windowZIndices.value[id];
};

const bringToFront = (id: string) => {
  maxZIndex++;
  windowZIndices.value[id] = maxZIndex;
};

const getZIndex = (id: string) => windowZIndices.value[id] || 100;

// Context Menu
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  appId: ''
});

const contextMenuRef = ref<HTMLElement | null>(null);

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const repositionContextMenu = async () => {
  await nextTick();
  const el = contextMenuRef.value;
  if (!el) return;

  const margin = 8;
  const width = el.offsetWidth;
  const height = el.offsetHeight;

  const left = clamp(contextMenu.value.x, margin, window.innerWidth - width - margin);
  const top = clamp(contextMenu.value.y, margin, window.innerHeight - height - margin);

  contextMenu.value.x = left;
  contextMenu.value.y = top;
};

const showContextMenu = (e: MouseEvent, appId: string) => {
  contextMenu.value = {
    visible: true,
    x: e.clientX,
    y: e.clientY,
    appId
  };
  repositionContextMenu();
};

const showDesktopMenu = (e: MouseEvent) => {
    if (showEditModal.value || showRenameModal.value || showUninstallModal.value) return;
    contextMenu.value = {
        visible: true,
        x: e.clientX,
        y: e.clientY,
        appId: '' // Empty appId indicates desktop menu
    };
    repositionContextMenu();
};

const closeContextMenu = () => {
  contextMenu.value.visible = false;
};

const handleInstallApp = () => {
    closeContextMenu();
    showGuideModal.value = true;
};

const handleInstallFileChange = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
        addToast('请选择 .zip 格式的应用包', 'warning');
        return;
    }
    await appStore.installFromFileSmart(file);
    if (appStore.error) {
        addToast(`安装失败: ${appStore.error}`, 'error');
    } else {
        addToast('安装成功', 'success');
    }
};

const handleEdit = () => {
  const appId = contextMenu.value.appId;
  closeContextMenu();
  editAppId.value = appId;
  showEditModal.value = true;
};

const handleRename = async () => {
  const appId = contextMenu.value.appId;
  closeContextMenu();
  renameAppId.value = appId;
  showRenameModal.value = true;
};

const handleDoRename = async (newName: string) => {
    if (renameAppId.value && newName) {
        await appStore.renameApp(renameAppId.value, newName);
    }
};

const handleExportApp = async () => {
    const appId = contextMenu.value.appId;
    closeContextMenu();
    const app = appStore.apps.find(a => a.id === appId);
    if (!app || !app.zipBlob) {
        addToast('无法导出：找不到应用文件', 'error');
        return;
    }
    
    // Create download link
    const url = URL.createObjectURL(app.zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${app.title}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

const handleOpenSource = () => {
    const appId = contextMenu.value.appId;
    closeContextMenu();
    const app = appStore.apps.find(a => a.id === appId);
    if (app && app.repository) {
        window.open(app.repository, '_blank');
    }
};

const handleUninstall = async () => {
  const appId = contextMenu.value.appId;
  closeContextMenu();
  uninstallAppId.value = appId;
  showUninstallModal.value = true;
};

const handleCloseUninstallModal = () => {
  if (uninstallBusy.value) return;
  showUninstallModal.value = false;
  uninstallAppId.value = '';
};

const handleConfirmUninstall = async () => {
  if (!uninstallAppId.value || uninstallBusy.value) return;
  uninstallBusy.value = true;
  try {
    await appStore.uninstallApp(uninstallAppId.value);
    closeApp(uninstallAppId.value);
    showUninstallModal.value = false;
    uninstallAppId.value = '';
  } finally {
    uninstallBusy.value = false;
  }
};

const handleOpenNewWindow = () => {
     const appId = contextMenu.value.appId;
     closeContextMenu();
     openAppInPopup(appId);
 };

const handleOpenApp = () => {
    handleAppLaunch(contextMenu.value.appId);
    closeContextMenu();
};

const handleGlobalMessage = async (event: MessageEvent) => {
    // Check if the source is one of our known popup windows
    const sourceWindow = event.source as Window;
    if (!sourceWindow) return;
    
    const appId = popupWindows.get(sourceWindow);
    if (appId) {
        // Handle bridge message from popup
        const result = await handleBridgeMessage(
            event, 
            appId, 
            sourceWindow,
            {
                onOpenApp: (id) => handleAppLaunch(id)
            },
            { isPopup: true }
        );
        
        if (result && result.success) {
            if (result.type === 'system.installApp' || result.type === 'system.uninstallApp') {
                await appStore.loadApps();
            }
        }
    }
};

onMounted(() => {
  appStore.loadApps();
  window.addEventListener('click', closeContextMenu);
  window.addEventListener('message', handleGlobalMessage);
});

onUnmounted(() => {
    window.removeEventListener('click', closeContextMenu);
    window.removeEventListener('message', handleGlobalMessage);
});

// Desktop Long Press Logic
const isDesktopLongPress = ref(false);
const desktopLongPressTimer = ref<number | undefined>(undefined);

const handleDesktopTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    if ((e.target as HTMLElement).closest('.js-app-icon')) return; // Ignore if touching an app icon

    isDesktopLongPress.value = false;
    desktopLongPressTimer.value = window.setTimeout(() => {
        isDesktopLongPress.value = true;
        const touch = e.touches[0];
        // Create a fake mouse event compatible with showDesktopMenu
        const fakeEvent = {
            clientX: touch.clientX,
            clientY: touch.clientY,
            preventDefault: () => {}
        } as unknown as MouseEvent;
        showDesktopMenu(fakeEvent);
    }, 500);
};

const handleDesktopTouchMove = () => {
    clearTimeout(desktopLongPressTimer.value);
};

const handleDesktopTouchEnd = (e: TouchEvent) => {
    clearTimeout(desktopLongPressTimer.value);
    if (isDesktopLongPress.value) e.preventDefault();
};
</script>

<template>
  <div ref="dropZoneRef" 
       class="w-screen h-screen relative overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8 select-none transition-colors duration-300"
       @contextmenu.prevent="showDesktopMenu"
       @touchstart="handleDesktopTouchStart"
       @touchmove="handleDesktopTouchMove"
       @touchend="handleDesktopTouchEnd">
    
    <!-- Settings Button Removed -->
    
    <!-- Background / Drop Overlay -->
    <div v-if="isDragOverFiles && !isDraggingApp" 
         class="absolute inset-0 z-50 bg-blue-500/20 backdrop-blur-sm border-4 border-blue-500 border-dashed m-4 rounded-3xl flex items-center justify-center pointer-events-none">
      <div class="text-4xl font-bold text-blue-600 bg-white/80 px-8 py-4 rounded-full shadow-xl">
        拖拽 ZIP 安装小程序
      </div>
    </div>

    <!-- Desktop Grid Container -->
    <div class="h-full pb-20 overflow-y-auto custom-scrollbar p-1" @contextmenu.prevent="showDesktopMenu">
      <draggable 
          v-model="draggableApps" 
          item-key="id"
          class="grid grid-cols-[repeat(auto-fill,minmax(74px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2 md:gap-6 content-start min-h-full"
          ghost-class="sortable-ghost"
          drag-class="sortable-drag"
          :animation="200"
          :delay="200"
          :delay-on-touch-only="true"
          @start="isDraggingApp = true"
          @end="isDraggingApp = false"
      >
        <template #item="{ element: app }">
          <div class="h-full">
              <AppIcon :app="app" 
                       @open="handleAppLaunch(app.id)"
                       @contextmenu.stop="showContextMenu($event, app.id)" />
          </div>
        </template>

        <template #footer>
            <!-- Add App Placeholder (When Empty) -->
            <div v-if="appStore.apps.length === 0" 
                 class="flex flex-col items-center justify-center gap-2 group cursor-pointer animate-scale-in"
                 @click.stop="showGuideModal = true">
                <div class="w-[60px] h-[60px] md:w-[74px] md:h-[74px] rounded-2xl bg-white/40 dark:bg-gray-700/40 backdrop-blur-sm border-2 border-dashed border-gray-400/50 dark:border-gray-500/50 flex items-center justify-center group-hover:bg-white/60 dark:group-hover:bg-gray-700/60 group-hover:border-blue-500 dark:group-hover:border-blue-400 group-hover:scale-105 transition-all shadow-sm">
                    <svg class="w-8 h-8 text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                </div>
                <span class="text-xs font-medium text-gray-600 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 text-shadow-sm text-center px-1 py-0.5 rounded bg-white/30 dark:bg-black/30 backdrop-blur-[2px]">添加应用</span>
            </div>
                     
            <!-- Inline Spinner if installing -->
            <div v-if="appStore.isLoading" class="flex flex-col items-center justify-center w-[100px] h-[100px]">
               <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
               <span class="text-xs text-gray-500 mt-2">Installing...</span>
            </div>
        </template>
      </draggable>
    </div>
    
    <!-- Global Loading Overlay -->
    <div v-if="appStore.isLoading" class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-none">
         <div class="bg-white px-8 py-6 rounded-2xl shadow-2xl flex flex-col items-center animate-bounce-small">
             <div class="animate-spin rounded-full h-10 w-10 border-4 border-indigo-100 border-t-indigo-600 mb-3"></div>
             <span class="text-gray-700 font-medium">正在安装应用...</span>
         </div>
    </div>

    <!-- Windows Layer -->
    <TransitionGroup name="window">
      <template v-for="appId in openWindows" :key="appId">
        <Window v-if="appStore.apps.find(a => a.id === appId)"
                :app="appStore.apps.find(a => a.id === appId)!"
                :is-open="true"
                :z-index="getZIndex(appId)"
                @close="closeApp(appId)"
                @focus="bringToFront(appId)"
                @open-app="handleAppLaunch" />
      </template>
    </TransitionGroup>

    <!-- Context Menu -->
    <div v-if="contextMenu.visible"
         ref="contextMenuRef"
         class="fixed bg-white dark:bg-gray-800 shadow-xl rounded-lg py-1 z-[999] min-w-[160px] border border-gray-100 dark:border-gray-700"
         :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }">
         <div v-if="contextMenu.appId">
             <div class="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-700 dark:text-gray-200" @click.stop="handleOpenApp">打开</div>
             <div class="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-700 dark:text-gray-200" @click.stop="handleOpenNewWindow">新窗口打开</div>
             <div class="border-t border-gray-100 dark:border-gray-700 my-1"></div>
             
             <div class="px-4 py-2 text-sm transition-colors"
                  :class="appStore.apps.find(a => a.id === contextMenu.appId)?.repository 
                          ? 'hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-gray-700 dark:text-gray-200' 
                          : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'" 
                  @click.stop="appStore.apps.find(a => a.id === contextMenu.appId)?.repository && handleOpenSource()">
                 打开开源地址
             </div>
             
             <div class="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-700 dark:text-gray-200" @click.stop="handleEdit">编辑信息</div>
             <div class="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-700 dark:text-gray-200" @click.stop="handleExportApp">导出应用 (ZIP)</div>
             <div class="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-700 dark:text-gray-200" @click.stop="handleRename">重命名</div>
             <div class="px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer text-sm text-red-600 dark:text-red-400" @click.stop="handleUninstall">卸载</div>
         </div>
         <div v-else>
             <div class="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-700 dark:text-gray-200" @click.stop="handleInstallApp">安装应用</div>
             <div class="border-t border-gray-100 dark:border-gray-700 my-1"></div>
             <div class="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-700 dark:text-gray-200" @click.stop="showSettingsModal = true; closeContextMenu()">系统设置</div>
         </div>
    </div>

    <input ref="installFileInputRef" type="file" accept=".zip" class="hidden" @change="handleInstallFileChange" />
    
    <!-- Edit Modal -->
    <EditAppModal :app-id="editAppId" :is-open="showEditModal" @close="showEditModal = false" />
    
    <!-- Rename Modal -->
    <RenameAppModal 
        :is-open="showRenameModal" 
        :current-name="appStore.apps.find(a => a.id === renameAppId)?.title || ''"
        @close="showRenameModal = false"
        @save="handleDoRename" />

    <UninstallAppModal
        :is-open="showUninstallModal"
        :is-busy="uninstallBusy"
        :app-title="appStore.apps.find(a => a.id === uninstallAppId)?.title || ''"
        @close="handleCloseUninstallModal"
        @confirm="handleConfirmUninstall" />

    <SettingsModal :is-open="showSettingsModal" @close="showSettingsModal = false" />
    
    <GuideModal 
        :is-open="showGuideModal" 
        @close="showGuideModal = false" 
        @select-file="installFileInputRef?.click()" />

    <AppUpdateModal
        v-if="appStore.updateConfirmation"
        :is-open="appStore.updateConfirmation.isOpen"
        :new-app="appStore.updateConfirmation.newApp"
        :old-app="appStore.updateConfirmation.oldApp"
        @confirm="appStore.updateConfirmation.resolve(true)"
        @cancel="appStore.updateConfirmation.resolve(false)" />

    <PermissionRequestModal />

    <!-- Version Info -->
    <div class="fixed bottom-1 left-0 right-0 text-center pointer-events-none z-0">
        <span class="text-[10px] text-gray-400/60 font-mono">
            H5Box v{{ APP_VERSION }} • DB v{{ DB_VERSION }}
        </span>
    </div>

  </div>
</template>

<style scoped lang="postcss">
.window-enter-active,
.window-leave-active {
  transition: all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.window-enter-from,
.window-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(0,0,0,0.1);
  border-radius: 3px;
}
.animate-scale-in {
    animation: scaleIn 0.2s ease-out;
}
@keyframes scaleIn {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
}

/* Draggable Styles */
:deep(.sortable-ghost) {
    @apply opacity-50 grayscale scale-95;
}

:deep(.sortable-drag) {
    @apply scale-105 shadow-xl z-50;
}
</style>
