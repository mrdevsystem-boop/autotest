import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AIValidationError,
  parseGenerateRequest,
  parseGeneratedDrafts,
} from './ai-validation.js';

const suiteId = '12345678-1234-1234-1234-123456789abc';

const validDraft = {
  name: 'Login test',
  description: 'Check login page',
  kind: 'web',
  steps: [
    { action: 'goto', url: 'http://127.0.0.1:5173' },
    { action: 'expectTitle', text: 'Login' },
  ],
};

test('valid generation request uses default maxCases', () => {
  assert.deepEqual(
    parseGenerateRequest({
      suiteId,
      requirement: '  Test login  ',
    }),
    {
      suiteId,
      requirement: 'Test login',
      maxCases: 3,
    },
  );
});

test('invalid generation requests are rejected', () => {
  for (const input of [
    null,
    {},
    { suiteId: 'bad', requirement: 'Test login' },
    { suiteId, requirement: ' ' },
    { suiteId, requirement: 'x'.repeat(4001) },
    { suiteId, requirement: 'Test', maxCases: 0 },
    { suiteId, requirement: 'Test', maxCases: 6 },
    { suiteId, requirement: 'Test', maxCases: 1.5 },
  ]) {
    assert.throws(
      () => parseGenerateRequest(input),
      (error: unknown) =>
        error instanceof AIValidationError &&
        error.code === 'invalid_generation_request',
    );
  }
});

test('valid generated drafts are accepted', () => {
  const drafts = parseGeneratedDrafts(
    { testCases: [validDraft] },
    3,
  );

  assert.equal(drafts.length, 1);
  assert.equal(drafts[0]?.name, 'Login test');
  assert.equal(drafts[0]?.steps.length, 2);
});

test('invalid AI output is rejected', () => {
  const invalidOutputs = [
    null,
    {},
    { testCases: [] },
    { testCases: [validDraft, validDraft] },
    { testCases: [{ ...validDraft, name: '' }] },
    { testCases: [{ ...validDraft, name: 'x'.repeat(121) }] },
    { testCases: [{ ...validDraft, kind: 'api' }] },
    { testCases: [{ ...validDraft, steps: [] }] },
    {
      testCases: [{
        ...validDraft,
        steps: [{ action: 'goto', url: 'https://example.com' }],
      }],
    },
    {
      testCases: [{
        ...validDraft,
        steps: [{ action: 'unknown' }],
      }],
    },
  ];

  for (const input of invalidOutputs) {
    assert.throws(
      () => parseGeneratedDrafts(input, 1),
      (error: unknown) =>
        error instanceof AIValidationError &&
        error.code === 'invalid_ai_output',
    );
  }
});

test('generated steps must fit the existing Case API limit', () => {
  const oversized = {
    ...validDraft,
    steps: [{
      action: 'expectTitle',
      text: 'x'.repeat(1000),
    }, ...Array.from({ length: 6 }, () => ({
      action: 'expectTitle',
      text: 'x'.repeat(1000),
    }))],
  };

  assert.throws(
    () => parseGeneratedDrafts({ testCases: [oversized] }, 3),
    (error: unknown) =>
      error instanceof AIValidationError &&
      error.code === 'invalid_ai_output',
  );
});

test('AI output rejects non-array testCases', () => {
  for (const testCases of [null, undefined, {}, 'invalid', 42]) {
    assert.throws(
      () => parseGeneratedDrafts({ testCases }, 3),
      (error: unknown) =>
        error instanceof AIValidationError &&
        error.code === 'invalid_ai_output',
    );
  }
});