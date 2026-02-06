<script setup lang="ts">
const props = defineProps<{
  isOpen: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  isBusy?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'export'): void;
}>();

const handleExport = () => {
  if (props.isBusy) return;
  emit('export');
};
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-[3000] flex items-center justify-center bg-black/40 backdrop-blur-sm"
    @click.self="!props.isBusy && $emit('close')"
    @contextmenu.stop
  >
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6 transform transition-all scale-100">
      <h3 class="text-xl font-bold text-gray-800 dark:text-white mb-4">{{ props.title || '导出全部应用' }}</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">{{ props.description || '即将导出包含所有应用信息的备份文件。' }}</p>
      
      <div class="flex justify-end gap-3">
        <button
                @click="$emit('close')"
                class="px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="props.isBusy">
          取消
        </button>
        <button
                @click="handleExport"
                class="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="props.isBusy">
          {{ props.isBusy ? '正在导出...' : (props.confirmText || '导出') }}
        </button>
      </div>
    </div>
  </div>
</template>
