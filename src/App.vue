<script setup lang="ts">
import Desktop from '@/components/Desktop.vue';
import Toast from '@/components/Toast.vue';
import { startupError } from '@/systemState';

const reload = () => {
  window.location.reload();
};
</script>

<template>
  <div v-if="startupError" class="fixed inset-0 z-[9999] bg-gray-50 flex flex-col items-center justify-center p-8 text-center">
    <div class="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
      <svg class="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
      </svg>
    </div>
    <h1 class="text-2xl font-bold text-gray-900 mb-2">启动失败</h1>
    <p class="text-gray-600 mb-6 max-w-md break-words whitespace-pre-wrap text-left bg-white p-4 rounded border border-gray-200 shadow-sm">{{ startupError }}</p>
    <button @click="reload" class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium">
      重试
    </button>
  </div>
  <template v-else>
    <Desktop />
    <Toast />
  </template>
</template>
