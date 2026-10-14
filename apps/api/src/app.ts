import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { PLATFORM_NAME, type HealthResponse } from '@aitest/contracts';
import { ProjectStore, validProject } from './projects.js';
import type { AIProvider } from './ai-provider.js';
import { generateTestCases } from './ai-generation.js';
import type { SqliteStore, RunStatus } from './sqlite.js';
import { parseWebSteps, executeWebSteps, InvalidStepsError, AssertionFailure } from './playwright-runner.js';
type ProjectRepository = Pick<ProjectStore, 'list' | 'get' | 'create' | 'update' | 'delete'>;
type Store = ProjectRepository & Partial<Pick<SqliteStore, 'listSuites' | 'createSuite' | 'deleteSuite' | 'getSuite' | 'updateSuite' | 'listCases' | 'createCase' | 'deleteCase' | 'getCase' | 'updateCase' | 'createRun' | 'getRun' | 'listRuns' | 'transitionRun' | 'reportSummary' | 'reportRuns'>>;
const send = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': process.env.AITEST_WEB_ORIGIN ?? 'http://127.0.0.1:5173',
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
export function createApp(store: Store = new ProjectStore(), aiProvider?: AIProvider) {
  let busy = false;
  return createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (req.method === 'OPTIONS') return send(res, 204, null);
    if (req.method === 'POST' && url.pathname === '/api/ai/test-cases/generate') {
      let payload: unknown;

      try {
        payload = await bodyJson(req);
      } catch {
        return send(res, 400, { error: 'invalid_generation_request' });
      }

      const result = await generateTestCases(
        payload,
        (suiteId) => Boolean(store.getSuite?.(suiteId)),
        aiProvider,
      );

      return send(res, result.status, result.body);
    }
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
    // S1-05.1: project-scoped reporting; deleted cases cannot be attributed to a project in schema v3.
    if (req.method === 'GET' && (url.pathname === '/api/reports/summary' || url.pathname === '/api/reports/runs')) {
      const projectId = url.searchParams.get('projectId');
      if (!projectId || !/^[0-9a-f-]{36}$/.test(projectId)) return send(res,400,{error:'invalid_project_id'});
      if (!store.get(projectId)) return send(res,404,{error:'not_found'});
      if (url.pathname === '/api/reports/summary') {
        if (!store.reportSummary) return send(res,501,{error:'reporting_unavailable'});
        return send(res,200,{data:store.reportSummary(projectId)});
      }
      if (!store.reportRuns) return send(res,501,{error:'reporting_unavailable'});
      const statusParam = url.searchParams.get('status');
      const statuses: RunStatus[] = ['queued','running','passed','failed','error','cancelled'];
      if (statusParam !== null && !statuses.includes(statusParam as RunStatus)) return send(res,400,{error:'invalid_status'});
      const limitParam = url.searchParams.get('limit') ?? '20';
      const offsetParam = url.searchParams.get('offset') ?? '0';
      if (!/^[0-9]+$/.test(limitParam) || !/^[0-9]+$/.test(offsetParam)) return send(res,400,{error:'invalid_pagination'});
      const limit = Number(limitParam), offset = Number(offsetParam);
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(offset) || offset < 0) return send(res,400,{error:'invalid_pagination'});
      return send(res,200,{data:store.reportRuns(projectId,statusParam as RunStatus | undefined,limit,offset)});
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
    // S1-04.1/2: record and inspect run requests; no test process is executed yet.
    const runCreate = /^\/api\/cases\/([0-9a-f-]{36})\/runs$/.exec(url.pathname);
    if (runCreate && store.createRun && store.listRuns && store.getCase) {
      const caseId=runCreate[1];
      if (!store.getCase(caseId)) return send(res,404,{error:'not_found'});
      if (req.method==='GET') return send(res,200,{data:store.listRuns(caseId)});
      if (req.method==='POST') {
        try {
          const payload=await bodyJson(req);
          if (!payload || typeof payload!=='object') return send(res,400,{error:'invalid_run'});
          const engine=(payload as Record<string,unknown>).engine;
          if (engine!=='playwright' && engine!=='pytest' && engine!=='selenium') return send(res,400,{error:'invalid_engine'});
          const testCase=store.getCase(caseId)!;
          if ((testCase.kind==='api' && engine!=='pytest') || (testCase.kind==='web' && engine==='pytest') || testCase.kind==='mobile')
            return send(res,400,{error:'unsupported_case_engine'});
          const run=store.createRun(caseId,engine);
          return send(res,run?201:404,run?{data:run}:{error:'not_found'});
        } catch { return send(res,400,{error:'invalid_json_or_size'}); }
      }
    }
    const runExecute = /^\/api\/runs\/([0-9a-f-]{36})\/execute$/.exec(url.pathname);
    if (runExecute && req.method === 'POST' && store.getRun && store.getCase && store.transitionRun) {
      const run = store.getRun(runExecute[1]);
      if (!run) return send(res,404,{error:'not_found'});
      if (run.status !== 'queued') return send(res,409,{error:'run_not_queued'});
      if (run.engine !== 'playwright') return send(res,400,{error:'unsupported_engine'});
      if (!run.testCaseId) return send(res,409,{error:'case_deleted'});
      const testCase = store.getCase(run.testCaseId);
      if (!testCase || testCase.kind !== 'web') return send(res,409,{error:'case_unavailable'});
      if (busy) return send(res,409,{error:'runner_busy'});
      let steps;
      try { steps = parseWebSteps(testCase.steps); }
      catch (error) { return send(res,400,{error:error instanceof InvalidStepsError ? error.message : 'invalid_steps'}); }
      const started = store.transitionRun(run.id,'queued','running');
      if (!started) return send(res,409,{error:'run_not_queued'});
      busy = true;
      // Do not block the HTTP request while Chromium runs.
      void executeWebSteps(steps).then(output => {
        store.transitionRun!(run.id,'running','passed',{output});
      }).catch(error => {
        const status = error instanceof AssertionFailure ? 'failed' : 'error';
        store.transitionRun!(run.id,'running',status,{errorMessage:String(error instanceof Error ? error.message : error)});
      }).finally(() => { busy = false; });
      return send(res,202,{data:started});
    }
    const runDetail = /^\/api\/runs\/([0-9a-f-]{36})$/.exec(url.pathname);
    if (runDetail && req.method==='GET' && store.getRun) {
      const run=store.getRun(runDetail[1]);
      return send(res,run?200:404,run?{data:run}:{error:'not_found'});
    }
    return send(res,404,{error:'not_found'});
  });
}
