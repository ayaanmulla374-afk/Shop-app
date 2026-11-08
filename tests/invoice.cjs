const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('dist/app.js', 'utf8');
const code = source.match(/async function invoiceDocument\(\)\{[\s\S]*?\r?\n\}\r?\n\$\('printBill'\)/)?.[0].replace(/\r?\n\$\('printBill'\)$/, '');
assert.ok(code, 'showInvoice exists');

async function render(b) {
  const name = {}, date = {}, rows = {}, subtotal = [{}, {}];
  const invoice = {
    readyState: 'complete',
    querySelector: selector => ({ '#customer-meta p': name, '#items-table tbody': rows })[selector],
    querySelectorAll: selector => ({ '#customer-meta p': [name, date], '#subtotal-bar p': subtotal })[selector]
  };
  const context = {
    $: id => id === 'invoiceFrame' ? { contentDocument: invoice } : null,
    periodLabel: bill => bill.date,
    money: amount => `₹${amount}`,
    escapeHtml: value => String(value).replaceAll('<', '&lt;')
  };
  await vm.runInNewContext(`${code};showInvoice(b)`, { ...context, b });
  return { name, date, rows, subtotal };
}

const bill = { name: 'A < B', date: '8 November 2026', total: 200, lines: [{ name: 'Normal press', qty: 2, rate: 50 }, { name: 'Saree', qty: 1, rate: 100 }] };
(async()=>{
const result = await render(bill);
assert.equal(result.name.textContent, 'Customer Name :  A < B');
assert.equal(result.date.textContent, 'Date : 8 November 2026');
assert.match(result.rows.innerHTML, /Normal press[\s\S]*₹100[\s\S]*Saree/);
assert.equal(result.subtotal[1].textContent, '₹200');
assert.doesNotMatch(fs.readFileSync('dist/invoice.html', 'utf8'), /id="(?:pressing-charges|grand-total-bar)"/);
console.log('Invoice uses live bill values without pressing or grand-total sections.');
})().catch(error=>{console.error(error);process.exitCode=1});
