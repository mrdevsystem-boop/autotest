import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { PLATFORM_NAME, type HealthResponse } from '@aitest/contracts';
import { ProjectStore, validProject } from './projects.js';
import type { SqliteStore } from './sqlite.js';
type ProjectRepository = Pick<ProjectStore, 'list' | 'get' | 'create' | 'update' | 'delete'>;
type Store = ProjectRepository & Partial<Pick<SqliteStore, 'listSuites' | 'createSuite' | 'deleteSuite' | 'getSuite' | 'updateSuite' | 'listCases' | 'createCase' | 'deleteCase' | 'getCase' | 'updateCase'>>;
const send = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': 'http://127.0.0.1:5173',
    'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type' });
  res.end(status === 204 ? undefined : JSON.stringify(body));
};
async function bodyJson(req: IncomingMessage): Promise<unknown> {
  let content = '';
  for await (const chunk of req) { content += String(chunk); if (content.length > 10000) throw new Error('too_large'); }
  try { return JSON.parse(content); } catch { throw new Error('invalid_json'); }
}
function validName(v: unknown): v is {name: string; steps?: string; kind?: string; description?: string} {
  if (!v || typeof v !== 'object') return false;
  const x = v as Record<string, unknown>;
  return typeof x.name === 'string' && x.name.trim().length > 0 && x.name.length <= 120 &&
    (x.steps === undefined || (typeof x.steps === 'string' && x.steps.length <= 5000)) &&
    (x.description === undefined || (typeof x.description === 'string' && x.description.length <= 2000)) &&
    (x.kind === undefined || (typeof x.kind === 'string' && ['web','api','mobile'].includes(x.kind)));
}
export function createApp(store: Store = new ProjectStore()) {
  return createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (req.method === 'OPTIONS') return send(res, 204, null);
    if (req.method === 'GET' && url.pathname === '/health') {
      const health: HealthResponse = { status: 'ok', service: PLATFORM_NAME, version: '0.1.0' };
      return send(res, 200, health);
    }
    if (url.pathname === '/api/projects') {
      if (req.method === 'GET') return send(res, 200, { data: store.list() });
      if (req.method === 'POST') {
        try { const body = await bodyJson(req); if (!validProject(body)) return send(res, 400, { error: 'invalid_project' }); return send(res, 201, { data: store.create(body.name.trim(), body.description ?? '') }); }
        catch { return send(res, 400, { error: 'invalid_json_or_size' }); }
      }
    }
    const match = /^\/api\/projects\/([0-9a-f-]{36})$/.exec(url.pathname);
    if (match) {
      const id = match[1];
      if (req.method === 'GET') { const project = store.get(id); return send(res, project ? 200 : 404, project ? { data: project } : { error: 'not_found' }); }
      if (req.method === 'DELETE') return send(res, store.delete(id) ? 204 : 404, null);
      if (req.method === 'PUT') {
        try { const body = await bodyJson(req); if (!validProject(body)) return send(res, 400, { error: 'invalid_project' }); const project = store.update(id, body.name.trim(), body.description ?? ''); return send(res, project ? 200 : 404, project ? { data: project } : { error: 'not_found' }); }
        catch { return send(res, 400, { error: 'invalid_json_or_size' }); }
      }
    }
    const suites = /^\/api\/projects\/([0-9a-f-]{36})\/suites$/.exec(url.pathname);
    if (suites && store.listSuites && store.createSuite) {
      const projectId = suites[1];
      if (!store.get(projectId)) return send(res, 404, {error:'not_found'});
      if (req.method === 'GET') return send(res, 200, {data:store.listSuites(projectId)});
      if (req.method === 'POST') { try { const b = await bodyJson(req); if (!validName(b)) return send(res,400,{error:'invalid_suite'}); return send(res,201,{data:store.createSuite(projectId,b.name.trim())}); } catch { return send(res,400,{error:'invalid_json_or_size'}); } }
    }
    const suiteDetail = /^\/api\/suites\/([0-9a-f-]{36})$/.exec(url.pathname);
    if (suiteDetail && store.getSuite && store.updateSuite) {
      const id = suiteDetail[1];
      if (req.method === 'GET') { const item = store.getSuite(id); return send(res,item?200:404,item?{data:item}:{error:'not_found'}); }
      if (req.method === 'PUT') { try { const b=await bodyJson(req); if (!validName(b)) return send(res,400,{error:'invalid_suite'}); const item=store.updateSuite(id,b.name.trim()); return send(res,item?200:404,item?{data:item}:{error:'not_found'}); } catch { return send(res,400,{error:'invalid_json_or_size'}); } }
    }
    const suiteDelete = /^\/api\/suites\/([0-9a-f-]{36})$/.exec(url.pathname);
    if (suiteDelete && req.method === 'DELETE' && store.deleteSuite) return send(res,store.deleteSuite(suiteDelete[1]) ? 204 : 404,null);
    const cases = /^\/api\/suites\/([0-9a-f-]{36})\/cases$/.exec(url.pathname);
    if (cases && store.listCases && store.createCase) {
      const suiteId = cases[1];
      if (req.method === 'GET') return send(res,200,{data:store.listCases(suiteId)});
      if (req.method === 'POST') { try { const b = await bodyJson(req); if (!validName(b)) return send(res,400,{error:'invalid_case'}); const c = store.createCase(suiteId,b.name.trim(),b.steps ?? '',b.kind ?? 'web',b.description ?? ''); return send(res,c ? 201 : 404,c ? {data:c} : {error:'not_found'}); } catch { return send(res,400,{error:'invalid_json_or_size'}); } }
    }
    const caseDetail = /^\/api\/cases\/([0-9a-f-]{36})$/.exec(url.pathname);
    if (caseDetail && store.getCase && store.updateCase) {
      const id = caseDetail[1];
      if (req.method === 'GET') { const item=store.getCase(id); return send(res,item?200:404,item?{data:item}:{error:'not_found'}); }
      if (req.method === 'PUT') { try { const b=await bodyJson(req); if (!validName(b)) return send(res,400,{error:'invalid_case'}); const item=store.updateCase(id,b.name.trim(),b.steps ?? '',b.kind ?? 'web',b.description ?? ''); return send(res,item?200:404,item?{data:item}:{error:'not_found'}); } catch { return send(res,400,{error:'invalid_json_or_size'}); } }
    }
    const caseDelete = /^\/api\/cases\/([0-9a-f-]{36})$/.exec(url.pathname);
    if (caseDelete && req.method === 'DELETE' && store.deleteCase) return send(res,store.deleteCase(caseDelete[1]) ? 204 : 404,null);
    return send(res,404,{error:'not_found'});
  });
}
