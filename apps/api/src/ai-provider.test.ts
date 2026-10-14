import assert from 'node:assert/strict';
import test from 'node:test';
import { MockAIProvider } from './ai-provider.js';
import { parseGeneratedDrafts } from './ai-validation.js';

test('mock AI provider returns deterministic valid drafts', async () => {
  const provider = new MockAIProvider();

  const input = {
    requirement: 'Test login page',
    maxCases: 3,
  };

  const first = await provider.generateTestCases(input);
  const second = await provider.generateTestCases(input);

  assert.deepEqual(first, second);

  const drafts = parseGeneratedDrafts(first, input.maxCases);

  assert.equal(drafts.length, 1);
  assert.equal(drafts[0]?.kind, 'web');
  assert.equal(drafts[0]?.name, 'Generated smoke test');
});

test('mock AI provider works without API credentials', async () => {
  const provider = new MockAIProvider();

  const output = await provider.generateTestCases({
    requirement: 'Check application title',
    maxCases: 1,
  });

  assert.equal(parseGeneratedDrafts(output, 1).length, 1);
});