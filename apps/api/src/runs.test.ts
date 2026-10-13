import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteStore } from './sqlite.js';
import { createApp } from './app.js';

test('v2 to v3 migration preserves existing cases and run history survives reopen', () => {
  const dir=mkdtempSync(join(tmpdir(),'aitest-runs-'));
  const filename=join(dir,'db.sqlite');
  try {
    const store=new SqliteStore(filename);
    const p=store.create('Project'); const suite=store.createSuite(p.id,'Suite')!;
    const item=store.createCase(suite.id,'Login','','web')!;
    store.db.exec('DROP TABLE test_runs; PRAGMA user_version = 2;');
    store.close();
    const migrated=new SqliteStore(filename);
    assert.equal((migrated.db.prepare('PRAGMA user_version').get() as {user_version:number}).user_version,3);
    assert.equal(migrated.getCase(item.id)?.name,'Login');
    const run=migrated.createRun(item.id,'playwright')!;
    assert.equal(run.status,'queued');
    assert.equal(migrated.transitionRun(run.id,'queued','running')?.status,'running');
    assert.equal(migrated.transitionRun(run.id,'running','passed',{output:'ok'})?.status,'passed');
    assert.throws(()=>migrated.transitionRun(run.id,'passed','running'),/invalid_run_transition/);
    migrated.deleteCase(item.id);
    assert.equal(migrated.getRun(run.id)?.testCaseId,null);
    assert.equal(migrated.getRun(run.id)?.caseName,'Login');
    migrated.close();
    const reopened=new SqliteStore(filename);
    assert.equal(reopened.getRun(run.id)?.status,'passed');
    assert.equal(reopened.getRun(run.id)?.output,'ok');
    reopened.close();
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test('HTTP Run API creates queued records but does not execute a runner', async () => {
  const store=new SqliteStore(':memory:'); const server=createApp(store);
  try {
    const project=store.create('P'); const suite=store.createSuite(project.id,'S')!;
    const item=store.createCase(suite.id,'C','','api')!;
    await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
    const address=server.address(); if (!address || typeof address==='string') throw new Error('address');
    const base=`http://127.0.0.1:${address.port}`;
    const post=(engine:string)=>fetch(`${base}/api/cases/${item.id}/runs`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({engine})});
    assert.equal((await post('playwright')).status,400);
    const created=await post('pytest'); assert.equal(created.status,201);
    const run=(await created.json() as {data:{id:string;status:string}}).data;
    assert.equal(run.status,'queued');
    const get=await fetch(`${base}/api/runs/${run.id}`);
    assert.equal(get.status,200);
    const list=await fetch(`${base}/api/cases/${item.id}/runs`);
    assert.equal((await list.json() as {data:unknown[]}).data.length,1);
  } finally {
    if (server.listening) await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
    store.close();
  }
});
