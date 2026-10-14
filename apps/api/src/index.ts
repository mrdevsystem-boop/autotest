import { resolve } from 'node:path';
import { createApp } from './app.js';
import { SqliteStore } from './sqlite.js';
const filename = process.env.AITEST_DB_PATH ?? resolve(process.cwd(), '../../data/aitest.sqlite');
const store = new SqliteStore(filename);
const server = createApp(store);
const port = Number(process.env.AITEST_PORT ?? '3001');
server.listen(port, '127.0.0.1', () => {
  console.log(`API listening on http://127.0.0.1:${port}; SQLite: ${filename}`);
});
const shutdown = () => server.close(() => { store.close(); process.exit(0); });
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
