import { PLATFORM_NAME } from '@aitest/contracts';
const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('App root not found');
app.innerHTML = `<div style="font-family:system-ui;max-width:800px;margin:80px auto;padding:24px"><h1>AI Testing Platform</h1><p>${PLATFORM_NAME} — Sprint 1 bootstrap</p><p>Web, API, Android và iOS runners: chưa triển khai.</p><p>API health: <a href="http://127.0.0.1:3001/health">http://127.0.0.1:3001/health</a></p></div>`;
