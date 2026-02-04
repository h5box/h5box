import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { registerSW } from 'virtual:pwa-register'
// import { useToast } from './composables/useToast'
import { setStartupError } from './systemState'
import './style.css'
import App from './App.vue'

// const { addToast } = useToast()

// Robust SW Registration
if (!navigator.cookieEnabled) {
  console.warn('Cookies are disabled. Service Worker will likely fail.');
  setStartupError('Cookie 已被禁用。请启用 Cookie 以允许 Service Worker 运行，否则应用无法离线工作。');
}

registerSW({ 
  immediate: true,
  onRegisterError(error: any) {
    console.error('Service Worker registration failed:', error);
    let msg = `Service Worker 注册失败: ${error}`;
    
    // Detailed diagnosis for InvalidStateError
    if (error?.name === 'InvalidStateError' || error?.message?.includes('InvalidStateError')) {
      msg = 'Service Worker 注册失败: 浏览器环境受限 (InvalidStateError)。\n\n';
      msg += '可能原因：\n';
      msg += '1. 使用了隐私模式/无痕浏览 (请切换到普通窗口)\n';
      msg += '2. 浏览器禁用了 Cookie 或历史记录 (请检查设置)\n';
      msg += '3. 浏览器处于非安全环境 (需要 localhost 或 HTTPS)\n';
      
      if (!navigator.cookieEnabled) {
         msg += '\n检测到 Cookie 已禁用，这会导致 Service Worker 无法运行。';
      }
    }
    setStartupError(msg);
  }
})

// Check environment
if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker is not supported in this environment');
    setStartupError('当前环境不支持 Service Worker (可能需要 HTTPS 或 localhost)');
}

// Manually log for debugging
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then((registration) => {
    console.log('PWA: Service Worker ready', registration);
  }).catch(err => {
    console.error('PWA: Service Worker ready failed', err);
    // addToast(`SW 就绪失败: ${err}`, 'error');
    setStartupError(`Service Worker 就绪失败: ${err}`);
  });
}

const pinia = createPinia()


const app = createApp(App)

// Detect if we are running inside an iframe as an app but loaded the main app code (SW bypass)
// This happens if the Service Worker failed to intercept the request and the server returned index.html (SPA fallback)
// CHANGED: Use includes() instead of startsWith() to support subdirectories (GitHub Pages)
if (window.location.pathname.includes('/app/')) {
    document.body.innerHTML = `
        <div style="padding: 20px; font-family: sans-serif; color: #333;">
            <h1 style="color: #e11d48;">Connection Failed</h1>
            <p>The application could not be loaded from the local database.</p>
            <div style="background: #eff6ff; padding: 15px; border-radius: 6px; border-left: 4px solid #3b82f6; margin-top: 20px;">
                <p><strong>Possible reasons:</strong></p>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>Service Worker is not active or failed to intercept the request.</li>
                    <li>Browser restrictions (try using localhost or HTTPS).</li>
                    <li>Hard refresh might be needed (Ctrl+F5).</li>
                </ul>
                <p style="margin-top: 10px; font-size: 0.9em; color: #666;">Current Path: ${window.location.pathname}</p>
            </div>
        </div>
    `;
    throw new Error('App loaded in main context instead of SW context');
}

app.use(pinia)
app.mount('#app')
