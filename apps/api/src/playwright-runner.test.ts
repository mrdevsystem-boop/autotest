import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWebSteps, InvalidStepsError } from './playwright-runner.js';
import { SqliteStore } from './sqlite.js';
import { createApp } from './app.js';

test('web steps parser accepts a local browser scenario', () => {
  const steps = parseWebSteps(JSON.stringify([
    {action:'goto',url:'http://127.0.0.1:5173'},
    {action:'fill',selector:'#username',value:'demo'},
    {action:'click',selector:'#submit'},
    {action:'expectText',selector:'#result',text:'Welcome'}
  ]));
  assert.equal(steps.length,4);
});

test('web steps parser rejects empty, shell commands and remote navigation', () => {
  for (const raw of ['', '[]', '[{"action":"exec","command":"cmd.exe"}]',
    '[{"action":"goto","url":"https://example.com"}]']) {
    assert.throws(() => parseWebSteps(raw), InvalidStepsError);
  }
});

test('execute endpoint rejects invalid steps without mutating queued run', async () => {
  const store = new SqliteStore(':memory:');
  const server = createApp(store);
  try {
    const project=store.create('P');
    const suite=store.createSuite(project.id,'S')!;
    const item=store.createCase(suite.id,'Empty','','web')!;
    const run=store.createRun(item.id,'playwright')!;
    await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
    const address=server.address(); if (!address || typeof address === 'string') throw new Error('address');
    const response=await fetch(`http://127.0.0.1:${address.port}/api/runs/${run.id}/execute`,{method:'POST'});
    assert.equal(response.status,400);
    assert.equal(store.getRun(run.id)?.status,'queued');
  } finally {
    if (server.listening) await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
    store.close();
  }
});
