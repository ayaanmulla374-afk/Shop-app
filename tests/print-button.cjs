const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('dist/app.js', 'utf8');
const handler = source.slice(source.indexOf("$('printBill').onclick="), source.indexOf('// shortcut: the PDF is a rasterized invoice;'));
const button = {};
let opened = 0, printed = '', error = '';
const popup = { location: {}, close: () => { opened--; } };
const context = {
  $: () => button,
  currentBill: () => ({ id: 'bill1' }),
  billPdf: async () => ({ size: 100 }),
  window: { open: () => { opened++; return popup; } },
  URL: { createObjectURL: () => 'blob:bill', revokeObjectURL: () => {} },
  setTimeout: () => {},
  showStatus: (_, message) => { error = message; },
};
vm.runInNewContext(handler, context);
(async () => {
  await button.onclick();
  printed = popup.location.href;
  assert.equal(opened, 1);
  assert.equal(printed, 'blob:bill');
  assert.equal(error, '');
  console.log('Print button opens the generated bill PDF.');
})().catch(e => { console.error(e); process.exitCode = 1; });
