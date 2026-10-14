import test from 'node:test';
import assert from 'node:assert/strict';
import { SqliteStore } from './sqlite.js';
import { createApp } from './app.js';

test('reporting summary and history are scoped, paginated and validated', async () => {
  const store = new SqliteStore(':memory:');
  const server = createApp(store);
  try {
    const p = store.create('P');
    const other = store.create('Other');
    const s = store.createSuite(p.id, 'S')!;
    const otherS = store.createSuite(other.id, 'OtherS')!;
    const c = store.createCase(s.id, 'Case')!;
    const otherC = store.createCase(otherS.id, 'OtherCase')!;
    const pass = store.createRun(c.id, 'playwright')!;
    store.transitionRun(pass.id, 'queued', 'running');
    store.transitionRun(pass.id, 'running', 'passed', {output:'ok'});
    const failed = store.createRun(c.id, 'playwright')!;
    store.transitionRun(failed.id, 'queued', 'running');
    store.transitionRun(failed.id, 'running', 'failed');
    store.createRun(c.id, 'playwright');
    store.createRun(otherC.id, 'playwright');
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing address');
    const base = `http://127.0.0.1:${address.port}`;
    const get = (path:string) => fetch(base + path);
    const summary = await get(`/api/reports/summary?projectId=${p.id}`);
    assert.equal(summary.status, 200);
    assert.deepEqual((await summary.json() as any).data, {
      queued:1, running:0, passed:1, failed:1, error:0, cancelled:0,
      total:3, completed:2, passRate:50
    });
    const list = await get(`/api/reports/runs?projectId=${p.id}&status=passed&limit=1&offset=0`);
    assert.equal(list.status, 200);
    const data = (await list.json() as any).data;
    assert.equal(data.total,1);
    assert.equal(data.items.length,1);
    assert.equal(data.items[0].id,pass.id);
    assert.equal((await get(`/api/reports/runs?projectId=${p.id}&limit=2&offset=2`)).status,200);
    assert.equal((await get(`/api/reports/runs?projectId=${p.id}&limit=101`)).status,400);
    assert.equal((await get(`/api/reports/runs?projectId=${p.id}&status=bogus`)).status,400);
    assert.equal((await get(`/api/reports/summary?projectId=bogus`)).status,400);
    assert.equal((await get(`/api/reports/summary?projectId=${'0'.repeat(8)}-${'0'.repeat(4)}-${'0'.repeat(4)}-${'0'.repeat(4)}-${'0'.repeat(12)}`)).status,404);
    store.deleteCase(c.id);
    const after = (await (await get(`/api/reports/summary?projectId=${p.id}`)).json() as any).data;
    assert.equal(after.total,0); // schema v3 cannot attribute orphaned runs to a project
  } finally {
    if (server.listening) await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
    store.close();
  }
});
