# 网页小程序启动器 (Web App Launcher)

**网页小程序启动器** 是一个基于 Web 技术的轻量级桌面操作系统模拟环境。它允许用户在浏览器中直接安装、运行和管理 HTML5 应用程序，提供类原生的桌面体验。

## ✨ 核心特性

*   **🖥️ 沉浸式桌面体验**
    *   提供完整的窗口管理系统（拖拽、缩放、最小化/最大化）。
    *   支持多任务并行处理，应用状态自动持久化。
    *   可自定义的桌面布局，支持应用图标拖拽排序。

*   **📦 强大的应用管理**
    *   **拖拽安装**：直接将 `.zip` 格式的应用包拖入桌面即可安装。
    *   **URL 安装**：支持通过网络链接直接添加应用。
    *   **应用市场**：内置应用发现机制，轻松获取新应用。
    *   **完全离线**：应用代码存储在本地 IndexedDB 中，无网络也能运行。

*   **🔒 安全与隐私**
    *   基于沙箱机制运行应用，确保主系统安全。
    *   数据完全本地化，不依赖云端存储，保护用户隐私。

*   **💾 数据备份与迁移**
    *   支持一键导出所有应用数据。
    *   支持单个应用的打包导出与分享。

## 🛠️ 技术栈

本项目采用现代化的前端技术构建，确保高性能与良好的开发体验：

*   **核心框架**: [Vue 3](https://vuejs.org/) + [TypeScript](https://www.typescriptlang.org/)
*   **构建工具**: [Vite](https://vitejs.dev/)
*   **状态管理**: [Pinia](https://pinia.vuejs.org/)
*   **样式系统**: [Tailwind CSS](https://tailwindcss.com/)
*   **本地存储**: [idb](https://github.com/jakearchibald/idb) (IndexedDB Wrapper)
*   **文件处理**: [JSZip](https://stuk.github.io/jszip/)

## 🚀 快速开始

1.  **克隆项目**
    ```bash
    git clone [repository-url]
    cd html-app
    ```

2.  **安装依赖**
    ```bash
    npm install
    ```

3.  **启动开发服务器**
    ```bash
    npm run dev
    ```

4.  **构建生产版本**
    ```bash
    npm run build
    ```

---
*Generated for html-app project introduction.*
