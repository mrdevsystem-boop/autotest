import { PLATFORM_NAME } from '@aitest/contracts';
interface Project { id: string; name: string; description: string; createdAt: string }
const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('App root not found');
const root: HTMLElement = app;
root.innerHTML = `<main style="font-family:system-ui;max-width:850px;margin:40px auto;padding:20px">
<h1>AI Testing Platform</h1><p>${PLATFORM_NAME} — S1-02 Project CRUD demo (in-memory)</p>
<p style="color:#a64">Dữ liệu demo sẽ mất khi khởi động lại API. Chưa có đăng nhập, phân quyền hoặc PostgreSQL.</p>
<form id="form"><label>Tên project <input id="name" required maxlength="120" /></label>
<label>Mô tả <input id="description" maxlength="2000" /></label><button>Tạo project</button></form>
<p id="message" role="status"></p><h2>Projects</h2><ul id="projects"></ul></main>`;
const api = 'http://127.0.0.1:3001/api/projects';
const message = root.querySelector<HTMLElement>('#message')!;
async function load() {
  const list = root.querySelector<HTMLUListElement>('#projects')!;
  list.replaceChildren();
  try {
    const response = await fetch(api); if (!response.ok) throw new Error('HTTP ' + response.status);
    const body = await response.json() as { data: Project[] };
    for (const project of body.data) {
      const li = document.createElement('li'); li.style.margin = '12px 0';
      const label = document.createElement('span'); label.textContent = project.name + (project.description ? ' — ' + project.description : '');
      const remove = document.createElement('button'); remove.textContent = 'Xóa'; remove.style.marginLeft = '12px';
      remove.addEventListener('click', async () => {
        if (!confirm(`Xóa project "${project.name}"?`)) return;
        const result = await fetch(api + '/' + project.id, { method: 'DELETE' });
        message.textContent = result.ok ? 'Đã xóa project' : 'Xóa thất bại'; await load();
      });
      li.append(label, remove); list.append(li);
    }
    if (!body.data.length) { const li = document.createElement('li'); li.textContent = 'Chưa có project'; list.append(li); }
  } catch (error) { message.textContent = 'Không kết nối được API: ' + String(error); }
}
root.querySelector<HTMLFormElement>('#form')!.addEventListener('submit', async event => {
  event.preventDefault();
  const name = root.querySelector<HTMLInputElement>('#name')!;
  const description = root.querySelector<HTMLInputElement>('#description')!;
  try {
    const result = await fetch(api, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: name.value, description: description.value }) });
    if (!result.ok) throw new Error('HTTP ' + result.status);
    name.value = ''; description.value = ''; message.textContent = 'Tạo project thành công'; await load();
  } catch (error) { message.textContent = 'Tạo project thất bại: ' + String(error); }
});
void load();
