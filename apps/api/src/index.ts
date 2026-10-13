import { createServer } from 'node:http';
import { PLATFORM_NAME, type HealthResponse } from '@aitest/contracts';

const port = Number(process.env.PORT ?? 3001);
const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    const response: HealthResponse = { status: 'ok', service: PLATFORM_NAME, version: '0.1.0' };
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(response));
    return;
  }
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'not_found' }));
});
server.listen(port, '127.0.0.1', () => console.log(`API listening at http://127.0.0.1:${port}`));
