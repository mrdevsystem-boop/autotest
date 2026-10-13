import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { PLATFORM_NAME, type HealthResponse } from '@aitest/contracts';
import { ProjectStore, validProject } from './projects.js';
const send = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': 'http://127.0.0.1:5173',
    'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type' });
  res.end(JSON.stringify(body));
};
async function bodyJson(req: IncomingMessage): Promise<unknown> {
  let content = '';
  for await (const chunk of req) {
    content += String(chunk);
    if (content.length > 10000) throw new Error('too_large');
  }
  try { return JSON.parse(content); } catch { throw new Error('invalid_json'); }
}
export function createApp(store = new ProjectStore()) {
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
        try {
          const body = await bodyJson(req);
          if (!validProject(body)) return send(res, 400, { error: 'invalid_project' });
          return send(res, 201, { data: store.create(body.name.trim(), body.description ?? '') });
        } catch { return send(res, 400, { error: 'invalid_json_or_size' }); }
      }
    }
    const match = /^\/api\/projects\/([0-9a-f-]{36})$/.exec(url.pathname);
    if (match) {
      const id = match[1];
      if (req.method === 'GET') { const project = store.get(id); return send(res, project ? 200 : 404, project ? { data: project } : { error: 'not_found' }); }
      if (req.method === 'DELETE') return send(res, store.delete(id) ? 204 : 404, null);
      if (req.method === 'PUT') {
        try {
          const body = await bodyJson(req);
          if (!validProject(body)) return send(res, 400, { error: 'invalid_project' });
          const project = store.update(id, body.name.trim(), body.description ?? '');
          return send(res, project ? 200 : 404, project ? { data: project } : { error: 'not_found' });
        } catch { return send(res, 400, { error: 'invalid_json_or_size' }); }
      }
    }
    return send(res, 404, { error: 'not_found' });
  });
}
