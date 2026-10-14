import type { AIProvider, AIGenerationInput } from './ai-provider.js';

export type AIProviderErrorCode =
  | 'ai_not_configured'
  | 'ai_provider_error'
  | 'ai_timeout'
  | 'invalid_ai_output';

export class AIProviderError extends Error {
  constructor(public readonly code: AIProviderErrorCode) {
    super(code);
    this.name = 'AIProviderError';
  }
}

export interface OpenAIConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
}

export function readOpenAIConfig(
  env: NodeJS.ProcessEnv = process.env,
): OpenAIConfig {
  const baseUrl = env.AI_BASE_URL?.trim() ?? '';
  const apiKey = env.AI_API_KEY?.trim() ?? '';
  const model = env.AI_MODEL?.trim() ?? '';
  const timeoutMs = Number(env.AI_TIMEOUT_MS ?? '20000');

  if (!baseUrl || !apiKey || !model) {
    throw new AIProviderError('ai_not_configured');
  }

  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1000 ||
    timeoutMs > 120000
  ) {
    throw new AIProviderError('ai_not_configured');
  }

  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new AIProviderError('ai_not_configured');
  }

  if (
    parsed.protocol !== 'https:' &&
    !(parsed.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname))
  ) {
    throw new AIProviderError('ai_not_configured');
  }

  if (parsed.username || parsed.password ||
      parsed.search || parsed.hash) {
    throw new AIProviderError('ai_not_configured');
  }

  return { baseUrl, apiKey, model, timeoutMs };
}

const SYSTEM_PROMPT = [
  'Generate executable draft web test cases.',
  'Return JSON only with a top-level testCases array.',
  'Each case must have name, description, kind="web", and steps.',
  'Allowed actions: goto, click, fill, expectText, expectTitle.',
  'Only use http://localhost or http://127.0.0.1 URLs for goto.',
  'Never invent credentials, secrets, or external URLs.',
  'Generated cases are drafts requiring human approval.',
].join(' ');

export class OpenAICompatibleProvider implements AIProvider {
  constructor(private readonly config: OpenAIConfig) {}

  async generateTestCases(
    input: AIGenerationInput,
  ): Promise<unknown> {
    const endpoint =
      this.config.baseUrl.replace(/\/+$/, '') +
      '/chat/completions';

    let response: Response;

    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.config.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: JSON.stringify({
                requirement: input.requirement,
                maxCases: input.maxCases,
              }),
            },
          ],
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === 'TimeoutError' ||
         error.name === 'AbortError')
      ) {
        throw new AIProviderError('ai_timeout');
      }
      throw new AIProviderError('ai_provider_error');
    }

    if (!response.ok) {
      throw new AIProviderError('ai_provider_error');
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new AIProviderError('invalid_ai_output');
    }

    if (
      !payload ||
      typeof payload !== 'object' ||
      !('choices' in payload)
    ) {
      throw new AIProviderError('invalid_ai_output');
    }

    const choices = (payload as {
      choices?: Array<{
        message?: { content?: unknown };
      }>;
    }).choices;

    const content = choices?.[0]?.message?.content;

    if (typeof content !== 'string') {
      throw new AIProviderError('invalid_ai_output');
    }

    try {
      return JSON.parse(content) as unknown;
    } catch {
      throw new AIProviderError('invalid_ai_output');
    }
  }
}
