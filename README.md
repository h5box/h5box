<h1 align="center">H5Box 网页小程序启动器</h1>

<div align="center">
  <a href="https://h5box.skskk.com">
    <img width="100px" alt="logo" src="https://h5box.skskk.com/h5box-logo.svg"/>
  </a>
  <p>
    <em>一个现代化的、基于浏览器的桌面环境，用于在本地管理和运行 HTML5 应用程序。本项目基于 Vue 3、TypeScript 和 IndexedDB 构建。</em>
  </p>
</div>

<h2>功能特性</h2>

<ul>
  <li><strong>本地应用管理</strong>：通过拖拽 ZIP 文件或输入 URL 安装应用。</li>
  <li><strong>持久化存储</strong>：应用及其状态通过 IndexedDB 存储在本地浏览器中。</li>
  <li><strong>窗口管理</strong>：支持可拖拽、可调整大小的窗口，并具备状态持久化功能。</li>
  <li><strong>PWA 支持</strong>：支持离线运行，并可作为渐进式 Web 应用（PWA）安装到系统。</li>
  <li><strong>应用市场</strong>：内置应用市场界面，支持发现和导入应用（基于 JSON 配置）。</li>
  <li><strong>导入/导出</strong>：支持将所有应用备份为 JSON 文件，或将单个应用导出为 ZIP 文件。</li>
  <li><strong>个性化定制</strong>：支持拖拽排序应用图标、重命名应用以及自定义图标。</li>
</ul>

<h2>快速开始</h2>

<h3>环境要求</h3>

<ul>
  <li>Node.js (v16 或更高版本)</li>
  <li>npm 或 pnpm</li>
</ul>

<h3>安装步骤</h3>

<ol>
  <li>
    <p>克隆仓库：</p>
    <pre><code>git clone https://github.com/yourusername/html-app-launcher.git
cd html-app-launcher</code></pre>
  </li>
  <li>
    <p>安装依赖：</p>
    <pre><code>npm install</code></pre>
  </li>
  <li>
    <p>启动开发服务器：</p>
    <pre><code>npm run dev</code></pre>
  </li>
  <li>
    <p>打开浏览器并访问 <code>http://localhost:3000</code>（或终端中显示的 URL）。</p>
  </li>
</ol>

<h2>使用说明</h2>

<ul>
  <li><strong>安装应用</strong>：将包含 <code>index.html</code> 的 ZIP 文件直接拖拽到桌面背景上即可安装。</li>
  <li><strong>应用排序</strong>：长按并拖拽应用图标即可重新排列顺序。</li>
  <li><strong>右键菜单</strong>：右键点击应用图标可访问打开、导出、重命名和编辑信息等选项；右键点击空白处可导出全部应用数据。</li>
  <li><strong>应用市场</strong>：点击桌面的“应用市场”图标，可以导入市场数据或通过 URL 安装应用。</li>
  <li><strong>数据导出</strong>：在桌面空白处点击右键，选择“导出全部应用 (JSON)”进行备份。</li>
</ul>

<h2>生产环境构建</h2>

<p>如需构建用于生产环境的静态文件：</p>

<pre><code>npm run build</code></pre>

<p>构建产物将输出到 <code>dist</code> 目录。</p>

<h2>贡献指南</h2>

<p>欢迎提交 Pull Request。对于重大更改，请先提交 Issue 进行讨论。</p>

<h2>开源协议</h2>

<p><a href="LICENSE">MIT</a></p>
