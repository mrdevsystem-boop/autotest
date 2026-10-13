import { PLATFORM_NAME } from '@aitest/contracts';
interface Project { id:string; name:string; description:string }
interface Suite { id:string; projectId:string; name:string }
interface Case { id:string; suiteId:string; name:string; steps:string; kind:string; description:string }
const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('App root missing');
const api = 'http://127.0.0.1:3001/api';
root.innerHTML = `<main style="font:16px system-ui;max-width:1000px;margin:24px auto;padding:16px;line-height:1.6">
<h1>AI Testing Platform</h1><p>${PLATFORM_NAME} · Local SQLite · S1-03</p>
<p style="color:#985c18">Local development only: chưa có đăng nhập, tenant RBAC hay RLS.</p>
<form id="projectForm"><h2>Projects</h2><input name="name" placeholder="Tên project" maxlength="120" required> <input name="description" placeholder="Mô tả" maxlength="2000"> <button>Tạo Project</button></form>
<div id="projects"></div><p id="status" role="status"></p></main>`;
const projectsEl = root.querySelector<HTMLElement>('#projects')!;
const status = root.querySelector<HTMLElement>('#status')!;
const button = (label:string, action:()=>void) => { const el=document.createElement('button'); el.type='button'; el.textContent=label; el.style.margin='4px'; el.addEventListener('click',action); return el; };
const line = (text:string) => { const el=document.createElement('span'); el.textContent=text; return el; };
async function request<T>(path:string, method='GET', body?:unknown):Promise<T> {
  const res=await fetch(api+path,{method,headers:body?{'content-type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
  if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status} ${await res.text()}`);
  return res.status===204 ? undefined as T : await res.json() as T;
}
async function act(fn:()=>Promise<void>) { try { await fn(); status.textContent='Đã cập nhật thành công'; await refresh(); } catch(e) { status.textContent=String(e); } }
async function refresh() {
  const projects=(await request<{data:Project[]}>('/projects')).data;
  projectsEl.replaceChildren();
  for (const project of projects) {
    const section=document.createElement('section'); section.style.cssText='border:1px solid #ccc;border-radius:8px;padding:12px;margin:16px 0';
    const title=document.createElement('h3'); title.textContent=project.name; section.append(title,line(project.description));
    section.append(button('Sửa Project',()=>{ const name=prompt('Tên Project',project.name); if(name===null)return; const description=prompt('Mô tả',project.description); if(description===null)return; void act(async()=>{await request(`/projects/${project.id}`,'PUT',{name,description});}); }));
    section.append(button('Xóa Project',()=>{ if(confirm(`Xóa Project ${project.name} và toàn bộ Suite/Case?`)) void act(async()=>{await request(`/projects/${project.id}`,'DELETE');}); }));
    const suiteForm=document.createElement('form'); suiteForm.innerHTML='<input name="name" maxlength="120" required placeholder="Tên Test Suite"> <button>Tạo Suite</button>';
    suiteForm.addEventListener('submit',e=>{e.preventDefault(); const data=new FormData(suiteForm); void act(async()=>{await request(`/projects/${project.id}/suites`,'POST',{name:data.get('name')});});}); section.append(suiteForm);
    const suites=(await request<{data:Suite[]}>(`/projects/${project.id}/suites`)).data;
    for (const suite of suites) {
      const panel=document.createElement('div'); panel.style.cssText='margin:12px 0 12px 24px;padding:10px;border-left:3px solid #888';
      const heading=document.createElement('strong'); heading.textContent='Suite: '+suite.name; panel.append(heading);
      panel.append(button('Sửa Suite',()=>{const name=prompt('Tên Suite',suite.name); if(name!==null) void act(async()=>{await request(`/suites/${suite.id}`,'PUT',{name});});}));
      panel.append(button('Xóa Suite',()=>{if(confirm(`Xóa Suite ${suite.name} và toàn bộ Case?`)) void act(async()=>{await request(`/suites/${suite.id}`,'DELETE');});}));
      const caseForm=document.createElement('form'); caseForm.innerHTML='<input name="name" maxlength="120" required placeholder="Tên Test Case"> <select name="kind"><option value="web">Web</option><option value="api">API</option><option value="mobile">Mobile</option></select> <input name="description" maxlength="2000" placeholder="Mô tả"> <textarea name="steps" maxlength="5000" placeholder="Các bước kiểm thử" style="vertical-align:middle"></textarea> <button>Tạo Case</button>';
      caseForm.addEventListener('submit',e=>{e.preventDefault(); const d=new FormData(caseForm); void act(async()=>{await request(`/suites/${suite.id}/cases`,'POST',{name:d.get('name'),kind:d.get('kind'),description:d.get('description'),steps:d.get('steps')});});}); panel.append(caseForm);
      const cases=(await request<{data:Case[]}>(`/suites/${suite.id}/cases`)).data;
      for (const item of cases) {
        const entry=document.createElement('div'); entry.style.margin='8px 0';
        entry.append(line(`[${item.kind}] ${item.name} — ${item.description} — ${item.steps}`));
        entry.append(button('Sửa Case',()=>{
          const name=prompt('Tên Case',item.name); if(name===null)return;
          const kind=prompt('Loại (web/api/mobile)',item.kind); if(kind===null)return;
          const description=prompt('Mô tả',item.description); if(description===null)return;
          const steps=prompt('Các bước',item.steps); if(steps===null)return;
          void act(async()=>{await request(`/cases/${item.id}`,'PUT',{name,kind,description,steps});});
        }));
        entry.append(button('Xóa Case',()=>{if(confirm(`Xóa Case ${item.name}?`)) void act(async()=>{await request(`/cases/${item.id}`,'DELETE');});}));
        panel.append(entry);
      }
      section.append(panel);
    }
    projectsEl.append(section);
  }
  if(!projects.length) projectsEl.append(line('Chưa có Project'));
}
root.querySelector<HTMLFormElement>('#projectForm')!.addEventListener('submit',e=>{
  e.preventDefault(); const form=e.currentTarget as HTMLFormElement; const d=new FormData(form);
  void act(async()=>{await request('/projects','POST',{name:d.get('name'),description:d.get('description')});form.reset();});
});
void refresh().catch(e=>{status.textContent='Không kết nối được API: '+String(e);});
