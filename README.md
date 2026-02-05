<h1 align="center">H5Box 网页小程序启动器</h1>

<div align="center">
  <a>
    <img width="100px" alt="logo" src="https://github.com/h5box/h5box/raw/main/public/pwa-icon.svg"/>
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
  <li><strong>导入/导出</strong>：支持将所有应用备份为 JSON 文件，或将单个应用导出为 ZIP 文件。</li>
  <li><strong>个性化定制</strong>：支持拖拽排序应用图标、重命名应用以及自定义图标。</li>
</ul>

<h2>快速开始</h2>
访问 <a href="https://h5box.github.io/h5box/">h5box.github.io/h5box</a>






<h2>使用说明</h2>

<ul>
  <li><strong>安装应用</strong>：将包含 <code>index.html</code> 的 ZIP 文件直接拖拽到桌面背景上即可安装。</li>
  <li><strong>应用排序</strong>：长按并拖拽应用图标即可重新排列顺序。</li>
  <li><strong>右键菜单</strong>：右键点击应用图标可访问打开、导出、重命名和编辑信息等选项；右键点击空白处可导出全部应用数据。</li>
  <li><strong>应用市场</strong>：点击桌面的“应用市场”图标，可以导入市场数据或通过 URL 安装应用。</li>
  <li><strong>数据导出</strong>：在桌面空白处点击右键，选择“导出全部应用 (JSON)”进行备份。</li>
</ul>






<h2>开发指南</h2>
如果你想开发一个应用市场

可以参考 [AppMarketAPI.md](AppMarketAPI.md) 文档。



<h2>开源协议</h2>

<p><a href="LICENSE">MIT</a></p>
