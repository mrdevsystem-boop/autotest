import { createServer } from 'node:http';

const port = Number(process.env.AITEST_MOCK_AI_PORT ?? '4114');
const drafts = [1, 2, 3].map(n => ({
  name: `E2E AI draft ${n}`,
  description: `Deterministic mock draft ${n}`,
  kind: 'web',
  steps: [{ action: 'goto', url: 'http://127.0.0.1:5174' }, { action: 'expectTitle', text: 'AI Testing' }],
}));

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
    res.writeHead(404).end();
    return;
  }
  try {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 65536) throw new Error('Request too large');
    }
    const request = JSON.parse(body);
    const userMessage = request.messages?.find(m => m.role === 'user')?.content;
    const { maxCases } = JSON.parse(userMessage);
    if (!Number.isInteger(maxCases) || maxCases < 1 || maxCases > 5) throw new Error('Invalid maxCases');
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ testCases: drafts.slice(0, maxCases) }) } }] }));
  } catch {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'invalid mock request' }));
  }
});
server.listen(port, '127.0.0.1');
process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());
