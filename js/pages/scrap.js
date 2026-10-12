/* =========================================================
   js/pages/scrap.js - Scrap Battery (Core) Inventory Tracking
   Phase 8: Automotive Specifics
   ========================================================= */

window.state = window.state || {};
state.scrapCategory = state.scrapCategory || 'all';

function pgScrap(){
  const db = window.DB || {};
  const activeShop = (typeof currentShopId === 'function') ? currentShopId() : null;
  const scrapList = (db.scrapInventory || []).filter(s => !activeShop || s.shopId === activeShop || !s.shopId);

  // Metrics calculation
  const totalUnits = scrapList.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
  const totalValuation = scrapList.reduce((sum, s) => sum + (Number(s.totalValue) || ((Number(s.quantity) || 0) * (Number(s.unitScrapValue) || 800))), 0);
  const avgRate = totalUnits > 0 ? (totalValuation / totalUnits) : 800;

  // Inflow this week
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const oneWeekStr = oneWeekAgo.toISOString().slice(0, 10);

  let thisWeekInflow = 0;
  scrapList.forEach(s => {
    (s.acquisitions || []).forEach(a => {
      if((a.date || '').slice(0, 10) >= oneWeekStr){
        thisWeekInflow += Number(a.qty || 1);
      }
    });
  });

  // Filter by category
  const selCat = state.scrapCategory || 'all';
  let filtered = scrapList;
  if(selCat !== 'all'){
    filtered = filtered.filter(s => s.category === selCat);
  }

  return `
    <div class="scrap-page">
      
      <!-- Header -->
      <div class="scrap-header">
        <div>
          <h3>🔋 Scrap Battery Inventory <small>පරණ බැටරි හා Core අමතර කොටස් තොග කළමනාකරණය</small></h3>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="openAddScrapModal()" style="display:flex;align-items:center;gap:6px;font-weight:700">
            <span>➕ නව Scrap තොගයක්</span>
          </button>
        </div>
      </div>

      <!-- Financial & Quantity Stats -->
      <div class="stats" style="margin-bottom:14px">
        <div class="stat">
          <div class="ic" style="background:rgba(245,158,11,0.15);color:#fcd34d">🔋</div>
          <div>
            <b>${totalUnits}</b>
            <span>පවතින Core ප්‍රමාණය (Units)</span>
          </div>
        </div>
        <div class="stat">
          <div class="ic" style="background:rgba(59,130,246,0.15);color:#93c5fd">🏷️</div>
          <div>
            <b>${money(avgRate)}</b>
            <span>ඒකක Scrap අගය (Avg Rate)</span>
          </div>
        </div>
        <div class="stat">
          <div class="ic" style="background:rgba(16,185,129,0.15);color:#6ee7b7">💰</div>
          <div>
            <b>${money(totalValuation)}</b>
            <span>මුළු Scrap වටිනාකම (Total Value)</span>
          </div>
        </div>
        <div class="stat">
          <div class="ic" style="background:rgba(139,92,246,0.15);color:#c4b5fd">📅</div>
          <div>
            <b>+${thisWeekInflow}</b>
            <span>මේ සතියේ ලැබුණු ප්‍රමාණය (This Week)</span>
          </div>
        </div>
      </div>

      <!-- Category Filter Tabs -->
      <div class="card" style="padding:12px;margin-bottom:14px;background:var(--panel2)">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <span style="font-size:12px;font-weight:700;color:var(--muted);margin-right:6px">කාණ්ඩය / Category:</span>
          <button class="btn btn-sm ${selCat==='all'?'btn-primary':''}" onclick="state.scrapCategory='all'; render();">සියල්ල (${scrapList.length})</button>
          <button class="btn btn-sm ${selCat==='battery'?'btn-primary':''}" onclick="state.scrapCategory='battery'; render();">🔋 බැටරි (Battery)</button>
          <button class="btn btn-sm ${selCat==='alternator'?'btn-primary':''}" onclick="state.scrapCategory='alternator'; render();">⚡ Alternators</button>
          <button class="btn btn-sm ${selCat==='starter'?'btn-primary':''}" onclick="state.scrapCategory='starter'; render();">⚙️ Starters</button>
        </div>
      </div>

      <!-- Scrap Cards Grid -->
      ${filtered.length > 0 ? `
        <div class="scrap-grid">
          ${filtered.map(item => renderScrapCard(item)).join('')}
        </div>
      ` : `
        <div class="card" style="padding:50px 20px;text-align:center">
          <div style="font-size:42px;margin-bottom:12px">🔋</div>
          <div style="font-size:16px;font-weight:700;margin-bottom:6px">Scrap තොග වාර්තා නොමැත</div>
          <p style="color:var(--muted);font-size:12.5px;max-width:400px;margin:0 auto 16px">
            පාරිභෝගිකයින්ගෙන් බැටරි හුවමාරු කළ විට ස්වයංක්‍රීයව මෙහි සටහන් වේ, නැතහොත් නව තොගයක් එක් කරන්න.
          </p>
          <button class="btn btn-primary" onclick="openAddScrapModal()">➕ නව Scrap වර්ගයක් එක් කරන්න</button>
        </div>
      `}

    </div>
  `;
}

function renderScrapCard(item){
  const qty = Number(item.quantity) || 0;
  const rate = Number(item.unitScrapValue) || 800;
  const val = Number(item.totalValue) || (qty * rate);

  const acquisitions = item.acquisitions || [];
  const disposals = item.disposals || [];

  // Recent 3 activities
  const recentActs = [];
  acquisitions.slice(-3).reverse().forEach(a => {
    recentActs.push({
      type: 'add',
      text: `+ ${a.qty} (${a.date || 'අද'}) — Exchange from ${a.sourceSaleId || 'Bill'}`,
      detail: a.customerName || ''
    });
  });
  disposals.slice(-3).reverse().forEach(d => {
    recentActs.push({
      type: 'sub',
      text: `− ${d.qty} (${d.date || 'අද'}) — Sold ${money(d.amountReceived || 0)}`,
      detail: d.buyer || 'Scrap Dealer'
    });
  });

  return `
    <div class="scrap-card">
      <div>
        <div class="sc-top">
          <div>
            <div class="sc-title">
              <span>🔋</span>
              <span>${esc(item.productName || 'වාහන බැටරි Core')}</span>
            </div>
            <small style="color:var(--muted);font-size:11.5px">Ref: ${esc(item.productId || 'P-CORE')}</small>
          </div>
          <span class="sc-cat-pill">${esc(item.category || 'battery')}</span>
        </div>

        <div class="sc-metrics-box">
          <div class="sc-row">
            <span>පවතින ප්‍රමාණය (Current Stock):</span>
            <b style="font-size:16px;color:${qty > 0 ? '#34d399' : '#f87171'}">${qty} units</b>
          </div>
          <div class="sc-row">
            <span>ඒකක Scrap අගය (Scrap Rate):</span>
            <b>${money(rate)} / unit</b>
          </div>
          <div class="sc-row highlight">
            <span>මුළු වටිනාකම (Total Scrap Value):</span>
            <b>${money(val)}</b>
          </div>
        </div>

        <!-- Recent Activity Mini Box -->
        <div class="sc-activity">
          <div class="sc-act-head">📋 මෑත ක්‍රියාකාරකම් (Recent Activity):</div>
          ${recentActs.slice(0, 3).map(act => `
            <div class="sc-act-item">
              <span class="${act.type === 'add' ? 'sc-act-add' : 'sc-act-sub'}">${esc(act.text)}</span>
              <small style="color:var(--muted)">${esc(act.detail)}</small>
            </div>
          `).join('') || '<div style="font-size:11px;color:var(--muted);text-align:center">ක්‍රියාකාරකම් නොමැත</div>'}
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="sc-actions">
        <button class="btn btn-sm btn-green" onclick="sellScrap('${item.id}')" ${qty <= 0 ? 'disabled' : ''} style="flex:1;display:flex;justify-content:center;align-items:center;gap:5px;font-weight:700">
          <span>💵 Sell Scrap (විකුණන්න)</span>
        </button>
        <button class="btn btn-sm" onclick="openAddScrapModal('${item.id}')" title="තොග එක් කරන්න" style="padding:6px 10px">
          <span>➕ Add</span>
        </button>
        <button class="btn btn-sm" onclick="viewScrapHistory('${item.id}')" title="ඉතිහාසය බලන්න" style="padding:6px 10px">
          <span>📊 History</span>
        </button>
      </div>
    </div>
  `;
}

/* =========================================================
   SELL SCRAP MODAL (WITH OPTIONAL CASH-IN TOGGLE)
   ========================================================= */
function sellScrap(scrapId){
  const db = window.DB || {};
  const scrap = (db.scrapInventory || []).find(s => s.id === scrapId);
  if(!scrap) return;

  const currentQty = Number(scrap.quantity) || 0;
  if(currentQty <= 0){
    toast('විකිණීමට scrap තොග නොමැත', 'warn');
    return;
  }

  const rate = Number(scrap.unitScrapValue) || 800;

  const modalBody = `
    <div style="display:flex;flex-direction:column;gap:12px;padding:4px 0">
      
      <div style="background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:10px 12px">
        <b style="font-size:14px;color:var(--primary)">${esc(scrap.productName)}</b>
        <div style="font-size:12px;color:var(--muted);margin-top:2px">
          පවතින තොගය: <b style="color:#34d399">${currentQty} units</b> · සාමාන්‍ය මිල: <b>${money(rate)}</b>
        </div>
      </div>

      <div>
        <label style="font-size:12px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">අලෙවි කරන ප්‍රමාණය (Quantity to Sell)</label>
        <input type="number" id="scrapSellQty" min="1" max="${currentQty}" value="${currentQty}"
               oninput="recalcScrapAmount()"
               style="width:100%;font-size:16px;font-weight:700">
        <small style="color:var(--muted);font-size:11px">උපරිම අලෙවි කළ හැක්කේ ${currentQty} units පමණි</small>
      </div>

      <div>
        <label style="font-size:12px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">ලැබුණු මුදල (Amount Received Rs.)</label>
        <input type="number" id="scrapSellAmount" value="${currentQty * rate}" min="0" step="10"
               style="width:100%;font-size:16px;font-weight:700;color:#34d399">
      </div>

      <div>
        <label style="font-size:12px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">ගැනුම්කරු / Scrap Dealer Name</label>
        <input id="scrapSellBuyer" placeholder="උදා: Scrap Dealer Kamal / Silva Brothers" style="width:100%">
      </div>

      <!-- Cash-In Movement Toggle Option -->
      <div class="scrap-toggle-row">
        <input type="checkbox" id="scrapCashInToggle" checked>
        <div>
          <label for="scrapCashInToggle" style="font-weight:700;font-size:12.5px;color:var(--txt);cursor:pointer">
            💵 ලැබුණු මුදල Cash Drawer / Petty Cash (Cash In) ලෙස සටහන් කරන්න
          </label>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">
            මෙම මුදල සේප්පුවේ පවතින දෛනික මුදල් ශේෂයට (Cash Movement) ස්වයංක්‍රීයව එකතු වේ
          </div>
        </div>
      </div>

    </div>
  `;

  const modalFooter = `
    <button class="btn" onclick="closeModal()">අවලංගු</button>
    <button class="btn btn-green" onclick="confirmSellScrap('${scrapId}')">
      ✅ අලෙවි කරන්න (Confirm Sell)
    </button>
  `;

  openModal(
    '💵 Scrap අලෙවිය',
    'Sell Scrap — ' + scrap.productName,
    modalBody,
    modalFooter
  );
}

function recalcScrapAmount(){
  const qtyInp = document.getElementById('scrapSellQty');
  const amtInp = document.getElementById('scrapSellAmount');
  if(!qtyInp || !amtInp) return;
  const qty = parseInt(qtyInp.value, 10) || 0;
  amtInp.value = qty * 800;
}

async function confirmSellScrap(scrapId){
  const db = window.DB || {};
  const scrap = (db.scrapInventory || []).find(s => s.id === scrapId);
  if(!scrap) return;

  const qtyInp = document.getElementById('scrapSellQty');
  const amtInp = document.getElementById('scrapSellAmount');
  const buyerInp = document.getElementById('scrapSellBuyer');
  const cashInToggle = document.getElementById('scrapCashInToggle');

  const sellQty = parseInt(qtyInp ? qtyInp.value : 0, 10);
  const amount = parseFloat(amtInp ? amtInp.value : 0);
  const buyer = (buyerInp ? buyerInp.value : '').trim() || 'Scrap Dealer';
  const doCashIn = cashInToggle ? cashInToggle.checked : true;

  if(!sellQty || sellQty <= 0){
    toast('වලංගු ප්‍රමාණයක් ඇතුළත් කරන්න', 'err');
    return;
  }
  if(sellQty > scrap.quantity){
    toast('පවතින තොගයට වඩා වැඩි ප්‍රමාණයක් අලෙවි කළ නොහැක', 'err');
    return;
  }

  // Update scrap document
  scrap.quantity = (Number(scrap.quantity) || 0) - sellQty;
  scrap.totalValue = scrap.quantity * (Number(scrap.unitScrapValue) || 800);
  scrap.disposals = scrap.disposals || [];

  const disposalRecord = {
    date: today(),
    qty: sellQty,
    buyer,
    amountReceived: amount,
    recordedBy: window.state?.user?.name || 'Staff',
    timestamp: new Date().toISOString()
  };
  scrap.disposals.push(disposalRecord);
  scrap.updatedAt = new Date().toISOString();

  // Firestore update
  try {
    if(window.shopUpdate){
      await window.shopUpdate('scrapInventory', scrap.id, {
        quantity: scrap.quantity,
        totalValue: scrap.totalValue,
        disposals: scrap.disposals,
        updatedAt: scrap.updatedAt
      });
    } else if(window.FB && window.FB.fbUpdate){
      await window.FB.fbUpdate('scrapInventory', scrap.id, {
        quantity: scrap.quantity,
        totalValue: scrap.totalValue,
        disposals: scrap.disposals,
        updatedAt: scrap.updatedAt
      });
    }
  } catch(e){
    console.warn('Scrap sell error:', e);
  }

  // Optional: Record Cash In Movement in Petty Cash
  if(doCashIn && amount > 0){
    const cashMove = {
      id: 'CM-' + Date.now(),
      shopId: scrap.shopId || (typeof currentShopId === 'function' ? currentShopId() : 'SHOP-001'),
      type: 'in',
      amount: amount,
      reason: `Scrap Sale (${sellQty} units: ${scrap.productName}) to ${buyer}`,
      cashier: window.state?.user?.name || 'Staff',
      date: today(),
      timestamp: new Date().toISOString()
    };
    db.cashMoves = db.cashMoves || [];
    db.cashMoves.push(cashMove);

    try {
      if(window.shopAdd) await window.shopAdd('cashMovements', cashMove);
      else if(window.FB && window.FB.fbAdd) await window.FB.fbAdd('cashMovements', cashMove);
    } catch(err){
      console.warn('Cash movement recording warning:', err);
    }
  }

  if(typeof db.persistLocal === 'function') db.persistLocal();
  closeModal();
  render();
  toast(`✅ Scrap ${sellQty}ක් අලෙවි විය (${money(amount)})`, 'ok');
}

/* =========================================================
   ADD SCRAP MODAL (MANUAL ADD)
   ========================================================= */
function openAddScrapModal(scrapId = null){
  const db = window.DB || {};
  const activeShop = (typeof currentShopId === 'function') ? currentShopId() : null;
  const products = (db.products || []).filter(p => !activeShop || p.shopId === activeShop || !p.shopId);

  let existing = null;
  if(scrapId){
    existing = (db.scrapInventory || []).find(s => s.id === scrapId);
  }

  const modalBody = `
    <div style="display:flex;flex-direction:column;gap:12px;padding:4px 0">
      
      <div>
        <label style="font-size:12px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">බැටරිය හෝ අමතර කොටස (Product)</label>
        <select id="scrapProdSelect" style="width:100%;padding:9px;border-radius:8px">
          <option value="">-- බැටරි හෝ අමතර කොටසක් තෝරන්න --</option>
          ${products.map(p => `
            <option value="${p.id}" data-name="${esc(p.name)}" data-cat="${esc(p.cat)}" ${(existing && existing.productId === p.id) ? 'selected' : ''}>
              ${esc(p.code)} — ${esc(p.name)} (${esc(p.brand || '')})
            </option>
          `).join('')}
        </select>
      </div>

      <div class="grid2" style="gap:10px">
        <div>
          <label style="font-size:12px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">එක් කරන ප්‍රමාණය (Units)</label>
          <input type="number" id="scrapAddQty" min="1" value="1" style="width:100%;font-size:15px;font-weight:700">
        </div>
        <div>
          <label style="font-size:12px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">ඒකක Scrap අගය (Rate Rs.)</label>
          <input type="number" id="scrapAddRate" min="0" value="${existing ? existing.unitScrapValue : 800}" style="width:100%;font-size:15px;font-weight:700">
        </div>
      </div>

      <div>
        <label style="font-size:12px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">ප්‍රභවය / Source</label>
        <select id="scrapSourceSelect" style="width:100%;padding:8px;border-radius:8px">
          <option value="customer_exchange">🔄 පාරිභෝගික හුවමාරුව (Customer Exchange)</option>
          <option value="warranty">🛡️ වගකීම් ආපසු භාරදීම (Warranty Scrap)</option>
          <option value="damage">⚠️ අබලන් වූ තොග (Damaged Stock)</option>
          <option value="other">📦 වෙනත් (Other)</option>
        </select>
      </div>

      <div>
        <label style="font-size:12px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">පාරිභෝගිකයා හෝ සටහන (Customer / Note)</label>
        <input id="scrapAddNote" placeholder="උදා: කමල් - බිල්පත් අංකය හෝ සටහන" style="width:100%">
      </div>

    </div>
  `;

  openModal(
    existing ? '➕ Scrap තොග එක් කරන්න' : '🔋 නව Scrap කාණ්ඩයක්',
    'Core Battery Scrap Inflow Recorder',
    modalBody,
    `<button class="btn" onclick="closeModal()">අවලංගු</button>
     <button class="btn btn-primary" onclick="saveAddScrap('${scrapId || ''}')">💾 සුරකින්න (Save)</button>`
  );
}

async function saveAddScrap(scrapId){
  const sel = document.getElementById('scrapProdSelect');
  const qtyInp = document.getElementById('scrapAddQty');
  const rateInp = document.getElementById('scrapAddRate');
  const sourceSel = document.getElementById('scrapSourceSelect');
  const noteInp = document.getElementById('scrapAddNote');

  const pid = sel ? sel.value : '';
  const opt = sel ? sel.selectedOptions[0] : null;
  const prodName = opt ? opt.getAttribute('data-name') : 'වාහන බැටරි Core';
  const qty = parseInt(qtyInp ? qtyInp.value : 1, 10);
  const rate = parseFloat(rateInp ? rateInp.value : 800);
  const source = sourceSel ? sourceSel.value : 'customer_exchange';
  const note = (noteInp ? noteInp.value : '').trim();

  if(!qty || qty <= 0){
    toast('කරුණාකර නිවැරදි ප්‍රමාණයක් ඇතුළත් කරන්න', 'err');
    return;
  }

  const scrapItem = {
    productId: pid || 'P-CORE',
    productName: prodName,
    category: 'battery',
    source: source,
    quantity: qty,
    unitScrapValue: rate,
    sourceSaleId: 'MANUAL',
    customerName: note || 'අතින් ඇතුළත් කළ තොගය',
    depositPaid: 0,
    recordedBy: window.state?.user?.name || 'Staff',
    date: today()
  };

  if(typeof window.addScrapInventory === 'function'){
    await window.addScrapInventory(scrapItem);
  } else if(window.DB && typeof window.DB.addScrapInventory === 'function'){
    await window.DB.addScrapInventory(scrapItem);
  }

  closeModal();
  render();
  toast('✅ Scrap තොගය සාර්ථකව යාවත්කාලීන විය', 'ok');
}

/* =========================================================
   VIEW SCRAP HISTORY MODAL
   ========================================================= */
function viewScrapHistory(scrapId){
  const db = window.DB || {};
  const scrap = (db.scrapInventory || []).find(s => s.id === scrapId);
  if(!scrap) return;

  const acquisitions = scrap.acquisitions || [];
  const disposals = scrap.disposals || [];

  const modalBody = `
    <div style="display:flex;flex-direction:column;gap:14px;padding:4px 0">
      
      <div style="background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:12px">
        <b style="font-size:15px;color:var(--primary)">${esc(scrap.productName)}</b>
        <div style="font-size:12px;color:var(--muted);margin-top:2px">
          පවතින ශේෂය: <b style="color:#34d399">${scrap.quantity} units</b> · එකතුව: <b>${money(scrap.totalValue)}</b>
        </div>
      </div>

      <!-- Acquisitions Table -->
      <div>
        <h4 style="margin:0 0 8px;font-size:13px;color:#34d399">📥 ලැබීම් ඉතිහාසය (Inflow / Acquisitions):</h4>
        <div class="tbl-wrap" style="max-height:160px;overflow-y:auto">
          <table class="report-table" style="font-size:11.5px">
            <thead>
              <tr><th>දිනය</th><th>ප්‍රමාණය</th><th>පාරිභෝගිකයා / විස්තර</th><th>බිල්පත</th><th>කාර්ය මණ්ඩලය</th></tr>
            </thead>
            <tbody>
              ${acquisitions.slice().reverse().map(a => `
                <tr>
                  <td>${esc(a.date || '—')}</td>
                  <td><b style="color:#34d399">+${a.qty}</b></td>
                  <td>${esc(a.customerName || 'Exchange')}</td>
                  <td><small>${esc(a.sourceSaleId || 'Manual')}</small></td>
                  <td><small>${esc(a.recordedBy || 'Staff')}</small></td>
                </tr>
              `).join('') || '<tr><td colspan="5" class="empty">වාර්තා නැත</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Disposals Table -->
      <div>
        <h4 style="margin:0 0 8px;font-size:13px;color:#f87171">📤 අලෙවි ඉතිහාසය (Outflow / Sales):</h4>
        <div class="tbl-wrap" style="max-height:160px;overflow-y:auto">
          <table class="report-table" style="font-size:11.5px">
            <thead>
              <tr><th>දිනය</th><th>ප්‍රමාණය</th><th>ගැනුම්කරු</th><th>ලැබුණු මුදල</th><th>කාර්ය මණ්ඩලය</th></tr>
            </thead>
            <tbody>
              ${disposals.slice().reverse().map(d => `
                <tr>
                  <td>${esc(d.date || '—')}</td>
                  <td><b style="color:#f87171">−${d.qty}</b></td>
                  <td>${esc(d.buyer || 'Scrap Dealer')}</td>
                  <td style="color:#34d399;font-weight:700">${money(d.amountReceived || 0)}</td>
                  <td><small>${esc(d.recordedBy || 'Staff')}</small></td>
                </tr>
              `).join('') || '<tr><td colspan="5" class="empty">වාර්තා නැත</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;

  openModal(
    '📊 Scrap ඉතිහාසය',
    scrap.productName + ' — Core Audit Log',
    modalBody,
    `<button class="btn" onclick="closeModal()">වසන්න</button>`
  );
}

window.pgScrap = pgScrap;
window.renderScrapCard = renderScrapCard;
window.sellScrap = sellScrap;
window.recalcScrapAmount = recalcScrapAmount;
window.confirmSellScrap = confirmSellScrap;
window.openAddScrapModal = openAddScrapModal;
window.saveAddScrap = saveAddScrap;
window.viewScrapHistory = viewScrapHistory;
