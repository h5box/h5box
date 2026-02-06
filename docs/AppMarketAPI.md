# 应用市场接口文档 (App Market Interface Documentation)

本文档描述了第三方应用如何与系统进行交互，实现应用安装、管理等功能。这使得开发者可以构建自己的“应用市场”应用。

## 1. 交互机制

应用通常运行在沙盒环境（iframe）中，与宿主系统（OS）的通信通过 `window.parent.postMessage` 实现。

> **注意**：如果应用被配置为在“弹出窗口”中运行，或者用户选择在新窗口中打开应用，此时应用与系统的通信通道为 `window.opener`。为了保证兼容性，建议应用同时尝试向 `window.parent` 和 `window.opener` 发送消息。

### 1.1 请求格式 (Request)

应用向系统发送的消息应遵循以下 JSON 格式：

```typescript
interface SystemRequest {
  type: string;       // 调用的 API 方法名，例如 "system.installApp"
  payload?: any;      // 方法参数
  requestId: string;  // 唯一请求 ID，用于匹配响应
}
```

### 1.2 响应格式 (Response)

系统处理完成后，会向应用发送响应消息：

```typescript
interface SystemResponse {
  type: string;       // 对应请求的 type + ".result"，例如 "system.installApp.result"
  payload?: any;      // 成功时的返回数据
  error?: string;     // 失败时的错误信息
  requestId: string;  // 对应请求的 ID
  success: boolean;   // 是否成功
}
```

---

## 2. 权限机制

为了保证系统安全，敏感操作（如安装、卸载、读取应用列表）需要先申请权限。

### 2.1 申请权限 (`system.requestPermissions`)

在调用敏感 API 之前，必须先调用此接口申请相应权限。系统会弹出对话框询问用户。

*   **Type**: `system.requestPermissions`
*   **Payload**:
    *   `permissions` (string[]): 请求的权限列表。

*   **Response Payload**:
    *   `true` (boolean): 用户允许。
    *   若用户拒绝，请求将失败（Promise reject）。

*   **可用权限**:
    *   `system.installApp`: 允许安装应用。
    *   `system.uninstallApp`: 允许卸载应用。
    *   `system.getInstalledApps`: 允许读取已安装应用列表。
    *   `system.openApp`: 允许打开其他应用。

*   **示例**:

```javascript
await callSystem('system.requestPermissions', {
  permissions: ['system.installApp', 'system.getInstalledApps']
});
```

---

## 3. API 列表

### 3.1 安装应用 (`system.installApp`)

请求系统下载并安装一个应用。**需要 `system.installApp` 权限。**

> **注意**：目前每次调用 `installApp` 都会创建一个新的应用实例（即使是相同的 URL），系统会分配一个新的 `appId`。请避免重复安装。

*   **Type**: `system.installApp`
*   **Payload**:
    *   `file` (Blob): 应用 ZIP 包的二进制数据。使用 Blob/File 可以避免跨域 (CORS) 问题。
    *   `appIdentifier` (string, optional): 应用唯一标识符（如 `user/repo`）。若提供此字段，系统将检测是否已安装同名应用：
        *   若已安装且版本不同，将弹出更新确认框。
        *   若已安装且版本相同，将跳过安装。
    *   `title` (string, optional): 应用标题。若提供，将覆盖 ZIP 包内 `index.html` 中的标题。
    *   `icon` (string, optional): 应用图标 URL 或 Base64。若提供，将覆盖 ZIP 包内的图标。
    *   `version` (string, optional): 应用版本号。若提供，将覆盖 ZIP 包内的版本号。用于版本比较。

*   **Response Payload**:
    *   `appId` (string): 安装后的应用 ID。
    *   `title` (string): 应用标题。

*   **示例**:

```javascript
// 假设已获取 blob
callSystem('system.installApp', {
  file: blobData,
  appIdentifier: 'com.example.myapp',
  title: 'My Custom App',
  icon: 'https://example.com/icon.png'
});
```

### 3.2 获取已安装应用 (`system.getInstalledApps`)

获取当前系统中已安装的所有应用列表。**需要 `system.getInstalledApps` 权限。**

*   **Type**: `system.getInstalledApps`
*   **Payload**: 无

*   **Response Payload**: `AppInfo[]` 数组
    *   `id` (string)
    *   `title` (string)
    *   `version` (string)
    *   `description` (string)
    *   `icon` (string): Base64 编码的图标
    *   `author` (string)
    *   `installTime` (number): 安装时间戳 (ms)
    *   `keywords` (string[]): 应用标签
    *   `installSource` (string): 安装来源
    *   `appIdentifier` (string): 应用唯一标识符
    *   `repository` (string): 仓库地址
    *   `website` (string): 官网地址

### 3.3 卸载应用 (`system.uninstallApp`)

请求卸载指定应用。**需要 `system.uninstallApp` 权限。**

*   **Type**: `system.uninstallApp`
*   **Payload**:
    *   `appId` (string): 要卸载的应用 ID。

*   **Response Payload**:
    *   `success` (boolean): true

### 3.5 读取应用源文件 (`system.getAppSource`)

获取已安装应用的源文件（通常为 ZIP 包）。**需要 `system.readAppSource` 权限。**

*   **Type**: `system.getAppSource`
*   **Payload**:
    *   `appId` (string): 要读取的应用 ID。

*   **Response Payload**:
    *   `blob` (Blob): 应用的源文件 Blob 对象。
    *   `filename` (string): 建议的文件名。

### 3.6 打开应用 (`system.openApp`)

请求系统打开指定的应用。**需要 `system.openApp` 权限。**

*   **Type**: `system.openApp`
*   **Payload**:
    *   `appId` (string): 要打开的应用 ID。

*   **Response Payload**:
    *   `success` (boolean): true

---

## 4. 常见错误 (Errors)

如果请求失败，`response.error` 字段可能包含以下信息：

*   `Permission denied: <permission>` - 权限不足，请先申请。
*   `Missing URL` - 安装时未提供 URL。
*   `Failed to download: <reason>` - 下载 ZIP 失败。
*   `App not found` - 指定的 `appId` 不存在。
*   `Host system does not support opening apps` - 系统不支持此操作。
*   `Request timeout` - 请求超时。

---

## 5. 开发者接入指南 (SDK 示例)

建议在你的应用中封装一个 `SystemBridge` 类来处理通信。

```javascript
// system-bridge.js

export class SystemBridge {
  constructor() {
    this.pendingRequests = new Map();
    
    // 监听来自系统的响应
    window.addEventListener('message', (event) => {
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
   * 发送请求给系统
   */
  request(type, payload = {}) {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();
      this.pendingRequests.set(requestId, { resolve, reject });
      
      const message = {
        type,
        payload,
        requestId
      };

      // 尝试向父窗口发送 (iframe 模式)
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(message, '*');
      }

      // 尝试向打开者窗口发送 (弹出窗口模式)
      if (window.opener && window.opener !== window) {
        window.opener.postMessage(message, '*');
      }
      
      // 超时处理 (可选)
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  // 封装常用方法
  async requestPermissions(permissions) {
      return this.request('system.requestPermissions', { permissions });
  }

  async installApp(payload) {
    return this.request('system.installApp', payload);
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
}

// 使用示例
const bridge = new SystemBridge();

(async () => {
    try {
        // 1. 先申请权限
        await bridge.requestPermissions([
            'system.getInstalledApps', 
            'system.installApp',
            'system.openApp'
        ]);

        // 2. 获取列表
        const apps = await bridge.getInstalledApps();
        console.log('Installed apps:', apps);

        // 3. 安装应用
        document.getElementById('installBtn').onclick = async () => {
          try {
            // 获取 Blob
            const response = await fetch('http://localhost:8000/apps/download/some-app.zip');
            const blob = await response.blob();

            const res = await bridge.installApp({
                file: blob, 
                title: 'My Custom App'
            });

            // 安装成功后尝试打开
            if(confirm('安装成功，是否打开？')) {
                await bridge.openApp(res.appId);
            }
          } catch (e) {
            alert('安装失败: ' + e.message);
          }
        };

    } catch (err) {
        console.error('Permission denied:', err);
    }
})();
```
