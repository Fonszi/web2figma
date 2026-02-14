/**
 * Forge Local Relay — bridges Chrome Extension and Figma Plugin.
 *
 * Usage: node relay/server.mjs
 *        npm run relay
 *
 * Endpoints:
 *   POST /extraction  — Extension sends extraction JSON
 *   GET  /extraction  — Plugin fetches extraction JSON (clears after read)
 *   GET  /health      — Connection status check
 *
 * No dependencies — uses Node.js built-in http module.
 */

import { createServer } from 'node:http';

const PORT = 19876;
const MAX_BODY_SIZE = 50 * 1024 * 1024; // 50MB
const VERSION = '0.1.0';

let currentExtraction = null;
let lastPostTimestamp = 0;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    ...CORS_HEADERS,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        reject(new Error('BODY_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function timestamp() {
  return new Date().toISOString().slice(11, 19);
}

const server = createServer(async (req, res) => {
  const { method, url } = req;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  if (url === '/health' && method === 'GET') {
    sendJson(res, 200, {
      status: 'ok',
      version: VERSION,
      hasExtraction: currentExtraction !== null,
      timestamp: lastPostTimestamp || Date.now(),
    });
    return;
  }

  if (url === '/extraction' && method === 'POST') {
    try {
      const body = await readBody(req);
      JSON.parse(body); // validate JSON
      currentExtraction = body;
      lastPostTimestamp = Date.now();
      console.log(`[${timestamp()}] Extraction received (${(body.length / 1024).toFixed(1)} KB)`);
      sendJson(res, 200, { ok: true });
    } catch (err) {
      if (err.message === 'BODY_TOO_LARGE') {
        sendJson(res, 413, { error: 'Payload too large (max 50MB)' });
      } else {
        sendJson(res, 400, { error: 'Invalid JSON' });
      }
    }
    return;
  }

  if (url === '/extraction' && method === 'GET') {
    if (!currentExtraction) {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }
    const data = currentExtraction;
    currentExtraction = null; // single-consumer: clear after read
    console.log(`[${timestamp()}] Extraction fetched by plugin`);
    res.writeHead(200, {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
    });
    res.end(data);
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`\nForge Relay Server v${VERSION}`);
  console.log(`Listening on http://localhost:${PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`  POST /extraction  — Send extraction from extension`);
  console.log(`  GET  /extraction  — Fetch extraction in plugin`);
  console.log(`  GET  /health      — Check server status`);
  console.log(`\nPress Ctrl+C to stop.\n`);
});

// Graceful shutdown
function shutdown() {
  console.log(`\n[${timestamp()}] Shutting down...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Export for testing
export { server, PORT, VERSION, MAX_BODY_SIZE };
