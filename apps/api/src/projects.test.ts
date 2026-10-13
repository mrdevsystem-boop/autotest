import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.js';
import { ProjectStore, validProject } from './projects.js';
test('project validation and store CRUD', () => {
  assert.equal(validProject({ name: '' }), false);
  assert.equal(validProject({ name: 'Demo' }), true);
  const store = new ProjectStore(); const p = store.create('Demo');
  assert.equal(store.list().length, 1);
  assert.equal(store.update(p.id, 'Updated')?.name, 'Updated');
  assert.equal(store.delete(p.id), true);
  assert.equal(store.get(p.id), undefined);
});
test('HTTP project CRUD and invalid payload', async () => {
  const server = createApp();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const addr = server.address(); if (!addr || typeof addr === 'string') throw new Error('address');
    const base = `http://127.0.0.1:${addr.port}`;
    const bad = await fetch(base + '/api/projects', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(bad.status, 400);
    const created = await fetch(base + '/api/projects', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Project A' }) });
    assert.equal(created.status, 201);
    const json = await created.json() as { data: { id: string } };
    const list = await fetch(base + '/api/projects');
    assert.equal(((await list.json()) as { data: unknown[] }).data.length, 1);
    const removed = await fetch(base + '/api/projects/' + json.data.id, { method: 'DELETE' });
    assert.equal(removed.status, 204);
  } finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
});
