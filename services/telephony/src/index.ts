/**
 * Two thin transports, one core.
 *
 *   ws://HOST/media   — Exotel AgentStream. Bidirectional PCM over a WebSocket (panel 2).
 *   POST /whatsapp    — Meta Cloud API webhook for voice notes (panel 4).
 *   GET  /whatsapp    — Meta's webhook verification handshake.
 *   GET  /health      — for the tunnel and for a smoke test.
 *
 * The rule this file exists to obey: **neither adapter contains interview logic.** Each one turns
 * its transport into an `Utterance`, hands it to `turn()` from @rc097/core, and turns the returned
 * `say[]` back into its transport. If a question, a threshold or a re-ask rule ever appears here,
 * the WhatsApp path and the IVR path become two implementations of the same seven questions and
 * they disagree by day three (spec §0).
 *
 * Run it:
 *   npm run telephony                      # this server on :5001
 *   ngrok http 5001                        # public https/wss URL
 *   then point Exotel's Voicebot applet at wss://<id>.ngrok.app/media
 *   and Meta's webhook at https://<id>.ngrok.app/whatsapp
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { handleExotelSocket } from './exotel.js';
import { handleWhatsAppWebhook, verifyWhatsAppWebhook } from './whatsapp.js';

const PORT = Number(process.env.PORT ?? 5001);

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'rc097-telephony', ts: new Date().toISOString() }));
    return;
  }

  if (url.pathname === '/whatsapp' && req.method === 'GET') {
    // Meta's one-time handshake: echo hub.challenge when the verify token matches.
    const out = verifyWhatsAppWebhook(url.searchParams);
    res.writeHead(out.status, { 'Content-Type': 'text/plain' });
    res.end(out.body);
    return;
  }

  if (url.pathname === '/whatsapp' && req.method === 'POST') {
    const raw = await readBody(req);
    // Answer Meta immediately: it retries aggressively on a slow 200, and an ASR round trip is far
    // slower than its patience. The actual work continues after the response.
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('EVENT_RECEIVED');
    void handleWhatsAppWebhook(raw, req.headers['x-hub-signature-256'] as string | undefined).catch((e) =>
      console.error('[whatsapp] handler failed:', e),
    );
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found');
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  if (url.pathname !== '/media') {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws: WebSocket) => handleExotelSocket(ws, url));
});

server.listen(PORT, () => {
  console.log(`[rc097-telephony] listening on :${PORT}`);
  console.log(`  IVR      ws://localhost:${PORT}/media`);
  console.log(`  WhatsApp http://localhost:${PORT}/whatsapp`);
  console.log(`  health   http://localhost:${PORT}/health`);
  if (!process.env.ASR_PROVIDER) {
    console.log('\n  ASR_PROVIDER is unset — running with the stub recogniser.');
    console.log('  Set ASR_PROVIDER=bhashini|sarvam and the matching key to use a real one.');
  }
});
