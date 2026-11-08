const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('dist/app.js', 'utf8');
const code = source.match(/function showInvoice\(b\)\{[\s\S]*?\r?\n\}\r?\n\$\('printBill'\)/)?.[0].replace(/\r?\n\$\('printBill'\)$/, '');
assert.ok(code, 'showInvoice exists');

function render(b) {
  const name = {}, date = {}, rows = {}, subtotal = [{}, {}], total = {}, pressText = {};
  let pressRemoved = false;
  const pressing = { querySelector: () => pressText, remove: () => { pressRemoved = true; } };
  const invoice = {
    replaceChildren() {},
    querySelector: selector => ({ '#customer-meta p': name, '#items-table tbody': rows, '#grand-total-bar span:last-child': total, '#pressing-charges': pressing })[selector],
    querySelectorAll: selector => ({ '#customer-meta p': [name, date], '#subtotal-bar p': subtotal })[selector]
  };
  const context = {
    $: id => id === 'invoice' ? invoice : { content: { cloneNode: () => ({}) } },
    periodLabel: bill => bill.date,
    money: amount => `₹${amount}`,
    escapeHtml: value => String(value).replaceAll('<', '&lt;')
  };
  vm.runInNewContext(`${code};showInvoice(b)`, { ...context, b });
  return { name, date, rows, subtotal, total, pressText, pressRemoved };
}

const bill = { name: 'A < B', date: '8 November 2026', total: 200, lines: [{ name: 'Normal press', qty: 2, rate: 50 }, { name: 'Saree', qty: 1, rate: 100 }] };
const result = render(bill);
assert.equal(result.name.textContent, 'Customer Name :  A < B');
assert.equal(result.date.textContent, 'Date : 8 November 2026');
assert.match(result.rows.innerHTML, /Normal press[\s\S]*₹100[\s\S]*Saree/);
assert.equal(result.subtotal[1].textContent, '₹200');
assert.equal(result.total.textContent, '₹200');
assert.match(result.pressText.innerHTML, /₹100.*Included/);
assert.equal(result.pressRemoved, false);
assert.equal(render({ ...bill, lines: [bill.lines[1]] }).pressRemoved, true);
console.log('Invoice uses live bill values and included pressing charges.');
