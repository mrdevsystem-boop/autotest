import { spawn } from 'node:child_process';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const apiDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const root = resolve(apiDir, '../..');
const webDir = join(root, 'apps/web');
const apiBase = 'http://127.0.0.1:3101/api';
const webBase = 'http://127.0.0.1:5174';
const children = [];
let browser;
let page;
let temp;
let failure = false;

function launch(name, cwd, args, env) {
  const child = spawn(process.execPath, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  children.push(child);
  let log = '';
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { log += String(chunk); if (log.length > 8000) log = log.slice(-8000); });
  child.on('error', e => { log += String(e); });
  return { child, name, logs: () => log };
}
async function waitFor(url, proc) {
  for (let i = 0; i < 100; i++) {
    if (proc.child.exitCode !== null) throw new Error(`${proc.name} exited: ${proc.logs()}`);
    try { const response = await fetch(url, { signal: AbortSignal.timeout(1000) }); if (response.ok) return; } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`Timeout waiting for ${url}: ${proc.logs()}`);
}
async function call(path, method = 'GET', body) {
  const res = await fetch(apiBase + path, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : (await res.json()).data;
}
function logPass(name) { console.log(`PASS ${name}`); }
async function main() {
  temp = await mkdtemp(join(tmpdir(), 'aitest-e2e-'));
  const dbPath = join(temp, 'regression.sqlite');
  const mock = launch('Mock AI', apiDir, ['e2e/mock-ai.mjs'], { AITEST_MOCK_AI_PORT: '4114' });
  await waitFor('http://127.0.0.1:4114/health', mock);
  const api = launch('API', apiDir, ['--import', 'tsx', 'src/index.ts'], { AITEST_PORT: '3101', AITEST_DB_PATH: dbPath, AITEST_WEB_ORIGIN: webBase, AI_BASE_URL: 'http://127.0.0.1:4114/v1', AI_API_KEY: 'local-e2e-only', AI_MODEL: 'mock-e2e' });
  const vite = launch('Vite', webDir, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5174', '--strictPort'], { VITE_API_URL: apiBase });
  await Promise.all([waitFor('http://127.0.0.1:3101/health', api), waitFor(webBase, vite)]);
  const project = await call('/projects', 'POST', { name: 'E2E Regression Project', description: 'Temporary isolated test' });
  const suite = await call(`/projects/${project.id}/suites`, 'POST', { name: 'Regression Suite' });
  const testCase = await call(`/suites/${suite.id}/cases`, 'POST', { name: 'Regression Case', kind: 'web', steps: JSON.stringify([{ action: 'goto', url: webBase }, { action: 'expectTitle', text: 'AI Testing' }]) });
  for (let i = 0; i < 6; i++) await call(`/cases/${testCase.id}/runs`, 'POST', { engine: 'playwright' });
  const executed = await call(`/cases/${testCase.id}/runs`, 'POST', { engine: 'playwright' });
  await call(`/runs/${executed.id}/execute`, 'POST');
  let finished;
  for (let i = 0; i < 90; i++) {
    finished = await call(`/runs/${executed.id}`);
    if (['passed', 'failed', 'error'].includes(finished.status)) break;
    await new Promise(r => setTimeout(r, 300));
  }
  assert.equal(finished.status, 'passed', `Run failed: ${finished.errorMessage}`);
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(12000);
  await page.goto(webBase);
  const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'E2E Regression Project' }) });
  const dashboard = section.locator('.report-dashboard');
  const history = section.locator('.report-run-history');
  await history.getByText('1-5 of 7').waitFor();
  assert.match(await dashboard.innerText(), /Total Runs\s*7/);
  logPass('Dashboard total and initial history');
  await history.locator('select').first().selectOption('passed');
  await history.getByText('1-1 of 1').waitFor();
  assert.equal(await history.locator('tbody tr').count(), 2);
  await history.locator('select').first().selectOption('queued');
  await history.getByText('1-5 of 6').waitFor();
  await history.locator('select').first().selectOption('');
  await history.getByText('1-5 of 7').waitFor();
  logPass('All / Passed / Queued filters');
  await history.getByRole('button', { name: 'Next' }).click();
  await history.getByText('6-7 of 7').waitFor();
  await history.getByRole('button', { name: 'Previous' }).click();
  await history.getByText('1-5 of 7').waitFor();
  await history.locator('select').nth(1).selectOption('10');
  await history.getByText('1-7 of 7').waitFor();
  logPass('Previous / Next / page size');
  await history.locator('select').first().selectOption('queued');
  await history.getByText('1-6 of 6').waitFor();

  await history.getByRole('button', { name: 'View details' }).first().click();


  await history.locator('pre:visible').filter({
    hasText: 'No execution output.'
  }).waitFor();

  await history.locator('pre:visible').filter({
    hasText: 'No error message.'
  }).waitFor();

  await history.getByRole('button', { name: 'Hide details' }).click();
  assert.equal(await history.getByRole('button', { name: 'Hide details' }).count(), 0);
  logPass('Queued details and expand / collapse');
  await history.locator('select').first().selectOption('passed');
  await history.getByText('1-1 of 1').waitFor();
  await history.getByRole('button', { name: 'View details' }).click();
  await history.getByText('step_1: goto OK').waitFor();
  logPass('Passed execution output');
  await history.getByRole('button', { name: 'Refresh history' }).click();
  await history.getByText('1-1 of 1').waitFor();
  await dashboard.getByRole('button', { name: 'Refresh metrics' }).click();
  await dashboard.getByText('Total Runs').waitFor();
  logPass('Refresh history and metrics');
  // AI generation is draft-only until an explicit user approval.
  const aiPanel = section.locator('.suite').filter({ hasText: 'Suite: Regression Suite' }).locator('.ai-generation');
  await aiPanel.locator('textarea').fill('Generate three deterministic browser test cases');
  await aiPanel.getByRole('combobox', { name: 'Maximum generated test cases' }).selectOption('3');
  await aiPanel.getByRole('button', { name: 'Generate with AI' }).click();
  await aiPanel.getByText('3 draft(s) generated. Review before saving.').waitFor();
  const draftCards = aiPanel.locator('[data-testid="ai-draft"]');
  assert.equal(await draftCards.count(), 3);
  for (let n = 1; n <= 3; n++) {
    const card = draftCards.filter({ hasText: `E2E AI draft ${n}` });
    assert.equal(await card.count(), 1);
    assert.match(await card.locator('pre').innerText(), /"action": "goto"/);
  }
  assert.equal((await call(`/suites/${suite.id}/cases`)).length, 1, 'Generation must not persist drafts');
  logPass('AI Generate, preview and no persistence before approval');

  await draftCards.filter({ hasText: 'E2E AI draft 2' }).getByRole('button', { name: 'Discard' }).click();
  assert.equal(await draftCards.count(), 2);
  assert.equal((await call(`/suites/${suite.id}/cases`)).length, 1, 'Discard must not persist drafts');
  logPass('AI Discard preserves other drafts without persistence');

  await draftCards.filter({ hasText: 'E2E AI draft 1' }).getByRole('button', { name: 'Approve & Save' }).click();
  await aiPanel.getByText('Test case saved. Review the remaining drafts.').waitFor();
  assert.equal(await draftCards.count(), 1);
  assert.equal(await draftCards.filter({ hasText: 'E2E AI draft 3' }).count(), 1);
  let cases = await call(`/suites/${suite.id}/cases`);
  assert.deepEqual(cases.filter(c => c.name.startsWith('E2E AI draft')).map(c => c.name), ['E2E AI draft 1']);
  logPass('AI Approve saves only selected draft and preserves remaining draft');

  await draftCards.filter({ hasText: 'E2E AI draft 3' }).getByRole('button', { name: 'Approve & Save' }).click();
  await draftCards.first().waitFor({ state: 'detached' });
  await section.getByText('[web] E2E AI draft 3', { exact: false }).waitFor();
  cases = await call(`/suites/${suite.id}/cases`);
  assert.deepEqual(cases.filter(c => c.name.startsWith('E2E AI draft')).map(c => c.name).sort(), ['E2E AI draft 1', 'E2E AI draft 3']);
  assert.equal(cases.some(c => c.name === 'E2E AI draft 2'), false);
  logPass('AI Multi-Draft approval and refresh with discarded draft absent');
  console.log('E2E PASS: 10 regression groups (6 reporting + 4 AI UI)');
}
try { await main(); }
catch (e) {
  failure = true;
  console.error('E2E FAILED:', e);
  if (page && temp) {
    try { await mkdir(temp, { recursive: true }); await page.screenshot({ path: join(temp, 'failure.png'), fullPage: true }); console.error('Screenshot:', join(temp, 'failure.png')); } catch {}
  }
} finally {
  await browser?.close().catch(() => {});
  for (const child of children.reverse()) {
    if (process.platform === 'win32') {
      try { await new Promise(resolve => { const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }); killer.on('error', resolve); killer.on('close', resolve); }); } catch {}
    } else child.kill('SIGTERM');
  }
  if (temp && !failure) await rm(temp, { recursive: true, force: true }).catch(() => {});
}
if (failure) process.exitCode = 1;
