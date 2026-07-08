// Cloudflare Pages Function: cloud backup for review progress.
// GET  /api/state  -> stored progress JSON
// PUT  /api/state  -> replace stored progress JSON
// Auth: Authorization: Bearer <SYNC_TOKEN env var>; storage: KV binding STATE.

export async function onRequest({ request, env }) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!env.SYNC_TOKEN || token !== env.SYNC_TOKEN) {
    return new Response('unauthorized', { status: 401 });
  }

  if (request.method === 'GET') {
    const data = await env.STATE.get('progress');
    return new Response(data || 'null', {
      headers: { 'content-type': 'application/json' },
    });
  }

  if (request.method === 'PUT') {
    const body = await request.text();
    if (body.length > 512 * 1024) return new Response('too large', { status: 413 });
    try {
      JSON.parse(body);
    } catch {
      return new Response('invalid json', { status: 400 });
    }
    await env.STATE.put('progress', body);
    return new Response('{"ok":true}', {
      headers: { 'content-type': 'application/json' },
    });
  }

  return new Response('method not allowed', { status: 405 });
}
