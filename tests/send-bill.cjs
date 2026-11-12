const assert = require('node:assert/strict');
let handler;
let documentStatus = 200;
const calls = [];
let testBills = [{ id: 'bill1', phone: '9876543210' }];
global.Deno = {
  serve: fn => { handler = fn; },
  env: { get: key => ({ SUPABASE_URL: 'https://test.supabase.co', SUPABASE_ANON_KEY: 'publishable', META_PHONE_NUMBER_ID: '12345', META_ACCESS_TOKEN: 'secret' })[key] },
};
global.fetch = async (url, options) => {
  calls.push({ url, options });
  if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'owner' });
  if (url.includes('/rest/v1/shop_state')) return Response.json([{ data: { bills: testBills } }]);
  if (url.endsWith('/media')) return Response.json({ id: 'media1' });
  if (url.endsWith('/rest/v1/whatsapp_delivery')) return Response.json({}, { status: 201 });
  if (documentStatus === 0 && calls.filter(c => c.url.endsWith('/messages')).length === 1) throw Error('Network failure');
  const count = calls.filter(c => c.url.endsWith('/messages')).length;
  return Response.json({ messages: [{ id: `wamid.${count}` }] }, { status: documentStatus });
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
  assert.deepEqual(calls.slice(-3).map(call => call.url.split('/').pop()), ['media', 'messages', 'whatsapp_delivery']);
  const upload = calls.at(-3).options.body;
  assert.equal(upload.get('messaging_product'), 'whatsapp');
  assert.equal(upload.get('file').type, 'application/pdf');
  assert.equal(calls.at(-3).options.headers.Authorization, 'Bearer secret');
  const pdf = JSON.parse(calls.at(-2).options.body);
  assert.equal(pdf.to, '919876543210');
  assert.equal(pdf.template.name, 'bill_pdf_utility_v2');
  assert.equal(pdf.template.language.code, 'en');
  assert.equal(pdf.template.components[0].type, 'header');
  assert.equal(pdf.template.components[0].parameters[0].type, 'document');
  assert.equal(pdf.template.components[0].parameters[0].document.id, 'media1');
  assert.equal(pdf.template.components[1].type, 'body');
  assert.equal(pdf.template.components[1].parameters[0].type, 'text');
  assert.equal(pdf.template.components[1].parameters[0].text, 'Customer');
  assert.deepEqual(calls.filter(c => c.url.endsWith('/whatsapp_delivery')).map(c => JSON.parse(c.options.body).part), ['pdf']);

  calls.length = 0;
  testBills = [{ id: 'bill2', name: 'Asha Sharma', phone: '9876543210' }];
  response = await handler(request({ billId: 'bill2', pdf: 'JVBERi0=' }));
  assert.equal(response.status, 200);
  const namedPdf = JSON.parse(calls.filter(c => c.url.endsWith('/messages')).at(-1).options.body);
  assert.equal(namedPdf.template.components[1].parameters[0].text, 'Asha Sharma');

  const firstFilename = upload.get('file').name;
  calls.length = 0;
  testBills = [{ id: 'bill1', phone: '9876543210' }];
  response = await handler(request(body));
  assert.equal(response.status, 200);
  const resendUpload = calls.find(call => call.url.endsWith('/media')).options.body;
  const resendPdf = JSON.parse(calls.filter(call => call.url.endsWith('/messages')).at(-1).options.body);
  assert.notEqual(resendUpload.get('file').name, firstFilename);
  assert.equal(resendPdf.template.components[0].parameters[0].document.filename, resendUpload.get('file').name);

  calls.length = 0;
  documentStatus = 400;
  response = await handler(request(body));
  assert.equal(response.status, 502);
  assert.match((await response.json()).message, /Meta could not send the bill PDF/);
  calls.length = 0;
  documentStatus = 0;
  response = await handler(request(body));
  assert.equal(response.status, 502);
  assert.match((await response.json()).message, /Meta could not send the bill PDF/);
  console.log('Meta upload, single message delivery, customer name fallback, validation, and failure passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
