import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { PLATFORM_NAME } from '@aitest/contracts';
test('shared contracts are available', () => assert.equal(PLATFORM_NAME, 'ai-testing-platform'));
