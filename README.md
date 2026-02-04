# H5Box 网页小程序启动器
<div align="center">
  <a href="https://h5box.skskk.com"><img width="100px" alt="logo" src="https://h5box.skskk.com/public/h5box-logo.png"/></a>
  <p><em>一个现代化的、基于浏览器的桌面环境，用于在本地管理和运行 HTML5 应用程序。本项目基于 Vue 3、TypeScript 和 IndexedDB 构建。</em></p>
<div>



## 功能特性

- **本地应用管理**：通过拖拽 ZIP 文件或输入 URL 安装应用。
- **持久化存储**：应用及其状态通过 IndexedDB 存储在本地浏览器中。
- **窗口管理**：支持可拖拽、可调整大小的窗口，并具备状态持久化功能。
- **PWA 支持**：支持离线运行，并可作为渐进式 Web 应用（PWA）安装到系统。
- **应用市场**：内置应用市场界面，支持发现和导入应用（基于 JSON 配置）。
- **导入/导出**：支持将所有应用备份为 JSON 文件，或将单个应用导出为 ZIP 文件。
- **个性化定制**：支持拖拽排序应用图标、重命名应用以及自定义图标。

## 快速开始

### 环境要求

- Node.js (v16 或更高版本)
- npm 或 pnpm

### 安装步骤

1. 克隆仓库：
   ```bash
   git clone https://github.com/yourusername/html-app-launcher.git
   cd html-app-launcher
   ```

2. 安装依赖：
   ```bash
   npm install
   ```

3. 启动开发服务器：
   ```bash
   npm run dev
   ```

4. 打开浏览器并访问 `http://localhost:3000`（或终端中显示的 URL）。

## 使用说明

- **安装应用**：将包含 `index.html` 的 ZIP 文件直接拖拽到桌面背景上即可安装。
- **应用排序**：长按并拖拽应用图标即可重新排列顺序。
- **右键菜单**：右键点击应用图标可访问打开、导出、重命名和编辑信息等选项；右键点击空白处可导出全部应用数据。
- **应用市场**：点击桌面的“应用市场”图标，可以导入市场数据或通过 URL 安装应用。
- **数据导出**：在桌面空白处点击右键，选择“导出全部应用 (JSON)”进行备份。

## 生产环境构建

如需构建用于生产环境的静态文件：

```bash
npm run build
```

构建产物将输出到 `dist` 目录。

## 贡献指南

欢迎提交 Pull Request。对于重大更改，请先提交 Issue 进行讨论。

## 开源协议

[MIT](LICENSE)
