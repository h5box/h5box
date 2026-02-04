<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  isOpen: boolean;
  currentName: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', newName: string): void;
}>();

const name = ref('');

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    name.value = props.currentName;
  }
});

const handleSave = () => {
  if (name.value.trim()) {
    emit('save', name.value.trim());
    emit('close');
  }
};
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[3000] flex items-center justify-center bg-black/40 backdrop-blur-sm" @click.self="$emit('close')">
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6 transform transition-all scale-100">
      <h3 class="text-xl font-bold text-gray-800 dark:text-white mb-4">重命名应用</h3>
      
      <div class="mb-6">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">应用名称</label>
        <input v-model="name" 
               type="text" 
               class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
               placeholder="请输入新的应用名称"
               @keyup.enter="handleSave"
               autofocus />
      </div>

      <div class="flex justify-end gap-3">
        <button @click="$emit('close')" 
                class="px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
          取消
        </button>
        <button @click="handleSave" 
                class="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="!name.trim()">
          保存
        </button>
      </div>
    </div>
  </div>
</template>
