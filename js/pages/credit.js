/* =====================================================
   js/pages/credit.js - Store Credit Management & Settlements
   ===================================================== */

/* ---------- Customer credit balance ---------- */
function customerCreditBalance(customerId){
  const db = window.DB || {};
  const c = db.getCustomer ? db.getCustomer(customerId) : (db.customers || []).find(x => x.id === customerId);
  const custName = c?.name;
  const custSales = (db.sales || []).filter(s =>
    (s.customerId === customerId || (custName && s.customer === custName))
    && s.method === 'credit'
  );
  const owed = custSales.reduce((a,s) => a + (s.total || 0), 0);

  const paid = (db.payments || [])
    .filter(p => p.customerId === customerId)
    .reduce((a,p) => a + (p.amount || 0), 0);

  return { owed, paid, balance: Math.max(0, owed - paid) };
}

/* ---------- Open credit payment modal ---------- */
function openCreditPayment(customerId){
  if(typeof requireActiveShift === 'function' && !requireActiveShift('credit payment')) return;

  const db = window.DB || {};
  const c = db.getCustomer ? db.getCustomer(customerId) : (db.customers || []).find(x => x.id === customerId);
  if(!c){
    toast('පාරිභෝගිකයා හමු නොවීය', 'err');
    return;
  }

  const credit = customerCreditBalance(customerId);
  if(credit.balance <= 0){
    toast('මෙම පාරිභෝගිකයාට ගෙවීමට ණයක් නැත', 'warn');
    return;
  }

  /* Unpaid invoices */
  const unpaid = (db.sales || [])
    .filter(s => (s.customerId === customerId || (!s.customerId && s.customer === c.name)) && s.method === 'credit')
    .sort((a,b) => new Date(b.date) - new Date(a.date));

  openModal(`💵 ණය පියවීම — ${esc(c.name)}`, `Credit Settlement · ${esc(c.vehicle || c.phone || '')}`,
  `<div style="background:#0b1220;border:1px solid var(--line);border-radius:12px;padding:16px;margin-bottom:16px">
     <div class="srow"><span>මුළු ණය මුදල</span><b>${money(credit.owed)}</b></div>
     <div class="srow"><span>මෙතෙක් ගෙවා ඇති මුදල</span><b style="color:var(--green)">+ ${money(credit.paid)}</b></div>
     <div class="srow total" style="font-size:18px;margin-top:8px;padding-top:8px">
       <span>ගෙවීමට ඇති ශේෂය</span>
       <span style="color:var(--red)">${money(credit.balance)}</span>
     </div>
   </div>

   <div>
     <label style="font-size:12px;color:var(--muted);font-weight:600">දැන් ගෙවන මුදල / Payment Amount *</label>
     <input id="cpAmount" type="number" value="${credit.balance}" min="1" max="${credit.balance}"
            style="font-size:22px;font-weight:700;text-align:right;padding:12px;margin-top:6px">
   </div>

   <div class="quick-cash" style="margin-top:8px">
     <button type="button" onclick="document.getElementById('cpAmount').value=${credit.balance}">සම්පූර්ණ (${num(credit.balance)})</button>
     <button type="button" onclick="document.getElementById('cpAmount').value=${Math.round(credit.balance/2)}">50%</button>
     <button type="button" onclick="document.getElementById('cpAmount').value=1000">රු. 1,000</button>
     <button type="button" onclick="document.getElementById('cpAmount').value=5000">රු. 5,000</button>
     <button type="button" onclick="document.getElementById('cpAmount').value=10000">රු. 10,000</button>
   </div>

   <div class="grid2" style="margin-top:14px">
     <div>
       <label style="font-size:11.5px;color:var(--muted);font-weight:600">ගෙවීම් ක්‍රමය / Method</label>
       <select id="cpMethod" style="margin-top:4px">
         <option value="cash">💵 මුදල් (Cash — ලාච්චුවට)</option>
         <option value="card">💳 කාඩ් (Card / POS)</option>
         <option value="bank">🏦 බැංකු තැන්පතු (Bank Transfer)</option>
       </select>
     </div>
     <div>
       <label style="font-size:11.5px;color:var(--muted);font-weight:600">සටහන / Ref Note</label>
       <input id="cpNotes" placeholder="උදා: Slip අංකය හෝ සටහන" style="margin-top:4px">
     </div>
   </div>

   ${unpaid.length ? `
   <div style="margin-top:16px">
     <label style="font-size:11.5px;color:var(--muted);font-weight:600">ණයට ගත් බිල්පත් ලැයිස්තුව (${unpaid.length})</label>
     <div style="max-height:130px;overflow-y:auto;border:1px solid var(--line);border-radius:9px;padding:8px;margin-top:6px;background:rgba(0,0,0,0.2)">
       ${unpaid.map(s => `
         <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;font-size:12px;border-bottom:1px dashed rgba(255,255,255,0.07)">
           <span><b>${s.no}</b> · <small style="color:var(--muted)">${new Date(s.date).toLocaleDateString('en-GB')}</small></span>
           <b style="color:var(--primary)">${money(s.total)}</b>
         </div>`).join('')}
     </div>
   </div>` : ''}`,
  `<button class="btn" onclick="closeModal()">අවලංගු</button>
   <button class="btn btn-green" style="padding:10px 24px;font-weight:700"
           onclick="submitCreditPayment('${customerId}')">✅ ගෙවීම ලබාගන්න</button>`,
  false);

  setTimeout(() => document.getElementById('cpAmount')?.select(), 100);
}

async function submitCreditPayment(customerId){
  if(typeof requireActiveShift === 'function' && !requireActiveShift('credit payment')) return;

  const amount = parseFloat($('#cpAmount')?.value) || 0;
  if(amount <= 0){
    toast('කරුණාකර වලංගු මුදලක් ඇතුළත් කරන්න', 'err');
    return;
  }

  const credit = customerCreditBalance(customerId);
  if(amount > credit.balance + 0.01){
    toast('ශේෂයට වඩා වැඩි මුදලක් ගෙවිය නොහැක', 'err');
    return;
  }

  const db = window.DB || {};
  const c = db.getCustomer ? db.getCustomer(customerId) : (db.customers || []).find(x => x.id === customerId);
  const method = $('#cpMethod')?.value || 'cash';
  const notes = $('#cpNotes')?.value.trim() || '';

  const activeShift = (typeof Shift !== 'undefined' && state.user) ? Shift.getActive(state.user.id) : null;
  const payId = 'PAY-' + pad(db.counters.payment = (db.counters.payment || 0) + 1);

  const payment = {
    id: uid('PAY'),
    no: payId,
    shopId: (typeof currentShopId === 'function' && currentShopId()) ? currentShopId() : (window.state?.user?.shopId || 'SHOP-001'),
    customerId,
    customerName: c ? c.name : 'පාරිභෝගික',
    amount,
    method,
    notes,
    date: today(),
    timestamp: new Date().toISOString(),
    cashier: state.user ? state.user.name : 'කැෂියර්',
    shiftId: activeShift ? activeShift.id : null
  };

  if(!db.payments) db.payments = [];
  db.payments.push(payment);

  // If cash method & active shift: record Cash-In into shift drawer
  if(method === 'cash' && activeShift){
    if(!db.cashMoves) db.cashMoves = [];
    const move = {
      id: uid('CM'),
      shopId: (typeof currentShopId === 'function' && currentShopId()) ? currentShopId() : (window.state?.user?.shopId || 'SHOP-001'),
      shiftId: activeShift.id,
      type: 'in',
      amount,
      reason: 'ණය ගෙවීම',
      notes: `${c ? c.name : ''} — ${payId}`,
      date: today(),
      timestamp: new Date().toISOString(),
      by: state.user ? state.user.name : 'කැෂියර්'
    };
    db.cashMoves.push(move);
    if(window.FB && window.FB.fbAdd){
      (window.shopAdd ? window.shopAdd(window.FB.COL.cashMoves, move) : window.FB.fbAdd(window.FB.COL.cashMoves, move));
    }
  }

  // Update customer balance in state
  if(c){
    c.creditBalance = Math.max(0, credit.balance - amount);
    if(window.FB && window.FB.fbUpdate) window.FB.fbUpdate(window.FB.COL.customers, customerId, { creditBalance: c.creditBalance });
  }

  // Firestore sync for payment
  if(window.FB && window.FB.fbAdd){
    (window.shopAdd ? window.shopAdd(window.FB.COL.payments, payment) : window.FB.fbAdd(window.FB.COL.payments, payment));
  }

  if(typeof saveDB === 'function') saveDB();

  closeModal();
  toast(`✅ ණය ගෙවීම සාර්ථකයි — රු. ${num(amount)} ලබාගත්තා`);

  if(typeof updateShiftIndicator === 'function') updateShiftIndicator();
  if(typeof render === 'function') render();
}

window.customerCreditBalance = customerCreditBalance;
window.openCreditPayment = openCreditPayment;
window.submitCreditPayment = submitCreditPayment;
