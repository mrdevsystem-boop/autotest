import { resolve } from 'node:path';
import { createApp } from './app.js';
import { SqliteStore } from './sqlite.js';
import { OpenAICompatibleProvider, readOpenAIConfig } from './ai-openai.js';
import type { AIProvider } from './ai-provider.js';
const filename = process.env.AITEST_DB_PATH ?? resolve(process.cwd(), '../../data/aitest.sqlite');
const store = new SqliteStore(filename);
let aiProvider: AIProvider | undefined;

if (process.env.AI_BASE_URL || process.env.AI_API_KEY || process.env.AI_MODEL) {
  try {
    aiProvider = new OpenAICompatibleProvider(readOpenAIConfig());
    console.log('AI provider configured');
  } catch {
    console.warn('AI provider configuration invalid; AI generation unavailable');
  }
}

const server = createApp(store, aiProvider);
const port = Number(process.env.AITEST_PORT ?? '3001');
server.listen(port, '127.0.0.1', () => {
  console.log(`API listening on http://127.0.0.1:${port}; SQLite: ${filename}`);
});
const shutdown = () => server.close(() => { store.close(); process.exit(0); });
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
