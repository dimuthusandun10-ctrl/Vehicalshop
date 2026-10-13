/* =========================================================
   js/pages/shifts.js - Role-Based Shift History & Remote Control
   ========================================================= */

function pgShifts(){
  const db = window.DB || {};
  const allShifts = (db.shifts || []).slice().reverse();
  const user = (typeof state !== 'undefined' && state.user) ? state.user : {};
  const curRole = user.role || 'cashier';
  const curUid = user.id || user.authUid;
  const curName = user.name;
  const todayStr = today();

  /* ---------------------------------------------------------
     ROLE-BASED SHIFT FILTERING
     1. Cashier: ONLY see their own shifts
     2. Admin: ONLY see their own shifts & users under that admin
     3. Super Admin: Filtered according to selected shop
     --------------------------------------------------------- */
  let shifts = [];

  if(curRole === 'cashier'){
    // Cashier: Only their own shifts
    shifts = allShifts.filter(s => 
      s.cashierId === curUid || 
      (s.userId && s.userId === curUid) || 
      s.cashierName === curName
    );
  } else if(curRole === 'admin'){
    // Admin: Own shifts + subordinate cashiers under this admin
    const adminShopId = user.shopId;
    const users = db.users || [];

    const subordinateUsers = users.filter(u => {
      const uId = u.authUid || u.id;
      if(uId === curUid) return true; // Admin himself
      if(u.createdBy === curUid || u.adminId === curUid) return true;
      if(adminShopId && u.shopId === adminShopId && u.role === 'cashier') return true;
      return false;
    });

    const allowedUids = new Set(subordinateUsers.map(u => u.authUid || u.id).filter(Boolean));
    allowedUids.add(curUid);
    const allowedNames = new Set(subordinateUsers.map(u => u.name).filter(Boolean));
    if(curName) allowedNames.add(curName);

    shifts = allShifts.filter(s => {
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
      shifts = allShifts.filter(s => s.shopId === selShopId || (!s.shopId && selShopId === 'SHOP-001'));
    } else {
      shifts = allShifts;
    }
  }

  /* Summary statistics (based strictly on filtered shifts) */
  const todaysShifts = shifts.filter(s => (s.openedAt || '').slice(0,10) === todayStr);
  const openShifts = shifts.filter(s => s.status === 'open');
  const pendingShifts = shifts.filter(s => s.status === 'pending_balance');
  const closedShifts = shifts.filter(s => s.status === 'closed');

  /* ⭐ Total variance across CLOSED shifts only (unsettled/stopped shifts are NOT recorded as finalized) */
  const totalVar = closedShifts.reduce((a,s) => a + (s.variance||0), 0);
  const selShopId = state.activeShopId || state.activeShop?.id || 'all';

  return `
  <div class="shift-history-page">
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
      <div><b class="big">${money(totalVar)}</b><span>මුළු වෙනස්කම්</span></div>
    </div>
    <div class="stat">
      <div class="ic ic-lg" style="background:rgba(139,92,246,.15);color:#c4b5fd">📜</div>
      <div><b class="big">${closedShifts.length} <small style="font-size:12px;opacity:0.7">/ ${shifts.length}</small></b><span>අවසන් / මුළු</span></div>
    </div>
  </div>

  ${pendingShifts.length > 0 ? `
  <div style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35);border-radius:10px;padding:12px 16px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
    <div style="display:flex;align-items:center;gap:12px">
      <span style="font-size:24px">⚠️</span>
      <div>
        <b style="color:#fca5a5;font-size:13.5px">මුදල් ලාච්චුවේ අවසන් ශේෂය ඇතුළත් නොකළ Shift ${pendingShifts.length}ක් ඇත!</b>
        <small style="display:block;color:var(--muted);font-size:12px;margin-top:2px">මෙම Shift නවතා ඇති අතර, මුදල් ගණන් කර ඇතුළත් කරන තෙක් අවසන් වූ වාර්තාවක් ලෙස record නොවේ.</small>
      </div>
    </div>
    <button class="btn btn-sm btn-yellow" onclick="openSettlePendingModal('${pendingShifts[0].id}')" style="font-weight:700;display:flex;align-items:center;gap:6px">
      💰 ශේෂය ඇතුළත් කරන්න (${esc(pendingShifts[0].id)})
    </button>
  </div>` : ''}

  <div class="card">
    <div class="card-h" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <div>
        <h3 style="margin:0">📜 Cashier Shift ඉතිහාසය<small style="margin-left:8px">Shift History</small></h3>
        <div style="margin-top:5px;font-size:12px;color:var(--muted)">
          ${curRole === 'cashier' 
            ? `<span class="pill info" style="font-size:11px">👤 ඔබගේ Shift වාර්තා පමණි (My Shifts Only)</span>`
            : curRole === 'admin' 
              ? `<span class="pill info" style="font-size:11px">🛡️ ඔබගේ සහ යටතේ සිටින කැෂියර්වරුන්ගේ Shifts පමණි</span>`
              : `<span class="pill info" style="font-size:11px">👑 සුපිරි පරිපාලක · සාප්පුව: <b>${esc(state.activeShop?.name || selShopId || 'All')}</b></span>`}
        </div>
      </div>

      ${curRole === 'superadmin' ? `
      <div style="display:flex;align-items:center;gap:8px">
        <label style="font-size:12px;color:var(--muted);font-weight:600">🏪 සාප්පුව තෝරන්න:</label>
        <select onchange="state.activeShopId=this.value;if(window.DB&&window.DB.shops){state.activeShop=window.DB.shops.find(x=>x.id===this.value)||null;}render()" 
                style="padding:6px 12px;font-size:12px;border-radius:8px;background:var(--panel);border:1px solid var(--line);color:var(--txt)">
          <option value="all" ${(!state.activeShopId || state.activeShopId==='all') ? 'selected' : ''}>🌐 සියලු සාප්පු (All Shops)</option>
          ${(db.shops || []).map(sh => `
            <option value="${esc(sh.id)}" ${state.activeShopId === sh.id ? 'selected' : ''}>
              ${esc(sh.name || sh.id)} (${esc(sh.id)})
            </option>
          `).join('')}
        </select>
      </div>` : ''}
    </div>
    
    <!-- Desktop Table View -->
    <div class="desktop-only tbl-wrap">
    <table class="shifts-table">
      <thead><tr>
        <th>ID</th>
        <th>කැෂියර්</th>
        ${curRole === 'superadmin' ? '<th>සාප්පුව</th>' : ''}
        <th>ආරම්භය</th>
        <th>අවසානය</th>
        <th style="text-align:center">බිල්පත්</th>
        <th style="text-align:right">ආරම්භක</th>
        <th style="text-align:right">අපේක්ෂිත</th>
        <th style="text-align:right">ගණන් කළ</th>
        <th style="text-align:right">වෙනස්කම</th>
        <th style="text-align:center">තත්ත්වය & පාලනය</th>
      </tr></thead>
      <tbody>
      ${shifts.map(s => {
        const v = s.variance || 0;
        const vClass = Math.abs(v) < 0.01 ? 'ok' : v > 0 ? 'warn' : 'bad';
        const expected = s.summary ? s.summary.expected : (Shift.summary ? Shift.summary(s.id)?.expected : 0);
        return `<tr>
          <td data-label="ID"><b>${s.id}</b></td>
          <td data-label="කැෂියර්">
            <b>${esc(s.cashierName)}</b>
            ${s.stopReason ? `<small style="display:block;color:#f87171;font-size:10px">🛑 ${esc(s.stopReason)}</small>` : ''}
          </td>
          ${curRole === 'superadmin' ? `<td data-label="සාප්පුව"><span class="pill mute" style="font-size:10px">${esc(s.shopId || 'Default')}</span></td>` : ''}
          <td data-label="ආරම්භය"><small>${new Date(s.openedAt).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</small></td>
          <td data-label="අවසානය">
            ${s.status === 'closed' && s.closedAt
                ? `<small>${new Date(s.closedAt).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</small>`
                : s.status === 'pending_balance'
                  ? `<small style="color:#f87171">🛑 නවතා ඇත (${s.stoppedAt ? new Date(s.stoppedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : '—'})</small>`
                  : '<small style="color:var(--green)">🟢 සක්‍රීයයි</small>'}
          </td>
          <td data-label="බිල්පත්" style="text-align:center">${s.summary ? s.summary.invoices : ((s.status==='open'||s.status==='pending_balance') ? (db.sales||[]).filter(x=>x.shiftId===s.id).length : '—')}</td>
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
                ? '<span style="color:var(--muted);font-size:11px">සටහන් වී නැත</span>'
                : '—'}
          </td>
          <td data-label="තත්ත්වය" style="text-align:center;white-space:nowrap">
            ${s.status === 'open'
              ? `<span class="pill warn">🔓 විවෘත</span>
                 ${curRole === 'superadmin' ? `<button class="btn btn-sm btn-red" onclick="forceStopShiftPrompt('${s.id}')" style="margin-left:6px;padding:3px 8px;font-size:11px;font-weight:700" title="Super Admin Shift නවත්වන්න">🛑 නවත්වන්න</button>` : ''}`
              : s.status === 'pending_balance'
                ? `<span class="pill bad" style="background:rgba(239,68,68,0.18);color:#fca5a5;border:1px solid rgba(239,68,68,0.35);font-size:11px">🛑 නවතා ඇත (ශේෂය අපේක්ෂිත)</span>
                   <button class="btn btn-sm btn-yellow" onclick="openSettlePendingModal('${s.id}')" style="margin-left:6px;padding:3px 8px;font-size:11px;font-weight:700" title="මුදල් ඇතුළත් කර අවසන් කරන්න">💰 ශේෂය</button>`
                : '<span class="pill ok">🔒 අවසන්</span>'}
          </td>
        </tr>`;
      }).join('') || `<tr><td colspan="${curRole === 'superadmin' ? '11' : '10'}" class="empty">Shift වාර්තා නැත</td></tr>`}
      </tbody>
    </table>
    </div>

    <!-- Mobile Cards View -->
    <div class="mobile-only shift-cards-wrap">
      ${shifts.map(s => renderShiftCard(s, db, curRole)).join('') || '<div class="empty" style="padding:40px 20px;text-align:center">Shift වාර්තා නැත</div>'}
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

  return `
    <div class="shift-card" style="${s.status==='pending_balance' ? 'border-color:rgba(239,68,68,0.4);background:rgba(239,68,68,0.04)' : ''}">
      <div class="shift-card-head">
        <div>
          <b class="shift-card-id">${esc(s.id)}</b>
          <div style="font-size:12px;color:var(--txt);margin-top:2px">👤 <b>${esc(s.cashierName)}</b></div>
          ${s.stopReason ? `<div style="font-size:10.5px;color:#f87171;margin-top:2px">🛑 ${esc(s.stopReason)}</div>` : ''}
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
                  ? '<span style="color:var(--muted);font-size:10.5px">නොසුරැකි</span>' 
                  : '—'}</b>
        </div>
      </div>

      ${(s.status === 'open' && curRole === 'superadmin') || s.status === 'pending_balance' ? `
      <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line);display:flex;justify-content:flex-end;gap:8px">
        ${s.status === 'open' && curRole === 'superadmin' ? `
          <button class="btn btn-sm btn-red" onclick="forceStopShiftPrompt('${s.id}')" style="font-weight:700;font-size:12px;padding:6px 14px">
            🛑 Shift නවත්වන්න (Stop)
          </button>` : ''}
        ${s.status === 'pending_balance' ? `
          <button class="btn btn-sm btn-yellow" onclick="openSettlePendingModal('${s.id}')" style="font-weight:700;font-size:12px;padding:6px 14px">
            💰 මුදල් ඇතුළත් කරන්න (Settle)
          </button>` : ''}
      </div>` : ''}
    </div>
  `;
}

window.pgShifts = pgShifts;
