import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SqliteStore } from './sqlite.js';
import { createApp } from './app.js';
test('migrates existing v0 database without deleting projects and supports Suite/Case PUT', async () => {
  const dir=mkdtempSync(join(tmpdir(),'aitest-migrate-'));
  const filename=join(dir,'test.sqlite');
  const original=new DatabaseSync(filename);
  original.exec(`CREATE TABLE projects (id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL);
  CREATE TABLE test_suites (id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,name TEXT NOT NULL,created_at TEXT NOT NULL);
  CREATE TABLE test_cases (id TEXT PRIMARY KEY,suite_id TEXT NOT NULL REFERENCES test_suites(id) ON DELETE CASCADE,name TEXT NOT NULL,steps TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL);
  INSERT INTO projects VALUES ('00000000-0000-4000-8000-000000000001','Old Project','','2026-01-01T00:00:00Z');`);
  original.close();
  const store=new SqliteStore(filename);
  const server=createApp(store);
  try {
    assert.equal(store.list()[0]?.name,'Old Project');
    assert.equal((store.db.prepare('PRAGMA user_version').get() as {user_version:number}).user_version,2);
    await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
    const address=server.address(); if (!address || typeof address==='string') throw new Error('address');
    const base=`http://127.0.0.1:${address.port}`;
    const send=async(path:string,method:string,body?:unknown)=>fetch(base+path,{method,headers:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    const projectId='00000000-0000-4000-8000-000000000001';
    const suiteResponse=await send(`/api/projects/${projectId}/suites`,'POST',{name:'Suite'});
    assert.equal(suiteResponse.status,201);
    const suite=(await suiteResponse.json() as {data:{id:string}}).data;
    assert.equal((await send(`/api/suites/${suite.id}`,'PUT',{name:'Updated Suite'})).status,200);
    const caseResponse=await send(`/api/suites/${suite.id}/cases`,'POST',{name:'Case',kind:'mobile',description:'Android',steps:'Launch app'});
    assert.equal(caseResponse.status,201);
    const item=(await caseResponse.json() as {data:{id:string}}).data;
    assert.equal((await send(`/api/cases/${item.id}`,'PUT',{name:'Updated Case',kind:'api',description:'HTTP',steps:'GET /health'})).status,200);
    assert.equal(store.getCase(item.id)?.kind,'api');
    assert.equal((await send(`/api/cases/${item.id}`,'PUT',{name:'Invalid',kind:'unknown'})).status,400);
    assert.equal((await send(`/api/suites/${suite.id}`,'DELETE')).status,204);
    assert.equal(store.getCase(item.id),undefined);
  } finally {
    if(server.listening) await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
    store.close(); rmSync(dir,{recursive:true,force:true});
  }
});
