<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { useAppStore } from '../stores/apps';
import { useDropZone } from '@vueuse/core';
import { useToast } from '../composables/useToast';
import JSZip from 'jszip';
import { DB_VERSION } from '../db';
import AppIcon from './AppIcon.vue';
import Window from './Window.vue';
import EditAppModal from './EditAppModal.vue';
import RenameAppModal from './RenameAppModal.vue';
import ExportAppsModal from './ExportAppsModal.vue';
import UninstallAppModal from './UninstallAppModal.vue';
import PermissionRequestModal from './PermissionRequestModal.vue';
import SettingsModal from './SettingsModal.vue';
import GuideModal from './GuideModal.vue';
import AppUpdateModal from './AppUpdateModal.vue';

const APP_VERSION = '1.0.1';

const appStore = useAppStore();
const { addToast } = useToast();
const dropZoneRef = ref<HTMLElement | null>(null);
const installFileInputRef = ref<HTMLInputElement | null>(null);
// const showAppStore = ref(false); // Removed
const showEditModal = ref(false);
const showRenameModal = ref(false);
const showExportModal = ref(false);
const showUninstallModal = ref(false);
const showSettingsModal = ref(false);
const showGuideModal = ref(false);
const editAppId = ref('');
const renameAppId = ref('');
const uninstallAppId = ref('');
const uninstallBusy = ref(false);
const exportBusy = ref(false);
const exportMode = ref<'json' | 'zip'>('json');

// Drop Zone Logic (Install)
const { isOverDropZone } = useDropZone(dropZoneRef, {
    onDrop: async (files) => {
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
    }
});

// Window Management
const openWindows = ref<string[]>([]);
const windowZIndices = ref<Record<string, number>>({});
let maxZIndex = 100;

const openApp = async (id: string) => {
  if (!openWindows.value.includes(id)) {
    openWindows.value.push(id);
  }
  bringToFront(id);
  // Clear new flag when opening
  await appStore.clearNewFlag(id);
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
    if (showEditModal.value || showRenameModal.value || showExportModal.value || showUninstallModal.value) return;
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
     // Popup window instead of new tab
     const width = 800;
     const height = 600;
     const left = (window.screen.width - width) / 2;
     const top = (window.screen.height - height) / 2;
     window.open(`/app/${appId}/index.html`, '_blank', `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`);
 };

const handleOpenApp = () => {
    openApp(contextMenu.value.appId);
    closeContextMenu();
};

const handleExportAllApps = () => {
    closeContextMenu();
    exportMode.value = 'json';
    showExportModal.value = true;
};

const handleExportAllAppsZip = () => {
    closeContextMenu();
    exportMode.value = 'zip';
    showExportModal.value = true;
};

const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

const buildExportManifest = (meta: { author: string; repository: string }) => {
    return {
        author: meta.author,
        repository: meta.repository,
        updated: new Date().toISOString(),
        apps: appStore.apps.map(app => {
            const { zipBlob, ...rest } = app;
            return {
                ...rest,
                zipPath: zipBlob ? `apps/${app.id}.zip` : null
            };
        })
    };
};

const handleDoExport = async (meta: { author: string; repository: string }) => {
    if (exportBusy.value) return;
    exportBusy.value = true;
    try {
        const manifest = buildExportManifest(meta);

        if (exportMode.value === 'json') {
            const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
            downloadBlob(blob, 'apps.json');
            showExportModal.value = false;
            return;
        }

        const zip = new JSZip();
        zip.file('apps.json', JSON.stringify(manifest, null, 2));
        const appsFolder = zip.folder('apps');

        for (const app of appStore.apps) {
            if (!app.zipBlob) continue;
            appsFolder?.file(`${app.id}.zip`, app.zipBlob);
        }

        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        const date = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const filename = `apps_${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}.zip`;
        downloadBlob(zipBlob, filename);
        showExportModal.value = false;
    } finally {
        exportBusy.value = false;
    }
};

onMounted(() => {
  appStore.loadApps();
  window.addEventListener('click', closeContextMenu);
});

// Desktop Long Press Logic
const isDesktopLongPress = ref(false);
const desktopLongPressTimer = ref<number | undefined>(undefined);

const handleDesktopTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
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
    <div v-if="isOverDropZone" 
         class="absolute inset-0 z-50 bg-blue-500/20 backdrop-blur-sm border-4 border-blue-500 border-dashed m-4 rounded-3xl flex items-center justify-center pointer-events-none">
      <div class="text-4xl font-bold text-blue-600 bg-white/80 px-8 py-4 rounded-full shadow-xl">
        拖拽 ZIP 安装小程序
      </div>
    </div>

    <!-- Desktop Grid -->
    <div class="grid grid-cols-[repeat(auto-fill,minmax(74px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2 md:gap-6 content-start h-full pb-20 overflow-y-auto custom-scrollbar p-1"
         @contextmenu.prevent="showDesktopMenu">
      
      <!-- Installed Apps -->
      <div v-for="app in appStore.apps" 
           :key="app.id"
           class="transition-transform duration-200">
          <AppIcon :app="app" 
                   @open="openApp(app.id)"
                   @contextmenu.stop="showContextMenu($event, app.id)" />
      </div>

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
               
      <!-- Loading Indicator (Full Screen Overlay or inline) -->
      <!-- Inline Spinner if installing -->
      <div v-if="appStore.isLoading" class="flex flex-col items-center justify-center w-[100px] h-[100px]">
         <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
         <span class="text-xs text-gray-500 mt-2">Installing...</span>
      </div>
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
                @open-app="openApp" />
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
             <div class="border-t border-gray-100 dark:border-gray-700 my-1"></div>
             <div class="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-700 dark:text-gray-200" @click.stop="handleExportAllApps">导出全部应用 (JSON)</div>
             <div class="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-700 dark:text-gray-200" @click.stop="handleExportAllAppsZip">导出全部应用 (ZIP)</div>
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

    <!-- Export Modal -->
    <ExportAppsModal
        :is-open="showExportModal"
        :is-busy="exportBusy"
        :title="exportMode === 'zip' ? '导出全部应用 (ZIP)' : '导出全部应用 (JSON)'"
        :description="exportMode === 'zip' ? '将导出包含 apps.json 与所有应用 ZIP 包的压缩文件。请填写以下元数据：' : '将导出包含所有应用信息的 JSON 文件。请填写以下元数据：'"
        :confirm-text="exportMode === 'zip' ? '导出 ZIP' : '导出 JSON'"
        @close="showExportModal = false"
        @export="handleDoExport" />
        
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

<style scoped>
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
</style>
