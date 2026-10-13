import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteStore } from './sqlite.js';

test('SQLite persists projects and cascades suites/cases', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aitest-'));
  const path = join(dir, 'test.sqlite');
  try {
    const a = new SqliteStore(path);
    const p = a.create('Demo', 'persisted');
    const s = a.createSuite(p.id, 'Smoke')!;
    const c = a.createCase(s.id, 'Login', 'Open page')!;
    a.close();
    const b = new SqliteStore(path);
    assert.equal(b.get(p.id)?.name, 'Demo');
    assert.equal(b.listSuites(p.id)[0].id, s.id);
    assert.equal(b.listCases(s.id)[0].id, c.id);
    assert.equal(b.delete(p.id), true);
    assert.deepEqual(b.listCases(s.id), []);
    assert.deepEqual(b.listSuites(p.id), []);
    b.close();
  } finally { rmSync(dir, {recursive:true,force:true}); }
});
