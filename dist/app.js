
const $=id=>document.getElementById(id);const key='maharashtra-bills-v1';let data=JSON.parse(localStorage.getItem(key)||'{"prices":{},"bills":[]}');let cloudClient=null,cloudUser=null,cloudSave=Promise.resolve();
const catalog=[['Press',['Normal press','Saree press','Steam normal press','Steam saree press']],['Dry clean · Top',['Salwar (top)','Shirt','Coat','Sherwani','Dupatta']],['Dry clean · Bottom',['Salwar (bottom)','Pant','Ghagra','Blouse','Saree']]];
for(const [section,names] of catalog)names.push(...(data.customItems?.[section]||[]));
let items=catalog.flatMap(([,names])=>names);let quantities={};let openedBill=null;
const draftKey=key+'-draft',draftFields=['customerName','flatNo','phone','address','periodType','billDate','fromMonth','fromYear','toMonth','toYear'];
function saveDraft(){sessionStorage.setItem(draftKey,JSON.stringify({fields:Object.fromEntries(draftFields.map(id=>[id,$(id).value])),quantities,openedBillId:openedBill?.id}))}
function restoreDraft(){const saved=sessionStorage.getItem(draftKey);if(!saved)return;try{const draft=JSON.parse(saved);for(const id of draftFields)if(typeof draft.fields?.[id]==='string')$(id).value=draft.fields[id];quantities=draft.quantities||{};openedBill=data.bills.find(b=>b.id===draft.openedBillId)||null;updatePeriodMode();renderItems()}catch{sessionStorage.removeItem(draftKey)}}
const rateFor=name=>openedBill?.lines.find(line=>line.name===name)?.rate??Number(data.prices[name]||0);const money=n=>'₹'+Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2});
function persist(){
  if(!cloudClient){localStorage.setItem(key,JSON.stringify(data));return Promise.resolve(true)}
  const snapshot=structuredClone(data),userId=cloudUser.id;
  const pending=cloudSave.then(async()=>{const {error}=await cloudClient.from('shop_state').upsert({owner_id:userId,data:snapshot});if(error)throw error});
  cloudSave=pending.catch(()=>{});
  return pending.then(()=>true,e=>{showStatus('billStatus','Could not save to Supabase: '+e.message);return false});
}
function loadCloudData(next){data=next;for(const [index,[,names]] of catalog.entries()){names.splice([4,5,5][index]);names.push(...(data.customItems?.[catalog[index][0]]||[]))}items=catalog.flatMap(([,names])=>names);quantities={};openedBill=null;renderItems();renderPrices();restoreDraft()}

function renderItems(){
  let html='';
  for(const [index,[section,names]] of catalog.entries()){
    html+=`<h3 class="section-label">${section}</h3><table class="items"><thead><tr><th>Item</th><th>Rate</th><th>Qty</th><th>Amount</th></tr></thead><tbody>`;
    for(const name of names){let i=items.indexOf(name);html+=`<tr><td>${escapeHtml(name)}</td><td>${money(rateFor(name))}</td><td><input aria-label="${escapeHtml(name)} quantity" type="number" min="0" step="1" data-qty="${i}" value="${quantities[name]||''}" placeholder="0"></td><td id="amount-${i}">₹0</td></tr>`}
    html+=`</tbody></table><details class="add-item bill-add"><summary>+ Add item</summary><div class="add-fields"><label>New item name<input data-bill-name="${index}" placeholder="e.g. Kurta"></label><label>Price ₹<input data-bill-price="${index}" type="number" min="0.01" step="0.01" placeholder="Per item"></label><button class="btn ghost" type="button" data-bill-add="${index}">Save item</button></div></details>`;
  }
  $('itemRows').innerHTML=html;
  document.querySelectorAll('[data-qty]').forEach(el=>el.oninput=()=>{quantities[items[el.dataset.qty]]=el.value===''?0:Number(el.value);calculate()});
  document.querySelectorAll('[data-bill-add]').forEach(button=>button.onclick=()=>{
    const index=Number(button.dataset.billAdd),name=$('itemRows').querySelector(`[data-bill-name="${index}"]`).value;
    const price=Number($('itemRows').querySelector(`[data-bill-price="${index}"]`).value);
    if(!Number.isFinite(price)||price<=0||Math.abs(price*100-Math.round(price*100))>1e-8){showStatus('billStatus','Enter a positive price with up to two decimal places.');return}
    const added=addCustomItem(index,name,price,'billStatus');
    if(added){renderItems();showStatus('billStatus',`${added} added. Enter its quantity above.`)}
  });
  calculate();
}
function period(id){return $(''+id+'Year').value+'-'+$(''+id+'Month').value}
function todayDate(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function formatDate(date){return date?new Date(date+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'}):'Choose a date'}
function periodLabel(b){return b.date?formatDate(b.date):`${b.from} to ${b.to}`}
function billAddress(b){return [b.flat?`Flat ${b.flat}`:'',b.address].filter(Boolean).join(' · ')}
function updatePeriodMode(){const single=$('periodType').value==='date';$('monthRange').classList.toggle('hidden',single);$('specificDateField').classList.toggle('hidden',!single);calculate()}
function calculate(){let totalPaise=0;items.forEach((name,i)=>{let amountPaise=(quantities[name]||0)*Math.round(rateFor(name)*100);totalPaise+=amountPaise;let cell=$('amount-'+i);if(cell){cell.textContent=money(amountPaise/100);cell.closest('tr').classList.toggle('selected',quantities[name]>0)}});const total=totalPaise/100;$('total').textContent=money(total);const address=billAddress({flat:$('flatNo').value,address:$('address').value});const when=$('periodType').value==='date'?formatDate($('billDate').value):`${period('from')} to ${period('to')}`;$('summary').innerHTML=`<p><b>${escapeHtml($('customerName').value||'Customer name')}</b>${address?`<br><small>${escapeHtml(address)}</small>`:''}</p><p><small>${escapeHtml(when)}</small></p><hr><p>${items.filter(x=>quantities[x]>0).length} item types</p>`;return total}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function currentBill(){const name=$('customerName').value.trim(),phone=$('phone').value.trim(),flat=$('flatNo').value.trim(),address=$('address').value.trim();if(!name)throw Error('Enter customer name.');if(!/^(91)?[6-9]\d{9}$/.test(phone.replace(/\D/g,'')))throw Error('Enter a valid WhatsApp mobile number.');let dates;if($('periodType').value==='date'){const date=$('billDate').value;if(!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date)||(!Number.isFinite(new Date(date+'T12:00:00Z').getTime())||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date))throw Error('Choose a valid bill date.');dates={date}}else{const from=period('from'),to=period('to');if(!$('fromMonth').value||!$('toMonth').value||!$('fromYear').value||!$('toYear').value)throw Error('Choose both months.');if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(from)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(to))throw Error('Enter a valid month and year.');if(from>to)throw Error('The start month must be before the end month.');dates={from,to}}if(!items.some(x=>quantities[x]>0))throw Error('Add at least one quantity.');if(items.some(x=>!Number.isInteger(Number(quantities[x]||0))||Number(quantities[x]||0)<0))throw Error('Quantities must be whole numbers of zero or more.');if(items.some(x=>quantities[x]>0&&rateFor(x)<=0))throw Error('Set prices for items with quantities.');return{id:openedBill?.id||crypto.randomUUID(),name,flat,address,phone,...dates,lines:items.filter(x=>quantities[x]>0).map(x=>({name:x,qty:quantities[x],rate:rateFor(x)})),total:calculate(),savedAt:new Date().toISOString()}}
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
function renderCustomers(){let q=$('searchCustomer').value.toLowerCase();$('customerList').innerHTML=data.bills.filter(b=>[b.name,b.flat||'',b.address||''].some(x=>x.toLowerCase().includes(q))).map(b=>`<div class="customer"><div><b>${escapeHtml(b.name)}</b>${b.flat?` <small>· ${escapeHtml(b.flat)}</small>`:''}<div><small>${escapeHtml(periodLabel(b))} · ${money(b.total)}</small></div></div><button data-load="${b.id}">Open bill</button></div>`).join('')||'<p class="muted">No saved bills yet.</p>';document.querySelectorAll('[data-load]').forEach(el=>el.onclick=()=>{let b=data.bills.find(x=>x.id===el.dataset.load);openedBill=b;$('customerName').value=b.name;$('flatNo').value=b.flat||'';$('phone').value=b.phone||'';$('address').value=b.address||'';$('periodType').value=b.date?'date':'range';if(b.date)$('billDate').value=b.date;else{$('fromMonth').value=b.from.slice(5);$('toMonth').value=b.to.slice(5);$('fromYear').value=b.from.slice(0,4);$('toYear').value=b.to.slice(0,4)}quantities=Object.fromEntries(b.lines.map(x=>[x.name,x.qty]));updatePeriodMode();renderItems();saveDraft();switchTab('bill')})}
function switchTab(tab){document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));['bill','customers','settings'].forEach(x=>$(x).classList.toggle('hidden',x!==tab));if(tab==='customers')renderCustomers();if(tab==='settings')renderPrices()}document.querySelectorAll('.tabs button').forEach(x=>x.onclick=()=>switchTab(x.dataset.tab));['customerName','flatNo','phone','fromMonth','toMonth','fromYear','toYear','billDate','address'].forEach(id=>$(id).oninput=calculate);$('periodType').onchange=updatePeriodMode;$('savePrices').onclick=async()=>{const prices=[...document.querySelectorAll('[data-price]')];if(prices.some(el=>el.value!==''&&(!Number.isFinite(Number(el.value))||Number(el.value)<0||Math.abs(Number(el.value)*100-Math.round(Number(el.value)*100))>1e-8))){showStatus('priceStatus','Prices must be zero or more, with up to two decimal places.');return}for(const el of prices)data.prices[el.dataset.price]=el.value===''?0:Number(el.value);if(await persist()){renderItems();showStatus('priceStatus','Prices saved. New bills use these rates.')}else showStatus('priceStatus','Could not save prices to Supabase.')};
$('saveBill').onclick=async()=>{try{let b=currentBill();data.bills=data.bills.filter(x=>x.id!==b.id);data.bills.unshift(b);openedBill=b;if(await persist()){saveDraft();showStatus('billStatus','Bill saved for '+b.name+'.')}}catch(e){showStatus('billStatus',e.message)}};
function showInvoice(b){const date=new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'});$('invoice').innerHTML=`<div class=invoice-top><div class=invoice-logo><div class=invoice-mark>महाराष्ट्र</div><div class=invoice-brand>ड्रायक्लिनर्स</div><div class=invoice-tag>Maharashtra Dry Cleaners</div></div><div class=invoice-title>INVOICE<span>${escapeHtml(date)}</span></div></div><div class=invoice-stripe></div><div class=invoice-meta><div><small>BILLED TO</small><strong>${escapeHtml(b.name)}</strong>${billAddress(b)?`<span>${escapeHtml(billAddress(b))}</span>`:''}<span>${escapeHtml(b.phone)}</span></div><div><small>${b.date?'BILL DATE':'SERVICE PERIOD'}</small><strong>${escapeHtml(periodLabel(b))}</strong><span>Mumbai, Maharashtra</span></div></div><table class=invoice-items><thead><tr><th>SERVICE</th><th>QTY</th><th>RATE</th><th>AMOUNT</th></tr></thead><tbody>${b.lines.map(line=>`<tr><td>${escapeHtml(line.name)}</td><td>${line.qty}</td><td>${money(line.rate)}</td><td>${money(line.qty*line.rate)}</td></tr>`).join('')}</tbody></table><div class=invoice-total><span>TOTAL AMOUNT</span><strong>${money(b.total)}</strong></div><div class=invoice-footer><div><strong>Thank you for choosing us.</strong><span>Fresh care for every garment.</span></div><div>9930156507 · 8291119298<br>Mumbai · Pressing & Dry Cleaning</div></div>`;}
$('printBill').onclick=()=>{try{showInvoice(currentBill());window.print()}catch(e){showStatus('billStatus',e.message)}};
// shortcut: the PDF is a rasterized invoice; use a PDF layout engine if selectable text is needed.
async function billPdf(b){
  if(!window.html2pdf)throw Error('PDF generator could not load. Check your internet connection.');
  showInvoice(b);
  $('invoice').classList.add('pdf-render');
  try{return await html2pdf().set({margin:14,html2canvas:{scale:2},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}}).from($('invoice')).outputPdf('blob')}
  finally{$('invoice').classList.remove('pdf-render')}
}
function pdfBase64(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(Error('Could not read the bill PDF.'));reader.readAsDataURL(blob)})}
$('sendBill').onclick=async()=>{let chat;try{
  const b=currentBill(),message='Thank you for shopping with Maharashtra Dry Cleaners. Your bill is attached below.';
  const automatic=Boolean(cloudClient&&window.SHOP_WHATSAPP_AUTO);
  if(!automatic){chat=window.open('about:blank','_blank');if(!chat)throw Error('Allow pop-ups to open WhatsApp.')}
  if(cloudClient){
    data.bills=data.bills.filter(x=>x.id!==b.id);data.bills.unshift(b);openedBill=b;
    if(!await persist()){chat?.close();return}
    saveDraft();
  }
  const pdf=await billPdf(b);
  if(automatic){
    if(pdf.size>5_000_000)throw Error('Bill PDF is too large to send.');
    const {data:result,error}=await cloudClient.functions.invoke('send-bill',{body:{billId:b.id,pdf:await pdfBase64(pdf)}});
    if(error){let message=error.message;try{message=(await error.context.json()).message||message}catch{}throw Error(message)}
    showStatus('billStatus',result?.message||'Bill accepted by Meta.');
    return;
  }
  const url=URL.createObjectURL(pdf),link=document.createElement('a');
  link.href=url;link.download=`Bill-${b.name.replace(/[^a-z0-9-]+/gi,'-')}.pdf`;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
  const phone=b.phone.replace(/\D/g,'');
  chat.location.href=`https://wa.me/${phone.length===10?'91'+phone:phone}?text=${encodeURIComponent(message)}`;
  showStatus('billStatus','WhatsApp opened. Send the thank-you message, then attach the downloaded bill PDF.');
}catch(e){chat?.close();showStatus('billStatus',e.message)}};
$('newBill').onclick=()=>{['customerName','flatNo','phone','address'].forEach(id=>$(id).value='');$('fromMonth').value=$('toMonth').value=String(new Date().getMonth()+1).padStart(2,'0');$('fromYear').value=$('toYear').value=String(new Date().getFullYear());$('periodType').value='range';$('billDate').value=todayDate();quantities={};openedBill=null;updatePeriodMode();renderItems();showStatus('billStatus','');sessionStorage.removeItem(draftKey);switchTab('bill')};
$('searchCustomer').oninput=renderCustomers;let now=new Date();for(const id of ['from','to']){$(id+'Month').innerHTML=Array.from({length:12},(_,i)=>`<option value="${String(i+1).padStart(2,'0')}">${new Date(2000,i).toLocaleString('en-IN',{month:'long'})}</option>`).join('');$(id+'Year').innerHTML=Array.from({length:201},(_,i)=>`<option>${1900+i}</option>`).join('');$(id+'Month').value=String(now.getMonth()+1).padStart(2,'0');$(id+'Year').value=String(now.getFullYear())}$('billDate').value=todayDate();renderItems();restoreDraft();$('bill').addEventListener('input',saveDraft);$('bill').addEventListener('change',saveDraft);
