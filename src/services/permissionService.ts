import { ref } from 'vue';
import { db } from '../db';

export interface PermissionRequest {
    requestId: string;
    appId: string;
    permissions: string[];
    resolve: (granted: boolean) => void;
    reject: (reason?: any) => void;
}

const currentRequest = ref<PermissionRequest | null>(null);

export const permissionService = {
    currentRequest,

    async hasPermission(appId: string, permission: string): Promise<boolean> {
        const granted = await db.getPermissions(appId);
        return granted.includes(permission);
    },

    async requestPermissions(appId: string, permissions: string[], options?: { popup?: boolean }): Promise<boolean> {
        const granted = await db.getPermissions(appId);
        const missing = permissions.filter(p => !granted.includes(p));
        
        if (missing.length === 0) {
            return true;
        }

        if (options?.popup) {
            return this.requestPermissionsInPopup(appId, missing);
        }

        return new Promise<boolean>((resolve, reject) => {
            currentRequest.value = {
                requestId: Math.random().toString(36),
                appId,
                permissions: missing,
                resolve: async (result) => {
                    if (result) {
                        // Merge new permissions with existing ones
                        const newPermissions = [...new Set([...granted, ...missing])];
                        await db.setPermissions(appId, newPermissions);
                        resolve(true);
                    } else {
                        reject(new Error('User denied permission'));
                    }
                    currentRequest.value = null;
                },
                reject: (err) => {
                    currentRequest.value = null;
                    reject(err);
                }
            };
        });
    },

    async requestPermissionsInPopup(appId: string, permissions: string[]): Promise<boolean> {
        // Fetch app details for better UI
        const app = await db.getApp(appId);
        const title = app?.title || appId;
        const icon = app?.icon || '';

        return new Promise((resolve, reject) => {
             const requestId = Math.random().toString(36);
             const width = 500;
             const height = 400;
             const left = (window.screen.width - width) / 2;
             const top = (window.screen.height - height) / 2;
             
             const url = `./permission.html?appId=${encodeURIComponent(appId)}&title=${encodeURIComponent(title)}&icon=${encodeURIComponent(icon)}&permissions=${encodeURIComponent(JSON.stringify(permissions))}&requestId=${requestId}`;
             
             const win = window.open(url, '_blank', `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`);
             
             if (!win) {
                 // Popup blocked? Fallback to modal?
                 // Recursively call without popup option
                 return this.requestPermissions(appId, permissions).then(resolve).catch(reject);
             }

             const handler = (event: MessageEvent) => {
                 if (event.data?.type === 'permission.result' && event.data.requestId === requestId) {
                     window.removeEventListener('message', handler);
                     if (event.data.granted) {
                         // Update DB
                         db.getPermissions(appId).then(existing => {
                             const newPermissions = [...new Set([...existing, ...permissions])];
                             db.setPermissions(appId, newPermissions).then(() => resolve(true));
                         });
                     } else {
                         reject(new Error('User denied permission'));
                     }
                 }
             };
             
             window.addEventListener('message', handler);
        });
    },

    resolveRequest(granted: boolean) {
        if (currentRequest.value) {
            currentRequest.value.resolve(granted);
        }
    }
};
