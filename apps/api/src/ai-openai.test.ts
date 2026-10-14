import { OpenAICompatibleProvider } from './ai-openai.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AIProviderError,
  readOpenAIConfig,
} from './ai-openai.js';

const valid = {
  AI_BASE_URL: 'https://api.deepseek.com',
  AI_API_KEY: 'test-secret',
  AI_MODEL: 'deepseek-chat',
};

test('AI config accepts valid settings', () => {
  const config = readOpenAIConfig(valid);
  assert.equal(config.timeoutMs, 20000);
  assert.equal(config.model, 'deepseek-chat');
});

test('AI config rejects missing credentials', () => {
  assert.throws(
    () => readOpenAIConfig({ ...valid, AI_API_KEY: '' }),
    (error: unknown) =>
      error instanceof AIProviderError &&
      error.code === 'ai_not_configured',
  );
});

test('AI config rejects insecure external HTTP', () => {
  assert.throws(
    () => readOpenAIConfig({
      ...valid,
      AI_BASE_URL: 'http://example.com',
    }),
    AIProviderError,
  );
});

test('AI config rejects invalid timeout', () => {
  assert.throws(
    () => readOpenAIConfig({
      ...valid,
      AI_TIMEOUT_MS: '0',
    }),
    AIProviderError,
  );
});

test('AI adapter handles network failure', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('connection failed');
  };

  try {
    const provider = new OpenAICompatibleProvider(mockConfig);
    await assert.rejects(
      provider.generateTestCases(mockInput),
      (error: unknown) =>
        error instanceof AIProviderError &&
        error.code === 'ai_provider_error',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('AI adapter rejects missing choices', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ unexpected: true }), {
      status: 200,
    });

  try {
    const provider = new OpenAICompatibleProvider(mockConfig);
    await assert.rejects(
      provider.generateTestCases(mockInput),
      (error: unknown) =>
        error instanceof AIProviderError &&
        error.code === 'invalid_ai_output',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

const mockConfig = {
  baseUrl: 'https://api.example.com',
  apiKey: 'test-secret',
  model: 'test-model',
  timeoutMs: 1000,
};

const mockInput = {
  requirement: 'Check page title',
  maxCases: 1,
};
