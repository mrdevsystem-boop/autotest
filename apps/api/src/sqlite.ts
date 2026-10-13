import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Project } from './projects.js';

export interface TestSuite { id: string; projectId: string; name: string; createdAt: string }
export interface TestCase { id: string; suiteId: string; name: string; steps: string; createdAt: string }
export class SqliteStore {
  readonly db: DatabaseSync;
  constructor(filename: string) {
    if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS test_suites (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, name TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS test_cases (id TEXT PRIMARY KEY, suite_id TEXT NOT NULL REFERENCES test_suites(id) ON DELETE CASCADE, name TEXT NOT NULL, steps TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_suites_project ON test_suites(project_id);
      CREATE INDEX IF NOT EXISTS idx_cases_suite ON test_cases(suite_id);`);
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
  deleteSuite(id: string): boolean { return this.db.prepare('DELETE FROM test_suites WHERE id=?').run(id).changes > 0; }
  listCases(suiteId: string): TestCase[] { return (this.db.prepare('SELECT id, suite_id AS suiteId, name, steps, created_at AS createdAt FROM test_cases WHERE suite_id=? ORDER BY created_at, id').all(suiteId) as unknown) as TestCase[]; }
  createCase(suiteId: string, name: string, steps = ''): TestCase | undefined { if (!this.db.prepare('SELECT id FROM test_suites WHERE id=?').get(suiteId)) return undefined; const c = { id: randomUUID(), suiteId, name, steps, createdAt: new Date().toISOString() }; this.db.prepare('INSERT INTO test_cases VALUES (?,?,?,?,?)').run(c.id,c.suiteId,c.name,c.steps,c.createdAt); return c; }
  deleteCase(id: string): boolean { return this.db.prepare('DELETE FROM test_cases WHERE id=?').run(id).changes > 0; }
}
