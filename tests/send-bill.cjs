const assert = require('node:assert/strict');
let handler;
let documentStatus = 200;
const calls = [];
global.Deno = {
  serve: fn => { handler = fn; },
  env: { get: key => ({ SUPABASE_URL: 'https://test.supabase.co', SUPABASE_ANON_KEY: 'publishable', META_PHONE_NUMBER_ID: '12345', META_ACCESS_TOKEN: 'secret' })[key] },
};
global.fetch = async (url, options) => {
  calls.push({ url, options });
  if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'owner' });
  if (url.includes('/rest/v1/shop_state')) return Response.json([{ data: { bills: [{ id: 'bill1', phone: '9876543210' }] } }]);
  if (url.endsWith('/media')) return Response.json({ id: 'media1' });
  if (documentStatus === 0 && calls.filter(c => c.url.endsWith('/messages')).length === 2) throw Error('Network failure');
  return Response.json({ messages: [{ id: 'wamid.test' }] }, { status: calls.filter(c => c.url.endsWith('/messages')).length === 2 ? documentStatus : 200 });
};
require('../supabase/functions/send-bill/index.ts');
const request = (body, token = 'owner-token') => new Request('https://test.supabase.co/functions/v1/send-bill', {
  method: 'POST', headers: { Origin: 'https://ayaanmulla374-afk.github.io', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
});
(async () => {
  const body = { billId: 'bill1', pdf: 'JVBERi0=' };
  assert.equal((await handler(request(body, ''))).status, 401);
  assert.equal((await handler(request({ ...body, pdf: 'not-a-pdf' }))).status, 400);
  assert.equal(calls.length, 0);

  let response = await handler(request(body));
  assert.equal(response.status, 200);
  assert.deepEqual(calls.slice(-3).map(call => call.url.split('/').pop()), ['media', 'messages', 'messages']);
  const upload = calls.at(-3).options.body;
  assert.equal(upload.get('messaging_product'), 'whatsapp');
  assert.equal(upload.get('file').type, 'application/pdf');
  assert.equal(calls.at(-3).options.headers.Authorization, 'Bearer secret');
  const text = JSON.parse(calls.at(-2).options.body);
  const pdf = JSON.parse(calls.at(-1).options.body);
  assert.equal(text.to, '919876543210');
  assert.equal(text.template.name, 'bill_thank_you');
  assert.equal(pdf.template.name, 'bill_pdf');
  assert.equal(pdf.template.components[0].parameters[0].document.id, 'media1');

  calls.length = 0;
  documentStatus = 400;
  response = await handler(request(body));
  assert.equal(response.status, 502);
  assert.match((await response.json()).message, /Thank-you sent, but the PDF failed/);
  calls.length = 0;
  documentStatus = 0;
  response = await handler(request(body));
  assert.equal(response.status, 502);
  assert.match((await response.json()).message, /Thank-you sent, but the PDF could not be sent/);
  console.log('Meta upload, message order, validation, and partial failure passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
