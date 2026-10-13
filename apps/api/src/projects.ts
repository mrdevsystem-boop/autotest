import { randomUUID } from 'node:crypto';
export interface Project { id: string; name: string; description: string; createdAt: string }
export class ProjectStore {
  private projects = new Map<string, Project>();
  list(): Project[] { return [...this.projects.values()]; }
  get(id: string): Project | undefined { return this.projects.get(id); }
  create(name: string, description = ''): Project {
    const project = { id: randomUUID(), name, description, createdAt: new Date().toISOString() };
    this.projects.set(project.id, project); return project;
  }
  update(id: string, name: string, description = ''): Project | undefined {
    const current = this.projects.get(id); if (!current) return undefined;
    const next = { ...current, name, description }; this.projects.set(id, next); return next;
  }
  delete(id: string): boolean { return this.projects.delete(id); }
}
export function validProject(value: unknown): value is { name: string; description?: string } {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.name === 'string' && v.name.trim().length > 0 && v.name.length <= 120 &&
    (v.description === undefined || (typeof v.description === 'string' && v.description.length <= 2000));
}
