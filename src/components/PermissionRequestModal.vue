<script setup lang="ts">
import { computed } from 'vue';
import { permissionService } from '../services/permissionService';

const request = computed(() => permissionService.currentRequest.value);
const isOpen = computed(() => !!request.value);

const permissionNames: Record<string, string> = {
    'system.installApp': '安装应用',
    'system.uninstallApp': '卸载应用',
    'system.getInstalledApps': '读取已安装应用列表',
    'system.openApp': '打开其他应用',
    'system.readAppSource': '读取应用源代码'
};

const getPermissionName = (perm: string) => permissionNames[perm] || perm;

const handleAllow = () => {
    permissionService.resolveRequest(true);
};

const handleDeny = () => {
    permissionService.resolveRequest(false);
};
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-[4000] flex items-center justify-center bg-black/40 backdrop-blur-sm"
    @contextmenu.stop
  >
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6 transform transition-all scale-100 animate-scale-in">
      <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
              </svg>
          </div>
          <h3 class="text-xl font-bold text-gray-800 dark:text-white">权限申请</h3>
      </div>
      
      <p class="text-sm text-gray-600 dark:text-gray-300 mb-4">
        应用 <strong>{{ request?.appId }}</strong> 请求以下权限：
      </p>

      <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-6 border border-gray-100 dark:border-gray-600">
          <ul class="space-y-2">
              <li v-for="perm in request?.permissions" :key="perm" class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                  <svg class="w-4 h-4 text-gray-400 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  {{ getPermissionName(perm) }}
              </li>
          </ul>
      </div>

      <div class="flex justify-end gap-3">
        <button
          @click="handleDeny"
          class="px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
        >
          拒绝
        </button>
        <button
          @click="handleAllow"
          class="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md transition-colors"
        >
          允许
        </button>
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
