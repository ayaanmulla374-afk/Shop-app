const assert = require('node:assert/strict');
const { createHmac, webcrypto } = require('node:crypto');
let handler;
global.crypto = webcrypto;
global.Deno = {
  serve: fn => { handler = fn; },
  env: { get: key => ({
    META_WEBHOOK_VERIFY_TOKEN: 'verify-secret', META_APP_SECRET: 'app-secret', META_PHONE_NUMBER_ID: '12345',
    SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-secret',
  })[key] },
};
const rows = new Map([['wamid.one', { status_rank: 0 }]]);
global.fetch = async (url, options) => {
  assert.equal(options.headers.Authorization, 'Bearer service-secret');
  const parsed = new URL(url), id = parsed.searchParams.get('message_id')?.slice(3), row = rows.get(id);
  if (options.method === 'PATCH') {
    if (!row || row.status_rank >= Number(parsed.searchParams.get('status_rank').slice(3))) return Response.json([]);
    Object.assign(row, JSON.parse(options.body));
    return Response.json([{ message_id: id }]);
  }
  return Response.json(row ? [{ message_id: id }] : []);
};
require('../supabase/functions/whatsapp-webhook/index.ts');
const endpoint = 'https://test.supabase.co/functions/v1/whatsapp-webhook';
const event = (id, status, phone = '12345', timestamp = Math.floor(Date.now() / 1000)) => JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: { metadata: { phone_number_id: phone }, statuses: [{ id, status, timestamp }] } }] }] });
const signed = (body, secret = 'app-secret') => new Request(endpoint, {
  method: 'POST', headers: { 'X-Hub-Signature-256': 'sha256=' + createHmac('sha256', secret).update(body).digest('hex') }, body,
});
(async () => {
  assert.equal((await handler(new Request(endpoint + '?hub.mode=subscribe&hub.verify_token=verify-secret&hub.challenge=123'))).status, 200);
  assert.equal(await (await handler(new Request(endpoint + '?hub.mode=subscribe&hub.verify_token=bad&hub.challenge=123'))).text(), 'Verification failed');
  assert.equal((await handler(signed(event('wamid.one', 'delivered'), 'wrong'))).status, 401);
  assert.equal(rows.get('wamid.one').status_rank, 0);
  assert.equal((await handler(signed(event('wamid.one', 'delivered', 'other')))).status, 200);
  assert.equal(rows.get('wamid.one').status_rank, 0);
  assert.equal((await handler(signed(event('wamid.one', 'delivered')))).status, 200);
  assert.equal(rows.get('wamid.one').status, 'delivered');
  assert.equal((await handler(signed(event('wamid.one', 'sent')))).status, 200);
  assert.equal(rows.get('wamid.one').status, 'delivered');
  assert.equal((await handler(signed(event('missing', 'failed')))).status, 503);
  assert.equal((await handler(signed(event('missing', 'failed', '12345', 1)))).status, 200);
  console.log('Webhook verification, signature, phone filter, status update, and retry passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
