class SystemBridge {
    constructor() {
        this.pendingRequests = new Map();

        // Listen for responses from the system
        window.addEventListener('message', (event) => {
            // In a real scenario, you might want to verify event.origin
            const { type, payload, error, requestId, success } = event.data;

            if (requestId && this.pendingRequests.has(requestId)) {
                const { resolve, reject } = this.pendingRequests.get(requestId);
                this.pendingRequests.delete(requestId);

                if (success) {
                    resolve(payload);
                } else {
                    reject(new Error(error || 'Unknown error'));
                }
            }
        });
    }

    /**
     * Send a request to the system
     */
    request(type, payload = {}) {
        return new Promise((resolve, reject) => {
            // Generate a simple UUID-like string
            const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2);
            
            this.pendingRequests.set(requestId, { resolve, reject });

            window.parent.postMessage({
                type,
                payload,
                requestId
            }, '*');

            // Timeout after 30 seconds
            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error('Request timeout'));
                }
            }, 30000);
        });
    }

    async getInstalledApps() {
        return this.request('system.getInstalledApps');
    }

    async uninstallApp(appId) {
        return this.request('system.uninstallApp', { appId });
    }

    async openApp(appId) {
        return this.request('system.openApp', { appId });
    }

    async requestPermissions(permissions) {
        return this.request('system.requestPermissions', { permissions });
    }
}

// UI Logic
const bridge = new SystemBridge();
const appListEl = document.getElementById('appList');
const loadingEl = document.getElementById('loading');
const emptyEl = document.getElementById('empty');
const template = document.getElementById('appCardTemplate');

async function loadApps() {
    try {
        setLoading(true);
        const apps = await bridge.getInstalledApps();
        renderApps(apps);
    } catch (err) {
        console.error('Failed to load apps:', err);
        alert('加载应用列表失败: ' + err.message);
    } finally {
        setLoading(false);
    }
}

function setLoading(isLoading) {
    if (isLoading) {
        loadingEl.classList.remove('hidden');
        appListEl.classList.add('hidden');
        emptyEl.classList.add('hidden');
    } else {
        loadingEl.classList.add('hidden');
    }
}

function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderApps(apps) {
    appListEl.innerHTML = '';
    
    if (!apps || apps.length === 0) {
        emptyEl.classList.remove('hidden');
        appListEl.classList.add('hidden');
        return;
    }

    emptyEl.classList.add('hidden');
    appListEl.classList.remove('hidden');

    apps.forEach(app => {
        const clone = template.content.cloneNode(true);
        const card = clone.querySelector('.app-card');
        
        // Fill data
        clone.querySelector('.app-title').textContent = app.title;
        clone.querySelector('.app-desc').textContent = app.description || '暂无描述';
        clone.querySelector('.app-version').textContent = 'v' + (app.version || '1.0.0');
        clone.querySelector('.app-author').textContent = app.author || 'Unknown';
        
        // New fields
        const timeEl = clone.querySelector('.app-time');
        if (timeEl && app.installTime) {
            timeEl.textContent = formatDate(app.installTime);
        }

        const sourceEl = clone.querySelector('.app-source');
        if (sourceEl) {
            sourceEl.textContent = app.installSource || 'Local';
        }
        
        const iconImg = clone.querySelector('.app-icon');
        if (app.icon) {
            if (app.icon.startsWith('data:') || app.icon.startsWith('http')) {
                iconImg.src = app.icon;
            } else {
                iconImg.src = app.icon; 
            }
        } else {
            iconImg.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjOWNhM2FmIiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIGQ9Ik00IDhWNGg0TTkgOUw0IDRNNCAxNnY0aDRNOSAxNUw0IDIwTTIwIDhWNGgtNE0xNSA5bDUtNU00IDE2djRoNE05IDE1bC01IDVNMjAgMTZ2NGgtNE0xNSAxNWw1IDUiLz48L3N2Zz4=';
        }

        // Bind events
        const uninstallBtn = clone.querySelector('.uninstall-btn');
        uninstallBtn.onclick = async () => {
            if (!confirm(`确定要卸载 "${app.title}" 吗？`)) return;

            try {
                uninstallBtn.disabled = true;
                uninstallBtn.textContent = '...';
                
                await bridge.uninstallApp(app.id);
                
                card.style.opacity = '0';
                setTimeout(() => {
                    loadApps(); 
                }, 300);
                
            } catch (err) {
                console.error('Uninstall failed:', err);
                alert('卸载失败: ' + err.message);
                uninstallBtn.disabled = false;
                uninstallBtn.textContent = '卸载';
            }
        };

        const openBtn = clone.querySelector('.open-btn');
        if (openBtn) {
            openBtn.onclick = async () => {
                try {
                    await bridge.openApp(app.id);
                } catch (err) {
                    console.error('Open failed:', err);
                    alert('无法打开应用: ' + err.message);
                }
            };
        }

        appListEl.appendChild(clone);
    });
}

// Init
document.getElementById('refreshBtn').onclick = loadApps;

(async () => {
    try {
        await bridge.requestPermissions([
            'system.getInstalledApps', 
            'system.uninstallApp',
            'system.openApp'
        ]);
        loadApps();
    } catch (err) {
        console.error('Permission request failed:', err);
        // Still try to load, maybe some permissions were granted previously or partially
        // But in strict mode, it might fail.
        alert('权限申请被拒绝，部分功能可能不可用');
        loadApps();
    }
})();
