<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  isOpen: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  isBusy?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'export', data: { author: string; repository: string }): void;
}>();

const author = ref('');
const repository = ref('');

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    author.value = '';
    repository.value = '';
  }
});

const handleExport = () => {
  if (props.isBusy) return;
  emit('export', {
    author: author.value.trim(),
    repository: repository.value.trim()
  });
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
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">{{ props.description || '请填写以下元数据：' }}</p>
      
      <div class="space-y-4 mb-6">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">作者 (Author)</label>
          <input v-model="author" 
                 type="text" 
                 class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                 placeholder="您的名字" />
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">仓库链接 (Repository URL)</label>
          <input v-model="repository" 
                 type="text" 
                 class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                 placeholder="https://github.com/username/repo" />
        </div>
      </div>

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
