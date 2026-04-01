<script setup lang="ts">
import { ref } from 'vue';
import type { AppMetadata } from '../db';

const menuRef = ref<HTMLElement | null>(null);

defineProps<{
  visible: boolean;
  x: number;
  y: number;
  appId: string;
  apps: AppMetadata[];
}>();

defineEmits<{
  (e: 'open'): void;
  (e: 'open-new-window'): void;
  (e: 'open-source'): void;
  (e: 'edit'): void;
  (e: 'export'): void;
  (e: 'rename'): void;
  (e: 'uninstall'): void;
  (e: 'install'): void;
  (e: 'settings'): void;
}>();

defineExpose({
  menuRef
});
</script>

<template>
  <div
    v-if="visible"
    ref="menuRef"
    class="fixed bg-white dark:bg-gray-800 shadow-xl rounded-lg py-1 z-[999] min-w-[160px] border border-gray-100 dark:border-gray-700"
    :style="{ left: `${x}px`, top: `${y}px` }"
  >
    <div v-if="appId">
      <div class="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-700 dark:text-gray-200" @click.stop="$emit('open')">打开</div>
      <div class="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-700 dark:text-gray-200" @click.stop="$emit('open-new-window')">新窗口打开</div>
      <div class="border-t border-gray-100 dark:border-gray-700 my-1"></div>
      <div
        class="px-4 py-2 text-sm transition-colors"
        :class="apps.find(app => app.id === appId)?.repository
          ? 'hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-gray-700 dark:text-gray-200'
          : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'"
        @click.stop="apps.find(app => app.id === appId)?.repository && $emit('open-source')"
      >
        打开开源地址
      </div>
      <div class="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-700 dark:text-gray-200" @click.stop="$emit('edit')">编辑信息</div>
      <div class="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-700 dark:text-gray-200" @click.stop="$emit('export')">导出应用 (ZIP)</div>
      <div class="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-700 dark:text-gray-200" @click.stop="$emit('rename')">重命名</div>
      <div class="px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer text-sm text-red-600 dark:text-red-400" @click.stop="$emit('uninstall')">卸载</div>
    </div>
    <div v-else>
      <div class="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-700 dark:text-gray-200" @click.stop="$emit('install')">安装应用</div>
      <div class="border-t border-gray-100 dark:border-gray-700 my-1"></div>
      <div class="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-700 dark:text-gray-200" @click.stop="$emit('settings')">系统设置</div>
    </div>
  </div>
</template>
