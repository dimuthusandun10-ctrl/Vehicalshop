/* =====================================================
   js/shift.js — Cashier shift / drawer reconciliation & Petty Cash
   ===================================================== */

const Shift = {

  /* ---------- currently open shift for this user ---------- */
  getActive(userId){
    const db = (typeof DB !== 'undefined' && DB) ? DB : (window.DB || null);
    if(!db || !db.shifts) return null;
    return db.shifts.find(s => s.cashierId === userId && s.status === 'open') || null;
  },

  /* ---------- open a new shift ---------- */
  open(userId, userName, openingFloat, notes){
    const db = (typeof DB !== 'undefined' && DB) ? DB : (window.DB || null);
    if(!db) return null;
    if(!db.counters) db.counters = { invoice: 1, grn: 1, ret: 1, shift: 1, payment: 1 };
    if(!db.counters.shift) db.counters.shift = 1;
    if(!db.shifts) db.shifts = [];

    const sh = {
      id: 'SH' + pad(db.counters.shift++, 3),
      shopId: (typeof currentShopId === 'function' && currentShopId()) ? currentShopId() : (window.state?.user?.shopId || 'SHOP-001'),
      cashierId: userId,
      cashierName: userName,
      openedAt: new Date().toISOString(),
      closedAt: null,
      openingFloat: Number(openingFloat) || 0,
      closingCount: null,
      variance: null,
      status: 'open',
      openNotes: notes || '',
      closeNotes: '',
      summary: null
    };
    db.shifts.push(sh);

    if(window.FB && window.FB.fbSet){
      window.FB.fbSet(window.FB.COL.shifts, sh.id, sh);
    }
    if(typeof saveDB === 'function') saveDB();
    return sh;
  },

  /* ---------- calculate current summary ---------- */
  summary(shiftId){
    const db = (typeof DB !== 'undefined' && DB) ? DB : (window.DB || null);
    if(!db || !db.shifts) return null;
    const sh = db.shifts.find(s => s.id === shiftId);
    if(!sh) return null;

    const sales = (db.sales || []).filter(s => s.shiftId === shiftId);

    const cashSales   = sales.filter(s => s.method === 'cash').reduce((a,s) => a + (s.total || 0), 0);
    const cardSales   = sales.filter(s => s.method === 'card').reduce((a,s) => a + (s.total || 0), 0);
    const creditSales = sales.filter(s => s.method === 'credit').reduce((a,s) => a + (s.total || 0), 0);
    const discounts   = sales.reduce((a,s) => a + (s.disc || 0), 0);

    /* ⭐ Cash returns only (Card returns do not deduct from physical cash drawer) */
    const returnCashOutMoves = (db.cashMoves || []).filter(m => m.shiftId === shiftId && m.type === 'out' && m.refId);
    const cashRefunds = (db.returns || [])
      .filter(r => r.status === 'approved' && r.shiftId === shiftId && (r.refundMethod === 'cash' || !r.refundMethod) && !returnCashOutMoves.some(m => m.refId === r.id))
      .reduce((a,r) => a + (r.amount || 0), 0);

    /* ⭐ Petty Cash Movements */
    const cashIn = (db.cashMoves || [])
      .filter(m => m.shiftId === shiftId && m.type === 'in')
      .reduce((a,m) => a + (m.amount || 0), 0);

    const cashOut = (db.cashMoves || [])
      .filter(m => m.shiftId === shiftId && m.type === 'out')
      .reduce((a,m) => a + (m.amount || 0), 0);

    const expected = sh.openingFloat + cashSales + cashIn - cashOut - cashRefunds;

    return {
      invoices: sales.length,
      cashSales,
      cardSales,
      creditSales,
      totalSales: cashSales + cardSales + creditSales,
      discounts,
      cashRefunds,
      refunds: cashRefunds,
      cashIn,
      cashOut,
      expected: Math.max(0, expected)
    };
  },

  /* ---------- close the shift ---------- */
  close(shiftId, closingCount, notes){
    const db = (typeof DB !== 'undefined' && DB) ? DB : (window.DB || null);
    if(!db || !db.shifts) return null;
    const sh = db.shifts.find(s => s.id === shiftId);
    if(!sh) return null;

    sh.closedAt     = new Date().toISOString();
    sh.closingCount = Number(closingCount) || 0;
    sh.closeNotes   = notes || '';
    sh.summary      = this.summary(shiftId);
    sh.variance     = sh.closingCount - (sh.summary ? sh.summary.expected : 0);
    sh.status       = 'closed';

    if(window.FB && window.FB.fbSet){
      window.FB.fbSet(window.FB.COL.shifts, sh.id, sh);
    }
    if(typeof saveDB === 'function') saveDB(true);
    if(window.DB && typeof window.DB._persistLocalNow === 'function') window.DB._persistLocalNow();
    return sh;
  },

  /* ---------- human-friendly duration ---------- */
  duration(shift){
    if(!shift || !shift.openedAt) return { hours: 0, minutes: 0, text: '0h 0m' };
    const start = new Date(shift.openedAt);
    const end   = shift.closedAt ? new Date(shift.closedAt) : new Date();
    const ms    = Math.max(0, end - start);
    const h     = Math.floor(ms / 3600000);
    const m     = Math.floor((ms % 3600000) / 60000);
    return { hours:h, minutes:m, text:`${h}h ${m}m` };
  },

  /* ---------- live drawer total (for topbar) ---------- */
  liveExpected(shiftId){
    const s = this.summary(shiftId);
    return s ? s.expected : 0;
  }
};

window.Shift = Shift;

function addCashOutToShift(shiftId, amount, reason, refId){
  if(!shiftId || !amount) return null;
  const db = (typeof DB !== 'undefined' && DB) ? DB : (window.DB || {});
  if(!db.cashMoves) db.cashMoves = [];

  const move = {
    id: uid('CM'),
    shopId: (typeof currentShopId === 'function' && currentShopId()) ? currentShopId() : (window.state?.user?.shopId || 'SHOP-001'),
    shiftId: shiftId,
    type: 'out',
    amount: Number(amount) || 0,
    reason: reason || 'Return Refund',
    refId: refId || null,
    notes: `Return Cash-Out · Ref: ${refId || '-'}`,
    date: today(),
    timestamp: new Date().toISOString(),
    processedBy: (state.user ? state.user.name : 'පරිපාලක'),
    by: (state.user ? state.user.name : 'පරිපාලක')
  };

  db.cashMoves.push(move);
  if(window.FB && window.FB.fbAdd){
    (window.shopAdd ? window.shopAdd(window.FB.COL.cashMoves, move) : window.FB.fbAdd(window.FB.COL.cashMoves, move));
  }
  if(typeof saveDB === 'function') saveDB();
  return move;
}
Shift.addCashOutToShift = addCashOutToShift;
window.addCashOutToShift = addCashOutToShift;

function requireActiveShift(actionLabel) {
  const user = (typeof state !== 'undefined' && state) ? state.user : null;
  const active = user ? Shift.getActive(user.id) : null;
  if (active) return active;

  // No shift — show blocking modal
  openModal(
    '🔒 Shift අවශ්‍යයි',
    'Shift Required — ' + (actionLabel || 'this action'),
  `<div style="text-align:center;padding:20px 10px">
     <div style="font-size:56px;margin-bottom:16px">🔒</div>
     <div style="font-size:15px;font-weight:600;margin-bottom:8px">
       කරුණාකර පළමුව Shift එකක් අරඹන්න
     </div>
     <div style="color:var(--muted);font-size:12.5px;line-height:1.6">
       මුදල් ලාච්චුවේ ආරම්භක මුදල සටහන් කර,<br>
       දිනයේ විකුණුම් නිවැරදිව track කිරීමට<br>
       Shift එකක් ආරම්භ කිරීම අනිවාර්යයි.
     </div>
   </div>`,
  `<button class="btn btn-primary" style="padding:12px 28px" 
          onclick="closeModal();openShiftModal()">
     🔓 Shift ආරම්භ කරන්න
   </button>`,
  false);
  return null;
}

window.requireActiveShift = requireActiveShift;

/* =====================================================
   OPEN SHIFT MODAL
   ===================================================== */
function openShiftModal(){
  openModal('🔓 Shift ආරම්භ කරන්න','Open Shift — Opening Balance',
  `<div style="text-align:center;padding:8px 0 16px">
     <div style="font-size:42px;margin-bottom:8px">💰</div>
     <p style="color:var(--muted);font-size:12.5px;line-height:1.6">
       දවස ආරම්භයේදී ලාච්චුවේ ඇති ආරම්භක මුදල පහතින් ඇතුළත් කරන්න.<br>
       මෙය දවස අවසානයේ reconcile කිරීමට භාවිතා වේ.
     </p>
   </div>
   <div>
     <label style="font-size:12px;color:var(--muted);font-weight:600">ආරම්භක මුදල / Opening Float</label>
     <input id="opFloat" type="number" value="5000" min="0" autofocus
            style="font-size:22px;font-weight:700;text-align:right;padding:14px;margin-top:6px">
   </div>
   <div style="margin-top:8px">
     <div class="quick-cash">
       <button type="button" onclick="document.getElementById('opFloat').value=0">0</button>
       <button type="button" onclick="document.getElementById('opFloat').value=2000">2,000</button>
       <button type="button" onclick="document.getElementById('opFloat').value=5000">5,000</button>
       <button type="button" onclick="document.getElementById('opFloat').value=10000">10,000</button>
     </div>
   </div>
   <div style="margin-top:14px">
     <label style="font-size:12px;color:var(--muted);font-weight:600">සටහන / Note (optional)</label>
     <input id="opNotes" placeholder="උදා: උදේ shift එක" style="margin-top:6px">
   </div>`,
  `<button class="btn btn-primary" style="padding:10px 24px;font-size:14px;font-weight:700" onclick="confirmOpenShift()">
     ✅ Shift ආරම්භ කරන්න
   </button>`,
  false);
  setTimeout(() => document.getElementById('opFloat')?.select(), 100);
}

function confirmOpenShift(){
  const floatInp = $('#opFloat');
  const floatVal = floatInp ? parseFloat(floatInp.value) : NaN;
  if(isNaN(floatVal) || floatVal < 0){ toast('මුදල වැරදියි','err'); return; }

  const noteInp = $('#opNotes');
  const notes = noteInp ? noteInp.value.trim() : '';

  Shift.open(state.user.id, state.user.name, floatVal, notes);
  closeModal();
  updateShiftIndicator();
  toast('🔓 Shift ආරම්භ කළා — ලාච්චුවේ රු. ' + num(floatVal));
  renderNav();
  if(typeof render === 'function') render();
}

/* =====================================================
   PETTY CASH: CASH-IN / CASH-OUT MODAL
   ===================================================== */
function openCashMoveModal(type){
  if(!requireActiveShift('cash movement')) return;

  const isIn = type === 'in';

  openModal(
    isIn ? '💰 Cash-In (මුදල් ඇතුළත් කිරීම)' : '💸 Cash-Out (මුදල් ඉවත් කිරීම)',
    isIn ? 'Petty Cash In' : 'Petty Cash Out / Expense',
  `<div style="text-align:center;padding:8px 0 16px">
     <div style="font-size:42px;margin-bottom:8px">${isIn ? '💰' : '💸'}</div>
     <p style="color:var(--muted);font-size:12.5px">
       ${isIn
         ? 'ලාච්චුවට අමතරව එකතු කරන මුදල (උදා: මාරු කාසි දැමීම, ණය ලැබීම්)'
         : 'ලාච්චුවෙන් වියදම් කරන මුදල (උදා: තේ බිල්, ප්‍රවාහන ගාස්තු, සුළු වියදම්)'}
     </p>
   </div>

   <div>
     <label style="font-size:12px;color:var(--muted);font-weight:600">මුදල / Amount *</label>
     <input id="cmAmount" type="number" value="1000" min="1" autofocus
            style="font-size:22px;font-weight:700;text-align:right;padding:12px;margin-top:6px">
   </div>

   <div class="quick-cash" style="margin-top:8px">
     <button type="button" onclick="document.getElementById('cmAmount').value=200">200</button>
     <button type="button" onclick="document.getElementById('cmAmount').value=500">500</button>
     <button type="button" onclick="document.getElementById('cmAmount').value=1000">1,000</button>
     <button type="button" onclick="document.getElementById('cmAmount').value=2000">2,000</button>
     <button type="button" onclick="document.getElementById('cmAmount').value=5000">5,000</button>
   </div>

   <div style="margin-top:14px">
     <label style="font-size:12px;color:var(--muted);font-weight:600">හේතුව / Reason *</label>
     <select id="cmReason" style="margin-top:6px">
       ${isIn
         ? `<option>අමතර මුදල් / Float Addition</option>
            <option>ණය පියවීම / Credit Collection</option>
            <option>වෙනත් ආදායම / Other</option>`
         : `<option>තේ / කෑම බීම වියදම්</option>
            <option>ප්‍රවාහන / Courier ගාස්තු</option>
            <option>ලිපි ද්‍රව්‍ය / Stationery</option>
            <option>විදුලි / ජල බිල්</option>
            <option>පිරිසිදු කිරීම් / Cleaning</option>
            <option>වෙනත් වියදම්</option>`}
     </select>
   </div>

   <div style="margin-top:12px">
     <label style="font-size:12px;color:var(--muted);font-weight:600">විස්තරාත්මක සටහන / Note (optional)</label>
     <input id="cmNotes" placeholder="උදා: සවස තේ බිල සඳහා" style="margin-top:6px">
   </div>`,
  `<button class="btn" onclick="closeModal()">අවලංගු</button>
   <button class="btn ${isIn ? 'btn-green' : 'btn-red'}" style="padding:10px 22px;font-weight:700"
           onclick="confirmCashMove('${type}')">
     ${isIn ? '💰 මුදල් එකතු කරන්න' : '💸 මුදල් ඉවත් කරන්න'}
   </button>`,
  false);

  setTimeout(() => document.getElementById('cmAmount')?.select(), 100);
}

async function confirmCashMove(type){
  const amt = parseFloat($('#cmAmount')?.value) || 0;
  if(amt <= 0){ toast('වලංගු මුදලක් ඇතුළත් කරන්න','err'); return; }

  const active = Shift.getActive(state.user.id);
  if(!active){ toast('ක්‍රියාකාරී Shift එකක් නැත','err'); return; }

  const db = window.DB || {};
  const summary = Shift.summary(active.id);

  // If Cash-Out, ensure we have enough physical cash
  if(type === 'out' && amt > summary.expected){
    toast(`ලාච්චුවේ ඇත්තේ රු. ${num(summary.expected)} පමණි. මුදල ප්‍රමාණවත් නොවේ!`,'err');
    return;
  }

  const reason = $('#cmReason')?.value || '';
  const notes = $('#cmNotes')?.value.trim() || '';

  const move = {
    id: uid('CM'),
    shopId: (typeof currentShopId === 'function' && currentShopId()) ? currentShopId() : (window.state?.user?.shopId || 'SHOP-001'),
    shiftId: active.id,
    type,
    amount: amt,
    reason,
    notes,
    date: today(),
    timestamp: new Date().toISOString(),
    by: state.user ? state.user.name : 'කැෂියර්'
  };

  if(!db.cashMoves) db.cashMoves = [];
  db.cashMoves.push(move);

  if(window.FB && window.FB.fbAdd){
    (window.shopAdd ? window.shopAdd(window.FB.COL.cashMoves, move) : window.FB.fbAdd(window.FB.COL.cashMoves, move));
  }
  if(typeof saveDB === 'function') saveDB();

  closeModal();
  updateShiftIndicator();
  toast(`✅ ${type==='in'?'Cash-In (+ රු. '+num(amt)+')':'Cash-Out (- රු. '+num(amt)+')'} සාර්ථකව සටහන් විය`);
  if(typeof render === 'function') render();
}

/* =====================================================
   SHIFT QUICK ACTION MENU (Topbar Click)
   ===================================================== */
function openShiftMenu(){
  const active = (typeof state !== 'undefined' && state.user) ? Shift.getActive(state.user.id) : null;
  if(!active){
    openShiftModal();
    return;
  }
  const s = Shift.summary(active.id);
  const dur = Shift.duration(active);

  openModal('🕐 Shift කළමනාකරණය', `Active Shift · ${esc(active.cashierName)} (${dur.text})`,
  `<div style="background:#0b1220;border:1px solid var(--line);border-radius:12px;padding:16px;margin-bottom:16px">
     <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:10px">
       <span>🔓 ආරම්භය: <b>${new Date(active.openedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</b></span>
       <span>🧾 බිල්පත්: <b>${s.invoices}</b></span>
     </div>
     <div class="srow"><span>ආරම්භක මුදල</span><b>${money(active.openingFloat)}</b></div>
     <div class="srow"><span>+ මුදල් විකුණුම්</span><b style="color:var(--green)">+ ${money(s.cashSales)}</b></div>
     ${s.cashIn > 0 ? `<div class="srow"><span>+ Cash-In (ඇතුළත් කළ)</span><b style="color:var(--green)">+ ${money(s.cashIn)}</b></div>` : ''}
     ${s.cashOut > 0 ? `<div class="srow"><span>- Cash-Out (වියදම්)</span><b style="color:var(--red)">− ${money(s.cashOut)}</b></div>` : ''}
     ${s.cashRefunds > 0 ? `<div class="srow"><span>- මුදල් ආපසු ගෙවීම්</span><b style="color:var(--red)">− ${money(s.cashRefunds)}</b></div>` : ''}
     <div class="srow total" style="font-size:18px;margin-top:8px;padding-top:8px">
       <span>දැනට ලාච්චුවේ තිබිය යුතු මුදල</span>
       <span style="color:var(--primary)">${money(s.expected)}</span>
     </div>
   </div>

   <div class="quick-actions" style="margin:0">
     <button class="qa-btn" onclick="closeModal();openCashMoveModal('in')">
       <div class="qa-ic" style="background:rgba(16,185,129,.15);color:#6ee7b7">💰</div>
       <div class="qa-t">Cash-In</div>
       <div class="qa-s">මුදල් ඇතුළත් කිරීම</div>
     </button>
     <button class="qa-btn" onclick="closeModal();openCashMoveModal('out')">
       <div class="qa-ic" style="background:rgba(239,68,68,.15);color:#fca5a5">💸</div>
       <div class="qa-t">Cash-Out</div>
       <div class="qa-s">වියදම් ඉවත් කිරීම</div>
     </button>
     <button class="qa-btn" onclick="closeModal();closeShiftModal()">
       <div class="qa-ic" style="background:rgba(245,158,11,.15);color:#fcd34d">🔒</div>
       <div class="qa-t">Shift අවසන්</div>
       <div class="qa-s">Count & Close</div>
     </button>
   </div>`,
  '<button class="btn" onclick="closeModal()">වසන්න</button>',
  false);
}

/* =====================================================
   CLOSE SHIFT MODAL
   ===================================================== */
function closeShiftModal(afterAction){
  const user = (typeof state !== 'undefined' && state) ? state.user : null;
  if(!user){ if(afterAction) afterAction(); return; }

  const active = Shift.getActive(user.id);
  if(!active){ if(afterAction) afterAction(); return; }

  const s = Shift.summary(active.id);
  if(!s){ if(afterAction) afterAction(); return; }

  const dur = Shift.duration(active);
  window._closingShiftId = active.id;
  window._closingAfter = afterAction;

  const db = (typeof DB !== 'undefined' && DB) ? DB : (window.DB || {});
  const cashSalesCount = (db.sales || []).filter(x => x.shiftId === active.id && x.method === 'cash').length;

  openModal('🔒 Shift අවසන් කරන්න','Close Shift — Cash Reconciliation',
  `<div style="background:#0b1220;border:1px solid var(--line);border-radius:12px;padding:16px;margin-bottom:16px">
     <div style="display:flex;justify-content:space-between;font-size:12.5px;color:var(--muted);margin-bottom:12px">
       <span>🔓 ආරම්භය: <b style="color:var(--txt)">${new Date(active.openedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</b></span>
       <span>⏱️ කාලය: <b style="color:var(--txt)">${dur.text}</b></span>
     </div>

     <div class="srow"><span>ආරම්භක මුදල</span><b>${money(active.openingFloat)}</b></div>
     <div class="srow"><span>+ මුදල් විකුණුම් (${cashSalesCount})</span>
       <b style="color:var(--green)">+ ${money(s.cashSales)}</b></div>
     ${s.cashIn > 0 ? `
     <div class="srow"><span>+ Cash-In (ඇතුළත් කළ)</span>
       <b style="color:var(--green)">+ ${money(s.cashIn)}</b></div>` : ''}
     ${s.cashOut > 0 ? `
     <div class="srow"><span>- Cash-Out (වියදම්)</span>
       <b style="color:var(--red)">− ${money(s.cashOut)}</b></div>` : ''}
     ${s.cashRefunds > 0 ? `
     <div class="srow"><span>- ආපසු භාරදීම් (මුදල්)</span>
       <b style="color:var(--red)">− ${money(s.cashRefunds)}</b></div>` : ''}

     <div class="srow total" style="font-size:20px;margin-top:12px;padding-top:12px">
       <span>ලාච්චුවේ තියෙන්න ඕන</span>
       <span style="color:var(--primary)">${money(s.expected)}</span>
     </div>
   </div>

   <div style="display:flex;gap:8px;margin-bottom:12px">
     <div style="flex:1;padding:10px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.25);border-radius:9px;text-align:center">
       <small style="color:var(--muted);font-size:10.5px">💳 කාඩ්</small>
       <b style="display:block;color:#6ee7b7;font-size:15px;margin-top:2px">${money(s.cardSales)}</b>
     </div>
     <div style="flex:1;padding:10px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);border-radius:9px;text-align:center">
       <small style="color:var(--muted);font-size:10.5px">📝 ණය</small>
       <b style="display:block;color:#fcd34d;font-size:15px;margin-top:2px">${money(s.creditSales)}</b>
     </div>
     <div style="flex:1;padding:10px;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.25);border-radius:9px;text-align:center">
       <small style="color:var(--muted);font-size:10.5px">🧾 බිල්පත්</small>
       <b style="display:block;color:#93c5fd;font-size:15px;margin-top:2px">${s.invoices}</b>
     </div>
     <div style="flex:1;padding:10px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);border-radius:9px;text-align:center">
       <small style="color:var(--muted);font-size:10.5px">🏷️ වට්ටම්</small>
       <b style="display:block;color:#fca5a5;font-size:15px;margin-top:2px">${money(s.discounts)}</b>
     </div>
   </div>

   <div>
     <label style="font-size:12px;color:var(--muted);font-weight:600">ගණන් කරන ලද මුදල / Counted Cash *</label>
     <input id="clCount" type="number" value="${s.expected}" min="0"
            style="font-size:22px;font-weight:700;text-align:right;padding:14px;margin-top:6px"
            oninput="previewVariance(${s.expected})">
     <div id="varBox" style="margin-top:10px;padding:12px;border-radius:9px;text-align:center;font-weight:600"></div>
   </div>

   <div style="margin-top:14px">
     <label style="font-size:12px;color:var(--muted);font-weight:600">සටහන / Note (optional)</label>
     <input id="clNotes" placeholder="උදා: හැම දෙයක්ම හරි" style="margin-top:6px">
   </div>`,
  `<button class="btn" onclick="cancelShiftClose()">අවලංගු</button>
   <button class="btn btn-green" style="padding:10px 20px" onclick="confirmCloseShift()">
     🔒 Shift අවසන් කරන්න
   </button>`,
  false);

  previewVariance(s.expected);
}

function previewVariance(expected){
  const counted = parseFloat($('#clCount')?.value) || 0;
  const diff = counted - expected;
  const box = $('#varBox');
  if(!box) return;

  if(Math.abs(diff) < 0.01){
    box.style.background = 'rgba(16,185,129,.12)';
    box.style.color = '#6ee7b7';
    box.innerHTML = '✅ හරියටම ගැලපේ / Balanced';
  } else if(diff > 0){
    box.style.background = 'rgba(245,158,11,.12)';
    box.style.color = '#fcd34d';
    box.innerHTML = `⚠️ වැඩිපුර ${money(diff)} / Over`;
  } else {
    box.style.background = 'rgba(239,68,68,.12)';
    box.style.color = '#fca5a5';
    box.innerHTML = `❌ අඩුවීම ${money(Math.abs(diff))} / Short`;
  }
}

function cancelShiftClose(){
  closeModal();
  window._closingShiftId = null;
  window._closingAfter = null;
}

function confirmCloseShift(){
  const id = window._closingShiftId;
  const clInp = $('#clCount');
  const counted = clInp ? parseFloat(clInp.value) : NaN;
  if(isNaN(counted) || counted < 0){ toast('මුදල වැරදියි','err'); return; }

  const noteInp = $('#clNotes');
  const after = window._closingAfter;
  window._closingShiftId = null;
  window._closingAfter = null;

  const sh = Shift.close(id, counted, noteInp ? noteInp.value.trim() : '');

  closeModal();
  updateShiftIndicator();

  /* Show closing receipt */
  if(sh){
    showShiftReceipt(sh, after);
  } else if(after){
    after();
  }
}

/* ---------- shift summary receipt ---------- */
function showShiftReceipt(sh, afterAction){
  if(!sh){
    if(afterAction) afterAction();
    return;
  }
  const dur = Shift.duration(sh);
  const s = sh.summary || { invoices: 0, cashSales: 0, cardSales: 0, creditSales: 0, totalSales: 0, discounts: 0, cashRefunds: 0, cashIn: 0, cashOut: 0, expected: 0 };
  const v = sh.variance || 0;

  const varColor = Math.abs(v) < 0.01 ? '#6ee7b7' : v > 0 ? '#fcd34d' : '#fca5a5';
  const varTxt = Math.abs(v) < 0.01 ? '✅ සමතුලිත'
                : v > 0 ? `⚠️ වැඩිපුර ${money(v)}`
                : `❌ අඩුවීම ${money(Math.abs(v))}`;

  window._shiftReceiptAfter = afterAction;

  openModal('🔒 Shift වාර්තාව','Shift Closed — ' + sh.id,
  `<div class="shift-report">
     <div class="shift-head">
       <div class="shift-head-ico">🔒</div>
       <div>
         <div class="shift-head-t">Shift අවසන් විය</div>
         <div class="shift-head-s">${esc(sh.cashierName)} · ${dur.text}</div>
       </div>
     </div>

     <div class="shift-grid">
       <div><span>🔓 ආරම්භය</span><b>${new Date(sh.openedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</b></div>
       <div><span>🔒 අවසානය</span><b>${new Date(sh.closedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</b></div>
       <div><span>🧾 බිල්පත්</span><b>${s.invoices}</b></div>
       <div><span>⏱️ කාලය</span><b>${dur.text}</b></div>
     </div>

     <div class="shift-breakdown">
       <div class="srow"><span>ආරම්භක මුදල</span><b>${money(sh.openingFloat)}</b></div>
       <div class="srow"><span>+ මුදල් විකුණුම්</span><b style="color:var(--green)">+ ${money(s.cashSales)}</b></div>
       ${s.cashIn > 0 ? `<div class="srow"><span>+ Cash-In</span><b style="color:var(--green)">+ ${money(s.cashIn)}</b></div>` : ''}
       ${s.cashOut > 0 ? `<div class="srow"><span>- Cash-Out</span><b style="color:var(--red)">− ${money(s.cashOut)}</b></div>` : ''}
       ${s.cashRefunds > 0 ? `<div class="srow"><span>- ආපසු භාරදීම්</span><b style="color:var(--red)">− ${money(s.cashRefunds)}</b></div>` : ''}
       <div class="srow total"><span>ලාච්චුවේ තියෙන්න ඕන</span><span>${money(s.expected)}</span></div>
       <div class="srow" style="margin-top:8px"><span>ගණන් කරන ලද මුදල</span><b>${money(sh.closingCount)}</b></div>
     </div>

     <div class="shift-verdict" style="color:${varColor};border-color:${varColor}">
       ${varTxt}
     </div>

     <div class="shift-extra">
       <div><span>💳 කාඩ් විකුණුම්</span><b>${money(s.cardSales)}</b></div>
       <div><span>📝 ණය විකුණුම්</span><b>${money(s.creditSales || 0)}</b></div>
       <div><span>🏷️ වට්ටම්</span><b>${money(s.discounts)}</b></div>
       <div><span>💰 මුළු විකුණුම්</span><b>${money(s.totalSales)}</b></div>
     </div>
  </div>`,
  `<button class="btn btn-primary" style="padding:10px 24px;font-size:14px;font-weight:700" onclick="finishShiftReceipt()">
     ✅ හරි ${afterAction ? '· Logout වෙන්න' : ''}
   </button>`,
  false);

  if(afterAction){
    clearTimeout(window._shiftReceiptTimeout);
    window._shiftReceiptTimeout = setTimeout(() => {
      finishShiftReceipt();
    }, 5000);
  }
}

function finishShiftReceipt(){
  clearTimeout(window._shiftReceiptTimeout);
  closeModal();
  if(window._shiftReceiptAfter){
    const cb = window._shiftReceiptAfter;
    window._shiftReceiptAfter = null;
    cb();
  }
  if(typeof render === 'function') render();
}

/* =====================================================
   TOPBAR INDICATOR
   ===================================================== */
let _shiftTimer = null;
function updateShiftIndicator(){
  const el = $('#shiftIndicator');
  if(!el) return;

  const user = (typeof state !== 'undefined' && state) ? state.user : null;
  if(!user){
    el.innerHTML = '';
    el.style.display = 'none';
    if(_shiftTimer){ clearInterval(_shiftTimer); _shiftTimer = null; }
    return;
  }

  const active = Shift.getActive(user.id);
  if(!active){
    el.innerHTML = `
      <span class="shift-dot" style="background:var(--red)"></span>
      <span>Shift එකක් නැත</span>
      <span style="opacity:.6">· ආරම්භ කරන්න</span>
    `;
    el.style.display = 'inline-flex';
    el.style.borderColor = 'rgba(239,68,68,0.4)';
    if(_shiftTimer){ clearInterval(_shiftTimer); _shiftTimer = null; }
    return;
  }

  el.style.display = 'inline-flex';
  el.style.borderColor = '';
  const dur = Shift.duration(active);
  const expected = Shift.liveExpected(active.id);
  el.innerHTML = `
    <span class="shift-dot"></span>
    <span>Shift ${dur.text}</span>
    <span style="opacity:.4">|</span>
    <span>💰 ${money(expected)}</span>
  `;

  if(!_shiftTimer){
    _shiftTimer = setInterval(() => {
      const u = (typeof state !== 'undefined' && state) ? state.user : null;
      if(!u){
        clearInterval(_shiftTimer);
        _shiftTimer = null;
        return;
      }
      const a = Shift.getActive(u.id);
      if(a) updateShiftIndicator();
      else { clearInterval(_shiftTimer); _shiftTimer = null; }
    }, 30000);
  }
}

window.openShiftModal = openShiftModal;
window.confirmOpenShift = confirmOpenShift;
window.closeShiftModal = closeShiftModal;
window.cancelShiftClose = cancelShiftClose;
window.confirmCloseShift = confirmCloseShift;
window.showShiftReceipt = showShiftReceipt;
window.finishShiftReceipt = finishShiftReceipt;
window.updateShiftIndicator = updateShiftIndicator;
window.openCashMoveModal = openCashMoveModal;
window.confirmCashMove = confirmCashMove;
window.openShiftMenu = openShiftMenu;
