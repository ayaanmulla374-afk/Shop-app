
const $=id=>document.getElementById(id);const key='maharashtra-bills-v1';let data=JSON.parse(localStorage.getItem(key)||'{"prices":{},"bills":[]}');
const catalog=[['Press',['Normal press','Saree press','Steam normal press','Steam saree press']],['Dry clean · Top',['Salwar (top)','Shirt','Coat','Sherwani','Dupatta']],['Dry clean · Bottom',['Salwar (bottom)','Pant','Ghagra','Blouse','Saree']]];
for(const [section,names] of catalog)names.push(...(data.customItems?.[section]||[]));
const items=catalog.flatMap(([,names])=>names);let quantities={};let openedBill=null;
const rateFor=name=>openedBill?.lines.find(line=>line.name===name)?.rate??Number(data.prices[name]||0);const money=n=>'₹'+Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2});
function persist(){localStorage.setItem(key,JSON.stringify(data))}
function renderItems(){
  let html='';
  for(const [index,[section,names]] of catalog.entries()){
    html+=`<h3 class="section-label">${section}</h3><table class="items"><thead><tr><th>Item</th><th>Rate</th><th>Qty</th><th>Amount</th></tr></thead><tbody>`;
    for(const name of names){let i=items.indexOf(name);html+=`<tr><td>${escapeHtml(name)}</td><td>${money(rateFor(name))}</td><td><input aria-label="${escapeHtml(name)} quantity" type="number" min="0" step="1" data-qty="${i}" value="${quantities[name]||0}"></td><td id="amount-${i}">₹0</td></tr>`}
    html+=`</tbody></table><details class="add-item bill-add"><summary>+ Add item</summary><div class="add-fields"><label>New item name<input data-bill-name="${index}" placeholder="e.g. Kurta"></label><label>Price ₹<input data-bill-price="${index}" type="number" min="0.01" step="0.01" placeholder="Per item"></label><button class="btn ghost" type="button" data-bill-add="${index}">Save item</button></div></details>`;
  }
  $('itemRows').innerHTML=html;
  document.querySelectorAll('[data-qty]').forEach(el=>el.oninput=()=>{quantities[items[el.dataset.qty]]=Math.max(0,Math.floor(Number(el.value)||0));calculate()});
  document.querySelectorAll('[data-bill-add]').forEach(button=>button.onclick=()=>{
    const index=Number(button.dataset.billAdd),name=$('itemRows').querySelector(`[data-bill-name="${index}"]`).value;
    const price=Number($('itemRows').querySelector(`[data-bill-price="${index}"]`).value);
    if(!Number.isFinite(price)||price<=0){showStatus('billStatus','Enter a price greater than zero for the new item.');return}
    const added=addCustomItem(index,name,price,'billStatus');
    if(added){renderItems();showStatus('billStatus',`${added} added. Enter its quantity above.`)}
  });
  calculate();
}
function calculate(){let total=0;items.forEach((name,i)=>{let amount=(quantities[name]||0)*rateFor(name);total+=amount;let cell=$('amount-'+i);if(cell)cell.textContent=money(amount)});$('total').textContent=money(total);$('summary').innerHTML=`<p><b>${escapeHtml($('customerName').value||'Customer name')}</b><br><small>Flat ${escapeHtml($('flatNo').value||'—')}</small><br><small>${escapeHtml($('address').value||'')}</small></p><p><small>${escapeHtml($('fromMonth').value||'Start month')} to ${escapeHtml($('toMonth').value||'End month')}</small></p><hr><p>${items.filter(x=>quantities[x]>0).length} item types</p>`;return total}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function currentBill(){const name=$('customerName').value.trim(),flat=$('flatNo').value.trim(),address=$('address').value.trim(),from=$('fromMonth').value,to=$('toMonth').value;if(!name||!flat||!from||!to)throw Error('Fill customer name, flat and both months.');if(from>to)throw Error('The start month must be before the end month.');if(!items.some(x=>quantities[x]>0))throw Error('Add at least one quantity.');if(items.some(x=>!Number.isInteger(Number(quantities[x]||0))||Number(quantities[x]||0)<0))throw Error('Quantities must be whole numbers of zero or more.');if(items.some(x=>quantities[x]>0&&rateFor(x)<=0))throw Error('Set prices for items with quantities.');return{id:openedBill?.id||crypto.randomUUID(),name,flat,address,phone:$('phone').value.trim(),from,to,lines:items.filter(x=>quantities[x]>0).map(x=>({name:x,qty:quantities[x],rate:rateFor(x)})),total:calculate(),savedAt:new Date().toISOString()}}
function showStatus(id,msg){$(id).textContent=msg}
function addCustomItem(index,value,price,statusId){
  const name=value.trim().replace(/\s+/g,' ');
  if(!name){showStatus(statusId,'Enter an item name first.');return null}
  if(items.some(item=>item.toLowerCase()===name.toLowerCase())){showStatus(statusId,'That item already exists.');return null}
  const section=catalog[index][0];(data.customItems??={})[section]??=[];data.customItems[section].push(name);
  catalog[index][1].push(name);items.push(name);
  if(price!==null)data.prices[name]=price;
  persist();return name;
}
function renderPrices(){
  $('priceRows').innerHTML=catalog.map(([section,names],index)=>`<h3 class="section-label">${section}</h3><div class="fields">${names.map(name=>`<label>${escapeHtml(name)}<input type="number" min="0" step="0.01" data-price="${escapeHtml(name)}" value="${data.prices[name]??''}" placeholder="₹ per item"></label>`).join('')}</div><details class="add-item"><summary>+ Add item</summary><div class="add-fields"><label>Add an item to ${section}<input data-new-item="${index}" placeholder="Item name, e.g. Kurta"></label><button class="btn ghost" data-add-item="${index}" type="button">Save item</button></div></details>`).join('');
  document.querySelectorAll('[data-add-item]').forEach(button=>button.onclick=()=>{
    const index=Number(button.dataset.addItem),input=$('priceRows').querySelector(`[data-new-item="${index}"]`),name=input.value.trim().replace(/\s+/g,' ');
    const enteredPrices=[...document.querySelectorAll('[data-price]')].map(el=>[el.dataset.price,el.value]);
    const added=addCustomItem(index,name,null,'priceStatus');if(!added){input.focus();return}
    renderPrices();renderItems();
    for(const [item,value] of enteredPrices){const price=[...document.querySelectorAll('[data-price]')].find(el=>el.dataset.price===item);price.value=value}
    showStatus('priceStatus',`${name} added. Set its price, then save prices.`);
  });
}
function renderCustomers(){let q=$('searchCustomer').value.toLowerCase();$('customerList').innerHTML=data.bills.filter(b=>[b.name,b.flat,b.address||''].some(x=>x.toLowerCase().includes(q))).map(b=>`<div class="customer"><div><b>${escapeHtml(b.name)}</b> <small>· ${escapeHtml(b.flat)}</small><div><small>${escapeHtml(b.from)} to ${escapeHtml(b.to)} · ${money(b.total)}</small></div></div><button data-load="${b.id}">Open bill</button></div>`).join('')||'<p class="muted">No saved bills yet.</p>';document.querySelectorAll('[data-load]').forEach(el=>el.onclick=()=>{let b=data.bills.find(x=>x.id===el.dataset.load);openedBill=b;$('customerName').value=b.name;$('flatNo').value=b.flat;$('phone').value=b.phone||'';$('address').value=b.address||'';$('fromMonth').value=b.from;$('toMonth').value=b.to;quantities=Object.fromEntries(b.lines.map(x=>[x.name,x.qty]));renderItems();switchTab('bill')})}
function switchTab(tab){document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));['bill','customers','settings'].forEach(x=>$(x).classList.toggle('hidden',x!==tab));if(tab==='customers')renderCustomers();if(tab==='settings')renderPrices()}document.querySelectorAll('.tabs button').forEach(x=>x.onclick=()=>switchTab(x.dataset.tab));['customerName','flatNo','phone','fromMonth','toMonth','address'].forEach(id=>$(id).oninput=calculate);$('savePrices').onclick=()=>{for(const el of document.querySelectorAll('[data-price]')){let n=Number(el.value);if(el.value!==''&&(!Number.isFinite(n)||n<0)){showStatus('priceStatus','Prices must be zero or more.');return}data.prices[el.dataset.price]=el.value===''?0:n}persist();renderItems();showStatus('priceStatus','Prices saved. New bills use these rates.')};
$('saveBill').onclick=()=>{try{let b=currentBill();data.bills=data.bills.filter(x=>x.id!==b.id);data.bills.unshift(b);openedBill=b;persist();showStatus('billStatus','Bill saved for '+b.name+'.')}catch(e){showStatus('billStatus',e.message)}};
$('printBill').onclick=()=>{try{currentBill();window.print()}catch(e){showStatus('billStatus',e.message)}};
$('sendBill').onclick=()=>{try{let b=currentBill();let text=`Maharashtra Dry Cleaners\nBill for ${b.name} (Flat ${b.flat})\n${b.address?`Address: ${b.address}\n`:''}${b.from} to ${b.to}\n`+b.lines.map(x=>`${x.name}: ${x.qty} × ${money(x.rate)} = ${money(x.qty*x.rate)}`).join('\n')+`\nTotal: ${money(b.total)}`;let phone=b.phone.replace(/\D/g,'');if(!/^(91)?[6-9]\d{9}$/.test(phone))throw Error('Enter a valid WhatsApp mobile number.');window.open(`https://wa.me/${phone.length===10?'91'+phone:phone}?text=${encodeURIComponent(text)}`,'_blank');showStatus('billStatus','WhatsApp opened with the bill ready to send.')}catch(e){showStatus('billStatus',e.message)}};
$('newBill').onclick=()=>{['customerName','flatNo','phone','fromMonth','toMonth','address'].forEach(id=>$(id).value='');quantities={};openedBill=null;renderItems();showStatus('billStatus','');switchTab('bill')};
$('searchCustomer').oninput=renderCustomers;let now=new Date();$('fromMonth').value=$('toMonth').value=now.toISOString().slice(0,7);renderItems();
