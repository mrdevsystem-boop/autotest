import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Project } from './projects.js';

export interface TestSuite { id: string; projectId: string; name: string; createdAt: string }
export interface TestCase { id: string; suiteId: string; name: string; steps: string; kind: string; description: string; createdAt: string }
export type RunStatus = 'queued' | 'running' | 'passed' | 'failed' | 'error' | 'cancelled';
export interface TestRun {
  id: string; testCaseId: string | null; caseName: string; engine: string;
  status: RunStatus; createdAt: string; startedAt: string | null;
  finishedAt: string | null; durationMs: number | null;
  output: string; errorMessage: string;
}
export class SqliteStore {
  readonly db: DatabaseSync;
  constructor(filename: string) {
    if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec('PRAGMA foreign_keys = ON;');
    const version = Number((this.db.prepare('PRAGMA user_version').get() as {user_version:number}).user_version);
    if (version > 3) throw new Error(`Unsupported database schema version ${version}`);
    // Version 1 adopts the original S1-03 tables without removing existing rows.
    if (version < 1) {
      this.db.exec(`BEGIN IMMEDIATE;
        CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS test_suites (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, name TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS test_cases (id TEXT PRIMARY KEY, suite_id TEXT NOT NULL REFERENCES test_suites(id) ON DELETE CASCADE, name TEXT NOT NULL, steps TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS idx_suites_project ON test_suites(project_id);
        CREATE INDEX IF NOT EXISTS idx_cases_suite ON test_cases(suite_id);
        PRAGMA user_version = 1;
        COMMIT;`);
    }
    if (Number((this.db.prepare('PRAGMA user_version').get() as {user_version:number}).user_version) < 2) {
      const columns = (this.db.prepare('PRAGMA table_info(test_cases)').all() as {name:string}[]).map(x=>x.name);
      this.db.exec('BEGIN IMMEDIATE;');
      try {
        if (!columns.includes('kind')) this.db.exec("ALTER TABLE test_cases ADD COLUMN kind TEXT NOT NULL DEFAULT 'web'");
        if (!columns.includes('description')) this.db.exec("ALTER TABLE test_cases ADD COLUMN description TEXT NOT NULL DEFAULT ''");
        this.db.exec('PRAGMA user_version = 2; COMMIT;');
      } catch (error) { this.db.exec('ROLLBACK;'); throw error; }
    }
    if (Number((this.db.prepare('PRAGMA user_version').get() as {user_version:number}).user_version) < 3) {
      this.db.exec(`BEGIN IMMEDIATE;
        CREATE TABLE IF NOT EXISTS test_runs (
          id TEXT PRIMARY KEY,
          test_case_id TEXT REFERENCES test_cases(id) ON DELETE SET NULL,
          case_name TEXT NOT NULL,
          engine TEXT NOT NULL CHECK(engine IN ('playwright','pytest','selenium')),
          status TEXT NOT NULL CHECK(status IN ('queued','running','passed','failed','error','cancelled')),
          created_at TEXT NOT NULL,
          started_at TEXT,
          finished_at TEXT,
          duration_ms INTEGER,
          output TEXT NOT NULL DEFAULT '',
          error_message TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS idx_runs_case ON test_runs(test_case_id,created_at);
        PRAGMA user_version = 3;
        COMMIT;`);
    }
  }
  private run(row: any): TestRun | undefined {
    return row ? { id:row.id, testCaseId:row.test_case_id, caseName:row.case_name,
      engine:row.engine, status:row.status, createdAt:row.created_at,
      startedAt:row.started_at, finishedAt:row.finished_at, durationMs:row.duration_ms,
      output:row.output, errorMessage:row.error_message } : undefined;
  }
  createRun(testCaseId: string, engine: 'playwright' | 'pytest' | 'selenium'): TestRun | undefined {
    const testCase = this.getCase(testCaseId);
    if (!testCase) return undefined;
    const id=randomUUID(); const createdAt=new Date().toISOString();
    this.db.prepare(`INSERT INTO test_runs (id,test_case_id,case_name,engine,status,created_at)
      VALUES (?,?,?,?,?,?)`).run(id,testCaseId,testCase.name,engine,'queued',createdAt);
    return this.getRun(id);
  }
  getRun(id: string): TestRun | undefined {
    return this.run(this.db.prepare('SELECT * FROM test_runs WHERE id=?').get(id));
  }
  listRuns(testCaseId: string): TestRun[] {
    return (this.db.prepare('SELECT * FROM test_runs WHERE test_case_id=? ORDER BY created_at DESC,id DESC LIMIT 100').all(testCaseId) as any[]).map(r=>this.run(r)!);
  }
  transitionRun(id: string, expected: RunStatus, next: RunStatus, details: {output?:string;errorMessage?:string} = {}): TestRun | undefined {
    const allowed: Record<RunStatus, RunStatus[]> = {
      queued:['running','cancelled'], running:['passed','failed','error','cancelled'],
      passed:[],failed:[],error:[],cancelled:[]
    };
    if (!allowed[expected].includes(next)) throw new Error('invalid_run_transition');
    const previous=this.getRun(id);
    if (!previous || previous.status !== expected) return undefined;
    const now=new Date().toISOString();
    const startedAt=next==='running' ? now : previous.startedAt;
    const finishedAt=['passed','failed','error','cancelled'].includes(next) ? now : null;
    const durationMs=finishedAt && startedAt ? Math.max(0,Date.parse(finishedAt)-Date.parse(startedAt)) : null;
    const result=this.db.prepare(`UPDATE test_runs SET status=?,started_at=?,finished_at=?,duration_ms=?,output=?,error_message=? WHERE id=? AND status=?`)
      .run(next,startedAt,finishedAt,durationMs,(details.output??previous.output).slice(0,10000),(details.errorMessage??previous.errorMessage).slice(0,2000),id,expected);
    return result.changes ? this.getRun(id) : undefined;
  }
  close() { this.db.close(); }
  private project(row: any): Project | undefined { return row ? { id: row.id, name: row.name, description: row.description, createdAt: row.created_at } : undefined; }
  list(): Project[] { return (this.db.prepare('SELECT * FROM projects ORDER BY created_at, id').all() as any[]).map(r => this.project(r)!); }
  get(id: string): Project | undefined { return this.project(this.db.prepare('SELECT * FROM projects WHERE id=?').get(id)); }
  create(name: string, description = ''): Project { const p = { id: randomUUID(), name, description, createdAt: new Date().toISOString() }; this.db.prepare('INSERT INTO projects VALUES (?, ?, ?, ?)').run(p.id,p.name,p.description,p.createdAt); return p; }
  update(id: string, name: string, description = ''): Project | undefined { const result = this.db.prepare('UPDATE projects SET name=?, description=? WHERE id=?').run(name,description,id); return result.changes ? this.get(id) : undefined; }
  delete(id: string): boolean { return this.db.prepare('DELETE FROM projects WHERE id=?').run(id).changes > 0; }
  listSuites(projectId: string): TestSuite[] { return (this.db.prepare('SELECT id, project_id AS projectId, name, created_at AS createdAt FROM test_suites WHERE project_id=? ORDER BY created_at, id').all(projectId) as unknown) as TestSuite[]; }
  createSuite(projectId: string, name: string): TestSuite | undefined { if (!this.get(projectId)) return undefined; const s = { id: randomUUID(), projectId, name, createdAt: new Date().toISOString() }; this.db.prepare('INSERT INTO test_suites VALUES (?,?,?,?)').run(s.id,s.projectId,s.name,s.createdAt); return s; }
  getSuite(id: string): TestSuite | undefined { return this.db.prepare('SELECT id, project_id AS projectId, name, created_at AS createdAt FROM test_suites WHERE id=?').get(id) as TestSuite | undefined; }
  updateSuite(id: string, name: string): TestSuite | undefined { const result = this.db.prepare('UPDATE test_suites SET name=? WHERE id=?').run(name,id); return result.changes ? this.getSuite(id) : undefined; }
  deleteSuite(id: string): boolean { return this.db.prepare('DELETE FROM test_suites WHERE id=?').run(id).changes > 0; }
  listCases(suiteId: string): TestCase[] { return (this.db.prepare('SELECT id, suite_id AS suiteId, name, steps, kind, description, created_at AS createdAt FROM test_cases WHERE suite_id=? ORDER BY created_at, id').all(suiteId) as unknown) as TestCase[]; }
  createCase(suiteId: string, name: string, steps = '', kind = 'web', description = ''): TestCase | undefined { if (!this.db.prepare('SELECT id FROM test_suites WHERE id=?').get(suiteId)) return undefined; const c = { id: randomUUID(), suiteId, name, steps, kind, description, createdAt: new Date().toISOString() }; this.db.prepare('INSERT INTO test_cases (id,suite_id,name,steps,kind,description,created_at) VALUES (?,?,?,?,?,?,?)').run(c.id,c.suiteId,c.name,c.steps,c.kind,c.description,c.createdAt); return c; }
  getCase(id: string): TestCase | undefined { return this.db.prepare('SELECT id, suite_id AS suiteId, name, steps, kind, description, created_at AS createdAt FROM test_cases WHERE id=?').get(id) as TestCase | undefined; }
  updateCase(id: string, name: string, steps = '', kind = 'web', description = ''): TestCase | undefined { const result = this.db.prepare('UPDATE test_cases SET name=?, steps=?, kind=?, description=? WHERE id=?').run(name,steps,kind,description,id); return result.changes ? this.getCase(id) : undefined; }
  deleteCase(id: string): boolean { return this.db.prepare('DELETE FROM test_cases WHERE id=?').run(id).changes > 0; }
}
