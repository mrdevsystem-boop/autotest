import type { AIProvider } from './ai-provider.js';
import { AIProviderError } from './ai-openai.js';
import {
  AIValidationError,
  parseGenerateRequest,
  parseGeneratedDrafts,
} from './ai-validation.js';

export interface GenerationResult {
  status: number;
  body: unknown;
}

export async function generateTestCases(
  input: unknown,
  suiteExists: (suiteId: string) => boolean,
  provider?: AIProvider,
): Promise<GenerationResult> {
  let request: ReturnType<typeof parseGenerateRequest>;

  try {
    request = parseGenerateRequest(input);
  } catch (error) {
    if (error instanceof AIValidationError) {
      return {
        status: 400,
        body: { error: 'invalid_generation_request' },
      };
    }
    throw error;
  }

  if (!suiteExists(request.suiteId)) {
    return {
      status: 404,
      body: { error: 'suite_not_found' },
    };
  }

  if (!provider) {
    return {
      status: 503,
      body: { error: 'ai_not_configured' },
    };
  }

  try {
    const output = await provider.generateTestCases({
      requirement: request.requirement,
      maxCases: request.maxCases,
    });

    const drafts = parseGeneratedDrafts(output, request.maxCases);

    return {
      status: 200,
      body: { data: { drafts } },
    };
  } catch (error) {
    if (error instanceof AIValidationError) {
      return {
        status: 502,
        body: { error: 'invalid_ai_output' },
      };
    }

    if (error instanceof AIProviderError) {
      const status =
        error.code === 'ai_timeout' ? 504 :
        error.code === 'ai_not_configured' ? 503 : 502;

      return {
        status,
        body: { error: error.code },
      };
    }

    return {
      status: 502,
      body: { error: 'ai_provider_error' },
    };
  }
}