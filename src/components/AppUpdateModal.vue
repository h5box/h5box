<script setup lang="ts">
import { type AppMetadata } from '../db';

const props = defineProps<{
  isOpen: boolean;
  newApp: AppMetadata | null;
  oldApp: AppMetadata | null;
}>();

const emit = defineEmits<{
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();

const getShortId = (id: string) => id.substring(0, 8);
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[3000] flex items-center justify-center p-4">
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" @click="emit('cancel')"></div>

    <!-- Modal Panel -->
    <div class="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-scale-in">
      
      <!-- Header Background Pattern -->
      <div class="absolute top-0 left-0 right-0 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 opacity-10"></div>
      
      <div class="relative px-6 pt-8 pb-6">
        <!-- App Icon & Title -->
        <div class="flex flex-col items-center mb-6">
          <div class="w-20 h-20 rounded-2xl bg-white dark:bg-gray-700 shadow-lg p-1 mb-4 transform hover:scale-105 transition-transform duration-300">
            <div class="w-full h-full rounded-xl overflow-hidden" v-if="newApp?.icon || oldApp?.icon">
                <img v-if="(newApp?.icon || oldApp?.icon)?.startsWith('data:') || (newApp?.icon || oldApp?.icon)?.startsWith('http')" 
                     :src="newApp?.icon || oldApp?.icon" 
                     class="w-full h-full object-cover" />
                <div v-else class="w-full h-full flex items-center justify-center text-gray-400">
                    <svg class="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>
            </div>
          </div>
          <h2 class="text-xl font-bold text-gray-900 dark:text-white text-center">{{ newApp?.title }}</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 text-center mt-1">发现新版本，是否立即更新？</p>
        </div>

        <!-- Version Comparison Card -->
        <div class="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-100 dark:border-gray-600 mb-6">
          <div class="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
            <!-- Old Version -->
            <div class="text-center">
              <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">当前版本</div>
              <div class="font-mono text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 px-2 py-1 rounded border border-gray-200 dark:border-gray-500 inline-block">
                {{ oldApp?.version || '0.0.0' }}
              </div>
            </div>

            <!-- Arrow -->
            <div class="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </div>

            <!-- New Version -->
            <div class="text-center">
              <div class="text-xs text-blue-500 dark:text-blue-400 mb-1 font-medium">新版本</div>
              <div class="font-mono text-sm font-bold text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded border border-blue-100 dark:border-blue-800 inline-block shadow-sm">
                {{ newApp?.version || '1.0.0' }}
              </div>
            </div>
          </div>

          <!-- Build ID Info (Subtle) -->
          <div class="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600 flex justify-between items-center text-xs text-gray-400 dark:text-gray-500">
             <span>Build: {{ getShortId(oldApp?.id || '') }}</span>
             <span>&rarr;</span>
             <span>{{ getShortId(newApp?.id || '') }}</span>
          </div>
        </div>

        <!-- Description Change (Optional) -->
        <div v-if="newApp?.description && newApp.description !== oldApp?.description" class="mb-6">
            <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">更新内容</h3>
            <div class="text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-600">
                {{ newApp.description }}
            </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-3">
          <button 
            type="button" 
            class="flex-1 px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-700 transition-all" 
            @click="emit('cancel')"
          >
            暂不更新
          </button>
          <button 
            type="button" 
            class="flex-1 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/30 shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2" 
            @click="emit('confirm')"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            立即更新
          </button>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-scale-in {
    animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes scaleIn {
    from { 
        opacity: 0;
        transform: scale(0.95) translateY(10px);
    }
    to { 
        opacity: 1;
        transform: scale(1) translateY(0);
    }
}
</style>
