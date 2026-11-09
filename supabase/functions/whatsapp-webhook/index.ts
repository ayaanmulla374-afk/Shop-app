const ranks: Record<string, number> = { sent: 1, delivered: 2, read: 3, failed: 4 };

Deno.serve(async (request) => {
  const verifyToken = Deno.env.get('META_WEBHOOK_VERIFY_TOKEN');
  const appSecret = Deno.env.get('META_APP_SECRET');
  const phoneId = Deno.env.get('META_PHONE_NUMBER_ID');
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!verifyToken || !appSecret || !phoneId || !url || !serviceKey) return new Response('Server settings are incomplete', { status: 500 });

  if (request.method === 'GET') {
    const params = new URL(request.url).searchParams;
    if (params.get('hub.mode') === 'subscribe' && params.get('hub.verify_token') === verifyToken && params.get('hub.challenge')) {
      return new Response(params.get('hub.challenge'));
    }
    return new Response('Verification failed', { status: 403 });
  }
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const signature = request.headers.get('X-Hub-Signature-256');
  if (!signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return new Response('Invalid signature', { status: 401 });
  const body = await request.arrayBuffer();
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const digest = Uint8Array.from(signature.slice(7).match(/../g)!, hex => parseInt(hex, 16));
  if (!await crypto.subtle.verify('HMAC', key, digest, body)) return new Response('Invalid signature', { status: 401 });

  let payload;
  try { payload = JSON.parse(new TextDecoder().decode(body)); }
  catch { return new Response('Invalid JSON', { status: 400 }); }
  if (payload.object !== 'whatsapp_business_account') return new Response('OK');

  try {
    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
    for (const entry of payload.entry || []) for (const change of entry.changes || []) {
      if (change.field !== 'messages' || String(change.value?.metadata?.phone_number_id) !== phoneId) continue;
      for (const event of change.value.statuses || []) {
        const rank = ranks[event.status];
        if (!rank || typeof event.id !== 'string') continue;
        const row = `${url}/rest/v1/whatsapp_delivery?message_id=eq.${encodeURIComponent(event.id)}`;
        const updated = await fetch(`${row}&status_rank=lt.${rank}&select=message_id`, {
          method: 'PATCH', headers,
          body: JSON.stringify({ status: event.status, status_rank: rank, error_code: event.errors?.[0]?.code?.toString() || null, updated_at: new Date().toISOString() }),
        });
        if (!updated.ok) return new Response('Could not record delivery', { status: 503 });
        if ((await updated.json()).length) continue;
        const existing = await fetch(`${row}&select=message_id`, { headers });
        if (!existing.ok) return new Response('Could not check delivery', { status: 503 });
        if (!(await existing.json()).length) {
          // shortcut: retry a recent unmatched status for a send/record race; ignore unrelated messages after five minutes.
          if (Date.now() - Number(event.timestamp) * 1000 < 300_000) return new Response('Message not recorded yet', { status: 503 });
        }
      }
    }
    return new Response('OK');
  } catch { return new Response('Could not record delivery', { status: 503 }); }
});
