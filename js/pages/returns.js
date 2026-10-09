/* =========================================================
   js/pages/returns.js - Product Returns & Approvals Workflow
   Cashier Request & Admin Approval Flow with Discount Protection
   ========================================================= */

window.returnsTab = window.returnsTab || 'pending'; // 'pending' | 'all' | 'summary'
window.returnsFilters = window.returnsFilters || { status: 'all', date: 'all', cashier: 'all' };
window.returnModalState = window.returnModalState || { selectedSale: null, items: {}, reason: 'වැරදි භාණ්ඩය (Wrong Item)', note: '' };
window._knownReturnStatuses = window._knownReturnStatuses || {};

/* ---------- Main Dispatcher ---------- */
function pgReturns(){
  if(!state.user){
    return `<div class="card"><div class="empty">කරුණාකර ප්‍රථමයෙන් පද්ධතියට පිවිසෙන්න</div></div>`;
  }
  if(!hasPermission('returns')){
    return `<div class="card"><div class="empty" style="padding:40px;text-align:center"><div style="font-size:36px;margin-bottom:10px">🔒</div><b>ඔබට ආපසු භාරදීම් (Returns) අංශයට ප්‍රවේශ වීමට අවසර නැත</b><p style="color:var(--muted);font-size:12px;margin-top:4px">Access Denied · Returns permission required</p></div></div>`;
  }

  if(state.user.role === 'cashier'){
    return pgReturnsCashier();
  } else {
    return pgReturnsAdmin();
  }
}

/* =========================================================
   CASHIER VIEW: My Requests & Create Request
   ========================================================= */
function pgReturnsCashier(){
  const db = window.DB || {};
  const allReturns = db.returns || [];

  // Filter only cashier's own requests
  const myReturns = allReturns.filter(r => r.requestedBy === state.user.name || r.requestedById === state.user.id);

  const pending = myReturns.filter(r => r.status === 'pending');
  const approved = myReturns.filter(r => r.status === 'approved');
  const rejected = myReturns.filter(r => r.status === 'rejected');
  const totalAmount = myReturns.reduce((a, r) => a + Number(r.amount || 0), 0);

  return `
  <div class="returns-page">

    <!-- Header -->
    <div class="returns-header">
      <div>
        <h2>↩️ මගේ ආපසු ඉල්ලීම් <small>My Return Requests · Cashier View</small></h2>
      </div>
      <div>
        <button type="button" class="btn btn-primary" onclick="returnsOpenNewRequest()">
          + නව ඉල්ලීමක් (New Request)
        </button>
      </div>
    </div>

    <!-- 4 Stats Cards -->
    <div class="stats">
      <div class="stat">
        <div class="ic" style="background:rgba(245,158,11,.15);color:#fcd34d">⏳</div>
        <div><b>${pending.length}</b><span>අපේක්ෂිත / Pending</span></div>
      </div>
      <div class="stat">
        <div class="ic" style="background:rgba(16,185,129,.15);color:#6ee7b7">✅</div>
        <div><b>${approved.length}</b><span>අනුමත / Approved</span></div>
      </div>
      <div class="stat">
        <div class="ic" style="background:rgba(239,68,68,.15);color:#fca5a5">❌</div>
        <div><b>${rejected.length}</b><span>ප්‍රතික්ෂේප / Rejected</span></div>
      </div>
      <div class="stat">
        <div class="ic" style="background:rgba(59,130,246,.15);color:#93c5fd">💰</div>
        <div><b>${money(totalAmount)}</b><span>මුළු එකතුව / Total</span></div>
      </div>
    </div>

    <!-- My Requests Table Card -->
    <div class="card">
      <div class="card-h">
        <h3>📋 මගේ ඉල්ලීම් ලැයිස්තුව <small>Submitted Requests (${myReturns.length})</small></h3>
      </div>
      <!-- Desktop Table View -->
      <div class="desktop-only tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>අංකය</th>
              <th>දිනය</th>
              <th>බිල් අංකය</th>
              <th>භාණ්ඩ</th>
              <th style="text-align:right">මුදල</th>
              <th style="text-align:center">තත්ත්වය</th>
              <th style="text-align:center">ක්‍රියා</th>
            </tr>
          </thead>
          <tbody>
            ${myReturns.slice().reverse().map(r => `
              <tr>
                <td><b>${esc(r.no)}</b></td>
                <td><small>${esc(r.date)}</small></td>
                <td><b>${esc(r.invoice)}</b><br><small style="color:var(--muted)">${esc(r.customer || '')}</small></td>
                <td>${(r.items || []).map(i => `${esc(i.name)} × ${i.qty}`).join(', ')}</td>
                <td style="text-align:right;font-weight:700;color:var(--primary)">${money(r.amount)}</td>
                <td style="text-align:center">${renderStatusBadge(r.status)}</td>
                <td style="text-align:center;white-space:nowrap">
                  <button type="button" class="btn btn-sm" onclick="returnsViewDetails('${r.id}')" title="විස්තර බලන්න">👁️ බලන්න</button>
                  ${r.status === 'pending' ? `
                    <button type="button" class="btn btn-sm btn-red" onclick="returnsCancelRequest('${r.id}')" title="අවලංගු කරන්න">✕ අවලංගු</button>
                  ` : ''}
                  ${r.status === 'approved' && r.customerId ? `
                    <button type="button" class="btn btn-sm btn-blue" onclick="createBillFromReturn('${r.id}')" title="නව බිලක් සාදන්න">🔄 නව බිලක්</button>
                  ` : ''}
                </td>
              </tr>
            `).join('') || `<tr><td colspan="7" class="empty" style="text-align:center;padding:26px">ආපසු ඉල්ලීම් නැත (No return requests yet)</td></tr>`}
          </tbody>
        </table>
      </div>

      <!-- Mobile Cards View -->
      <div class="mobile-only returns-cards-wrap">
        ${myReturns.slice().reverse().map(r => renderCashierReturnCard(r)).join('') || `<div class="empty" style="text-align:center;padding:26px">ආපසු ඉල්ලීම් නැත (No return requests yet)</div>`}
      </div>
    </div>

  </div>`;
}

/* =========================================================
   ADMIN VIEW: Approvals, All Requests & Summary
   ========================================================= */
function pgReturnsAdmin(){
  const db = window.DB || {};
  const allReturns = db.returns || [];

  const pending = allReturns.filter(r => r.status === 'pending');
  const approved = allReturns.filter(r => r.status === 'approved');
  const rejected = allReturns.filter(r => r.status === 'rejected');
  const totalApprovedAmount = approved.reduce((a, r) => a + Number(r.amount || 0), 0);

  const activeTab = window.returnsTab || 'pending';

  return `
  <div class="returns-page">

    <!-- Header -->
    <div class="returns-header">
      <div>
        <h2>↩️ ආපසු භාරදීම් <small>Returns & Refunds Management · Admin Control</small></h2>
      </div>
      <div>
        <button type="button" class="btn btn-primary btn-sm" onclick="returnsOpenNewRequest()">
          + නව ඉල්ලීමක් (New Request)
        </button>
      </div>
    </div>

    <!-- 4 Stats Cards -->
    <div class="stats">
      <div class="stat">
        <div class="ic" style="background:rgba(245,158,11,.15);color:#fcd34d">⏳</div>
        <div><b>${pending.length}</b><span>අපේක්ෂිත / Pending</span></div>
      </div>
      <div class="stat">
        <div class="ic" style="background:rgba(16,185,129,.15);color:#6ee7b7">✅</div>
        <div><b>${approved.length}</b><span>අනුමත / Approved</span></div>
      </div>
      <div class="stat">
        <div class="ic" style="background:rgba(239,68,68,.15);color:#fca5a5">❌</div>
        <div><b>${rejected.length}</b><span>ප්‍රතික්ෂේප / Rejected</span></div>
      </div>
      <div class="stat">
        <div class="ic" style="background:rgba(16,185,129,.15);color:#6ee7b7">💰</div>
        <div><b>${money(totalApprovedAmount)}</b><span>ආපසු ගෙවීම් / Total Refunds</span></div>
      </div>
    </div>

    <!-- Tabs Navigation -->
    <div class="returns-tabs">
      <button type="button" class="returns-tab ${activeTab === 'pending' ? 'active' : ''}" onclick="returnsSetTab('pending')">
        ⏳ අනුමැතිය අපේක්ෂිත ${pending.length > 0 ? `<span class="tab-badge">${pending.length}</span>` : ''}
      </button>
      <button type="button" class="returns-tab ${activeTab === 'all' ? 'active' : ''}" onclick="returnsSetTab('all')">
        📜 සියලු ඉල්ලීම් (${allReturns.length})
      </button>
      <button type="button" class="returns-tab ${activeTab === 'summary' ? 'active' : ''}" onclick="returnsSetTab('summary')">
        📊 සාරාංශය / Summary
      </button>
    </div>

    <!-- Tab Content -->
    ${activeTab === 'pending' ? renderAdminPendingTab(pending) : ''}
    ${activeTab === 'all' ? renderAdminAllTab(allReturns) : ''}
    ${activeTab === 'summary' ? renderAdminSummaryTab(allReturns) : ''}

  </div>`;
}

function returnsSetTab(tab){
  window.returnsTab = tab;
  render();
}

/* ---------- Tab 1: Pending Cards Layout ---------- */
function renderAdminPendingTab(pendingList){
  if(!pendingList.length){
    return `
    <div class="card">
      <div class="empty" style="text-align:center;padding:36px;color:var(--muted)">
        <div style="font-size:32px;margin-bottom:8px">🎉</div>
        <b>අනුමැතිය සඳහා රැඳී ඇති ආපසු ඉල්ලීම් නොමැත</b>
        <p style="font-size:12px;margin-top:4px">සියලු ඉල්ලීම් අනුමත හෝ ප්‍රතික්ෂේප කර ඇත (No pending returns)</p>
      </div>
    </div>`;
  }

  return `
  <div class="returns-cards-grid">
    ${pendingList.slice().reverse().map(r => `
      <div class="return-card">
        <div class="return-card-header">
          <span class="return-card-no">${esc(r.no)}</span>
          <span class="return-status-badge pending">⏳ අපේක්ෂිත</span>
          <span class="return-card-time">${formatRelativeTime(r.createdAt || r.date)}</span>
        </div>
        <div class="return-card-meta">
          <div>👤 කැෂියර්: <b>${esc(r.requestedBy || 'නොදනී')}</b></div>
          <div>🧾 බිල් අංකය: <b>${esc(r.invoice)}</b></div>
          <div>👥 පාරිභෝගික: <b>${esc(r.customer || 'වෝක්-ඉන්')}</b></div>
          <div>📝 හේතුව: <b>${esc(r.reason)}</b></div>
        </div>
        <div class="return-card-items">
          <div style="font-size:11.5px;color:var(--muted);font-weight:600">භාණ්ඩ:</div>
          ${(r.items || []).map(it => `
            <div class="return-item-row">
              <span class="return-item-title">• ${esc(it.name)} × ${it.qty}</span>
              <span class="return-item-price">${money(it.qty * (it.effectivePrice != null ? it.effectivePrice : it.price))}</span>
            </div>
          `).join('')}
          <div class="return-card-total">
            <span>මුළු එකතුව:</span>
            <span>${money(r.amount)}</span>
          </div>
        </div>
        ${r.notes ? `<div class="return-card-note">📝 සටහන: "${esc(r.notes)}"</div>` : ''}
        <div class="return-card-footer">
          <button type="button" class="btn btn-sm" onclick="returnsViewDetails('${r.id}')">👁️ විස්තර</button>
          <button type="button" class="btn btn-sm btn-red" onclick="returnsRejectModal('${r.id}')">❌ ප්‍රතික්ෂේප</button>
          <button type="button" class="btn btn-sm btn-green" onclick="returnsApproveModal('${r.id}')">✅ අනුමත කරන්න</button>
        </div>
      </div>
    `).join('')}
  </div>`;
}

/* ---------- Tab 2: All Requests Table with Filters ---------- */
function renderAdminAllTab(allReturns){
  const filters = window.returnsFilters;

  // Filter list
  let list = allReturns.slice().reverse();

  if(filters.status !== 'all'){
    list = list.filter(r => r.status === filters.status);
  }

  if(filters.cashier !== 'all'){
    list = list.filter(r => (r.requestedBy || '').toLowerCase() === filters.cashier.toLowerCase());
  }

  if(filters.date === 'today'){
    const t = today();
    list = list.filter(r => (r.date || '').slice(0, 10) === t);
  } else if(filters.date === 'week'){
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
    list = list.filter(r => (r.date || '').slice(0, 10) >= weekAgo);
  } else if(filters.date === 'month'){
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
    list = list.filter(r => (r.date || '').slice(0, 10) >= monthAgo);
  }

  const cashiers = [...new Set(allReturns.map(r => r.requestedBy).filter(Boolean))];

  return `
  <div class="card">
    <div class="returns-filters-bar">
      <div class="returns-filter-group">
        <span class="returns-filter-label">තත්ත්වය:</span>
        <select onchange="returnsSetFilter('status', this.value)">
          <option value="all" ${filters.status === 'all' ? 'selected' : ''}>සියල්ල (All)</option>
          <option value="pending" ${filters.status === 'pending' ? 'selected' : ''}>⏳ අපේක්ෂිත (Pending)</option>
          <option value="approved" ${filters.status === 'approved' ? 'selected' : ''}>✅ අනුමත (Approved)</option>
          <option value="rejected" ${filters.status === 'rejected' ? 'selected' : ''}>❌ ප්‍රතික්ෂේප (Rejected)</option>
          <option value="cancelled" ${filters.status === 'cancelled' ? 'selected' : ''}>🚫 අවලංගු (Cancelled)</option>
        </select>
      </div>

      <div class="returns-filter-group">
        <span class="returns-filter-label">දිනය:</span>
        <select onchange="returnsSetFilter('date', this.value)">
          <option value="all" ${filters.date === 'all' ? 'selected' : ''}>සියල්ල (All)</option>
          <option value="today" ${filters.date === 'today' ? 'selected' : ''}>අද (Today)</option>
          <option value="week" ${filters.date === 'week' ? 'selected' : ''}>සතිය (This Week)</option>
          <option value="month" ${filters.date === 'month' ? 'selected' : ''}>මාසය (This Month)</option>
        </select>
      </div>

      <div class="returns-filter-group">
        <span class="returns-filter-label">කැෂියර්:</span>
        <select onchange="returnsSetFilter('cashier', this.value)">
          <option value="all" ${filters.cashier === 'all' ? 'selected' : ''}>සියලු කැෂියර් (All)</option>
          ${cashiers.map(c => `
            <option value="${esc(c)}" ${filters.cashier === c ? 'selected' : ''}>${esc(c)}</option>
          `).join('')}
        </select>
      </div>
    </div>

    <!-- Desktop Table View -->
    <div class="desktop-only tbl-wrap">
      <table>
        <thead>
          <tr>
            <th>අංකය</th>
            <th>දිනය</th>
            <th>කැෂියර්</th>
            <th>බිල් අංකය</th>
            <th>පාරිභෝගික</th>
            <th>භාණ්ඩ</th>
            <th style="text-align:right">මුදල</th>
            <th style="text-align:center">තත්ත්වය</th>
            <th style="text-align:center">ක්‍රියා</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(r => `
            <tr>
              <td><b>${esc(r.no)}</b></td>
              <td><small>${esc(r.date)}</small></td>
              <td><b>${esc(r.requestedBy || 'නොදනී')}</b></td>
              <td><b>${esc(r.invoice)}</b></td>
              <td>${esc(r.customer || 'වෝක්-ඉන්')}</td>
              <td>${(r.items || []).map(i => `${esc(i.name)} × ${i.qty}`).join(', ')}</td>
              <td style="text-align:right;font-weight:700;color:var(--primary)">${money(r.amount)}</td>
              <td style="text-align:center">${renderStatusBadge(r.status)}</td>
              <td style="text-align:center;white-space:nowrap">
                <button type="button" class="btn btn-sm" onclick="returnsViewDetails('${r.id}')" title="විස්තර">👁️</button>
                ${r.status === 'pending' ? `
                  <button type="button" class="btn btn-sm btn-green" onclick="returnsApproveModal('${r.id}')" title="අනුමත">✅</button>
                  <button type="button" class="btn btn-sm btn-red" onclick="returnsRejectModal('${r.id}')" title="ප්‍රතික්ෂේප">❌</button>
                ` : ''}
                ${r.status === 'approved' && r.customerId ? `
                  <button type="button" class="btn btn-sm btn-blue" onclick="createBillFromReturn('${r.id}')" title="නව බිලක් සාදන්න">🔄 නව බිලක්</button>
                ` : ''}
              </td>
            </tr>
          `).join('') || `<tr><td colspan="9" class="empty" style="text-align:center;padding:26px">ගැලපෙන ආපසු ඉල්ලීම් හමු නොවීය</td></tr>`}
        </tbody>
      </table>
    </div>

    <!-- Mobile Cards View -->
    <div class="mobile-only returns-cards-wrap">
      ${list.map(r => renderAdminReturnRowCard(r)).join('') || `<div class="empty" style="text-align:center;padding:26px">ගැලපෙන ආපසු ඉල්ලීම් හමු නොවීය</div>`}
    </div>
  </div>`;
}

function returnsSetFilter(k, val){
  window.returnsFilters[k] = val;
  render();
}

/* ---------- Tab 3: Summary & Analytics ---------- */
function renderAdminSummaryTab(allReturns){
  const approved = allReturns.filter(r => r.status === 'approved');
  const totalApproved = approved.reduce((a, r) => a + Number(r.amount || 0), 0);

  // Breakdown by reason
  const reasonMap = {};
  allReturns.forEach(r => {
    const k = r.reason || 'වෙනත්';
    if(!reasonMap[k]) reasonMap[k] = { count: 0, amount: 0 };
    reasonMap[k].count++;
    reasonMap[k].amount += Number(r.amount || 0);
  });

  // Breakdown by cashier
  const cashierMap = {};
  allReturns.forEach(r => {
    const k = r.requestedBy || 'නොදනී';
    if(!cashierMap[k]) cashierMap[k] = { count: 0, amount: 0, approved: 0 };
    cashierMap[k].count++;
    cashierMap[k].amount += Number(r.amount || 0);
    if(r.status === 'approved') cashierMap[k].approved++;
  });

  // Breakdown by category/item
  const itemMap = {};
  approved.forEach(r => {
    (r.items || []).forEach(it => {
      const k = it.name || it.code || 'Item';
      if(!itemMap[k]) itemMap[k] = { qty: 0, total: 0 };
      itemMap[k].qty += Number(it.qty || 0);
      itemMap[k].total += Number(it.qty || 0) * Number(it.effectivePrice != null ? it.effectivePrice : it.price);
    });
  });

  return `
  <div class="returns-summary-grid">
    <div class="returns-breakdown-card">
      <h4>📝 හේතු අනුව බෙදීම (By Reason)</h4>
      ${Object.entries(reasonMap).map(([rs, data]) => `
        <div class="returns-breakdown-row">
          <span>${esc(rs)} (${data.count})</span>
          <b>${money(data.amount)}</b>
        </div>
      `).join('') || '<div class="empty" style="padding:10px">දත්ත නැත</div>'}
    </div>

    <div class="returns-breakdown-card">
      <h4>👤 කැෂියර් අනුව බෙදීම (By Cashier)</h4>
      ${Object.entries(cashierMap).map(([c, data]) => `
        <div class="returns-breakdown-row">
          <span>${esc(c)} (${data.count} ඉල්ලීම්)</span>
          <b>${money(data.amount)}</b>
        </div>
      `).join('') || '<div class="empty" style="padding:10px">දත්ත නැත</div>'}
    </div>

    <div class="returns-breakdown-card">
      <h4>📦 ආපසු ලැබූ භාණ්ඩ (Returned Items)</h4>
      ${Object.entries(itemMap).slice(0, 8).map(([name, data]) => `
        <div class="returns-breakdown-row">
          <span>${esc(name)} × ${data.qty}</span>
          <b style="color:#6ee7b7">${money(data.total)}</b>
        </div>
      `).join('') || '<div class="empty" style="padding:10px">අනුමත දත්ත නැත</div>'}
    </div>
  </div>`;
}

/* =========================================================
   NEW RETURN REQUEST MODAL (Cashier & Admin)
   ========================================================= */
function returnsOpenNewRequest(){
  if(!hasPermission('returns')){
    toast('ආපසු ඉල්ලීම් කිරීමට ඔබට අවසර නැත', 'err');
    return;
  }
  if(typeof requireActiveShift === 'function' && !requireActiveShift('return request')) return;

  const db = window.DB || {};
  const sales = (db.sales || []).slice().reverse();

  if(!sales.length){
    toast('පද්ධතියේ කිසිදු බිල්පතක් නොමැත (No sales available)', 'err');
    return;
  }

  window.returnModalState = {
    selectedSale: null,
    items: {},
    reason: 'වැරදි භාණ්ඩය (Wrong Item)',
    note: ''
  };

  const recent10 = sales.slice(0, 10);

  const modalBody = `
  <div style="display:flex;flex-direction:column;gap:12px">

    <!-- STEP 1: Invoice Picker -->
    <div class="new-request-step">
      <div class="new-request-step-title">
        <span>STEP 1: බිල්පත තෝරන්න (Select Invoice) *</span>
      </div>
      <div>
        <input id="rSearchSaleInput" placeholder="🔍 බිල් අංකය හෝ පාරිභෝගික නම සොයන්න..."
               oninput="returnsSearchSales(this.value)">
      </div>
      <div class="sales-picker" id="rSalesPicker">
        ${renderSalesPickerList(recent10)}
      </div>
    </div>

    <!-- STEP 2: Items Picker (shown after invoice selected) -->
    <div class="new-request-step hidden" id="rItemsStep">
      <div class="new-request-step-title">
        <span>STEP 2: භාණ්ඩ තෝරන්න (Select Items to Return) *</span>
        <span id="rDiscBadgeSlot"></span>
      </div>
      <div id="rItemsPickerSlot"></div>
    </div>

    <!-- STEP 3 & 4: Reason & Note -->
    <div class="grid2">
      <div class="new-request-step" style="margin-bottom:0">
        <div class="new-request-step-title">STEP 3: හේතුව (Reason)</div>
        <select id="rReason" style="margin-top:4px" onchange="returnModalState.reason = this.value">
          <option value="වැරදි භාණ්ඩය (Wrong Item)">වැරදි භාණ්ඩය (Wrong Item)</option>
          <option value="හානි වූ භාණ්ඩය (Damaged Item)">හානි වූ භාණ්ඩය (Damaged Item)</option>
          <option value="පාරිභෝගිකයාට අවශ්‍ය නැත (Not Required)">පාරිභෝගිකයාට අවශ්‍ය නැත (Not Required)</option>
          <option value="නොගැලපෙන මාදිලිය (Model Incompatible)">නොගැලපෙන මාදිලිය (Model Incompatible)</option>
          <option value="වෙනත් (Other)">වෙනත් (Other)</option>
        </select>
      </div>

      <div class="new-request-step" style="margin-bottom:0">
        <div class="new-request-step-title">STEP 4: සටහන (Optional Note)</div>
        <input id="rNote" placeholder="අමතර විස්තර ඇත්නම් මෙහි ලියන්න..." style="margin-top:4px"
               oninput="returnModalState.note = this.value">
      </div>
    </div>

    <!-- Summary Box -->
    <div style="background:#0b1220;border:1px solid var(--line);border-radius:9px;padding:12px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <span style="font-size:12.5px;color:var(--muted)">ආපසු මුදල (Refund Amount):</span>
        <div id="rModalRefundTotal" style="font-size:18px;font-weight:700;color:var(--primary)">රු. 0.00</div>
      </div>
      <div style="font-size:11.5px;color:#fcd34d">
        ⚠️ Admin අනුමැතිය අවශ්‍යයි (Approval Required)
      </div>
    </div>

  </div>`;

  const modalFooter = `
    <button type="button" class="btn" onclick="closeModal()">අවලංගු කරන්න / Cancel</button>
    <button type="button" class="btn btn-primary" onclick="returnsSubmitRequest()">📤 ඉල්ලීම යවන්න (Submit)</button>`;

  openModal('↩️ නව ආපසු ඉල්ලීම', 'New Return Request · Cashier to Admin Flow', modalBody, modalFooter, true);
}

function renderSalesPickerList(salesList){
  if(!salesList.length){
    return `<div style="padding:12px;text-align:center;color:var(--muted);font-size:12px">බිල්පත් හමු නොවීය</div>`;
  }

  const selectedId = returnModalState.selectedSale ? returnModalState.selectedSale.id : '';

  return salesList.map(s => `
    <div class="sales-picker-item ${s.id === selectedId ? 'selected' : ''}" onclick="returnsSelectSale('${s.id}')">
      <div class="sales-picker-left">
        <b>${esc(s.no)} · ${esc(s.customer || 'වෝක්-ඉන්')}</b>
        <small>${esc(s.date?.slice(0, 10) || '')} · ක්‍රමය: ${s.method === 'cash' ? '💵 මුදල්' : s.method === 'credit' ? '👥 ණය' : '💳 කාඩ්'}</small>
      </div>
      <div class="sales-picker-right">
        ${money(s.total)}
      </div>
    </div>
  `).join('');
}

function returnsSearchSales(query){
  const q = (query || '').trim().toLowerCase();
  const db = window.DB || {};
  const sales = (db.sales || []).slice().reverse();

  let matched = sales;
  if(q){
    matched = sales.filter(s =>
      (s.no || '').toLowerCase().includes(q) ||
      (s.customer || '').toLowerCase().includes(q) ||
      (s.vehicle || '').toLowerCase().includes(q)
    );
  }

  const picker = $('#rSalesPicker');
  if(picker) picker.innerHTML = renderSalesPickerList(matched.slice(0, 10));
}

function returnsSelectSale(saleId){
  const db = window.DB || {};
  const s = (db.sales || []).find(x => x.id === saleId);
  if(!s) return;

  returnModalState.selectedSale = s;
  returnModalState.items = {};

  // Highlight item in picker
  $$('.sales-picker-item').forEach(el => el.classList.remove('selected'));
  const picker = $('#rSalesPicker');
  if(picker) picker.innerHTML = renderSalesPickerList((db.sales || []).slice().reverse().slice(0, 10));

  // Render Step 2 Items Picker
  returnsRenderItemPicker();
}

function returnsGetEffectivePrice(sale, item){
  const sub = Number(sale.sub || sale.total || 0);
  const disc = Number(sale.disc || 0);
  const discountRate = (sub > 0 && disc > 0) ? (disc / sub) : 0;
  return item.price * (1 - discountRate);
}

function returnsRenderItemPicker(){
  const s = returnModalState.selectedSale;
  if(!s) return;

  const stepEl = $('#rItemsStep');
  if(stepEl) stepEl.classList.remove('hidden');

  const sub = Number(s.sub || s.total || 0);
  const disc = Number(s.disc || 0);
  const discountRate = (sub > 0 && disc > 0) ? (disc / sub) : 0;

  const badgeSlot = $('#rDiscBadgeSlot');
  if(badgeSlot){
    badgeSlot.innerHTML = discountRate > 0
      ? `<span class="pill warn" style="font-size:10px">🏷️ වට්ටම් අනුපාතය: ${(discountRate * 100).toFixed(1)}% අඩුවෙන් ගණනය වේ</span>`
      : '';
  }

  const slot = $('#rItemsPickerSlot');
  if(!slot) return;

  slot.innerHTML = `
  <table class="item-qty-picker-table">
    <thead>
      <tr>
        <th style="width:30px;text-align:center">තෝරන්න</th>
        <th>භාණ්ඩය (Item)</th>
        <th style="text-align:center">ගත් ප්‍රමාණය</th>
        <th style="text-align:center">ආපසු ප්‍රමාණය</th>
        <th style="text-align:right">මුල් මිල</th>
        <th style="text-align:right">ශුද්ධ මිල</th>
        <th style="text-align:right">පේළි එකතුව</th>
      </tr>
    </thead>
    <tbody>
      ${s.items.map((it, ix) => {
        const effPrice = returnsGetEffectivePrice(s, it);
        return `
        <tr>
          <td style="text-align:center">
            <input type="checkbox" id="rChk_${ix}" onchange="returnsToggleItem(${ix})"
                   style="width:16px;height:16px;cursor:pointer">
          </td>
          <td>
            <b>${esc(it.name)}</b><br>
            <small style="color:var(--muted)">${esc(it.code || '')}</small>
          </td>
          <td style="text-align:center">${it.qty}</td>
          <td style="text-align:center">
            <input type="number" id="rQty_${ix}" class="item-qty-input"
                   min="1" max="${it.qty}" value="1" disabled
                   oninput="returnsUpdateItemQty(${ix}, this.value)">
          </td>
          <td style="text-align:right;color:var(--muted);${discountRate > 0 ? 'text-decoration:line-through' : ''}">
            ${money(it.price)}
          </td>
          <td style="text-align:right;font-weight:700;color:var(--green)">
            ${money(effPrice)}
          </td>
          <td style="text-align:right;font-weight:700;color:var(--primary)" id="rLineTot_${ix}">
            රු. 0.00
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;

  returnsCalcReturnTotal();
}

function returnsToggleItem(ix){
  const chk = $(`#rChk_${ix}`);
  const qtyInp = $(`#rQty_${ix}`);
  const s = returnModalState.selectedSale;
  if(!s || !chk) return;

  const isChecked = chk.checked;
  if(qtyInp) qtyInp.disabled = !isChecked;

  if(!returnModalState.items[ix]){
    returnModalState.items[ix] = { selected: false, qty: 1 };
  }

  returnModalState.items[ix].selected = isChecked;
  returnModalState.items[ix].qty = qtyInp ? (parseInt(qtyInp.value) || 1) : 1;

  returnsCalcReturnTotal();
}

function returnsUpdateItemQty(ix, val){
  const s = returnModalState.selectedSale;
  if(!s) return;
  const it = s.items[ix];
  let q = parseInt(val) || 1;
  if(q < 1) q = 1;
  if(q > it.qty) q = it.qty;

  const inp = $(`#rQty_${ix}`);
  if(inp) inp.value = q;

  if(returnModalState.items[ix]){
    returnModalState.items[ix].qty = q;
  }

  returnsCalcReturnTotal();
}

function returnsCalcReturnTotal(){
  const s = returnModalState.selectedSale;
  if(!s) return 0;

  let total = 0;
  s.items.forEach((it, ix) => {
    const sel = returnModalState.items[ix];
    const lineEl = $(`#rLineTot_${ix}`);
    if(sel && sel.selected && sel.qty > 0){
      const effPrice = returnsGetEffectivePrice(s, it);
      const lineTot = sel.qty * effPrice;
      total += lineTot;
      if(lineEl) lineEl.textContent = money(lineTot);
    } else {
      if(lineEl) lineEl.textContent = 'රු. 0.00';
    }
  });

  const totEl = $('#rModalRefundTotal');
  if(totEl) totEl.textContent = money(total);

  return total;
}

// Backward compatibility alias
function calcReturnTotal(){
  return returnsCalcReturnTotal();
}

/* ---------- Submit Return Request ---------- */
async function returnsSubmitRequest(){
  const s = returnModalState.selectedSale;
  if(!s){
    toast('කරුණාකර පළමුව බිල්පතක් තෝරන්න (Select an invoice)', 'warn');
    return;
  }

  const items = [];
  let totalRefund = 0;

  s.items.forEach((it, ix) => {
    const sel = returnModalState.items[ix];
    if(sel && sel.selected && sel.qty > 0){
      const effPrice = returnsGetEffectivePrice(s, it);
      const lineTot = sel.qty * effPrice;
      totalRefund += lineTot;
      items.push({
        pid: it.pid,
        code: it.code || '',
        name: it.name || '',
        price: it.price,
        effectivePrice: effPrice,
        qty: sel.qty
      });
    }
  });

  if(!items.length){
    toast('ආපසු දෙන භාණ්ඩ අවම වශයෙන් එකක්වත් තෝරන්න', 'warn');
    return;
  }

  const db = window.DB || {};
  if(!db.counters) db.counters = {};
  const retNo = 'RET-' + pad(db.counters.ret = (db.counters.ret || 0) + 1);

  const activeShift = (typeof Shift !== 'undefined' && state.user) ? Shift.getActive(state.user.id) : null;

  const returnDoc = {
    id: uid('R'),
    no: retNo,
    shopId: (typeof currentShopId === 'function' && currentShopId()) ? currentShopId() : (window.state?.user?.shopId || 'SHOP-001'),
    invoice: s.no,
    saleId: s.id,
    customerId: s.customerId || null,
    customer: s.customer || 'වෝක්-ඉන්',
    date: today(),
    createdAt: new Date().toISOString(),
    reason: $('#rReason')?.value || returnModalState.reason || 'වෙනත්',
    notes: $('#rNote')?.value || returnModalState.note || '',
    items,
    amount: totalRefund,
    refundMethod: s.method === 'cash' ? 'cash' : (s.method === 'credit' ? 'credit' : 'card'),
    status: 'pending',
    requestedBy: state.user ? state.user.name : 'කැෂියර්',
    requestedById: state.user ? state.user.id : null,
    cashierId: state.user ? state.user.id : null,
    cashierName: state.user ? state.user.name : 'කැෂියර්',
    shiftId: activeShift ? activeShift.id : (s.shiftId || null),
    notified: false,
    approvedBy: null,
    approvedById: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null
  };

  if(!db.returns) db.returns = [];
  db.returns.push(returnDoc);

  if(window.FB && window.FB.fbAdd){
    await (window.shopAdd ? window.shopAdd(window.FB.COL.returns, returnDoc) : window.FB.fbAdd(window.FB.COL.returns, returnDoc));
  }
  if(typeof saveDB === 'function') saveDB();

  // Record status in local tracker
  window._knownReturnStatuses[returnDoc.id] = 'pending';

  closeModal();
  renderNav();
  render();
  toast('ඉල්ලීම යවන ලදී — Admin අනුමැතිය අවශ්‍යයි ⏳', 'ok');
}

/* =========================================================
   ADMIN ACTIONS: Approve & Reject Flows
   ========================================================= */
function returnsApproveModal(id){
  const user = state.user;
  if(!user || (user.role !== 'admin' && user.role !== 'superadmin')){
    toast('අනුමත කිරීමට අවසර නැත (Admin only)', 'err');
    return;
  }

  const db = window.DB || {};
  const r = (db.returns || []).find(x => x.id === id);
  if(!r) return;

  const methodText = r.refundMethod === 'cash'
    ? '💵 මුදල් (Cash Drawer)'
    : (r.refundMethod === 'credit' ? '👥 පාරිභෝගික ණය ගිණුම (Store Credit)' : '💳 කාඩ්පත (Card)');

  const impactWarning = r.refundMethod === 'cash'
    ? `<div class="pill warn" style="margin-top:6px">⚠️ මෙය කැෂියර්ගේ ලාච්චුවෙන් ${money(r.amount)} ක් අඩු වනු ඇත. (Cash drawer will be reduced)</div>`
    : (r.refundMethod === 'credit'
      ? `<div class="pill info" style="margin-top:6px">ℹ️ පාරිභෝගිකයාගේ ණය ශේෂයෙන් ${money(r.amount)} ක් අඩු වනු ඇත.</div>`
      : `<div class="pill mute" style="margin-top:6px">ℹ️ කාඩ්පත් ගනුදෙනුවක් බැවින් මුදල් ලාච්චුවට බලපෑමක් නැත.</div>`);

  const modalBody = `
  <div style="display:flex;flex-direction:column;gap:12px">
    <div style="background:#141f33;padding:12px;border-radius:9px;border:1px solid var(--line)">
      <div style="font-size:14px;font-weight:700;color:var(--primary)">${esc(r.no)} · ${esc(r.requestedBy || 'කැෂියර්')}</div>
      <div style="font-size:12px;color:var(--muted);margin-top:3px">
        බිල්පත: <b>${esc(r.invoice)}</b> | පාරිභෝගික: <b>${esc(r.customer || 'වෝක්-ඉන්')}</b>
      </div>
    </div>

    <div class="return-impact-box">
      <div style="font-weight:700;color:var(--txt)">ආපසු භාරදෙන භාණ්ඩ (Items & Stock Impact):</div>
      ${(r.items || []).map(it => `
        <div style="display:flex;justify-content:space-between;color:var(--muted)">
          <span>• ${esc(it.name)} × ${it.qty}</span>
          <b style="color:#6ee7b7">→ තොග +${it.qty}</b>
        </div>
      `).join('')}
    </div>

    <div class="return-impact-box">
      <div style="font-weight:700;color:var(--txt)">මුදල් ආපසු ගෙවීම (Refund Details):</div>
      <div style="display:flex;justify-content:space-between;color:var(--muted)">
        <span>ගෙවීම් ක්‍රමය (Method):</span>
        <b>${methodText}</b>
      </div>
      <div style="display:flex;justify-content:space-between;color:var(--muted)">
        <span>ආපසු මුදල (Amount):</span>
        <b style="color:var(--primary);font-size:15px">${money(r.amount)}</b>
      </div>
      ${impactWarning}
    </div>

    <div style="display:flex;flex-direction:column;gap:6px;font-size:12.5px;color:var(--muted);margin-top:4px">
      <label style="display:flex;align-items:center;gap:6px">
        <input type="checkbox" id="rChkRestock" checked style="width:16px;height:16px">
        <span>තොගය නැවත එකතු කරන්න (Restock items)</span>
      </label>
      <label style="display:flex;align-items:center;gap:6px">
        <input type="checkbox" id="rChkDrawer" checked style="width:16px;height:16px">
        <span>මුදල් ලාච්චුවට / ගිණුමට බලපාන්න (Apply drawer/ledger impact)</span>
      </label>
    </div>
  </div>`;

  const modalFooter = `
    <button type="button" class="btn" onclick="closeModal()">අවලංගු / Cancel</button>
    <button type="button" class="btn btn-green" onclick="returnsConfirmApprove('${r.id}')">✅ අනුමත කරන්න (Approve)</button>`;

  openModal('✅ අනුමත කිරීම තහවුරු කරන්න?', 'Confirm Return Approval', modalBody, modalFooter);
}

async function returnsConfirmApprove(id){
  const user = state.user;
  if(!user || (user.role !== 'admin' && user.role !== 'superadmin')){
    toast('අනුමත කිරීමට අවසර නැත', 'err');
    return;
  }

  const db = window.DB || {};
  const r = (db.returns || []).find(x => x.id === id);
  if(!r) return;

  const doRestock = $('#rChkRestock') ? $('#rChkRestock').checked : true;
  const doLedger = $('#rChkDrawer') ? $('#rChkDrawer').checked : true;

  let totalItemsQty = 0;

  // 1. Restore Stock
  if(doRestock){
    for(const it of (r.items || [])){
      totalItemsQty += Number(it.qty || 0);
      const p = db.getProd ? db.getProd(it.pid) : (db.products || []).find(x => x.id === it.pid);
      if(p){
        p.qty += Number(it.qty || 0);
        if(window.FB && window.FB.fbUpdate){
          await window.FB.fbUpdate(window.FB.COL.products, p.id, { qty: p.qty });
        }
      }
    }
  }

  // 2. Financial / Ledger impact
  if(doLedger){
    if(r.refundMethod === 'cash'){
      // Update original cashier's shift drawer
      if(r.shiftId){
        if(typeof addCashOutToShift === 'function'){
          addCashOutToShift(r.shiftId, r.amount, `Return ${r.no}`, r.id);
        }
      }
    } else if(r.refundMethod === 'credit'){
      // Deduct from customer's credit balance
      const cust = (db.customers || []).find(c => c.id === r.customerId || c.name === r.customer);
      if(cust){
        cust.creditBalance = Math.max(0, (cust.creditBalance || 0) - r.amount);
        if(window.FB && window.FB.fbUpdate){
          await window.FB.fbUpdate(window.FB.COL.customers, cust.id, { creditBalance: cust.creditBalance });
        }
      }
    }
  }

  // 3. Mark Approved
  r.status = 'approved';
  r.notified = false;
  r.approvedBy = user.name || 'පරිපාලක';
  r.approvedById = user.id || null;
  r.approvedAt = new Date().toISOString();

  if(window.FB && window.FB.fbUpdate){
    await window.FB.fbUpdate(window.FB.COL.returns, r.id, {
      status: 'approved',
      notified: false,
      approvedBy: r.approvedBy,
      approvedById: r.approvedById,
      approvedAt: r.approvedAt,
      shiftId: r.shiftId
    });
  }
  if(typeof saveDB === 'function') saveDB();

  if(typeof updateShiftIndicator === 'function') updateShiftIndicator();

  closeModal();
  renderNav();
  render();
  toast(`✅ අනුමත කරන ලදී · තොග +${totalItemsQty} · ${money(r.amount)} refund`);
}

function returnsRejectModal(id){
  const db = window.DB || {};
  const r = (db.returns || []).find(x => x.id === id);
  if(!r) return;

  const modalBody = `
  <div style="display:flex;flex-direction:column;gap:12px">
    <div style="background:#141f33;padding:12px;border-radius:9px;border:1px solid var(--line)">
      <div style="font-size:14px;font-weight:700;color:var(--red)">${esc(r.no)} · ${esc(r.requestedBy || 'කැෂියර්')}</div>
      <div style="font-size:12px;color:var(--muted);margin-top:3px">
        ආපසු ඉල්ලීම: <b>${money(r.amount)}</b> | බිල්පත: <b>${esc(r.invoice)}</b>
      </div>
    </div>

    <div>
      <label style="font-size:11.5px;color:var(--muted);font-weight:600">ප්‍රතික්ෂේප කිරීමට හේතුව / Reason *</label>
      <input id="rRejectReason" placeholder="උදා: 30 days පසු, භාණ්ඩය හානි වී ඇත, සීල් කඩා ඇත..." style="margin-top:4px">
    </div>
  </div>`;

  const modalFooter = `
    <button type="button" class="btn" onclick="closeModal()">අවලංගු / Cancel</button>
    <button type="button" class="btn btn-red" onclick="returnsConfirmReject('${r.id}')">❌ ප්‍රතික්ෂේප කරන්න (Reject)</button>`;

  openModal('❌ ප්‍රතික්ෂේප කිරීම', 'Reject Return Request', modalBody, modalFooter);
}

async function returnsConfirmReject(id){
  const db = window.DB || {};
  const r = (db.returns || []).find(x => x.id === id);
  if(!r) return;

  const reason = $('#rRejectReason')?.value.trim() || 'පරිපාලක විසින් ප්‍රතික්ෂේප කරන ලදී';

  r.status = 'rejected';
  r.rejectedBy = state.user ? state.user.name : 'පරිපාලක';
  r.rejectedAt = new Date().toISOString();
  r.rejectionReason = reason;

  if(window.FB && window.FB.fbUpdate){
    await window.FB.fbUpdate(window.FB.COL.returns, r.id, {
      status: 'rejected',
      rejectedBy: r.rejectedBy,
      rejectedAt: r.rejectedAt,
      rejectionReason: r.rejectionReason
    });
  }
  if(typeof saveDB === 'function') saveDB();

  closeModal();
  renderNav();
  render();
  toast('ප්‍රතික්ෂේප කරන ලදී ❌', 'err');
}

/* ---------- Cashier Cancel Own Request ---------- */
async function returnsCancelRequest(id){
  const db = window.DB || {};
  const r = (db.returns || []).find(x => x.id === id);
  if(!r || r.status !== 'pending') return;

  if(!confirm(`'${r.no}' ආපසු ඉල්ලීම අවලංගු කරන්නද? (Cancel request?)`)) return;

  r.status = 'cancelled';
  r.cancelledAt = new Date().toISOString();

  if(window.FB && window.FB.fbUpdate){
    await window.FB.fbUpdate(window.FB.COL.returns, r.id, { status: 'cancelled' });
  }
  if(typeof saveDB === 'function') saveDB();

  renderNav();
  render();
  toast('ඉල්ලීම අවලංගු කරන ලදී');
}

/* ---------- View Details Modal ---------- */
function returnsViewDetails(id){
  const db = window.DB || {};
  const r = (db.returns || []).find(x => x.id === id);
  if(!r){
    toast('ඉල්ලීම හමු නොවීය', 'err');
    return;
  }

  const modalBody = `
  <div style="display:flex;flex-direction:column;gap:12px">
    <div class="grid3">
      <div><small style="color:var(--muted)">ඉල්ලීම් අංකය</small><br><b>${esc(r.no)}</b></div>
      <div><small style="color:var(--muted)">තත්ත්වය</small><br>${renderStatusBadge(r.status)}</div>
      <div><small style="color:var(--muted)">දිනය</small><br><b>${esc(r.date)}</b></div>
    </div>

    <div class="grid3">
      <div><small style="color:var(--muted)">ඉල්ලූ කැෂියර්</small><br><b>${esc(r.requestedBy || '-')}</b></div>
      <div><small style="color:var(--muted)">බිල් අංකය</small><br><b>${esc(r.invoice)}</b></div>
      <div><small style="color:var(--muted)">පාරිභෝගිකයා</small><br><b>${esc(r.customer || 'වෝක්-ඉන්')}</b></div>
    </div>

    <div class="grid2">
      <div><small style="color:var(--muted)">හේතුව (Reason)</small><br><span>${esc(r.reason)}</span></div>
      <div><small style="color:var(--muted)">ගෙවීම් ක්‍රමය</small><br><span>${r.refundMethod === 'cash' ? '💵 මුදල්' : r.refundMethod === 'credit' ? '👥 ණය' : '💳 කාඩ්'}</span></div>
    </div>

    ${r.notes ? `<div><small style="color:var(--muted)">සටහන</small><br><span>${esc(r.notes)}</span></div>` : ''}

    ${r.status === 'approved' ? `
      <div class="pill ok" style="padding:6px 10px">
        ✅ අනුමත කළේ: <b>${esc(r.approvedBy || 'Admin')}</b> (${new Date(r.approvedAt || r.date).toLocaleDateString()})
      </div>
    ` : ''}

    ${r.status === 'rejected' ? `
      <div class="pill bad" style="padding:6px 10px">
        ❌ ප්‍රතික්ෂේප කළේ: <b>${esc(r.rejectedBy || 'Admin')}</b><br>
        හේතුව: ${esc(r.rejectionReason || 'විස්තර නැත')}
      </div>
    ` : ''}

    <hr style="border:none;border-top:1px solid var(--line)">

    <div class="tbl-wrap">
      <table>
        <thead>
          <tr>
            <th>භාණ්ඩය</th>
            <th style="text-align:center">ප්‍රමාණය</th>
            <th style="text-align:right">ශුද්ධ මිල</th>
            <th style="text-align:right">එකතුව</th>
          </tr>
        </thead>
        <tbody>
          ${(r.items || []).map(it => `
            <tr>
              <td><b>${esc(it.name)}</b><br><small style="color:var(--muted)">${esc(it.code || '')}</small></td>
              <td style="text-align:center">${it.qty}</td>
              <td style="text-align:right">${money(it.effectivePrice != null ? it.effectivePrice : it.price)}</td>
              <td style="text-align:right;font-weight:700;color:var(--primary)">${money(it.qty * (it.effectivePrice != null ? it.effectivePrice : it.price))}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="text-align:right;font-weight:700">මුළු ආපසු මුදල (Total Refund):</td>
            <td style="text-align:right;font-weight:700;color:var(--primary);font-size:15px">${money(r.amount)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>`;

  openModal(`📄 ${r.no} විස්තර`, `Return Request Details`, modalBody, `<button class="btn btn-primary" onclick="closeModal()">වසන්න (Close)</button>`, true);
}

/* ---------- Status Badge Helper ---------- */
function renderStatusBadge(status){
  if(status === 'pending') return `<span class="return-status-badge pending">⏳ අපේක්ෂිත</span>`;
  if(status === 'approved') return `<span class="return-status-badge approved">✅ අනුමත</span>`;
  if(status === 'rejected') return `<span class="return-status-badge rejected">❌ ප්‍රතික්ෂේප</span>`;
  if(status === 'cancelled') return `<span class="return-status-badge cancelled">🚫 අවලංගු</span>`;
  return `<span class="return-status-badge">${esc(status)}</span>`;
}

/* ---------- Human Time-Ago Helper ---------- */
function formatRelativeTime(input){
  if(!input) return '—';
  let d;
  if(input && typeof input.toDate === 'function') d = input.toDate();              // Firestore Timestamp instance
  else if(input && input.seconds !== undefined) d = new Date(input.seconds * 1000); // Firestore timestamp plain object { seconds, nanoseconds }
  else if(typeof input === 'string') d = new Date(input);
  else if(input instanceof Date) d = input;
  else if(typeof input === 'number') d = new Date(input);
  else return '—';
  
  if(isNaN(d.getTime())) return '—';
  
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);  // seconds
  
  if(diff < 60) return 'දැන්';
  if(diff < 3600) return Math.floor(diff/60) + ' මිනිත්තු කට පෙර';
  if(diff < 86400) return Math.floor(diff/3600) + ' පැය කට පෙර';
  if(diff < 604800) return Math.floor(diff/86400) + ' දින කට පෙර';
  
  return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short' });
}

function returnsTimeAgo(dateStr){
  return formatRelativeTime(dateStr);
}

/* ---------- Cashier Notification & Create Bill Helpers ---------- */
function showReturnNotification(ret){
  if(!ret) return;

  // 1. Toast banner
  toast(`✅ ඔබේ ඉල්ලීම ${ret.no} අනුමත විය — භාණ්ඩය නැවත තොගයට එකතු විය`, 'ok');

  // 2. Detailed Modal
  const itemsHtml = (ret.items || []).map(it => `
    <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;border-bottom:1px dashed var(--line)">
      <span>• ${esc(it.name)} × ${it.qty}</span>
      <b>${money(it.qty * (it.effectivePrice != null ? it.effectivePrice : it.price))}</b>
    </div>
  `).join('');

  const modalBody = `
  <div style="display:flex;flex-direction:column;gap:12px;padding:4px">
    <div style="background:#141f33;padding:12px;border-radius:9px;border:1px solid var(--line)">
      <div style="font-size:13px;margin-bottom:3px">ඉල්ලීම: <b style="color:var(--primary)">${esc(ret.no)}</b></div>
      <div style="font-size:13px;margin-bottom:3px">බිල් අංකය: <b>${esc(ret.invoice)}</b></div>
      <div style="font-size:13px">පාරිභෝගිකයා: <b>${esc(ret.customer || 'වෝක්-ඉන්')}</b></div>
    </div>

    <div>
      <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:6px">භාණ්ඩ:</div>
      ${itemsHtml}
    </div>

    <div style="background:#0b1220;padding:10px 12px;border-radius:8px;border:1px solid var(--line)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:13px">💰 ආපසු මුදල:</span>
        <b style="color:var(--primary);font-size:16px">${money(ret.amount)}</b>
      </div>
      <div style="font-size:12px;color:#6ee7b7">📦 භාණ්ඩ තොගය සාර්ථකව යාවත්කාලීන විය</div>
    </div>

    <div style="font-size:12px;color:var(--muted);line-height:1.6">
      <div>👤 අනුමත කළේ: <b>${esc(ret.approvedBy || 'පරිපාලක')}</b></div>
      <div>📅 දිනය: <b>${formatRelativeTime(ret.approvedAt || ret.createdAt || ret.date)}</b></div>
    </div>
  </div>`;

  openModal('✅ ඉල්ලීම අනුමත විය', 'Return Approved', modalBody,
    `<button class="btn btn-primary" style="width:100%" onclick="closeModal()">හරි (OK)</button>`);
}

function createBillFromReturn(returnId){
  const db = window.DB || {};
  const r = (db.returns || []).find(x => x.id === returnId);
  if(!r) return;

  // Pre-set customer for POS Billing
  state.cartCustomer = r.customerId || '';
  if(typeof go === 'function') go('billing');

  // Pre-fill customer dropdown after render
  setTimeout(() => {
    const sel = document.getElementById('cartCustomer');
    if(sel && r.customerId) sel.value = r.customerId;
  }, 200);
}

/* ---------- Global Exports & Aliases ---------- */
window.pgReturns = pgReturns;
window.pgReturnsCashier = pgReturnsCashier;
window.pgReturnsAdmin = pgReturnsAdmin;
window.returnsSetTab = returnsSetTab;
window.returnsSetFilter = returnsSetFilter;
window.returnsOpenNewRequest = returnsOpenNewRequest;
window.returnsSearchSales = returnsSearchSales;
window.returnsSelectSale = returnsSelectSale;
window.returnsRenderItemPicker = returnsRenderItemPicker;
window.returnsToggleItem = returnsToggleItem;
window.returnsUpdateItemQty = returnsUpdateItemQty;
window.returnsCalcReturnTotal = returnsCalcReturnTotal;
window.calcReturnTotal = calcReturnTotal;
window.returnsSubmitRequest = returnsSubmitRequest;
window.returnsApproveModal = returnsApproveModal;
window.returnsConfirmApprove = returnsConfirmApprove;
window.returnsRejectModal = returnsRejectModal;
window.returnsConfirmReject = returnsConfirmReject;
window.returnsCancelRequest = returnsCancelRequest;
window.returnsViewDetails = returnsViewDetails;
window.returnsGetEffectivePrice = returnsGetEffectivePrice;
window.returnsTimeAgo = returnsTimeAgo;
window.formatRelativeTime = formatRelativeTime;
window.showReturnNotification = showReturnNotification;
window.createBillFromReturn = createBillFromReturn;

// Aliases for backwards compatibility with legacy calls
window.newReturn = returnsOpenNewRequest;
window.approveReturn = returnsApproveModal;
window.rejectReturn = returnsRejectModal;
window.submitReturn = returnsSubmitRequest;

function renderCashierReturnCard(r){
  return `
    <div class="return-card">
      <div class="return-card-header">
        <span class="return-card-no">${esc(r.no)}</span>
        <span class="return-card-time">${esc(r.date)}</span>
        ${renderStatusBadge(r.status)}
      </div>
      <div class="return-card-meta">
        <div>🧾 බිල් අංකය: <b>${esc(r.invoice)}</b></div>
        ${r.customer ? `<div>👥 පාරිභෝගික: <b>${esc(r.customer)}</b></div>` : ''}
        <div>📦 භාණ්ඩ: <span>${(r.items || []).map(i => `${esc(i.name)} × ${i.qty}`).join(', ')}</span></div>
      </div>
      <div class="return-card-total" style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-top:1px dashed var(--border);border-bottom:1px dashed var(--border);margin:8px 0">
        <span style="font-size:12px;color:var(--muted)">මුළු මුදල:</span>
        <b style="font-size:15px;color:var(--primary);font-family:'Inter',sans-serif">${money(r.amount)}</b>
      </div>
      <div class="return-card-footer" style="display:flex;gap:6px;flex-wrap:wrap">
        <button type="button" class="btn btn-sm" onclick="returnsViewDetails('${r.id}')" title="විස්තර බලන්න">👁️ විස්තර</button>
        ${r.status === 'pending' ? `
          <button type="button" class="btn btn-sm btn-red" onclick="returnsCancelRequest('${r.id}')" title="අවලංගු කරන්න">✕ අවලංගු</button>
        ` : ''}
        ${r.status === 'approved' && r.customerId ? `
          <button type="button" class="btn btn-sm btn-blue" onclick="createBillFromReturn('${r.id}')" title="නව බිලක් සාදන්න">🔄 නව බිලක්</button>
        ` : ''}
      </div>
    </div>
  `;
}

function renderAdminReturnRowCard(r){
  return `
    <div class="return-card">
      <div class="return-card-header">
        <span class="return-card-no">${esc(r.no)}</span>
        <span class="return-card-time">${esc(r.date)}</span>
        ${renderStatusBadge(r.status)}
      </div>
      <div class="return-card-meta">
        <div>👤 කැෂියර්: <b>${esc(r.requestedBy || 'නොදනී')}</b></div>
        <div>🧾 බිල් අංකය: <b>${esc(r.invoice)}</b></div>
        <div>👥 පාරිභෝගික: <b>${esc(r.customer || 'වෝක්-ඉන්')}</b></div>
        <div>📦 භාණ්ඩ: <span>${(r.items || []).map(i => `${esc(i.name)} × ${i.qty}`).join(', ')}</span></div>
      </div>
      <div class="return-card-total" style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-top:1px dashed var(--border);border-bottom:1px dashed var(--border);margin:8px 0">
        <span style="font-size:12px;color:var(--muted)">මුළු එකතුව:</span>
        <b style="font-size:15px;color:var(--primary);font-family:'Inter',sans-serif">${money(r.amount)}</b>
      </div>
      <div class="return-card-footer" style="display:flex;gap:6px;flex-wrap:wrap">
        <button type="button" class="btn btn-sm" onclick="returnsViewDetails('${r.id}')" title="විස්තර">👁️ විස්තර</button>
        ${r.status === 'pending' ? `
          <button type="button" class="btn btn-sm btn-green" onclick="returnsApproveModal('${r.id}')" title="අනුමත">✅ අනුමත</button>
          <button type="button" class="btn btn-sm btn-red" onclick="returnsRejectModal('${r.id}')" title="ප්‍රතික්ෂේප">❌ ප්‍රතික්ෂේප</button>
        ` : ''}
        ${r.status === 'approved' && r.customerId ? `
          <button type="button" class="btn btn-sm btn-blue" onclick="createBillFromReturn('${r.id}')" title="නව බිලක් සාදන්න">🔄 නව බිලක්</button>
        ` : ''}
      </div>
    </div>
  `;
}

