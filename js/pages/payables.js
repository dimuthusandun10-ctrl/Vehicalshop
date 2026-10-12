/* =========================================================
   js/pages/payables.js - Supplier Payables & Cheques Ledger
   Phase 7: Reports & Financials (P&L + Export + Payables)
   ========================================================= */

function pgPayables(){
  const db = window.DB || {};
  const activeShop = (typeof currentShopId === 'function') ? currentShopId() : null;
  const suppliers = (db.suppliers || []).filter(s => !activeShop || s.shopId === activeShop || !s.shopId);

  // Calculate per-supplier ledger balances
  const supplierData = suppliers.map(sup => {
    // GRNs for this supplier
    const grns = (db.grns || []).filter(g => 
      g.supplierId === sup.id || g.supplier === sup.name
    );
    const totalPurchased = grns.reduce((a, g) => a + (Number(g.total) || 0), 0);
    
    // Payments & cheques from supplierPayments collection
    const payments = (db.supplierPayments || []).filter(p => 
      p.supplierId === sup.id
    );
    
    // Cash / Bank payments that are cleared
    const cashPaid = payments
      .filter(p => p.type === 'payment' && (p.status === 'cleared' || !p.status))
      .reduce((a, p) => a + (Number(p.amount) || 0), 0);
    
    // Pending post-dated cheques
    const pendingCheques = payments
      .filter(p => p.type === 'cheque' && p.status === 'pending');
    
    // Cleared cheques
    const clearedCheques = payments
      .filter(p => p.type === 'cheque' && p.status === 'cleared')
      .reduce((a, p) => a + (Number(p.amount) || 0), 0);
    
    // Outstanding balance owed to supplier
    const balance = totalPurchased - cashPaid - clearedCheques;
    
    return {
      supplier: sup,
      totalPurchased,
      cashPaid,
      pendingCheques,
      clearedCheques,
      balance
    };
  }).filter(d => d.totalPurchased > 0 || d.balance > 0 || d.pendingCheques.length > 0 || d.cashPaid > 0);

  // High level business metrics
  const totalPayable = supplierData.reduce((a, d) => a + d.balance, 0);
  const totalPendingCheques = supplierData.reduce((a, d) => 
    a + d.pendingCheques.reduce((sum, c) => sum + (Number(c.amount) || 0), 0), 0
  );
  
  const todayDate = today();
  const overdueCheques = supplierData.reduce((a, d) => 
    a + d.pendingCheques.filter(c => c.chequeDate && c.chequeDate < todayDate).length, 0
  );

  return `
    <div class="payables-page">
      
      <!-- Top Action Bar & Export -->
      <div class="card" style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
          <div>
            <h3 style="margin:0;font-size:17px">💰 සැපයුම්කරුවන්ගේ ණය සහ චෙක්පත් ලෙජරය<small style="display:block;color:var(--muted);font-size:11.5px;font-weight:400">Supplier Payables & Cheques Ledger</small></h3>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <button class="btn btn-sm" onclick="exportPayablesCSV()" title="සැපයුම්කරුවන්ගේ ණය විස්තරය CSV ලෙස බාගත කරන්න">
              ⬇️ Payables CSV
            </button>
            <button class="btn btn-sm btn-primary" onclick="go('grn')">
              📥 නව GRN
            </button>
          </div>
        </div>
      </div>

      <!-- Financial Metric Cards -->
      <div class="stats" style="margin-bottom:14px">
        <div class="stat">
          <div class="ic ic-lg" style="background:rgba(239,68,68,0.15);color:#fca5a5">💰</div>
          <div>
            <b class="big" style="color:${totalPayable > 0 ? '#fca5a5' : '#6ee7b7'}">${money(totalPayable)}</b>
            <span>මුළු ණය ශේෂය (Payables Owed)</span>
          </div>
        </div>
        <div class="stat">
          <div class="ic ic-lg" style="background:rgba(245,158,11,0.15);color:#fcd34d">📝</div>
          <div>
            <b class="big" style="color:#fcd34d">${money(totalPendingCheques)}</b>
            <span>Pending චෙක්පත් එකතුව</span>
          </div>
        </div>
        <div class="stat">
          <div class="ic ic-lg" style="background:rgba(139,92,246,0.15);color:#c4b5fd">⏰</div>
          <div>
            <b class="big" style="color:${overdueCheques > 0 ? '#ef4444' : '#c4b5fd'}">${overdueCheques}</b>
            <span>Overdue (කල් ඉකුත්) චෙක්පත්</span>
          </div>
        </div>
        <div class="stat">
          <div class="ic ic-lg" style="background:rgba(59,130,246,0.15);color:#93c5fd">🏢</div>
          <div>
            <b class="big">${supplierData.length}</b>
            <span>සක්‍රිය සැපයුම්කරුවන්</span>
          </div>
        </div>
      </div>

      <!-- Search & Filters Card -->
      <div class="card" style="padding:12px;margin-bottom:14px;background:var(--panel2)">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <div style="flex:1;min-width:220px">
            <input id="paySearch" type="search" placeholder="🔍 සැපයුම්කරු නම හෝ දුරකථන අංකය සොයන්න..." 
                   value="${esc(window._payablesSearch || '')}"
                   oninput="window._payablesSearch = this.value; filterPayablesList();" 
                   style="width:100%;margin:0">
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn btn-sm ${(!window._payablesFilter || window._payablesFilter==='all') ? 'btn-primary' : ''}" 
                    onclick="window._payablesFilter='all'; render();">සියල්ල</button>
            <button class="btn btn-sm ${window._payablesFilter==='pending' ? 'btn-primary' : ''}" 
                    onclick="window._payablesFilter='pending'; render();">⏳ චෙක්පත් පමණක්</button>
            <button class="btn btn-sm ${window._payablesFilter==='owed' ? 'btn-primary' : ''}" 
                    onclick="window._payablesFilter='owed'; render();">⚠️ ණය ඇති අය</button>
          </div>
        </div>
      </div>

      <!-- Supplier Payables Cards List -->
      <div id="payablesList">
        ${renderPayablesList(supplierData)}
      </div>

    </div>
  `;
}

function renderPayablesList(data){
  const search = (window._payablesSearch || '').trim().toLowerCase();
  const filter = window._payablesFilter || 'all';
  const todayDate = today();

  let list = data;

  if(search){
    list = list.filter(d => {
      const name = (d.supplier.name || '').toLowerCase();
      const phone = (d.supplier.phone || '').toLowerCase();
      return name.includes(search) || phone.includes(search);
    });
  }

  if(filter === 'pending'){
    list = list.filter(d => d.pendingCheques.length > 0);
  } else if(filter === 'owed'){
    list = list.filter(d => d.balance > 0);
  }

  if(!list.length){
    return `
      <div class="card">
        <div class="empty" style="padding:50px 20px;text-align:center">
          <div style="font-size:36px;margin-bottom:10px">🏢</div>
          <div style="font-weight:700;font-size:15px;margin-bottom:4px">සැපයුම්කරුවන්ගේ වාර්තා හමු නොවීය</div>
          <small style="color:var(--muted)">
            GRN මඟින් භාණ්ඩ ඇතුළත් කළ පසු හෝ සැපයුම්කරුවන්ට ගෙවීම් කළ පසු මෙහි දිස්වේ
          </small>
        </div>
      </div>
    `;
  }

  return list.map(d => {
    const sup = d.supplier;

    return `
      <div class="card payables-card" style="margin-bottom:14px;border:1px solid var(--line);border-radius:12px;padding:16px">
        <div class="card-h" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--line)">
          <div>
            <h3 style="margin:0;font-size:16px">🏢 ${esc(sup.name)}</h3>
            <small style="color:var(--muted);font-weight:500">${esc(sup.phone || sup.contact || 'දුරකථන අංකයක් නැත')}</small>
          </div>
          <button class="btn btn-sm btn-primary" onclick="recordPayment('${sup.id}')" style="font-weight:700;display:flex;align-items:center;gap:6px">
            💵 ගෙවීමක් සටහන් කරන්න
          </button>
        </div>

        <div class="payable-balance">
          <div class="pb-row">
            <span>මුළු ගැනුම් එකතුව (Total Purchases):</span>
            <b>${money(d.totalPurchased)}</b>
          </div>
          <div class="pb-row">
            <span>මුදලින් හෝ බැංකුවෙන් ගෙවා ඇත (Paid):</span>
            <b style="color:#6ee7b7">${money(d.cashPaid)}</b>
          </div>
          <div class="pb-row">
            <span>පියවූ චෙක්පත් (Cleared Cheques):</span>
            <b style="color:#6ee7b7">${money(d.clearedCheques)}</b>
          </div>
          <div class="pb-row total">
            <span>ගෙවීමට ඇති ශේෂය (Balance Owed):</span>
            <b style="color:${d.balance > 0 ? '#fca5a5' : '#6ee7b7'};font-size:16px">
              ${money(d.balance)}
            </b>
          </div>
        </div>

        ${d.pendingCheques.length > 0 ? `
          <div class="pending-cheques">
            <h4>⏳ කල්පිරෙන / Pending චෙක්පත් (${d.pendingCheques.length})</h4>
            ${d.pendingCheques.map(c => {
              const isOverdue = c.chequeDate && c.chequeDate < todayDate;
              return `
                <div class="cheque-row ${isOverdue ? 'overdue' : ''}">
                  <div>
                    <b>#${esc(c.chequeNo || 'N/A')} · ${esc(c.bank || 'Bank')}</b>
                    <small>දිනය: ${c.chequeDate ? new Date(c.chequeDate).toLocaleDateString('en-GB') : '—'} ${isOverdue ? '<span style="color:#ef4444;font-weight:700">· [කල් ඉකුත් / Overdue]</span>' : ''}</small>
                  </div>
                  <b style="font-size:14px;color:var(--primary);font-family:'Inter',sans-serif">${money(c.amount)}</b>
                  <div class="cheque-actions">
                    <button class="btn btn-sm btn-green" onclick="clearCheque('${c.id}')" title="Cleared (පියවූ) ලෙස සලකුණු කරන්න" style="padding:5px 8px;font-size:12px">
                      ✅ Cleared
                    </button>
                    <button class="btn btn-sm btn-red" onclick="cancelCheque('${c.id}')" title="චෙක්පත අවලංගු කරන්න" style="padding:5px 8px;font-size:12px">
                      ❌ Cancel
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}

      </div>
    `;
  }).join('');
}

function filterPayablesList(){
  const container = document.getElementById('payablesList');
  if(!container) return;
  const db = window.DB || {};
  const activeShop = (typeof currentShopId === 'function') ? currentShopId() : null;
  const suppliers = (db.suppliers || []).filter(s => !activeShop || s.shopId === activeShop || !s.shopId);

  const supplierData = suppliers.map(sup => {
    const grns = (db.grns || []).filter(g => g.supplierId === sup.id || g.supplier === sup.name);
    const totalPurchased = grns.reduce((a, g) => a + (Number(g.total) || 0), 0);
    const payments = (db.supplierPayments || []).filter(p => p.supplierId === sup.id);
    const cashPaid = payments.filter(p => p.type === 'payment' && (p.status === 'cleared' || !p.status)).reduce((a, p) => a + (Number(p.amount) || 0), 0);
    const pendingCheques = payments.filter(p => p.type === 'cheque' && p.status === 'pending');
    const clearedCheques = payments.filter(p => p.type === 'cheque' && p.status === 'cleared').reduce((a, p) => a + (Number(p.amount) || 0), 0);
    const balance = totalPurchased - cashPaid - clearedCheques;
    return { supplier: sup, totalPurchased, cashPaid, pendingCheques, clearedCheques, balance };
  }).filter(d => d.totalPurchased > 0 || d.balance > 0 || d.pendingCheques.length > 0 || d.cashPaid > 0);

  container.innerHTML = renderPayablesList(supplierData);
}

function recordPayment(supplierId){
  const db = window.DB || {};
  const sup = (db.suppliers || []).find(s => s.id === supplierId);
  if(!sup){
    if(typeof toast === 'function') toast('සැපයුම්කරු හමු නොවීය', 'err');
    return;
  }

  const modalBody = `
    <div style="display:flex;flex-direction:column;gap:12px;padding:4px 0">
      <div>
        <label style="font-size:12px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">ගෙවන මුදල (Amount Rs.)</label>
        <input type="number" id="payAmount" placeholder="0.00" min="0" step="0.01" style="width:100%;font-size:16px;font-weight:700">
      </div>
      
      <div>
        <label style="font-size:12px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">ගෙවීම් ක්‍රමය (Payment Method)</label>
        <select id="payType" onchange="toggleChequeFields()" style="width:100%;padding:9px;border-radius:8px">
          <option value="cash">💵 මුදල් (Cash)</option>
          <option value="bank">🏦 බැංකු මාරුව (Bank Transfer)</option>
          <option value="cheque">📝 චෙක්පතක් (Cheque)</option>
        </select>
      </div>
      
      <div id="chequeFields" style="display:none;background:rgba(245,158,11,0.06);padding:12px;border:1px solid rgba(245,158,11,0.25);border-radius:10px">
        <div style="margin-bottom:10px">
          <label style="font-size:12px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">චෙක් අංකය (Cheque No)</label>
          <input id="chequeNo" placeholder="123456" style="width:100%">
        </div>
        <div style="margin-bottom:10px">
          <label style="font-size:12px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">බැංකුව (Bank Name)</label>
          <input id="chequeBank" placeholder="BOC / Commercial / Sampath" style="width:100%">
        </div>
        <div>
          <label style="font-size:12px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">චෙක්පත් දිනය (Cheque Date)</label>
          <input type="date" id="chequeDate" value="${today()}" style="width:100%">
        </div>
      </div>
      
      <div>
        <label style="font-size:12px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">සටහන (Notes / Description - Optional)</label>
        <input id="payNotes" placeholder="බිල්පත් අංක හෝ අමතර විස්තර..." style="width:100%">
      </div>
    </div>
  `;

  const modalFooter = `
    <button class="btn" onclick="closeModal()">අවලංගු</button>
    <button class="btn btn-primary" onclick="savePayment('${sup.id}')">💾 සුරකින්න (Save Payment)</button>
  `;

  if(typeof openModal === 'function'){
    openModal(
      '💵 ගෙවීමක් සටහන් කරන්න',
      'Record Supplier Payment — ' + sup.name,
      modalBody,
      modalFooter
    );
  }
}

function toggleChequeFields(){
  const typeEl = document.getElementById('payType');
  const chqBox = document.getElementById('chequeFields');
  if(!typeEl || !chqBox) return;
  chqBox.style.display = (typeEl.value === 'cheque') ? 'block' : 'none';
}

async function savePayment(supplierId){
  const amountInp = document.getElementById('payAmount');
  const typeInp = document.getElementById('payType');
  const notesInp = document.getElementById('payNotes');

  const amount = parseFloat(amountInp ? amountInp.value : 0);
  const type = typeInp ? typeInp.value : 'cash';
  const notes = (notesInp ? notesInp.value : '').trim();

  if(!amount || amount <= 0 || isNaN(amount)){
    if(typeof toast === 'function') toast('කරුණාකර නිවැරදි මුදලක් ඇතුළත් කරන්න', 'err');
    return;
  }

  const db = window.DB || {};
  const sup = (db.suppliers || []).find(s => s.id === supplierId);
  const activeShop = (typeof currentShopId === 'function' && currentShopId()) ? currentShopId() : (window.state?.user?.shopId || 'SHOP-001');

  const payment = {
    id: 'PAY-' + Date.now(),
    shopId: activeShop,
    supplierId,
    supplierName: sup ? sup.name : 'Unknown Supplier',
    type: type === 'cheque' ? 'cheque' : 'payment',
    amount,
    method: type,
    notes,
    date: today(),
    timestamp: new Date().toISOString(),
    createdBy: window.state?.user?.name || 'Staff',
    status: type === 'cheque' ? 'pending' : 'cleared'
  };

  if(type === 'cheque'){
    const chqNoInp = document.getElementById('chequeNo');
    const chqBankInp = document.getElementById('chequeBank');
    const chqDateInp = document.getElementById('chequeDate');

    payment.chequeNo = (chqNoInp ? chqNoInp.value : '').trim();
    payment.bank = (chqBankInp ? chqBankInp.value : '').trim() || 'General';
    payment.chequeDate = (chqDateInp ? chqDateInp.value : '') || today();

    if(!payment.chequeNo || !payment.chequeDate){
      if(typeof toast === 'function') toast('චෙක්පත් අංකය සහ දිනය අනිවාර්ය වේ', 'err');
      return;
    }
  }

  // 1. Save to Firestore
  try {
    if(window.shopAdd){
      await window.shopAdd('supplierPayments', payment);
    } else if(window.FB && typeof window.FB.fbSet === 'function'){
      await window.FB.fbSet('supplierPayments', payment.id, payment);
    }
  } catch(err){
    console.warn('Firestore write warning:', err);
  }

  // 2. In-memory update
  db.supplierPayments = db.supplierPayments || [];
  db.supplierPayments.push(payment);
  if(typeof db.persistLocal === 'function') db.persistLocal();

  if(typeof closeModal === 'function') closeModal();
  if(typeof render === 'function') render();
  if(typeof toast === 'function') toast('✅ ගෙවීම සාර්ථකව සටහන් විය', 'ok');
}

async function clearCheque(chequeId){
  if(!confirm('මෙම චෙක්පත Cleared (පියවූ) ලෙස සලකුණු කරන්නද?')) return;

  const db = window.DB || {};
  const c = (db.supplierPayments || []).find(p => p.id === chequeId);
  if(c){
    c.status = 'cleared';
    c.clearedAt = new Date().toISOString();
  }

  try {
    if(window.FB && typeof window.FB.fbUpdate === 'function'){
      await window.FB.fbUpdate('supplierPayments', chequeId, {
        status: 'cleared',
        clearedAt: new Date().toISOString()
      });
    }
  } catch(err){
    console.warn('Cheque clear error:', err);
  }

  if(typeof db.persistLocal === 'function') db.persistLocal();
  if(typeof render === 'function') render();
  if(typeof toast === 'function') toast('✅ චෙක්පත Cleared ලෙස සලකුණු විය', 'ok');
}

async function cancelCheque(chequeId){
  if(!confirm('මෙම චෙක්පත අවලංගු (Cancelled) කරන්නද?')) return;

  const db = window.DB || {};
  const c = (db.supplierPayments || []).find(p => p.id === chequeId);
  if(c){
    c.status = 'cancelled';
    c.cancelledAt = new Date().toISOString();
  }

  try {
    if(window.FB && typeof window.FB.fbUpdate === 'function'){
      await window.FB.fbUpdate('supplierPayments', chequeId, {
        status: 'cancelled',
        cancelledAt: new Date().toISOString()
      });
    }
  } catch(err){
    console.warn('Cheque cancel error:', err);
  }

  if(typeof db.persistLocal === 'function') db.persistLocal();
  if(typeof render === 'function') render();
  if(typeof toast === 'function') toast('චෙක්පත අවලංගු කරන ලදී', 'warn');
}

function exportPayablesCSV(){
  const db = window.DB || {};
  const activeShop = (typeof currentShopId === 'function') ? currentShopId() : null;
  const suppliers = (db.suppliers || []).filter(s => !activeShop || s.shopId === activeShop || !s.shopId);

  const headers = [
    'Supplier', 'Phone', 'Total Purchased (Rs.)', 'Cash/Bank Paid (Rs.)',
    'Cleared Cheques (Rs.)', 'Balance Owed (Rs.)', 'Pending Cheques Count', 'Pending Cheques Amount (Rs.)'
  ];

  const rows = suppliers.map(sup => {
    const grns = (db.grns || []).filter(g => g.supplierId === sup.id || g.supplier === sup.name);
    const totalPurchased = grns.reduce((a, g) => a + (Number(g.total) || 0), 0);
    const payments = (db.supplierPayments || []).filter(p => p.supplierId === sup.id);
    const cashPaid = payments.filter(p => p.type === 'payment' && (p.status === 'cleared' || !p.status)).reduce((a, p) => a + (Number(p.amount) || 0), 0);
    const pendingCheques = payments.filter(p => p.type === 'cheque' && p.status === 'pending');
    const clearedCheques = payments.filter(p => p.type === 'cheque' && p.status === 'cleared').reduce((a, p) => a + (Number(p.amount) || 0), 0);
    const balance = totalPurchased - cashPaid - clearedCheques;
    const pendingAmount = pendingCheques.reduce((a, c) => a + (Number(c.amount) || 0), 0);

    return [
      sup.name || '',
      sup.phone || '',
      totalPurchased.toFixed(2),
      cashPaid.toFixed(2),
      clearedCheques.toFixed(2),
      balance.toFixed(2),
      pendingCheques.length,
      pendingAmount.toFixed(2)
    ];
  });

  if(typeof downloadCSV === 'function'){
    downloadCSV(`supplier-payables-${today()}.csv`, headers, rows);
  }
}

window.pgPayables = pgPayables;
window.renderPayablesList = renderPayablesList;
window.filterPayablesList = filterPayablesList;
window.recordPayment = recordPayment;
window.toggleChequeFields = toggleChequeFields;
window.savePayment = savePayment;
window.clearCheque = clearCheque;
window.cancelCheque = cancelCheque;
window.exportPayablesCSV = exportPayablesCSV;
