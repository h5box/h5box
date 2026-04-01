<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watchEffect } from 'vue';
import { useDropZone } from '@vueuse/core';
import draggable from 'vuedraggable';
import { useToast } from '../composables/useToast';
import { useSettings } from '../composables/useSettings';
import { useDesktopContextMenu } from '../composables/useDesktopContextMenu';
import { useDesktopLongPress } from '../composables/useDesktopLongPress';
import { useWindowManager } from '../composables/useWindowManager';
import { DB_VERSION } from '../db';
import { handleBridgeMessage } from '../services/bridge';
import { useAppStore } from '../stores/apps';
import AppIcon from './AppIcon.vue';
import AppUpdateModal from './AppUpdateModal.vue';
import DesktopContextMenu from './DesktopContextMenu.vue';
import EditAppModal from './EditAppModal.vue';
import GuideModal from './GuideModal.vue';
import PermissionRequestModal from './PermissionRequestModal.vue';
import RenameAppModal from './RenameAppModal.vue';
import SettingsModal from './SettingsModal.vue';
import UninstallAppModal from './UninstallAppModal.vue';
import Window from './Window.vue';

const APP_VERSION = '1.0.3';

const appStore = useAppStore();
const { addToast } = useToast();
const { openMethod } = useSettings();
const { contextMenu, contextMenuRef, showContextMenu, closeContextMenu } = useDesktopContextMenu();
const {
  openWindows,
  popupWindows,
  getExternalLaunchUrl,
  openApp,
  closeApp,
  bringToFront,
  getZIndex,
  openAppInPopup
} = useWindowManager();

const draggableApps = computed({
  get: () => appStore.apps,
  set: (value) => {
    void appStore.updateAppOrder(value);
  }
});

const dropZoneRef = ref<HTMLElement | null>(null);
const desktopContextMenuRef = ref<{ menuRef: HTMLElement | null } | null>(null);
const installFileInputRef = ref<HTMLInputElement | null>(null);
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

const showDesktopMenu = (event: MouseEvent) => {
  if (showEditModal.value || showRenameModal.value || showUninstallModal.value) return;
  showContextMenu(event.clientX, event.clientY);
};

const {
  handleDesktopTouchStart,
  handleDesktopTouchMove,
  handleDesktopTouchEnd
} = useDesktopLongPress((x, y) => showContextMenu(x, y));

useDropZone(dropZoneRef, {
  onDrop: async (files) => {
    isDragOverFiles.value = false;
    if (isDraggingApp.value || !files) return;

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        addToast(`无法安装 "${file.name}": 仅支持 .zip 格式的应用包`, 'warning');
        continue;
      }

      await appStore.installFromFileSmart(file);
      if (appStore.error) {
        addToast(`安装失败 "${file.name}": ${appStore.error}`, 'error');
      } else {
        addToast(`安装成功: ${file.name}`, 'success');
      }
    }
  },
  onEnter: (_files, event) => {
    if (event?.dataTransfer?.types.includes('Files')) {
      isDragOverFiles.value = true;
    }
  },
  onLeave: () => {
    isDragOverFiles.value = false;
  }
});

const handleOpenApp = async (appId: string) => {
  const app = appStore.apps.find(item => item.id === appId);
  if (!app) return;

  const externalUrl = getExternalLaunchUrl(app);
  if (externalUrl || openMethod.value === 'popup') {
    const opened = openAppInPopup(app, externalUrl || `./app/${appId}/index.html`, () => {
      addToast('浏览器拦截了弹窗，请允许弹窗后重试', 'warning');
    });
    if (opened) {
      await appStore.clearNewFlag(appId);
    }
    return;
  }

  openApp(appId);
  await appStore.clearNewFlag(appId);
};

const handleInstallFileChange = async (event: Event) => {
  const input = event.target as HTMLInputElement;
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
  editAppId.value = contextMenu.value.appId;
  showEditModal.value = true;
  closeContextMenu();
};

const handleRename = () => {
  renameAppId.value = contextMenu.value.appId;
  showRenameModal.value = true;
  closeContextMenu();
};

const handleDoRename = async (newName: string) => {
  if (renameAppId.value && newName) {
    await appStore.renameApp(renameAppId.value, newName);
  }
};

const handleExportApp = async () => {
  const app = appStore.apps.find(item => item.id === contextMenu.value.appId);
  closeContextMenu();
  if (!app?.zipBlob) {
    addToast('无法导出：找不到应用文件', 'error');
    return;
  }

  const url = URL.createObjectURL(app.zipBlob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${app.title}.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const handleOpenSource = () => {
  const app = appStore.apps.find(item => item.id === contextMenu.value.appId);
  closeContextMenu();
  if (app?.repository) {
    window.open(app.repository, '_blank');
  }
};

const handleUninstall = () => {
  uninstallAppId.value = contextMenu.value.appId;
  showUninstallModal.value = true;
  closeContextMenu();
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

const handleBridgeRefresh = async (event: MessageEvent) => {
  const sourceWindow = event.source as Window;
  if (!sourceWindow) return;

  const appId = popupWindows.get(sourceWindow);
  if (!appId) return;

  const result = await handleBridgeMessage(
    event,
    appId,
    sourceWindow,
    {
      onOpenApp: (id) => handleOpenApp(id)
    },
    { isPopup: true }
  );

  if (result?.success && (result.type === 'system.installApp' || result.type === 'system.uninstallApp')) {
    await appStore.loadApps();
  }
};

const handleOpenNewWindow = async () => {
  const app = appStore.apps.find(item => item.id === contextMenu.value.appId);
  closeContextMenu();
  if (!app) return;

  const opened = openAppInPopup(app, getExternalLaunchUrl(app) || `./app/${app.id}/index.html`, () => {
    addToast('浏览器拦截了弹窗，请允许弹窗后重试', 'warning');
  });
  if (opened) {
    await appStore.clearNewFlag(app.id);
  }
};

watchEffect(() => {
  contextMenuRef.value = desktopContextMenuRef.value?.menuRef ?? null;
});

onMounted(() => {
  void appStore.loadApps();
  window.addEventListener('click', closeContextMenu);
  window.addEventListener('message', handleBridgeRefresh);
});

onUnmounted(() => {
  window.removeEventListener('click', closeContextMenu);
  window.removeEventListener('message', handleBridgeRefresh);
});
</script>

<template>
  <div
    ref="dropZoneRef"
    class="w-screen h-screen relative overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8 select-none transition-colors duration-300"
    @contextmenu.prevent="showDesktopMenu"
    @touchstart="handleDesktopTouchStart"
    @touchmove="handleDesktopTouchMove"
    @touchend="handleDesktopTouchEnd"
  >
    <div
      v-if="isDragOverFiles && !isDraggingApp"
      class="absolute inset-0 z-50 bg-blue-500/20 backdrop-blur-sm border-4 border-blue-500 border-dashed m-4 rounded-3xl flex items-center justify-center pointer-events-none"
    >
      <div class="text-4xl font-bold text-blue-600 bg-white/80 px-8 py-4 rounded-full shadow-xl">
        拖拽 ZIP 安装小程序
      </div>
    </div>

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
            <AppIcon
              :app="app"
              @open="handleOpenApp(app.id)"
              @contextmenu.stop="showContextMenu($event.clientX, $event.clientY, app.id)"
            />
          </div>
        </template>

        <template #footer>
          <div
            v-if="appStore.apps.length === 0"
            class="flex flex-col items-center justify-center gap-2 group cursor-pointer animate-scale-in"
            @click.stop="showGuideModal = true"
          >
            <div class="w-[60px] h-[60px] md:w-[74px] md:h-[74px] rounded-2xl bg-white/40 dark:bg-gray-700/40 backdrop-blur-sm border-2 border-dashed border-gray-400/50 dark:border-gray-500/50 flex items-center justify-center group-hover:bg-white/60 dark:group-hover:bg-gray-700/60 group-hover:border-blue-500 dark:group-hover:border-blue-400 group-hover:scale-105 transition-all shadow-sm">
              <svg class="w-8 h-8 text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span class="text-xs font-medium text-gray-600 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 text-shadow-sm text-center px-1 py-0.5 rounded bg-white/30 dark:bg-black/30 backdrop-blur-[2px]">添加应用</span>
          </div>

          <div v-if="appStore.isLoading" class="flex flex-col items-center justify-center w-[100px] h-[100px]">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span class="text-xs text-gray-500 mt-2">Installing...</span>
          </div>
        </template>
      </draggable>
    </div>

    <div v-if="appStore.isLoading" class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-none">
      <div class="bg-white px-8 py-6 rounded-2xl shadow-2xl flex flex-col items-center animate-bounce-small">
        <div class="animate-spin rounded-full h-10 w-10 border-4 border-indigo-100 border-t-indigo-600 mb-3"></div>
        <span class="text-gray-700 font-medium">正在安装应用...</span>
      </div>
    </div>

    <TransitionGroup name="window">
      <template v-for="appId in openWindows" :key="appId">
        <Window
          v-if="appStore.apps.find(app => app.id === appId)"
          :app="appStore.apps.find(app => app.id === appId)!"
          :is-open="true"
          :z-index="getZIndex(appId)"
          @close="closeApp(appId)"
          @focus="bringToFront(appId)"
          @open-app="handleOpenApp"
        />
      </template>
    </TransitionGroup>

    <DesktopContextMenu
      ref="desktopContextMenuRef"
      :visible="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :app-id="contextMenu.appId"
      :apps="appStore.apps"
      @open="handleOpenApp(contextMenu.appId); closeContextMenu()"
      @open-new-window="handleOpenNewWindow"
      @open-source="handleOpenSource"
      @edit="handleEdit"
      @export="handleExportApp"
      @rename="handleRename"
      @uninstall="handleUninstall"
      @install="showGuideModal = true; closeContextMenu()"
      @settings="showSettingsModal = true; closeContextMenu()"
    />

    <input ref="installFileInputRef" type="file" accept=".zip" class="hidden" @change="handleInstallFileChange" />

    <EditAppModal :app-id="editAppId" :is-open="showEditModal" @close="showEditModal = false" />
    <RenameAppModal
      :is-open="showRenameModal"
      :current-name="appStore.apps.find(app => app.id === renameAppId)?.title || ''"
      @close="showRenameModal = false"
      @save="handleDoRename"
    />
    <UninstallAppModal
      :is-open="showUninstallModal"
      :is-busy="uninstallBusy"
      :app-title="appStore.apps.find(app => app.id === uninstallAppId)?.title || ''"
      @close="handleCloseUninstallModal"
      @confirm="handleConfirmUninstall"
    />
    <SettingsModal :is-open="showSettingsModal" @close="showSettingsModal = false" />
    <GuideModal :is-open="showGuideModal" @close="showGuideModal = false" @select-file="installFileInputRef?.click()" />
    <AppUpdateModal
      v-if="appStore.updateConfirmation"
      :is-open="appStore.updateConfirmation.isOpen"
      :new-app="appStore.updateConfirmation.newApp"
      :old-app="appStore.updateConfirmation.oldApp"
      @confirm="appStore.updateConfirmation.resolve(true)"
      @cancel="appStore.updateConfirmation.resolve(false)"
    />
    <PermissionRequestModal />

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
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
}

.animate-scale-in {
  animation: scaleIn 0.2s ease-out;
}

@keyframes scaleIn {
  from {
    transform: scale(0.95);
    opacity: 0;
  }

  to {
    transform: scale(1);
    opacity: 1;
  }
}

:deep(.sortable-ghost) {
  @apply opacity-50 grayscale scale-95;
}

:deep(.sortable-drag) {
  @apply scale-105 shadow-xl z-50;
}
</style>
