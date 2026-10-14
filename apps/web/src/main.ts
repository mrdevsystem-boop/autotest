import { PLATFORM_NAME } from '@aitest/contracts';

interface Project { id: string; name: string; description: string }
interface Suite { id: string; projectId: string; name: string }
interface Case { id: string; suiteId: string; name: string; steps: string; kind: string; description: string }
type RunStatus = 'queued' | 'running' | 'passed' | 'failed' | 'error' | 'cancelled';
interface Run { id: string; caseName: string; engine: string; status: RunStatus; createdAt: string; durationMs: number | null; output: string; errorMessage: string }

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('App root missing');
const api = 'http://127.0.0.1:3001/api';
const polling = new Set<ReturnType<typeof setInterval>>();
const terminal = new Set<RunStatus>(['passed', 'failed', 'error', 'cancelled']);

const style = document.createElement('style');
style.textContent = `body{font:15px system-ui,sans-serif;color:#1c2938;background:#f7f9fc;margin:0}main{max-width:1080px;margin:24px auto;padding:16px;line-height:1.5}h1{margin-bottom:0}section,.case{background:white;border:1px solid #dce2ea;border-radius:10px;padding:14px;margin:14px 0}.suite{margin:12px 0 12px 18px;padding:12px;border-left:3px solid #6b829c}.case{margin:10px 0}input,select,textarea{padding:7px;border:1px solid #b8c5d2;border-radius:5px;max-width:100%}textarea{vertical-align:middle}button{margin:4px;padding:7px 10px;border:1px solid #a5b7c9;border-radius:6px;background:#f3f6fa;cursor:pointer}button:disabled{opacity:.55;cursor:wait}.run-button{background:#1c5ca8;color:white;border-color:#1c5ca8}.run-history{margin:10px 0;padding:8px;background:#f8fafc;border-radius:6px}.run-row{border-top:1px solid #dce2ea;padding:8px 0}.run-row:first-child{border-top:0}.run-row summary{cursor:pointer}.run-row pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#edf1f6;padding:8px}.run-state{font-weight:700}.run-state.passed{color:#16713c}.run-state.failed,.run-state.error{color:#b12424}.run-state.running,.run-state.queued{color:#855600}.hint{color:#58677a;font-size:13px}#status{min-height:1.5em}`;
/* S1-05.2 Dashboard */
style.textContent += `.report-dashboard{margin:14px 0;padding:14px;border:1px solid #dce2ea;border-radius:10px;background:#f8fafc}.report-head{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}.report-head h4{margin:0}.report-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-top:12px}.report-metric{padding:12px;background:white;border:1px solid #dce2ea;border-radius:8px}.report-metric strong{display:block;font-size:24px}.report-error{color:#b12424}.report-meta{margin:8px 0 0;color:#58677a;font-size:13px}`;
document.head.append(style);
root.innerHTML = `<main><h1>AI Testing Platform</h1><p>${PLATFORM_NAME} · Local SQLite · S1-04.4</p><p class="hint">Chỉ dùng cho phát triển cục bộ: chưa có đăng nhập, tenant RBAC hoặc RLS.</p><form id="projectForm"><h2>Projects</h2><input name="name" placeholder="Tên project" maxlength="120" required> <input name="description" placeholder="Mô tả" maxlength="2000"> <button>Tạo Project</button></form><div id="projects"></div><p id="status" role="status" aria-live="polite"></p></main>`;
const projectsEl = root.querySelector<HTMLElement>('#projects')!;
const status = root.querySelector<HTMLElement>('#status')!;
const line = (text: string) => { const el = document.createElement('span'); el.textContent = text; return el; };
const button = (label: string, action: () => void) => { const el = document.createElement('button'); el.type = 'button'; el.textContent = label; el.addEventListener('click', action); return el; };

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(api + path, { method, headers: body === undefined ? undefined : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status} ${await res.text()}`);
  return res.status === 204 ? undefined as T : await res.json() as T;
}
async function act(fn: () => Promise<void>) {
  try { await fn(); status.textContent = 'Đã cập nhật thành công'; await refresh(); }
  catch (e) { status.textContent = String(e); }
}
function stopPolling() { for (const timer of polling) clearInterval(timer); polling.clear(); }

async function renderRuns(caseId: string, target: HTMLElement, runButton: HTMLButtonElement, preferredId?: string) {
  const runs = (await request<{ data: Run[] }>(`/cases/${caseId}/runs`)).data;
  target.replaceChildren();
  const title = document.createElement('strong'); title.textContent = `Lịch sử chạy (${runs.length}, tối đa 100)`; target.append(title);
  if (!runs.length) { target.append(line(' — Chưa có lần chạy')); runButton.disabled = false; return; }
  for (const run of runs) {
    const details = document.createElement('details'); details.className = 'run-row';
    if (run.id === preferredId) details.open = true;
    const summary = document.createElement('summary');
    const state = document.createElement('span'); state.className = `run-state ${run.status}`; state.textContent = run.status.toUpperCase();
    summary.append(state, line(` · ${new Date(run.createdAt).toLocaleString('vi-VN')} · ${run.durationMs === null ? '—' : `${run.durationMs} ms`} · ${run.id.slice(0, 8)}`));
    details.append(summary);
    const pre = document.createElement('pre'); pre.textContent = run.output || run.errorMessage || 'Chưa có log'; details.append(pre);
    target.append(details);
  }
  runButton.disabled = runs.some(r => r.status === 'running' || r.status === 'queued' && r.id === preferredId);
}

function watchRun(caseId: string, runId: string, target: HTMLElement, runButton: HTMLButtonElement) {
  let inFlight = false;
  let attempts = 0;
  const timer = setInterval(() => {
    if (inFlight || !target.isConnected) { if (!target.isConnected) { clearInterval(timer); polling.delete(timer); } return; }
    inFlight = true;
    void (async () => {
      try {
        const { data } = await request<{ data: Run }>(`/runs/${runId}`);
        await renderRuns(caseId, target, runButton, runId);
        if (terminal.has(data.status)) {
          clearInterval(timer); polling.delete(timer); runButton.disabled = false;
          status.textContent = `Run ${runId.slice(0, 8)}: ${data.status}`;
        }
      } catch (e) {
        attempts++;
        status.textContent = `Không thể cập nhật Run: ${String(e)}`;
        if (attempts >= 5) { clearInterval(timer); polling.delete(timer); runButton.disabled = false; }
      } finally { inFlight = false; }
    })();
  }, 1500);
  polling.add(timer);
}

/** S1-05.2 Dashboard: uses project-scoped server-side reporting totals. */
interface ReportSummary {
  total: number;
  queued: number;
  running: number;
  passed: number;
  failed: number;
  error: number;
  cancelled: number;
  completed: number;
  passRate: number;
}

function dashboardMetric(label: string, value: string): HTMLElement {
  const tile = document.createElement('div');
  tile.className = 'report-metric';
  const title = document.createElement('span');
  title.textContent = label;
  const number = document.createElement('strong');
  number.textContent = value;
  tile.append(title, number);
  return tile;
}

function renderDashboard(projectId: string): HTMLElement {
  const dashboard = document.createElement('div');
  dashboard.className = 'report-dashboard';
  const head = document.createElement('div');
  head.className = 'report-head';
  const title = document.createElement('h4');
  title.textContent = 'Test Results Dashboard';
  const refreshButton = button('Refresh metrics', () => { void load(); });
  head.append(title, refreshButton);
  const content = document.createElement('div');
  content.setAttribute('aria-live', 'polite');
  dashboard.append(head, content);

  let loading = false;
  async function load() {
    if (loading || !dashboard.isConnected) return;
    loading = true;
    refreshButton.disabled = true;
    content.textContent = 'Loading reporting data...';
    try {
      const { data } = await request<{ data: ReportSummary }>(
        `/reports/summary?projectId=${encodeURIComponent(projectId)}`
      );
      if (!dashboard.isConnected) return;
      const metrics = document.createElement('div');
      metrics.className = 'report-metrics';
      metrics.append(
        dashboardMetric('Total Runs', String(data.total)),
        dashboardMetric('Passed', String(data.passed)),
        dashboardMetric('Failed', String(data.failed)),
        dashboardMetric('Error', String(data.error)),
        dashboardMetric('Pass Rate', `${data.passRate}%`)
      );
      const meta = document.createElement('p');
      meta.className = 'report-meta';
      meta.textContent = `Completed: ${data.completed}  |  Queued: ${data.queued}  |  Running: ${data.running}  |  Cancelled: ${data.cancelled}. Pass rate excludes non-completed runs.`;
      content.replaceChildren(metrics, meta);
    } catch (error) {
      if (!dashboard.isConnected) return;
      const message = document.createElement('p');
      message.className = 'report-error';
      message.textContent = `Unable to load reporting data: ${String(error)}`;
      content.replaceChildren(message);
    } finally {
      loading = false;
      refreshButton.disabled = false;
    }
  }
  // Load after the project section is attached to the document.
  dashboard.addEventListener('dashboard:load', () => { void load(); });
  return dashboard;
}
/** S1-05.3: project-wide run history with server-side status filtering and pagination. */
interface ReportRunPage {
  items: Run[];
  total: number;
  limit: number;
  offset: number;
}

function renderProjectRunHistory(projectId: string): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'report-run-history';
  panel.style.cssText = 'margin:16px 0;padding:14px;border:1px solid #dce2ea;border-radius:10px;background:#fff';
  const heading = document.createElement('h4');
  heading.textContent = 'Project Run History';
  const controls = document.createElement('div');
  controls.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:8px';
  const statusLabel = document.createElement('label');
  statusLabel.textContent = 'Status: ';
  const statusSelect = document.createElement('select');
  for (const value of ['', 'queued', 'running', 'passed', 'failed', 'error', 'cancelled']) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value ? value.toUpperCase() : 'All';
    statusSelect.append(option);
  }
  statusLabel.append(statusSelect);
  const sizeLabel = document.createElement('label');
  sizeLabel.textContent = 'Page size: ';
  const sizeSelect = document.createElement('select');
  for (const size of [5, 10, 20]) {
    const option = document.createElement('option');
    option.value = String(size);
    option.textContent = String(size);
    sizeSelect.append(option);
  }
  sizeLabel.append(sizeSelect);
  const refreshButton = button('Refresh history', () => { void load(); });
  controls.append(statusLabel, sizeLabel, refreshButton);
  const results = document.createElement('div');
  results.setAttribute('aria-live', 'polite');
  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px';
  const previous = button('Previous', () => { offset = Math.max(0, offset - limit); void load(); });
  const next = button('Next', () => { offset += limit; void load(); });
  const pageInfo = document.createElement('span');
  footer.append(previous, pageInfo, next);
  panel.append(heading, controls, results, footer);

  let offset = 0;
  let limit = 5;
  let sequence = 0;
  let total = 0;
  let loading = false;
  function updateControls() {
    previous.disabled = loading || offset === 0;
    next.disabled = loading || offset + limit >= total;
    refreshButton.disabled = loading;
  }
  async function load() {
    if (!panel.isConnected) return;
    const ticket = ++sequence;
    loading = true;
    updateControls();
    results.textContent = 'Loading run history...';
    const statusFilter = statusSelect.value;
    const query = new URLSearchParams({ projectId, limit: String(limit), offset: String(offset) });
    if (statusFilter) query.set('status', statusFilter);
    try {
      const { data } = await request<{ data: ReportRunPage }>(`/reports/runs?${query.toString()}`);
      if (ticket !== sequence || !panel.isConnected) return;
      total = data.total;
      results.replaceChildren();
      if (data.items.length === 0) {
        results.textContent = 'No runs match this filter.';
      } else {
        const table = document.createElement('table');
        table.style.cssText = 'width:100%;border-collapse:collapse;margin-top:10px';
        const head = document.createElement('thead');
        const headRow = document.createElement('tr');
        for (const label of ['Test Case', 'Status', 'Created', 'Duration', 'Run ID']) {
          const th = document.createElement('th');
          th.textContent = label;
          th.style.cssText = 'text-align:left;border-bottom:1px solid #dce2ea;padding:7px';
          headRow.append(th);
        }
        head.append(headRow);
        const body = document.createElement('tbody');
        for (const run of data.items) {
          const tr = document.createElement('tr');
          const values = [run.caseName, run.status.toUpperCase(), new Date(run.createdAt).toLocaleString('vi-VN'), run.durationMs === null ? '-' : `${run.durationMs} ms`, run.id.slice(0, 8)];
          for (let i = 0; i < values.length; i++) {
            const td = document.createElement('td');
            td.textContent = values[i];
            td.style.cssText = 'border-bottom:1px solid #edf1f6;padding:7px;overflow-wrap:anywhere';
            if (i === 1) td.className = `run-state ${run.status}`;
            tr.append(td);
          }
          body.append(tr);
        }
        table.append(head, body);
        const scroll = document.createElement('div');
        scroll.style.overflowX = 'auto';
        scroll.append(table);
        results.append(scroll);
      }
      pageInfo.textContent = total === 0 ? '0 runs' : `${offset + 1}-${Math.min(offset + data.items.length, total)} of ${total}`;
    } catch (error) {
      if (ticket !== sequence || !panel.isConnected) return;
      results.textContent = `Unable to load run history: ${String(error)}`;
      pageInfo.textContent = 'Load failed';
      total = 0;
    } finally {
      if (ticket === sequence) { loading = false; updateControls(); }
    }
  }
  statusSelect.addEventListener('change', () => { offset = 0; void load(); });
  sizeSelect.addEventListener('change', () => { limit = Number(sizeSelect.value); offset = 0; void load(); });
  panel.addEventListener('history:load', () => { void load(); });
  updateControls();
  return panel;
}

async function refresh() {
  stopPolling();
  const projects = (await request<{ data: Project[] }>('/projects')).data;
  projectsEl.replaceChildren();
  for (const project of projects) {
    const section = document.createElement('section');
    const heading = document.createElement('h3'); heading.textContent = project.name;
    section.append(heading, line(` ${project.description} `));
    section.append(button('Sửa Project', () => { const name = prompt('Tên Project', project.name); if (name === null) return; const description = prompt('Mô tả', project.description); if (description !== null) void act(async () => { await request(`/projects/${project.id}`, 'PUT', { name, description }); }); }));
    section.append(button('Xóa Project', () => { if (confirm(`Xóa Project ${project.name} và toàn bộ Suite/Case?`)) void act(async () => { await request(`/projects/${project.id}`, 'DELETE'); }); }));
    const dashboard = renderDashboard(project.id);
    section.append(dashboard);
    const projectHistory = renderProjectRunHistory(project.id);
    section.append(projectHistory);
    const suiteForm = document.createElement('form'); suiteForm.innerHTML = '<input name="name" maxlength="120" required placeholder="Tên Test Suite"> <button>Tạo Suite</button>';
    suiteForm.addEventListener('submit', e => { e.preventDefault(); const d = new FormData(suiteForm); void act(async () => { await request(`/projects/${project.id}/suites`, 'POST', { name: d.get('name') }); }); }); section.append(suiteForm);
    const suites = (await request<{ data: Suite[] }>(`/projects/${project.id}/suites`)).data;
    for (const suite of suites) {
      const panel = document.createElement('div'); panel.className = 'suite';
      const title = document.createElement('strong'); title.textContent = `Suite: ${suite.name}`; panel.append(title);
      panel.append(button('Sửa Suite', () => { const name = prompt('Tên Suite', suite.name); if (name !== null) void act(async () => { await request(`/suites/${suite.id}`, 'PUT', { name }); }); }));
      panel.append(button('Xóa Suite', () => { if (confirm(`Xóa Suite ${suite.name} và toàn bộ Case?`)) void act(async () => { await request(`/suites/${suite.id}`, 'DELETE'); }); }));
      const caseForm = document.createElement('form'); caseForm.innerHTML = '<input name="name" maxlength="120" required placeholder="Tên Test Case"> <select name="kind"><option value="web">Web</option><option value="api">API</option><option value="mobile">Mobile</option></select> <input name="description" maxlength="2000" placeholder="Mô tả"> <textarea name="steps" maxlength="5000" placeholder="Các bước kiểm thử"></textarea> <button>Tạo Case</button>';
      caseForm.addEventListener('submit', e => { e.preventDefault(); const d = new FormData(caseForm); void act(async () => { await request(`/suites/${suite.id}/cases`, 'POST', { name: d.get('name'), kind: d.get('kind'), description: d.get('description'), steps: d.get('steps') }); }); }); panel.append(caseForm);
      const cases = (await request<{ data: Case[] }>(`/suites/${suite.id}/cases`)).data;
      for (const item of cases) {
        const entry = document.createElement('div'); entry.className = 'case';
        const description = document.createElement('div'); description.textContent = `[${item.kind}] ${item.name} — ${item.description}`; entry.append(description);
        const steps = document.createElement('details'); const stepsSummary = document.createElement('summary'); stepsSummary.textContent = 'Các bước kiểm thử'; const stepsText = document.createElement('pre'); stepsText.textContent = item.steps || '(trống)'; steps.append(stepsSummary, stepsText); entry.append(steps);
        entry.append(button('Sửa Case', () => {
          const name = prompt('Tên Case', item.name); if (name === null) return;
          const kind = prompt('Loại (web/api/mobile)', item.kind); if (kind === null) return;
          const description = prompt('Mô tả', item.description); if (description === null) return;
          const steps = prompt('Các bước', item.steps); if (steps === null) return;
          void act(async () => { await request(`/cases/${item.id}`, 'PUT', { name, kind, description, steps }); });
        }));
        entry.append(button('Xóa Case', () => { if (confirm(`Xóa Case ${item.name}?`)) void act(async () => { await request(`/cases/${item.id}`, 'DELETE'); }); }));
        if (item.kind === 'web') {
          const runButton = button('▶ Run Test', () => {
            runButton.disabled = true; status.textContent = `Đang khởi chạy ${item.name}...`;
            void (async () => {
              try {
                const created = (await request<{ data: Run }>(`/cases/${item.id}/runs`, 'POST', { engine: 'playwright' })).data;
                const started = (await request<{ data: Run }>(`/runs/${created.id}/execute`, 'POST')).data;
                await renderRuns(item.id, history, runButton, started.id);
                status.textContent = `Đã khởi chạy Run ${started.id.slice(0, 8)}`;
                watchRun(item.id, started.id, history, runButton);
              } catch (e) { runButton.disabled = false; status.textContent = `Không thể chạy Test: ${String(e)}`; await renderRuns(item.id, history, runButton).catch(() => {}); }
            })();
          });
          runButton.className = 'run-button'; entry.append(runButton);
          const history = document.createElement('div'); history.className = 'run-history'; entry.append(history);
          try { await renderRuns(item.id, history, runButton); }
          catch (e) { history.textContent = `Không tải được lịch sử: ${String(e)}`; }
        } else {
          const hint = document.createElement('p'); hint.className = 'hint'; hint.textContent = 'Runner cho loại Case này chưa được hỗ trợ.'; entry.append(hint);
        }
        panel.append(entry);
      }
      section.append(panel);
    }
    projectsEl.append(section);
    dashboard.dispatchEvent(new Event('dashboard:load'));
    projectHistory.dispatchEvent(new Event('history:load'));
  }
  if (!projects.length) projectsEl.append(line('Chưa có Project'));
}
root.querySelector<HTMLFormElement>('#projectForm')!.addEventListener('submit', e => {
  e.preventDefault(); const form = e.currentTarget as HTMLFormElement; const d = new FormData(form);
  void act(async () => { await request('/projects', 'POST', { name: d.get('name'), description: d.get('description') }); form.reset(); });
});
void refresh().catch(e => { status.textContent = `Không kết nối được API: ${String(e)}`; });
