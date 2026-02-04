<script setup lang="ts">
import { useTheme } from '../composables/useTheme';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const { themeMode, setTheme } = useTheme();

const modes = [
  { value: 'light', label: '浅色', icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z' },
  { value: 'dark', label: '深色', icon: 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z' },
  { value: 'system', label: '跟随系统', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' }
] as const;
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/20 backdrop-blur-sm" @click.self="emit('close')">
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all p-6">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-bold text-gray-800 dark:text-white">设置</h2>
        <button @click="emit('close')" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <div class="space-y-6">
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
      </div>
      
      <div class="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700 text-center text-xs text-gray-400">
        H5Box
      </div>
    </div>
  </div>
</template>
