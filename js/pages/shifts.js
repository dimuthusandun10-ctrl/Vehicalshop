/* =========================================================
   js/pages/shifts.js - Role-Based Shift History, Filters, PDF & Management
   ========================================================= */

window.shiftFilters = window.shiftFilters || {
  status: 'all',    // 'all' | 'open' | 'pending_balance' | 'closed'
  cashier: 'all',   // 'all' | cashierName
  date: 'all',      // 'all' | 'today' | 'week' | 'month'
  search: ''
};

function pgShifts(){
  const db = window.DB || {};
  const allShifts = (db.shifts || []).slice().reverse();
  const user = (typeof state !== 'undefined' && state.user) ? state.user : {};
  const curRole = user.role || 'cashier';
  const curUid = user.id || user.authUid;
  const curName = user.name;
  const todayStr = today();

  /* ---------------------------------------------------------
     1. ROLE-BASED ACCESS FILTERING
     - Cashier: ONLY see their own shifts
     - Admin: ONLY see their own shifts & users under that admin
     - Super Admin: Filtered according to selected shop
     --------------------------------------------------------- */
  let baseShifts = [];

  if(curRole === 'cashier'){
    baseShifts = allShifts.filter(s => 
      s.cashierId === curUid || 
      (s.userId && s.userId === curUid) || 
      s.cashierName === curName
    );
  } else if(curRole === 'admin'){
    const adminShopId = user.shopId;
    const users = db.users || [];

    const subordinateUsers = users.filter(u => {
      const uId = u.authUid || u.id;
      if(uId === curUid) return true;
      if(u.createdBy === curUid || u.adminId === curUid) return true;
      if(adminShopId && u.shopId === adminShopId && u.role === 'cashier') return true;
      return false;
    });

    const allowedUids = new Set(subordinateUsers.map(u => u.authUid || u.id).filter(Boolean));
    allowedUids.add(curUid);
    const allowedNames = new Set(subordinateUsers.map(u => u.name).filter(Boolean));
    if(curName) allowedNames.add(curName);

    baseShifts = allShifts.filter(s => {
      if(adminShopId && s.shopId && s.shopId !== adminShopId) return false;
      if(s.cashierId && allowedUids.has(s.cashierId)) return true;
      if(s.cashierName && allowedNames.has(s.cashierName)) return true;
      if(s.userId && allowedUids.has(s.userId)) return true;
      return false;
    });
  } else {
    // Super Admin: Filtered by selected shop
    const selShopId = state.activeShopId || state.activeShop?.id || (typeof currentShopId === 'function' ? currentShopId() : null);
    if(selShopId && selShopId !== 'all'){
      baseShifts = allShifts.filter(s => s.shopId === selShopId || (!s.shopId && selShopId === 'SHOP-001'));
    } else {
      baseShifts = allShifts;
    }
  }

  /* ---------------------------------------------------------
     2. EXTENDED USER FILTERS (STATUS, CASHIER, DATE, SEARCH)
     --------------------------------------------------------- */
  const flt = window.shiftFilters;
  let filteredShifts = baseShifts;

  // Status Filter
  if(flt.status !== 'all'){
    filteredShifts = filteredShifts.filter(s => s.status === flt.status);
  }

  // Cashier Filter
  if(flt.cashier !== 'all'){
    filteredShifts = filteredShifts.filter(s => (s.cashierName || '').toLowerCase() === flt.cashier.toLowerCase());
  }

  // Date Filter
  if(flt.date === 'today'){
    filteredShifts = filteredShifts.filter(s => (s.openedAt || '').slice(0, 10) === todayStr);
  } else if(flt.date === 'week'){
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    filteredShifts = filteredShifts.filter(s => (s.openedAt || '').slice(0, 10) >= weekAgo);
  } else if(flt.date === 'month'){
    const monthPrefix = todayStr.slice(0, 7);
    filteredShifts = filteredShifts.filter(s => (s.openedAt || '').slice(0, 7) === monthPrefix);
  }

  // Search Filter (ID or Cashier or Shop)
  if(flt.search){
    const q = flt.search.trim().toLowerCase();
    filteredShifts = filteredShifts.filter(s => 
      (s.id || '').toLowerCase().includes(q) ||
      (s.cashierName || '').toLowerCase().includes(q) ||
      (s.shopId || '').toLowerCase().includes(q)
    );
  }

  // Store for PDF export
  window._currentFilteredShifts = filteredShifts;

  /* Summary statistics (based on baseShifts for overall KPIs) */
  const todaysShifts = baseShifts.filter(s => (s.openedAt || '').slice(0,10) === todayStr);
  const openShifts = baseShifts.filter(s => s.status === 'open');
  const pendingShifts = baseShifts.filter(s => s.status === 'pending_balance');
  const closedShifts = baseShifts.filter(s => s.status === 'closed');
  const totalVar = closedShifts.reduce((a,s) => a + (s.variance||0), 0);

  // Cashier distinct list for filter dropdown
  const distinctCashiers = [...new Set(baseShifts.map(s => s.cashierName).filter(Boolean))].sort();

  const isSuperAdmin = curRole === 'superadmin';
  const selShopId = state.activeShopId || state.activeShop?.id || 'all';

  return `
  <div class="shift-history-page">
    
    <!-- Top 4 KPI Stat Cards -->
    <div class="stats">
      <div class="stat">
        <div class="ic ic-lg" style="background:rgba(16,185,129,.15);color:#6ee7b7">🔓</div>
        <div><b class="big">${openShifts.length}</b><span>විවෘත Shifts</span></div>
      </div>
      <div class="stat">
        <div class="ic ic-lg" style="background:rgba(59,130,246,.15);color:#93c5fd">📅</div>
        <div><b class="big">${todaysShifts.length}</b><span>අද Shifts</span></div>
      </div>
      <div class="stat">
        <div class="ic ic-lg" style="background:rgba(245,158,11,.15);color:#fcd34d">💰</div>
        <div><b class="big">${money(totalVar)}</b><span>මුළු වෙනස්කම් (Closed)</span></div>
      </div>
      <div class="stat">
        <div class="ic ic-lg" style="background:rgba(139,92,246,.15);color:#c4b5fd">📜</div>
        <div><b class="big">${closedShifts.length} <small style="font-size:12px;opacity:0.7">/ ${baseShifts.length}</small></b><span>අවසන් / මුළු</span></div>
      </div>
    </div>

    <!-- Alert for Shifts Stopped by Admin Pending Cashier Count -->
    ${pendingShifts.length > 0 ? `
    <div style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35);border-radius:10px;padding:12px 16px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <div style="display:flex;align-items:center;gap:12px">
        <span style="font-size:24px">⚠️</span>
        <div>
          <b style="color:#fca5a5;font-size:13.5px">මුදල් ලාච්චුවේ අවසන් ශේෂය ඇතුළත් නොකළ Shift ${pendingShifts.length}ක් ඇත!</b>
          <small style="display:block;color:var(--muted);font-size:12px;margin-top:2px">
            මෙම Shift පරිපාලක විසින් නවතා ඇති අතර, මුදල් ගණන් කර ඇතුළත් කරන තෙක් අවසන් වූ වාර්තාවක් ලෙස සම්පූර්ණ නොවේ.
          </small>
        </div>
      </div>
      <button class="btn btn-sm btn-yellow" onclick="openSettlePendingModal('${pendingShifts[0].id}')" style="font-weight:700;display:flex;align-items:center;gap:6px">
        💰 ශේෂය ඇතුළත් කරන්න (${esc(pendingShifts[0].id)})
      </button>
    </div>` : ''}

    <div class="card">
      <!-- Card Header with Actions -->
      <div class="card-h" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;border-bottom:1px solid var(--line);padding-bottom:12px;margin-bottom:12px">
        <div>
          <h3 style="margin:0;display:flex;align-items:center;gap:8px">
            <span>📜</span> Cashier Shift ඉතිහාසය <small>Shift History &amp; Audits</small>
          </h3>
          <div style="margin-top:4px;font-size:12px;color:var(--muted)">
            ${curRole === 'cashier' 
              ? `<span class="pill info" style="font-size:11px">👤 ඔබගේ Shift වාර්තා පමණි (My Shifts)</span>`
              : curRole === 'admin' 
                ? `<span class="pill info" style="font-size:11px">🛡️ ඔබගේ සහ යටතේ සිටින කැෂියර්වරුන්ගේ Shifts පමණි</span>`
                : `<span class="pill info" style="font-size:11px">👑 සුපිරි පරිපාලක · සාප්පුව: <b>${esc(state.activeShop?.name || selShopId || 'All')}</b></span>`}
          </div>
        </div>

        <!-- Action Buttons (Print PDF & Clear History) -->
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <button type="button" class="btn btn-sm btn-blue" onclick="exportShiftsPdfReport()" style="display:flex;align-items:center;gap:6px;font-weight:600">
            🖨️ PDF වාර්තාව (Report)
          </button>

          ${isSuperAdmin ? `
            <button type="button" class="btn btn-sm btn-red" onclick="clearShiftHistory()" style="display:flex;align-items:center;gap:6px;font-weight:700" title="මෙම සාප්පුවේ Shift ඉතිහාසය සම්පූර්ණයෙන්ම මකා දමන්න">
              🧹 Shift History Clear කරන්න
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Advanced Filter & Search Bar -->
      <div style="background:rgba(15,23,42,0.6);border:1px solid var(--line);border-radius:10px;padding:12px;margin-bottom:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        
        <!-- Superadmin Shop Selector -->
        ${isSuperAdmin ? `
        <div style="min-width:160px;flex:1">
          <label style="font-size:11px;color:var(--muted);font-weight:600;display:block;margin-bottom:3px">🏪 සාප්පුව:</label>
          <select onchange="state.activeShopId=this.value;if(window.DB&&window.DB.shops){state.activeShop=window.DB.shops.find(x=>x.id===this.value)||null;}render()" 
                  style="width:100%;padding:6px 10px;font-size:12px;border-radius:6px;background:var(--panel);border:1px solid var(--line);color:var(--txt)">
            <option value="all" ${(!state.activeShopId || state.activeShopId==='all') ? 'selected' : ''}>🌐 සියලු සාප්පු (All Shops)</option>
            ${(db.shops || []).map(sh => `
              <option value="${esc(sh.id)}" ${state.activeShopId === sh.id ? 'selected' : ''}>
                ${esc(sh.name || sh.id)} (${esc(sh.id)})
              </option>
            `).join('')}
          </select>
        </div>` : ''}

        <!-- Status Filter -->
        <div style="min-width:130px;flex:1">
          <label style="font-size:11px;color:var(--muted);font-weight:600;display:block;margin-bottom:3px">🚦 තත්ත්වය (Status):</label>
          <select onchange="window.shiftFilters.status=this.value;render()" 
                  style="width:100%;padding:6px 10px;font-size:12px;border-radius:6px;background:var(--panel);border:1px solid var(--line);color:var(--txt)">
            <option value="all" ${flt.status==='all'?'selected':''}>සියල්ල (All)</option>
            <option value="open" ${flt.status==='open'?'selected':''}>🔓 විවෘත (Open)</option>
            <option value="pending_balance" ${flt.status==='pending_balance'?'selected':''}>🛑 නවතා ඇත (Pending)</option>
            <option value="closed" ${flt.status==='closed'?'selected':''}>🔒 අවසන් (Closed)</option>
          </select>
        </div>

        <!-- Cashier Filter -->
        ${curRole !== 'cashier' ? `
        <div style="min-width:140px;flex:1">
          <label style="font-size:11px;color:var(--muted);font-weight:600;display:block;margin-bottom:3px">👤 කැෂියර් (Cashier):</label>
          <select onchange="window.shiftFilters.cashier=this.value;render()" 
                  style="width:100%;padding:6px 10px;font-size:12px;border-radius:6px;background:var(--panel);border:1px solid var(--line);color:var(--txt)">
            <option value="all" ${flt.cashier==='all'?'selected':''}>සියලු කැෂියර්වරු</option>
            ${distinctCashiers.map(c => `
              <option value="${esc(c)}" ${flt.cashier===c?'selected':''}>${esc(c)}</option>
            `).join('')}
          </select>
        </div>` : ''}

        <!-- Date Range Filter -->
        <div style="min-width:130px;flex:1">
          <label style="font-size:11px;color:var(--muted);font-weight:600;display:block;margin-bottom:3px">📅 දිනය (Date):</label>
          <select onchange="window.shiftFilters.date=this.value;render()" 
                  style="width:100%;padding:6px 10px;font-size:12px;border-radius:6px;background:var(--panel);border:1px solid var(--line);color:var(--txt)">
            <option value="all" ${flt.date==='all'?'selected':''}>සියලු දින (All Time)</option>
            <option value="today" ${flt.date==='today'?'selected':''}>අද (Today)</option>
            <option value="week" ${flt.date==='week'?'selected':''}>පසුගිය දින 7 (Week)</option>
            <option value="month" ${flt.date==='month'?'selected':''}>මෙම මාසය (Month)</option>
          </select>
        </div>

        <!-- Search Input -->
        <div style="min-width:160px;flex:2">
          <label style="font-size:11px;color:var(--muted);font-weight:600;display:block;margin-bottom:3px">🔍 සෙවුම (Shift ID / නම):</label>
          <input type="text" placeholder="SH035 හෝ කැෂියර් නම..." 
                 value="${esc(flt.search || '')}"
                 oninput="window.shiftFilters.search=this.value;render()"
                 style="width:100%;padding:6px 10px;font-size:12px;border-radius:6px;background:var(--panel);border:1px solid var(--line);color:var(--txt)">
        </div>

        <!-- Reset Button -->
        ${(flt.status !== 'all' || flt.cashier !== 'all' || flt.date !== 'all' || flt.search) ? `
        <div style="align-self:flex-end">
          <button type="button" class="btn btn-sm" onclick="window.shiftFilters={status:'all',cashier:'all',date:'all',search:''};render()" title="පෙරහන් Clear කරන්න">
            ✕ Reset
          </button>
        </div>` : ''}
      </div>
      
      <!-- Desktop Table View -->
      <div class="desktop-only tbl-wrap">
        <table class="shifts-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>කැෂියර්</th>
              ${isSuperAdmin ? '<th>සාප්පුව</th>' : ''}
              <th>ආරම්භය</th>
              <th>අවසානය</th>
              <th style="text-align:center">බිල්පත්</th>
              <th style="text-align:right">ආරම්භක</th>
              <th style="text-align:right">අපේක්ෂිත</th>
              <th style="text-align:right">ගණන් කළ</th>
              <th style="text-align:right">වෙනස්කම</th>
              <th style="text-align:center">තත්ත්වය</th>
              <th style="text-align:center">පාලනය</th>
            </tr>
          </thead>
          <tbody>
            ${filteredShifts.map(s => {
              const v = s.variance || 0;
              const vClass = Math.abs(v) < 0.01 ? 'ok' : v > 0 ? 'warn' : 'bad';
              const expected = s.summary ? s.summary.expected : (Shift.summary ? Shift.summary(s.id)?.expected : 0);
              const invCount = s.summary ? s.summary.invoices : ((s.status==='open'||s.status==='pending_balance') ? (db.sales||[]).filter(x=>x.shiftId===s.id).length : '—');
              
              return `
              <tr>
                <td data-label="ID"><b>${s.id}</b></td>
                <td data-label="කැෂියර්">
                  <b>${esc(s.cashierName)}</b>
                  ${s.status === 'pending_balance' && s.stopReason ? `<small style="display:block;color:#f87171;font-size:10.5px">🛑 ${esc(s.stopReason)}</small>` : ''}
                </td>
                ${isSuperAdmin ? `<td data-label="සාප්පුව"><span class="pill mute" style="font-size:10px">${esc(s.shopId || 'Default')}</span></td>` : ''}
                <td data-label="ආරම්භය"><small>${new Date(s.openedAt).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</small></td>
                <td data-label="අවසානය">
                  ${s.status === 'closed' && s.closedAt
                      ? `<small>${new Date(s.closedAt).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</small>`
                      : s.status === 'pending_balance'
                        ? `<small style="color:#f87171;font-weight:600">🛑 නවතා ඇත (ශේෂය අපේක්ෂිත)</small>`
                        : '<small style="color:var(--green);font-weight:600">🟢 සක්‍රීයයි (Active)</small>'}
                </td>
                <td data-label="බිල්පත්" style="text-align:center">${invCount}</td>
                <td data-label="ආරම්භක" class="amount" style="text-align:right">${money(s.openingFloat)}</td>
                <td data-label="අපේක්ෂිත" class="amount" style="text-align:right;color:var(--primary)">${money(expected || 0)}</td>
                <td data-label="ගණන් කළ" class="amount" style="text-align:right">
                  ${s.status === 'closed' && s.closingCount != null 
                    ? money(s.closingCount) 
                    : s.status === 'pending_balance'
                      ? '<span style="color:#f87171;font-size:11px;font-weight:600">ඇතුළත් කර නැත</span>'
                      : '—'}
                </td>
                <td data-label="වෙනස්කම" style="text-align:right">
                  ${s.status === 'closed'
                    ? `<span class="pill ${vClass}">${v > 0 ? '+' : ''}${money(v)}</span>`
                    : s.status === 'pending_balance'
                      ? '<span style="color:var(--muted);font-size:11px">—</span>'
                      : '—'}
                </td>
                <td data-label="තත්ත්වය" style="text-align:center;white-space:nowrap">
                  ${s.status === 'open'
                    ? `<span class="pill warn">🔓 විවෘත</span>`
                    : s.status === 'pending_balance'
                      ? `<span class="pill bad" style="font-size:11px">🛑 නවතා ඇත</span>`
                      : '<span class="pill ok">🔒 අවසන්</span>'}
                </td>
                <td data-label="පාලනය" style="text-align:center;white-space:nowrap">
                  <div style="display:flex;gap:4px;justify-content:center;align-items:center">
                    ${s.status === 'open' && isSuperAdmin ? `
                      <button class="btn btn-sm btn-red" onclick="forceStopShiftPrompt('${s.id}')" style="padding:3px 8px;font-size:11px;font-weight:700" title="Super Admin Shift නවත්වන්න">
                        🛑 නවත්වන්න
                      </button>` : ''}
                    ${s.status === 'pending_balance' ? `
                      <button class="btn btn-sm btn-yellow" onclick="openSettlePendingModal('${s.id}')" style="padding:3px 8px;font-size:11px;font-weight:700" title="මුදල් ඇතුළත් කර අවසන් කරන්න">
                        💰 ශේෂය
                      </button>` : ''}
                    ${isSuperAdmin ? `
                      <button type="button" class="btn btn-sm btn-red" onclick="deleteSingleShift('${s.id}')" style="padding:3px 7px;font-size:11px;background:#991b1b;border-color:#991b1b" title="මෙම Shift එක සදහටම මකා දමන්න">
                        🗑️
                      </button>` : ''}
                  </div>
                </td>
              </tr>`;
            }).join('') || `<tr><td colspan="${isSuperAdmin ? '12' : '11'}" class="empty" style="text-align:center;padding:24px">පෙරහන් වලට අදාළ Shift වාර්තා හමු නොවීය</td></tr>`}
          </tbody>
        </table>
      </div>

      <!-- Mobile Cards View -->
      <div class="mobile-only shift-cards-wrap">
        ${filteredShifts.map(s => renderShiftCard(s, db, curRole)).join('') || '<div class="empty" style="padding:40px 20px;text-align:center">Shift වාර්තා නැත</div>'}
      </div>
    </div>
  </div>`;
}

function renderShiftCard(s, db, curRole){
  const v = s.variance || 0;
  const vClass = Math.abs(v) < 0.01 ? 'ok' : v > 0 ? 'warn' : 'bad';
  const expected = s.summary ? s.summary.expected : (Shift.summary ? Shift.summary(s.id)?.expected : 0);
  const invCount = s.summary ? s.summary.invoices : ((s.status==='open'||s.status==='pending_balance') ? (db.sales||[]).filter(x=>x.shiftId===s.id).length : '—');
  const openedStr = new Date(s.openedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const closedStr = s.status === 'closed' && s.closedAt
    ? new Date(s.closedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : s.status === 'pending_balance'
      ? `🛑 නවතා ඇත (${s.stoppedAt ? new Date(s.stoppedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : 'ශේෂය නැත'})`
      : '🟢 සක්‍රීයයි (Active)';
  const isSuperAdmin = curRole === 'superadmin';

  return `
    <div class="shift-card" style="${s.status==='pending_balance' ? 'border-color:rgba(239,68,68,0.4);background:rgba(239,68,68,0.04)' : ''}">
      <div class="shift-card-head">
        <div>
          <b class="shift-card-id">${esc(s.id)}</b>
          <div style="font-size:12px;color:var(--txt);margin-top:2px">👤 <b>${esc(s.cashierName)}</b></div>
          ${s.status === 'pending_balance' && s.stopReason ? `<div style="font-size:10.5px;color:#f87171;margin-top:2px">🛑 ${esc(s.stopReason)}</div>` : ''}
        </div>
        <div style="text-align:right">
          ${s.status === 'open'
            ? `<span class="pill warn">🔓 විවෘත</span>`
            : s.status === 'pending_balance'
              ? `<span class="pill bad" style="font-size:10.5px">🛑 නවතා ඇත</span>`
              : '<span class="pill ok">🔒 අවසන්</span>'}
        </div>
      </div>

      <div class="shift-card-meta">
        <div><small style="color:var(--muted)">ආරම්භය:</small> <span>${openedStr}</span></div>
        <div><small style="color:var(--muted)">අවසානය:</small> <span style="${s.status==='pending_balance'?'color:#f87171':''}">${closedStr}</span></div>
        <div><small style="color:var(--muted)">බිල්පත්:</small> <span class="pill mute" style="font-size:10px;padding:1px 6px">${invCount} bills</span></div>
      </div>

      <div class="shift-card-grid">
        <div class="sc-stat">
          <small>ආරම්භක</small>
          <b>${money(s.openingFloat)}</b>
        </div>
        <div class="sc-stat">
          <small>අපේක්ෂිත</small>
          <b style="color:var(--primary)">${money(expected || 0)}</b>
        </div>
        <div class="sc-stat">
          <small>ගණන් කළ</small>
          <b>${s.status==='closed' && s.closingCount != null ? money(s.closingCount) : s.status==='pending_balance' ? '<span style="color:#f87171;font-size:11px">නැත</span>' : '—'}</b>
        </div>
        <div class="sc-stat">
          <small>වෙනස්කම</small>
          <b>${s.status === 'closed' 
                ? `<span class="pill ${vClass}" style="padding:2px 6px;font-size:11px">${v > 0 ? '+' : ''}${money(v)}</span>` 
                : s.status === 'pending_balance' 
                  ? '<span style="color:var(--muted);font-size:10.5px">—</span>' 
                  : '—'}</b>
        </div>
      </div>

      <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line);display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap">
        ${s.status === 'open' && isSuperAdmin ? `
          <button class="btn btn-sm btn-red" onclick="forceStopShiftPrompt('${s.id}')" style="font-weight:700;font-size:12px;padding:6px 14px">
            🛑 Shift නවත්වන්න (Stop)
          </button>` : ''}
        ${s.status === 'pending_balance' ? `
          <button class="btn btn-sm btn-yellow" onclick="openSettlePendingModal('${s.id}')" style="font-weight:700;font-size:12px;padding:6px 14px">
            💰 මුදල් ඇතුළත් කරන්න (Settle)
          </button>` : ''}
        ${isSuperAdmin ? `
          <button type="button" class="btn btn-sm btn-red" onclick="deleteSingleShift('${s.id}')" style="padding:6px 12px;font-size:11px;background:#991b1b;border-color:#991b1b">
            🗑️ මකන්න
          </button>` : ''}
      </div>
    </div>
  `;
}

/* =========================================================
   SUPER ADMIN SHIFT CLEANUP & REPORT FUNCTIONS
   ========================================================= */

async function clearShiftHistory(){
  const user = window.state?.user;
  if(!user || user.role !== 'superadmin'){
    toast('Shift ඉතිහාසය Clear කිරීමට සුපිරි පරිපාලක (Super Admin) අවසර අවශ්‍ය වේ!', 'err');
    return;
  }
  const db = window.DB || {};
  const curShop = (typeof currentShopId === 'function' && currentShopId()) || state.user?.shopId || state.activeShopId || 'SHOP-001';
  const isAllShops = state.activeShopId === 'all';
  
  const targetShifts = (db.shifts || []).filter(s => isAllShops || (!s.shopId || s.shopId === curShop));
  if(!targetShifts.length){
    toast('Clear කිරීමට Shift වාර්තා හමු නොවීය', 'info');
    return;
  }

  const shopLabel = isAllShops ? 'සියලු සාප්පු වල' : `'${state.activeShop?.name || curShop}' සාප්පුවේ`;
  if(!confirm(`අවධානයයි: ${shopLabel} Shift වාර්තා ${targetShifts.length}ම පද්ධතියෙන් සහ Cloud Database එකෙන් සදහටම මකා දැමීමට අවශ්‍ය බව තහවුරුද?\n\n(මෙය ආපසු හැරවිය නොහැක)`)){
    return;
  }

  // 1. Remove from local memory
  const shiftIds = new Set(targetShifts.map(s => s.id));
  db.shifts = (db.shifts || []).filter(s => !shiftIds.has(s.id));

  // 2. Permanently delete from Firestore
  if(window.FB && window.FB.fbDelete){
    for(const s of targetShifts){
      try {
        if(s._docId) await window.FB.fbDelete(window.FB.COL.shifts, s._docId);
        if(s.id && s.id !== s._docId) await window.FB.fbDelete(window.FB.COL.shifts, s.id);
      } catch(_){}
    }
  }

  // 3. Purge from sync queue
  try {
    if(window.Offline && Array.isArray(window.Offline.queue)){
      window.Offline.queue = window.Offline.queue.filter(q => !(q.collection === 'shifts' && shiftIds.has(q.docId)));
      window.Offline.persist();
    }
    const rawQ = localStorage.getItem('pos.syncQueue');
    if(rawQ){
      const parsedQ = JSON.parse(rawQ);
      if(Array.isArray(parsedQ)){
        localStorage.setItem('pos.syncQueue', JSON.stringify(
          parsedQ.filter(q => !(q.collection === 'shifts' && shiftIds.has(q.docId)))
        ));
      }
    }
  } catch(_){}

  if(typeof saveDB === 'function') saveDB();
  if(typeof updateShiftIndicator === 'function') updateShiftIndicator();
  toast(`Shift වාර්තා ${targetShifts.length}ක් සාර්ථකව Clear කරන ලදී 🧹`, 'ok');
  render();
}

async function deleteSingleShift(shiftId){
  const user = window.state?.user;
  if(!user || user.role !== 'superadmin'){
    toast('Shift මකා දැමීමට සුපිරි පරිපාලක අවසර අවශ්‍ය වේ', 'err');
    return;
  }
  const db = window.DB || {};
  const sh = (db.shifts || []).find(s => s.id === shiftId);
  if(!sh) return;

  if(!confirm(`'${sh.id}' (${sh.cashierName}) Shift වාර්තාව සදහටම මකා දැමීමට අවශ්‍ය බව තහවුරුද?`)) return;

  // 1. Remove from memory
  db.shifts = (db.shifts || []).filter(s => s.id !== shiftId);

  // 2. Remove from Firestore
  if(window.FB && window.FB.fbDelete){
    try {
      if(sh._docId) await window.FB.fbDelete(window.FB.COL.shifts, sh._docId);
      if(sh.id && sh.id !== sh._docId) await window.FB.fbDelete(window.FB.COL.shifts, sh.id);
    } catch(_){}
  }

  // 3. Purge sync queue
  try {
    const rawQ = localStorage.getItem('pos.syncQueue');
    if(rawQ){
      const parsedQ = JSON.parse(rawQ);
      if(Array.isArray(parsedQ)){
        localStorage.setItem('pos.syncQueue', JSON.stringify(
          parsedQ.filter(q => !(q.collection === 'shifts' && (q.docId === shiftId || (q.data && q.data.id === shiftId))))
        ));
      }
    }
    if(window.Offline && Array.isArray(window.Offline.queue)){
      window.Offline.queue = window.Offline.queue.filter(q => !(q.collection === 'shifts' && q.docId === shiftId));
      window.Offline.persist();
    }
  } catch(_){}

  if(typeof saveDB === 'function') saveDB();
  if(typeof updateShiftIndicator === 'function') updateShiftIndicator();
  toast(`'${sh.id}' Shift එක සාර්ථකව මකා දමන ලදී 🗑️`, 'ok');
  render();
}

function exportShiftsPdfReport(){
  const db = window.DB || {};
  const shifts = window._currentFilteredShifts || [];
  if(!shifts.length){
    toast('මුද්‍රණය කිරීමට Shift වාර්තා නැත', 'warn');
    return;
  }

  const columns = ['ID', 'කැෂියර් (Cashier)', 'සාප්පුව (Shop)', 'ආරම්භය (Opened)', 'අවසානය (Closed)', 'බිල්පත්', 'ආරම්භක (Float)', 'අපේක්ෂිත (Expected)', 'ගණන් කළ (Counted)', 'වෙනස්කම (Variance)', 'තත්ත්වය (Status)'];
  const alignments = ['left', 'left', 'center', 'left', 'left', 'center', 'right', 'right', 'right', 'right', 'center'];

  let totalFloat = 0;
  let totalExpected = 0;
  let totalCounted = 0;
  let totalVariance = 0;
  let totalBills = 0;

  const rows = shifts.map(s => {
    const expected = s.summary ? s.summary.expected : (Shift.summary ? Shift.summary(s.id)?.expected : 0);
    const counted = (s.status === 'closed' && s.closingCount != null) ? s.closingCount : 0;
    const v = s.variance || 0;
    const bills = s.summary ? s.summary.invoices : ((s.status==='open'||s.status==='pending_balance') ? (db.sales||[]).filter(x=>x.shiftId===s.id).length : 0);

    totalFloat += (s.openingFloat || 0);
    totalExpected += (expected || 0);
    if(s.status === 'closed') {
      totalCounted += counted;
      totalVariance += v;
    }
    totalBills += Number(bills) || 0;

    const openedStr = new Date(s.openedAt).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
    const closedStr = s.status === 'closed' && s.closedAt
      ? new Date(s.closedAt).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})
      : s.status === 'pending_balance' ? '🛑 නවතා ඇත' : '🟢 සක්‍රීයයි';

    const statusStr = s.status === 'closed' ? '🔒 අවසන්' : s.status === 'pending_balance' ? '🛑 නවතා ඇත' : '🔓 විවෘත';

    return [
      s.id,
      s.cashierName,
      s.shopId || 'Default',
      openedStr,
      closedStr,
      String(bills),
      money(s.openingFloat),
      money(expected),
      s.status === 'closed' ? money(counted) : '—',
      s.status === 'closed' ? ((v > 0 ? '+' : '') + money(v)) : '—',
      statusStr
    ];
  });

  const activeShop = state.activeShop || { name: 'Auto Parts Lanka' };
  const filterDesc = `තත්ත්වය: ${window.shiftFilters.status} | කැෂියර්: ${window.shiftFilters.cashier} | දිනය: ${window.shiftFilters.date}${window.shiftFilters.search ? ` | සෙවුම: "${window.shiftFilters.search}"` : ''}`;

  openPdfReportModal({
    title: '📜 Cashier Shift ඉතිහාස වාර්තාව (Shift History Report)',
    subtitle: `${activeShop.name || 'All Shops'} · මුළු Shifts: ${shifts.length}`,
    filtersText: filterDesc,
    summaryCards: [
      { label: 'මුළු SHIFTS', value: String(shifts.length) },
      { label: 'මුළු බිල්පත්', value: String(totalBills) },
      { label: 'මුළු අපේක්ෂිත මුදල', value: money(totalExpected) },
      { label: 'ගණන් කළ මුදල (CLOSED)', value: money(totalCounted) },
      { label: 'ශුද්ධ වෙනස්කම (VARIANCE)', value: (totalVariance > 0 ? '+' : '') + money(totalVariance) }
    ],
    columns: columns,
    rows: rows,
    alignments: alignments,
    landscape: true,
    filename: `Shifts_Report_${today()}.csv`
  });
}

window.pgShifts = pgShifts;
window.clearShiftHistory = clearShiftHistory;
window.deleteSingleShift = deleteSingleShift;
window.exportShiftsPdfReport = exportShiftsPdfReport;
