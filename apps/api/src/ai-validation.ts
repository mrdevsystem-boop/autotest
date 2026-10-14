import type {
  GenerateTestCasesRequest,
  GeneratedTestCaseDraft,
  GeneratedWebStep,
} from '@aitest/contracts';
import { parseWebSteps } from './playwright-runner.js';

export class AIValidationError extends Error {
  constructor(
    public readonly code:
      | 'invalid_generation_request'
      | 'invalid_ai_output',
  ) {
    super(code);
    this.name = 'AIValidationError';
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value);
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function parseGenerateRequest(
  input: unknown,
): Required<GenerateTestCasesRequest> {
  if (!record(input)) {
    throw new AIValidationError('invalid_generation_request');
  }

  const { suiteId, requirement, maxCases = 3 } = input;

  if (
    !validUuid(suiteId) ||
    typeof requirement !== 'string' ||
    requirement.trim().length === 0 ||
    requirement.length > 4000 ||
    typeof maxCases !== 'number' ||
    !Number.isInteger(maxCases) ||
    maxCases < 1 ||
    maxCases > 5
  ) {
    throw new AIValidationError('invalid_generation_request');
  }

  return {
    suiteId,
    requirement: requirement.trim(),
    maxCases,
  };
}

export function parseGeneratedDrafts(
  input: unknown,
  maxCases: number,
): GeneratedTestCaseDraft[] {
  if (
    !Number.isInteger(maxCases) ||
    maxCases < 1 ||
    maxCases > 5 ||
    !record(input) ||
    !Array.isArray(input.testCases) ||
    input.testCases.length < 1 ||
    input.testCases.length > maxCases
  ) {
    throw new AIValidationError('invalid_ai_output');
  }

  return input.testCases.map((item: unknown) => {
    if (
      !record(item) ||
      typeof item.name !== 'string' ||
      item.name.trim().length === 0 ||
      item.name.length > 120 ||
      typeof item.description !== 'string' ||
      item.description.length > 2000 ||
      item.kind !== 'web' ||
      !Array.isArray(item.steps)
    ) {
      throw new AIValidationError('invalid_ai_output');
    }

    let steps: GeneratedWebStep[];

    try {
      const serialized = JSON.stringify(item.steps);
      if (serialized.length > 5000) {
        throw new Error('steps_too_large');
      }

      steps = parseWebSteps(serialized) as GeneratedWebStep[];
    } catch {
      throw new AIValidationError('invalid_ai_output');
    }

    return {
      name: item.name.trim(),
      description: item.description,
      kind: 'web' as const,
      steps,
    };
  });
}