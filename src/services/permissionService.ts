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

    async requestPermissions(appId: string, permissions: string[]): Promise<boolean> {
        const granted = await db.getPermissions(appId);
        const missing = permissions.filter(p => !granted.includes(p));
        
        if (missing.length === 0) {
            return true;
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

    resolveRequest(granted: boolean) {
        if (currentRequest.value) {
            currentRequest.value.resolve(granted);
        }
    }
};
