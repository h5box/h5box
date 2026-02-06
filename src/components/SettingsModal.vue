<script setup lang="ts">
import { ref, watch } from 'vue';
import { useTheme } from '../composables/useTheme';
import { useSettings } from '../composables/useSettings';
import { useAppStore } from '../stores/apps';
import ExportAppsModal from './ExportAppsModal.vue';
import JSZip from 'jszip';
import { useToast } from '../composables/useToast';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const { themeMode, setTheme } = useTheme();
const { openMethod, setOpenMethod } = useSettings();
const appStore = useAppStore();
const { addToast } = useToast();

const modes = [
  { value: 'light', label: '浅色', icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z' },
  { value: 'dark', label: '深色', icon: 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z' },
  { value: 'system', label: '跟随系统', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' }
] as const;

// Storage Usage
const storageUsage = ref<string>('计算中...');

const getStorageUsage = async () => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
        try {
            const estimate = await navigator.storage.estimate();
            if (estimate.usage) {
                const mb = estimate.usage / (1024 * 1024);
                storageUsage.value = `${mb.toFixed(2)} MB`;
            } else {
                storageUsage.value = '0 MB';
            }
        } catch (e) {
            storageUsage.value = '未知';
        }
    } else {
        storageUsage.value = '不支持';
    }
};

watch(() => props.isOpen, (val) => {
    if (val) {
        getStorageUsage();
    }
});

// Backup Logic
const showExportModal = ref(false);
const exportBusy = ref(false);

const handleBackupAllApps = () => {
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

const handleDoExport = async () => {
    if (exportBusy.value) return;
    exportBusy.value = true;
    try {
        const meta = { author: 'User Backup', repository: 'Local' };
        const manifest = buildExportManifest(meta);
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
        const filename = `apps_backup_${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}.zip`;
        downloadBlob(zipBlob, filename);
        showExportModal.value = false;
        addToast('备份成功', 'success');
    } catch (e) {
        addToast('备份失败', 'error');
        console.error(e);
    } finally {
        exportBusy.value = false;
    }
};

// Clear All Apps Logic
const showClearConfirm = ref(false);
const showFinalClearConfirm = ref(false);
const clearCountDown = ref(5);
const canConfirmClear = ref(false);
let timer: number | null = null;

const startClearProcess = () => {
    showClearConfirm.value = true;
    clearCountDown.value = 5;
    canConfirmClear.value = false;
    
    if (timer) clearInterval(timer);
    timer = window.setInterval(() => {
        clearCountDown.value--;
        if (clearCountDown.value <= 0) {
            canConfirmClear.value = true;
            if (timer) clearInterval(timer);
        }
    }, 1000);
};

const cancelClear = () => {
    showClearConfirm.value = false;
    if (timer) clearInterval(timer);
};

const proceedToFinalConfirm = () => {
    showClearConfirm.value = false;
    showFinalClearConfirm.value = true;
};

const doClearAll = async () => {
    try {
        await appStore.clearAllApps();
        addToast('已清空全部应用', 'success');
        showFinalClearConfirm.value = false;
        getStorageUsage(); // Update usage
    } catch (e) {
        addToast('清空失败', 'error');
    }
};

</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/20 backdrop-blur-sm" @click.self="emit('close')">
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all p-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-bold text-gray-800 dark:text-white">系统设置</h2>
        <button @click="emit('close')" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <div class="space-y-8">
        <!-- Theme Selector -->
        <div>
          <div class="font-medium text-gray-800 dark:text-white mb-3">外观主题</div>
          <div class="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
            <button 
              v-for="mode in modes" 
              :key="mode.value"
              @click="setTheme(mode.value)"
              class="flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-lg transition-all duration-200"
              :class="themeMode === mode.value ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="mode.icon"></path>
              </svg>
              {{ mode.label }}
            </button>
          </div>
        </div>

        <!-- Open Method Selector -->
        <div>
          <div class="font-medium text-gray-800 dark:text-white mb-3">应用打开方式</div>
          <div class="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
            <button 
              @click="setOpenMethod('window')"
              class="flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-lg transition-all duration-200"
              :class="openMethod === 'window' ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
              </svg>
              当前页打开
            </button>
            <button 
              @click="setOpenMethod('popup')"
              class="flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-lg transition-all duration-200"
              :class="openMethod === 'popup' ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
              </svg>
              弹出窗口打开
            </button>
          </div>
        </div>

        <!-- Data Management -->
        <div>
            <div class="font-medium text-gray-800 dark:text-white mb-3">数据管理</div>
            <div class="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-4">
                <div class="flex justify-between items-center">
                    <span class="text-sm text-gray-600 dark:text-gray-300">存储空间占用</span>
                    <span class="text-sm font-mono font-medium text-gray-800 dark:text-gray-200">{{ storageUsage }}</span>
                </div>
                
                <div class="border-t border-gray-200 dark:border-gray-600"></div>

                <div class="flex flex-col gap-3">
                    <button 
                        @click="handleBackupAllApps"
                        class="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors text-sm font-medium"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        备份全部应用 (ZIP)
                    </button>

                    <button 
                        @click="startClearProcess"
                        class="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors text-sm font-medium"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        清空全部应用
                    </button>
                </div>
            </div>
        </div>
      </div>
      
      <div class="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700 text-center text-xs text-gray-400">
        H5Box
      </div>
    </div>

    <!-- Export Modal (nested or adjacent, but putting it here for simplicity) -->
    <ExportAppsModal
        :is-open="showExportModal"
        :is-busy="exportBusy"
        title="备份全部应用"
        description="即将导出包含所有应用 ZIP 包及元数据的压缩文件。"
        confirm-text="开始备份"
        @close="showExportModal = false"
        @export="handleDoExport" />

    <!-- First Clear Confirmation -->
    <div v-if="showClearConfirm" class="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 backdrop-blur-sm" @click.self="cancelClear">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-[90%] max-w-sm p-6 animate-scale-in">
            <div class="text-red-500 mb-4 flex justify-center">
                <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            </div>
            <h3 class="text-lg font-bold text-center text-gray-900 dark:text-white mb-2">危险操作警告</h3>
            <p class="text-sm text-gray-600 dark:text-gray-300 text-center mb-6">
                您正在尝试清空所有已安装的应用。此操作<span class="font-bold text-red-600">不可恢复</span>，所有应用数据都将丢失！
            </p>
            <div class="flex gap-3">
                <button @click="cancelClear" class="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    取消
                </button>
                <button 
                    @click="proceedToFinalConfirm" 
                    :disabled="!canConfirmClear"
                    class="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    确认清空
                    <span v-if="!canConfirmClear">({{ clearCountDown }}s)</span>
                </button>
            </div>
        </div>
    </div>

    <!-- Final Clear Confirmation (Small Popup) -->
    <div v-if="showFinalClearConfirm" class="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60" @click.self="showFinalClearConfirm = false">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-4 max-w-xs w-full animate-scale-in border-2 border-red-500">
            <h4 class="font-bold text-gray-900 dark:text-white mb-2">二次确认</h4>
            <p class="text-xs text-gray-600 dark:text-gray-300 mb-4">真的要清空吗？数据找不回来的哦。</p>
            <div class="flex justify-end gap-2">
                <button @click="showFinalClearConfirm = false" class="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded">再想想</button>
                <button @click="doClearAll" class="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700">确定清空</button>
            </div>
        </div>
    </div>

  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(0,0,0,0.1);
  border-radius: 2px;
}
.animate-scale-in {
    animation: scaleIn 0.2s ease-out;
}
@keyframes scaleIn {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
}
</style>