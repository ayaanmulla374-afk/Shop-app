const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('dist/app.js', 'utf8');
const code = source.match(/async function invoiceDocument\(\)\{[\s\S]*?\r?\n\}\r?\n\$\('printBill'\)/)?.[0].replace(/\r?\n\$\('printBill'\)$/, '');
assert.ok(code, 'showInvoice exists');

async function render(b) {
  const name = {}, date = {}, rows = {}, subtotal = [{}, {}], total = {};
  const invoice = {
    readyState: 'complete',
    querySelector: selector => ({ '#customer-meta p': name, '#items-table tbody': rows, '#grand-total-bar span:last-child': total })[selector],
    querySelectorAll: selector => ({ '#customer-meta p': [name, date], '#subtotal-bar p': subtotal })[selector]
  };
  const context = {
    $: id => id === 'invoiceFrame' ? { contentDocument: invoice } : null,
    periodLabel: bill => bill.date,
    money: amount => `₹${amount}`,
    escapeHtml: value => String(value).replaceAll('<', '&lt;')
  };
  await vm.runInNewContext(`${code};showInvoice(b)`, { ...context, b });
  return { name, date, rows, subtotal, total };
}

const bill = { name: 'A < B', date: '8 November 2026', total: 200, lines: [{ name: 'Normal press', qty: 2, rate: 50 }, { name: 'Saree', qty: 1, rate: 100 }] };
(async()=>{
const result = await render(bill);
assert.equal(result.name.textContent, 'Customer Name :  A < B');
assert.equal(result.date.textContent, 'Date : 8 November 2026');
assert.match(result.rows.innerHTML, /Normal press[\s\S]*₹100[\s\S]*Saree/);
assert.equal(result.subtotal[1].textContent, '₹200');
assert.equal(result.total.textContent, '₹200');
const design = fs.readFileSync('dist/invoice.html', 'utf8');
assert.doesNotMatch(design, /id="pressing-charges"|Pressing Charges/);
assert.match(design, /text-\[22px\].*font-bold/);
assert.match(design, /aria-hidden="true" class="bg-invoice-paper" style="height:67\.6875px"/);
console.log('Invoice uses live bill values with smaller customer text and no pressing bar.');
})().catch(error=>{console.error(error);process.exitCode=1});
