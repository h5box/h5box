import { defineStore } from 'pinia';
import { toRaw } from 'vue';
import { db, type AppMetadata } from '../db';
import { commitInstall, prepareInstall } from '../services/appInstall';
import { parseAppPackage } from '../services/installer';
import JSZip from 'jszip';

export const useAppStore = defineStore('apps', {
  state: () => ({
    apps: [] as AppMetadata[],
    isLoading: false,
    installProgress: 0,
    installStatus: '' as string,
    error: null as string | null,
    updateConfirmation: null as {
        isOpen: boolean;
        newApp: AppMetadata;
        oldApp: AppMetadata;
        resolve: (value: boolean) => void;
    } | null
  }),
  actions: {
    async loadApps() {
      try {
        const apps = await db.getAllApps();
        this.apps = apps.sort((a, b) => (a.order || 0) - (b.order || 0));
      } catch (e) {
        console.error('Failed to load apps', e);
      }
    },
    async installFromFile(file: File) {
      this.isLoading = true;
      this.error = null;
      try {
        await this.installSingleFromFile(file, 'Local File');
      } catch (e: any) {
        this.error = e.message || 'Installation failed';
        console.error(e);
      } finally {
        this.isLoading = false;
      }
    },
    async installFromFileSmart(file: File, source: string = 'Local File') {
      this.isLoading = true;
      this.installProgress = 0;
      this.installStatus = '正在解析...';
      this.error = null;
      try {
        const restored = await this.restoreFromExportZip(file);
        if (!restored) {
          this.installProgress = 50;
          this.installStatus = '正在安装...';
          await this.installSingleFromFile(file, source);
        }
        this.installProgress = 100;
        this.installStatus = '安装完成';
      } catch (e: any) {
        this.error = e.message || 'Installation failed';
        console.error(e);
      } finally {
        this.isLoading = false;
        setTimeout(() => {
             this.installProgress = 0;
             this.installStatus = '';
        }, 1000);
      }
    },
    async installFromUrl(url: string) {
      this.isLoading = true;
      this.installProgress = 0;
      this.installStatus = '正在连接...';
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to download app');
        
        const contentLength = res.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        let loaded = 0;

        const reader = res.body?.getReader();
        const chunks: Uint8Array[] = [];

        if (reader) {
             this.installStatus = '正在下载...';
             while (true) {
                 const { done, value } = await reader.read();
                 if (done) break;
                 if (value) {
                     chunks.push(value);
                     loaded += value.length;
                     if (total) {
                         this.installProgress = Math.min(Math.round((loaded / total) * 80), 80); // Download is 80%
                     }
                 }
             }
        }
        
        const blob = new Blob(chunks as any, { type: 'application/zip' });
        const filename = url.split('/').pop() || 'app.zip';
        const file = new File([blob], filename, { type: 'application/zip' });
        
        this.installStatus = '正在处理...';
        this.installProgress = 90;
        
        await this.installFromFileSmart(file, 'URL');
      } catch (e: any) {
        this.error = e.message;
        throw e;
      } finally {
        this.isLoading = false;
      }
    },
    async uninstallApp(id: string) {
      await db.deleteApp(id);
      this.apps = this.apps.filter(a => a.id !== id);
    },
    async updateApp(app: AppMetadata) {
      // Shallow copy to avoid proxy issues, ensuring all fields are preserved
      // Also ensure we are not passing a proxy
      // We can use JSON parse/stringify if no blob, but here we have blob.
      // So manual spread is best.
      const rawApp = { ...app };
      await db.updateApp(rawApp);
      const index = this.apps.findIndex(a => a.id === app.id);
      if (index !== -1) {
        this.apps[index] = app;
      }
    },
    async renameApp(id: string, newName: string) {
      const app = this.apps.find(a => a.id === id);
      if (app) {
        app.title = newName;
        await this.updateApp(app);
      }
    },
    async clearNewFlag(id: string) {
      const app = this.apps.find(a => a.id === id);
      if (app && app.isNew) {
        app.isNew = false;
        try {
          const rawApp = toRaw(app);
          // Explicitly update in DB
          await db.updateApp({ ...rawApp });
        } catch (e) {
          console.error('Failed to clear new flag in DB', e);
        }
      }
    },
    async ensureAppsLoaded() {
      if (this.apps.length === 0) {
        await this.loadApps();
      }
    },
    async confirmAppReplacement(newApp: AppMetadata, oldApp: AppMetadata) {
      const confirmed = await new Promise<boolean>((resolve) => {
        this.updateConfirmation = {
          isOpen: true,
          newApp,
          oldApp,
          resolve
        };
      });

      this.updateConfirmation = null;
      return confirmed;
    },
    async finalizeInstall(prepared: Awaited<ReturnType<typeof prepareInstall>>) {
      await this.ensureAppsLoaded();
      const installedApp = await commitInstall(prepared, {
        existingApps: this.apps,
        confirmReplace: (newApp, oldApp) => this.confirmAppReplacement(newApp, oldApp),
        onReplace: async (oldApp) => {
          await this.uninstallApp(oldApp.id);
        }
      });

      const existingIndex = this.apps.findIndex(app => app.id === installedApp.id);
      if (existingIndex === -1) {
        this.apps.push(installedApp);
      } else {
        this.apps[existingIndex] = installedApp;
      }

      return installedApp;
    },
    async installFromBridge(file: File, overrides: { appIdentifier?: string; title?: string; icon?: string; version?: string }, source: string) {
        const prepared = await prepareInstall(file, { source, overrides });
        return this.finalizeInstall(prepared);
    },
    async installSingleFromFile(
      file: File,
      source: string = 'Local File',
      overrides?: { appIdentifier?: string; title?: string; icon?: string; version?: string }
    ) {
      const prepared = await prepareInstall(file, { source, overrides });
      return this.finalizeInstall(prepared);
    },
    async restoreFromExportZip(file: File): Promise<boolean> {
      let zip: JSZip;
      try {
        zip = await JSZip.loadAsync(file);
      } catch {
        return false;
      }

      const manifestFile = zip.file('apps.json');
      if (!manifestFile) return false;

      let manifest: any;
      try {
        manifest = JSON.parse(await manifestFile.async('string'));
      } catch {
        return false;
      }

      if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.apps)) return false;

      const hasAnyAppZip = Object.keys(zip.files).some(path => path.startsWith('apps/') && path.toLowerCase().endsWith('.zip'));
      if (!hasAnyAppZip) return false;

      const normalizeString = (value: unknown) => (typeof value === 'string' ? value : '');
      const normalizeStringArray = (value: unknown) => (Array.isArray(value) ? value.map(v => normalizeString(v)).filter(Boolean) : []);
      const normalizeNumber = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

      const existingMaxOrder = this.apps.reduce((max, a) => Math.max(max, a.order || 0), 0);
      let nextOrder = existingMaxOrder + 1;
      let restoredCount = 0;

      for (const raw of manifest.apps as any[]) {
        if (!raw || typeof raw !== 'object') continue;
        const id = normalizeString(raw.id);
        if (!id) continue;

        const zipPath = normalizeString(raw.zipPath) || `apps/${id}.zip`;
        const appZip = zip.file(zipPath);
        if (!appZip) continue;

        const appZipBlob = await appZip.async('blob');
        const zipFile = new File([appZipBlob], `${id}.zip`, { type: 'application/zip' });

        const installTime = normalizeNumber(raw.installTime, Date.now());
        const order = typeof raw.order === 'number' && Number.isFinite(raw.order) ? raw.order : nextOrder++;

        try {
          const prepared = await parseAppPackage(zipFile, {
            id,
            installTime,
            metadataOverrides: {
              title: normalizeString(raw.title) || id,
              description: normalizeString(raw.description),
              icon: normalizeString(raw.icon),
              author: normalizeString(raw.author) || 'Unknown',
              version: normalizeString(raw.version) || '1.0.0',
              keywords: normalizeStringArray(raw.keywords),
              repository: typeof raw.repository === 'string' ? raw.repository : undefined,
              appIdentifier: normalizeString(raw.appIdentifier) || undefined,
              officialWebsite: normalizeString(raw.officialWebsite) || undefined,
              launchMode: normalizeString(raw.launchMode) === 'external' ? 'external' : 'embedded',
              order
            }
          });
          await db.saveAppBundle(prepared.app, prepared.files);
          restoredCount++;
        } catch {
          continue;
        }
      }

      if (restoredCount === 0) return false;
      await this.loadApps();
      return true;
    },
    async clearAllApps() {
      const appsCopy = [...this.apps];
      for (const app of appsCopy) {
        await this.uninstallApp(app.id);
      }
    },
    async updateAppOrder(newOrderApps: AppMetadata[]) {
        this.apps = newOrderApps;
        // Save all to DB with new order
        await Promise.all(newOrderApps.map(async (app, index) => {
            // Update if order changed or just to be safe
            if (app.order !== index) {
                app.order = index;
                await db.updateApp(toRaw(app));
            }
        }));
    }
  }
});
