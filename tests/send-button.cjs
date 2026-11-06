const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('dist/app.js', 'utf8');
const handler = source.slice(source.indexOf("$('sendBill').onclick="), source.indexOf("$('newBill').onclick="));
const button = {};
let opened = 0, downloads = 0, calls = 0, status = '';
const context = {
  $: () => button,
  data: { bills: [] }, openedBill: null,
  currentBill: () => ({ id: 'bill1', name: 'Asha', phone: '9876543210' }),
  persist: async () => true, saveDraft: () => {},
  billPdf: async () => ({ size: 100 }), pdfBase64: async () => 'JVBERi0=',
  showStatus: (_, message) => { status = message; },
  window: { SHOP_WHATSAPP_AUTO: true, open: () => { opened++; return { location: {}, close: () => {} }; } },
  document: { createElement: () => ({ click: () => { downloads++; } }) },
  URL: { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} },
  setTimeout: () => {},
};
vm.createContext(context);
vm.runInContext(handler, context);
(async () => {
  context.cloudClient = { functions: { invoke: async (name, request) => {
    calls++;
    assert.equal(name, 'send-bill');
    assert.equal(request.body.billId, 'bill1');
    return { data: { message: 'Accepted by Meta' } };
  } } };
  await button.onclick();
  assert.equal(calls, 1);
  assert.equal(opened, 0);
  assert.equal(downloads, 0);
  assert.equal(status, 'Accepted by Meta');

  context.window.SHOP_WHATSAPP_AUTO = false;
  await button.onclick();
  assert.equal(calls, 1);
  assert.equal(opened, 1);
  assert.equal(downloads, 1);
  assert.match(status, /attach the downloaded bill PDF/);
  console.log('Automatic and manual WhatsApp button modes passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
