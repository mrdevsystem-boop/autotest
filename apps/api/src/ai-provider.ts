export interface AIGenerationInput {
  requirement: string;
  maxCases: number;
}

export interface AIProvider {
  generateTestCases(input: AIGenerationInput): Promise<unknown>;
}

export class MockAIProvider implements AIProvider {
  async generateTestCases(
    input: AIGenerationInput,
  ): Promise<unknown> {
    return {
      testCases: [{
        name: 'Generated smoke test',
        description: `Generated from requirement: ${input.requirement.slice(0, 100)}`,
        kind: 'web',
        steps: [
          {
            action: 'goto',
            url: 'http://127.0.0.1:5173',
          },
          {
            action: 'expectTitle',
            text: 'AI Testing Platform',
          },
        ],
      }],
    };
  }
}