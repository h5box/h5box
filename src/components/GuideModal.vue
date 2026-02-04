<script setup lang="ts">
import { ref, watch } from 'vue';
import { useAppStore } from '../stores/apps';
import JSZip from 'jszip';
import { useToast } from '../composables/useToast';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'select-file'): void;
}>();

const appStore = useAppStore();
const { addToast } = useToast();

const activeTab = ref<'guide' | 'online'>('guide');
const onlineAppTitle = ref('');
const onlineAppUrl = ref('');
const onlineAppIconFile = ref<File | null>(null);
const onlineAppIconPreview = ref<string>('');
const isInstalling = ref(false);

const recommendedApps = [
    {
        title: '应用市场',
        url: 'http://localhost:5173/',
        description: '官方应用商店，发现更多精彩应用',
        appIdentifier: 'h5box/app-market',
        icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none"><defs><linearGradient id="bg-gradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#6366f1" /><stop offset="100%" stop-color="#9333ea" /></linearGradient></defs><rect width="48" height="48" rx="12" fill="url(#bg-gradient)" /><g transform="translate(12, 12)"><path stroke="#ffffff" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></g></svg>'
    }
];

const createOnlineAppZip = async (title: string, url: string, iconContent?: string, specificAppIdentifier?: string) => {
    const zip = new JSZip();
    
    // Handle Icon
    let iconData = iconContent;
    let iconFilename = '';

    if (!iconData) {
        // Default Icon (Globe)
        iconData = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg>';
    }

    // Check if icon is SVG string or Base64
    if (iconData.trim().startsWith('<svg')) {
        iconFilename = 'icon.svg';
        zip.file(iconFilename, iconData);
    } else if (iconData.startsWith('data:image')) {
        // Handle Base64 Image
        iconFilename = 'icon.png';
        const base64Data = iconData.split(',')[1];
        zip.file(iconFilename, base64Data, { base64: true });
    } else if (iconData.startsWith('http')) {
        // Handle URL
        // We cannot download it due to CORS likely, so we just use the link
        // installer.ts supports remote icons if they are in the zip's index.html link tag
    }

    // Generate app identifier
    const randomId = Math.random().toString(36).substring(2, 12);
    const appIdentifier = specificAppIdentifier || `LocalUser/online-${randomId}`;

    // Create index.html with correct icon link
    const htmlContent = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="app-identifier" content="${appIdentifier}">
    <link rel="canonical" href="${url}">
    <title>${title}</title>
    ${iconFilename ? `<link rel="icon" href="${iconFilename}">` : (iconData.startsWith('http') ? `<link rel="icon" href="${iconData}">` : '')}
    <style>
        body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; }
        iframe { width: 100%; height: 100%; border: none; }
    </style>
</head>
<body>
    <iframe id="app-frame" src="${url}" allow="camera; microphone; geolocation; fullscreen; clipboard-read; clipboard-write"></iframe>
    <script>
        const iframe = document.getElementById('app-frame');
        
        // Listen for messages from the inner iframe (Online App) and forward to Desktop
        window.addEventListener('message', (e) => {
            if (e.source === iframe.contentWindow) {
                if (window.parent) {
                    window.parent.postMessage(e.data, '*');
                }
            } else if (e.source === window.parent) {
                // Listen for messages from Desktop and forward to inner iframe
                if (iframe && iframe.contentWindow) {
                    iframe.contentWindow.postMessage(e.data, '*');
                }
            }
        });
    <\/script>
</body>
</html>`;
    
    zip.file('index.html', htmlContent);

    const content = await zip.generateAsync({ type: 'blob' });
    return new File([content], `${title}.zip`, { type: 'application/zip' });
};

const installRecommended = async (app: typeof recommendedApps[0]) => {
    if (isInstalling.value) return;
    isInstalling.value = true;
    try {
        const file = await createOnlineAppZip(app.title, app.url, app.icon, app.appIdentifier);
        await appStore.installFromFileSmart(file, 'Recommended');
        if (appStore.error) {
            addToast(`安装失败: ${appStore.error}`, 'error');
        } else {
            addToast(`已安装推荐应用: ${app.title}`, 'success');
            emit('close');
        }
    } catch (e) {
        console.error(e);
        addToast('安装失败', 'error');
    } finally {
        isInstalling.value = false;
    }
};

const handleIconChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
        onlineAppIconFile.value = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            onlineAppIconPreview.value = e.target?.result as string;
        };
        reader.readAsDataURL(file);
    }
};

const handleAddOnlineApp = async () => {
    if (!onlineAppTitle.value || !onlineAppUrl.value) {
        addToast('请填写标题和链接', 'warning');
        return;
    }
    
    if (isInstalling.value) return;
    isInstalling.value = true;
    
    try {
        // Try to fetch icon or just use default
        // Since we can't easily fetch cross-origin favicons, we'll use a default icon
        let iconContent = onlineAppIconPreview.value || undefined;
        
        const file = await createOnlineAppZip(onlineAppTitle.value, onlineAppUrl.value, iconContent);
        await appStore.installFromFileSmart(file, 'Online');
        addToast(`已添加应用: ${onlineAppTitle.value}`, 'success');
        emit('close');
        
        // Reset form
        onlineAppTitle.value = '';
        onlineAppUrl.value = '';
        onlineAppIconFile.value = null;
        onlineAppIconPreview.value = '';
    } catch (e) {
        console.error(e);
        addToast('添加失败', 'error');
    } finally {
        isInstalling.value = false;
    }
};

const handleSelectFile = () => {
    emit('select-file');
    emit('close');
};

let fetchIconTimer: number | undefined;

watch(onlineAppUrl, (newUrl) => {
    if (!newUrl) return;
    
    // If user has manually selected a file, don't overwrite
    if (onlineAppIconFile.value) return;

    clearTimeout(fetchIconTimer);
    fetchIconTimer = window.setTimeout(() => {
        try {
            const urlObj = new URL(newUrl);
            const domain = urlObj.hostname;
            if (domain) {
                // Direct connection to favicon.ico
                onlineAppIconPreview.value = `${urlObj.origin}/favicon.ico`;
            }
        } catch (e) {
            // Invalid URL, ignore
        }
    }, 500);
});

</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
      
      <!-- Header -->
      <div class="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h2 class="text-xl font-bold text-gray-800 dark:text-gray-100">欢迎使用</h2>
          <button @click="$emit('close')" class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
              <svg class="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
          </button>
      </div>

      <!-- Tabs -->
      <div class="flex border-b border-gray-100 dark:border-gray-700">
          <button @click="activeTab = 'guide'" 
                  class="flex-1 py-3 text-sm font-medium transition-colors relative"
                  :class="activeTab === 'guide' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'">
              新手引导
              <div v-if="activeTab === 'guide'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"></div>
          </button>
          <button @click="activeTab = 'online'" 
                  class="flex-1 py-3 text-sm font-medium transition-colors relative"
                  :class="activeTab === 'online' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'">
              添加在线应用
              <div v-if="activeTab === 'online'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"></div>
          </button>
      </div>

      <!-- Content -->
      <div class="p-6 overflow-y-auto custom-scrollbar">
          
          <!-- Guide Tab -->
          <div v-if="activeTab === 'guide'" class="space-y-6">
              <div class="space-y-4">
                  <h3 class="font-semibold text-gray-700 dark:text-gray-200">如何安装应用？</h3>
                  
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/30">
                          <div class="w-10 h-10 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center mb-3 text-blue-600 dark:text-blue-300">
                              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                              </svg>
                          </div>
                          <h4 class="font-medium text-gray-800 dark:text-gray-200 mb-1">拖拽安装</h4>
                          <p class="text-sm text-gray-600 dark:text-gray-400">直接将 .zip 格式的应用包拖拽到桌面即可完成安装。</p>
                      </div>

                      <div class="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800/30 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors" @click="handleSelectFile">
                          <div class="w-10 h-10 bg-purple-100 dark:bg-purple-800 rounded-full flex items-center justify-center mb-3 text-purple-600 dark:text-purple-300">
                              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                              </svg>
                          </div>
                          <h4 class="font-medium text-gray-800 dark:text-gray-200 mb-1">选择文件</h4>
                          <p class="text-sm text-gray-600 dark:text-gray-400">点击此处打开文件选择器，选择 .zip 包进行安装。</p>
                      </div>
                  </div>
              </div>

              <div class="space-y-4">
                  <h3 class="font-semibold text-gray-700 dark:text-gray-200">推荐应用</h3>
                  <div class="grid grid-cols-1 gap-3">
                      <div v-for="app in recommendedApps" :key="app.url" 
                           class="flex items-center p-3 rounded-xl border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow bg-gray-50 dark:bg-gray-800/50">
                          <div class="w-12 h-12 rounded-lg bg-white dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 shadow-sm shrink-0 overflow-hidden" v-html="app.icon"></div>
                          <div class="ml-3 flex-1 min-w-0">
                              <h4 class="font-medium text-gray-800 dark:text-gray-200 truncate">{{ app.title }}</h4>
                              <p class="text-xs text-gray-500 truncate">{{ app.description }}</p>
                              <p v-if="app.appIdentifier" class="text-xs text-gray-400 truncate mt-0.5">{{ app.appIdentifier }}</p>
                          </div>
                          <button @click="installRecommended(app)" 
                                  :disabled="isInstalling"
                                  class="ml-3 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                              安装
                          </button>
                      </div>
                  </div>
              </div>
          </div>

          <!-- Online App Tab -->
          <div v-else class="space-y-6">
              <div class="space-y-4">
                  <div>
                      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">应用标题</label>
                      <input v-model="onlineAppTitle" 
                             type="text" 
                             placeholder="例如：我的网站"
                             class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" />
                  </div>
                  <div>
                      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">网站链接 (URL)</label>
                      <input v-model="onlineAppUrl" 
                             type="url" 
                             placeholder="https://example.com"
                             class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" />
                  </div>
                  
                  <div>
                      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">应用图标 (可选)</label>
                      <div class="flex items-center gap-4">
                          <div class="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center border border-gray-200 dark:border-gray-600 overflow-hidden shrink-0">
                              <img v-if="onlineAppIconPreview" :src="onlineAppIconPreview" class="w-full h-full object-cover" />
                              <svg v-else class="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                          </div>
                          <div class="flex-1">
                              <input type="file" accept="image/*" @change="handleIconChange" class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-300" />
                              <p class="mt-1 text-xs text-gray-500">如果自动获取失败，请手动上传图标</p>
                          </div>
                      </div>
                  </div>

                  <div class="pt-2">
                      <button @click="handleAddOnlineApp" 
                              :disabled="isInstalling || !onlineAppTitle || !onlineAppUrl"
                              class="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
                          <span v-if="isInstalling" class="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                          {{ isInstalling ? '处理中...' : '添加到桌面' }}
                      </button>
                  </div>
              </div>
          </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
</style>
