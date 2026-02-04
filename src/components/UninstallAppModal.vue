<script setup lang="ts">
const props = withDefaults(defineProps<{
  isOpen: boolean;
  appTitle: string;
  isBusy?: boolean;
}>(), {
  isBusy: false
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'confirm'): void;
}>();
</script>

<template>
  <div
    v-if="props.isOpen"
    class="fixed inset-0 z-[3000] flex items-center justify-center bg-black/40 backdrop-blur-sm"
    @click.self="emit('close')"
    @contextmenu.stop
  >
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6 transform transition-all scale-100">
      <h3 class="text-xl font-bold text-gray-800 dark:text-white mb-3">确认卸载</h3>
      <p class="text-sm text-gray-600 dark:text-gray-300 mb-6">
        确定要卸载“{{ props.appTitle || '此应用' }}”吗？卸载后将删除本地数据，无法恢复。
      </p>

      <div class="flex justify-end gap-3">
        <button
          @click="emit('close')"
          class="px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="props.isBusy"
        >
          取消
        </button>
        <button
          @click="emit('confirm')"
          class="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="props.isBusy"
        >
          {{ props.isBusy ? '正在卸载...' : '卸载' }}
        </button>
      </div>
    </div>
  </div>
</template>
