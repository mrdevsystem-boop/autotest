-- DESIGN DRAFT ONLY: not wired to API or applied to a database.
-- Tenant isolation must be enforced by authenticated application context before production use.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE tenants (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL);
CREATE TABLE projects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 name varchar(120) NOT NULL, description text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX projects_tenant_idx ON projects(tenant_id);
CREATE TABLE test_suites (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 project_id uuid NOT NULL REFERENCES projects(id), name text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE test_cases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 suite_id uuid NOT NULL REFERENCES test_suites(id), name text NOT NULL, definition jsonb NOT NULL DEFAULT '{}'::jsonb
);
-- RLS must be implemented and verified in a later migration, not assumed here.
