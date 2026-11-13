// Deliberately only a health-check starter. No insecure mock authentication on a server.
import { createServer } from 'node:http';
const port = Number(process.env.PORT || 3001);
createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'GET' && req.url === '/api/v1/health') {
    res.end(JSON.stringify({ status: 'ok', mode: 'backend-starter' }));
  } else {
    res.statusCode = 501;
    res.end(JSON.stringify({ error: { code: 'NOT_IMPLEMENTED', message: 'See docs/API.md. Frontend uses a browser-local mock.' } }));
  }
}).listen(port, '127.0.0.1', () => console.log(`Backend starter: http://127.0.0.1:${port}/api/v1/health`));
