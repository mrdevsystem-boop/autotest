import { AIProviderError } from './ai-openai.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from './app.js';
import { SqliteStore } from './sqlite.js';
import { MockAIProvider } from './ai-provider.js';

test('HTTP AI generation validates request without provider', async () => {
  const server = createApp();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const address = server.address();
    assert(address && typeof address !== 'string');
    const url = `http://127.0.0.1:${address.port}/api/ai/test-cases/generate`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requirement: '' }),
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: 'invalid_generation_request',
    });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()),
    );
  }
});

test('HTTP AI generation rejects missing suite', async () => {
  const server = createApp();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const address = server.address();
    assert(address && typeof address !== 'string');

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/ai/test-cases/generate`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          suiteId: '11111111-1111-4111-8111-111111111111',
          requirement: 'Verify page title',
        }),
      },
    );

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      error: 'suite_not_found',
    });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()),
    );
  }
});

test('HTTP AI generation returns drafts without database mutation', async () => {
  const store = new SqliteStore(':memory:');
  const project = store.create('AI Project', '');
  const suite = store.createSuite(project.id, 'Smoke')!;
  const server = createApp(store, new MockAIProvider());

  await new Promise<void>((resolve) =>
    server.listen(0, '127.0.0.1', resolve),
  );

  try {
    const address = server.address();
    assert(address && typeof address !== 'string');

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/ai/test-cases/generate`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          suiteId: suite.id,
          requirement: 'Verify application title',
          maxCases: 1,
        }),
      },
    );

    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.data.drafts.length, 1);
    assert.equal(body.data.drafts[0].kind, 'web');
    assert.equal(body.data.drafts[0].steps[0].action, 'goto');

    assert.equal(store.listCases(suite.id).length, 0);
    assert.equal(
      store.db.prepare('SELECT COUNT(*) AS count FROM test_runs')
        .get()?.count,
      0,
    );
  } finally {
    await new Promise<void>((resolve) =>
      server.close(() => resolve()),
    );
    store.close();
  }
});

test('HTTP AI generation returns 503 without provider', async () => {
  const store = new SqliteStore(':memory:');
  const project = store.create('AI Project', '');
  const suite = store.createSuite(project.id, 'Smoke')!;
  const server = createApp(store);

  await new Promise<void>((resolve) =>
    server.listen(0, '127.0.0.1', resolve),
  );

  try {
    const address = server.address();
    assert(address && typeof address !== 'string');

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/ai/test-cases/generate`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          suiteId: suite.id,
          requirement: 'Verify title',
        }),
      },
    );

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: 'ai_not_configured',
    });
  } finally {
    await new Promise<void>((resolve) =>
      server.close(() => resolve()),
    );
    store.close();
  }
});

test('HTTP AI generation rejects invalid provider output', async () => {
  const store = new SqliteStore(':memory:');
  const project = store.create('AI Project', '');
  const suite = store.createSuite(project.id, 'Smoke')!;

  const server = createApp(store, {
    async generateTestCases() {
      return { testCases: [{ invalid: true }] };
    },
  });

  await new Promise<void>((resolve) =>
    server.listen(0, '127.0.0.1', resolve),
  );

  try {
    const address = server.address();
    assert(address && typeof address !== 'string');

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/ai/test-cases/generate`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          suiteId: suite.id,
          requirement: 'Verify title',
        }),
      },
    );

    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), {
      error: 'invalid_ai_output',
    });
    assert.equal(store.listCases(suite.id).length, 0);
  } finally {
    await new Promise<void>((resolve) =>
      server.close(() => resolve()),
    );
    store.close();
  }
});

test('HTTP AI generation rejects maxCases outside allowed range', async () => {
  const store = new SqliteStore(':memory:');
  const project = store.create('AI Project', '');
  const suite = store.createSuite(project.id, 'Smoke')!;
  const server = createApp(store, new MockAIProvider());

  await new Promise<void>((resolve) =>
    server.listen(0, '127.0.0.1', resolve),
  );

  try {
    const address = server.address();
    assert(address && typeof address !== 'string');

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/ai/test-cases/generate`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          suiteId: suite.id,
          requirement: 'Verify title',
          maxCases: 99,
        }),
      },
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: 'invalid_generation_request',
    });
  } finally {
    await new Promise<void>((resolve) =>
      server.close(() => resolve()),
    );
    store.close();
  }
});

test('HTTP AI generation maps provider errors', async () => {
  const scenarios = [
    { code: 'ai_provider_error', status: 502 },
    { code: 'ai_not_configured', status: 503 },
    { code: 'ai_timeout', status: 504 },
  ] as const;

  for (const scenario of scenarios) {
    const store = new SqliteStore(':memory:');
    const project = store.create('AI Project', '');
    const suite = store.createSuite(project.id, 'Smoke')!;

    const server = createApp(store, {
      async generateTestCases() {
        throw new AIProviderError(scenario.code);
      },
    });

    try {
      await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
      );

      const address = server.address();
      assert(address && typeof address !== 'string');

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/ai/test-cases/generate`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            suiteId: suite.id,
            requirement: 'Verify page title',
          }),
        },
      );

      assert.equal(response.status, scenario.status);
      assert.deepEqual(await response.json(), {
        error: scenario.code,
      });
      assert.equal(store.listCases(suite.id).length, 0);
    } finally {
      if (server.listening) {
        await new Promise<void>((resolve) =>
          server.close(() => resolve()),
        );
      }
      store.close();
    }
  }
});