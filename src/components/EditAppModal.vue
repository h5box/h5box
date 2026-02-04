<script setup lang="ts">
import { ref, computed, toRaw } from 'vue';
import { useAppStore } from '../stores/apps';
import { useToast } from '../composables/useToast';
import type { AppMetadata } from '../db';

const props = defineProps<{
  appId: string;
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const appStore = useAppStore();
const { addToast } = useToast();
const app = computed(() => appStore.apps.find(a => a.id === props.appId));

const form = ref<Partial<AppMetadata>>({});

// Initialize form when app changes or modal opens
const initForm = () => {
  if (app.value) {
    form.value = { ...app.value };
    // Remove blob from form to avoid issues, though we need it for update
    // Actually we just update fields we edit.
  }
};

// Watch for open
import { watch } from 'vue';
watch(() => props.isOpen, (newVal) => {
  if (newVal) initForm();
});

const save = async () => {
  if (!app.value) return;
  
  try {
    // Use toRaw to get the underlying plain object from the store (removing reactivity proxy)
    const baseApp = toRaw(app.value);
    
    // Merge with form data
    // We create a new object spreading baseApp first, then form.value
    // IMPORTANT: structuredClone or JSON.parse/stringify fails with Blob/Proxy.
    // We need to manually construct a clean object to ensure no Proxies are passed to IndexedDB
    
    // 1. Create a shallow copy of baseApp to get all properties
    // Deep clone array fields to avoid proxy issues with arrays (keywords)
    const cleanBaseApp: AppMetadata = {
        id: baseApp.id,
        title: baseApp.title,
        description: baseApp.description,
        icon: baseApp.icon,
        author: baseApp.author,
        version: baseApp.version,
        rootPrefix: baseApp.rootPrefix,
        keywords: baseApp.keywords ? [...toRaw(baseApp.keywords)] : [], // Clone array and unwrap
        installTime: baseApp.installTime,
        zipBlob: baseApp.zipBlob, // Blob is fine, not reactive usually
        order: baseApp.order,
        repository: baseApp.repository,
        appIdentifier: baseApp.appIdentifier,
        officialWebsite: baseApp.officialWebsite
    };
    
    // 2. Merge form data
    const rawForm = toRaw(form.value);
    const updatedApp: AppMetadata = {
      ...cleanBaseApp,
      ...rawForm
    };

    // Ensure array is also raw in case form update it
    if (updatedApp.keywords) {
        updatedApp.keywords = [...toRaw(updatedApp.keywords)];
    }
    
    // Ensure zipBlob is preserved (it should be in baseApp, but just to be safe if form.value overwrote it with undefined)
    if (baseApp.zipBlob && !updatedApp.zipBlob) {
        updatedApp.zipBlob = baseApp.zipBlob;
    }

    // Double check that we are not passing a Proxy
    // IndexedDB DataCloneError often happens when passing Vue Proxies directly
    await appStore.updateApp(updatedApp);
    addToast('保存成功', 'success');
    emit('close');
  } catch (error) {
    console.error('Failed to save app info:', error);
    addToast('保存失败，请重试', 'error');
  }
};

const handleIconChange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target?.result) {
                form.value.icon = e.target.result as string;
            }
        };
        reader.readAsDataURL(file);
    }
};
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm" @click.self="$emit('close')">
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg p-6 animate-scale-in">
      <h2 class="text-xl font-bold mb-4 text-gray-800 dark:text-white">编辑应用信息</h2>
      
      <div v-if="app" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">名称</label>
          <input v-model="form.title" type="text" class="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none">
        </div>

        <div>
           <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">图标</label>
           <div class="flex items-center gap-4">
               <img :src="form.icon" class="w-12 h-12 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 object-cover">
               <div class="flex-1 space-y-2">
                   <input type="text" v-model="form.icon" placeholder="输入图标 URL" class="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                   <input type="file" accept="image/*" @change="handleIconChange" class="text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-300">
               </div>
           </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">描述</label>
          <textarea v-model="form.description" rows="3" class="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"></textarea>
        </div>

        <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">作者</label>
            <input v-model="form.author" type="text" class="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none">
        </div>

        <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">包名 (Package Name)</label>
            <input v-model="form.appIdentifier" type="text" placeholder="例如: author/repo" class="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none">
        </div>

        <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">官方网站 (Official Website)</label>
            <input v-model="form.officialWebsite" type="text" class="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none">
        </div>
        
        <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">开源链接 (Repository)</label>
            <input v-model="form.repository" type="text" class="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none">
        </div>

        <div class="flex justify-end gap-3 mt-6">
          <button @click="$emit('close')" class="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">取消</button>
          <button @click="save" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-scale-in {
    animation: scaleIn 0.2s ease-out;
}
@keyframes scaleIn {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
}
</style>