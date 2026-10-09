/* =========================================================
   js/pages/shifts.js - Shift History & Reports Page (Admin)
   ========================================================= */

function pgShifts(){
  const db = window.DB || {};
  const shifts = (db.shifts || []).slice().reverse();
  const todayStr = today();

  const todaysShifts = shifts.filter(s => (s.openedAt || '').slice(0,10) === todayStr);
  const openShifts = shifts.filter(s => s.status === 'open');

  /* Total variance across all closed shifts */
  const totalVar = shifts.filter(s => s.status === 'closed').reduce((a,s) => a + (s.variance||0), 0);

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
      <div><b class="big">${shifts.length}</b><span>මුළු වාර්තා</span></div>
    </div>
  </div>

  <div class="card">
    <div class="card-h">
      <h3>📜 Cashier Shift ඉතිහාසය<small>Shift History</small></h3>
    </div>
    
    <!-- Desktop Table View -->
    <div class="desktop-only tbl-wrap">
    <table class="shifts-table">
      <thead><tr>
        <th>ID</th><th>කැෂියර්</th><th>ආරම්භය</th><th>අවසානය</th>
        <th style="text-align:center">බිල්පත්</th>
        <th style="text-align:right">ආරම්භක</th>
        <th style="text-align:right">අපේක්ෂිත</th>
        <th style="text-align:right">ගණන් කළ</th>
        <th style="text-align:right">වෙනස්කම</th>
        <th>තත්ත්වය</th>
      </tr></thead>
      <tbody>
      ${shifts.map(s => {
        const v = s.variance || 0;
        const vClass = Math.abs(v) < 0.01 ? 'ok' : v > 0 ? 'warn' : 'bad';
        const expected = s.summary ? s.summary.expected : 0;
        return `<tr>
          <td data-label="ID"><b>${s.id}</b></td>
          <td data-label="කැෂියර්">${esc(s.cashierName)}</td>
          <td data-label="ආරම්භය"><small>${new Date(s.openedAt).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</small></td>
          <td data-label="අවසානය">${s.closedAt
              ? `<small>${new Date(s.closedAt).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</small>`
              : '<small style="color:var(--green)">සක්‍රීය</small>'}</td>
          <td data-label="බිල්පත්" style="text-align:center">${s.summary ? s.summary.invoices : (s.status==='open' ? (db.sales||[]).filter(x=>x.shiftId===s.id).length : '—')}</td>
          <td data-label="ආරම්භක" class="amount" style="text-align:right">${money(s.openingFloat)}</td>
          <td data-label="අපේක්ෂිත" class="amount" style="text-align:right;color:var(--primary)">${s.status === 'closed' ? money(expected) : '—'}</td>
          <td data-label="ගණන් කළ" class="amount" style="text-align:right">${s.closingCount != null ? money(s.closingCount) : '—'}</td>
          <td data-label="වෙනස්කම" style="text-align:right">
            ${s.status === 'closed'
              ? `<span class="pill ${vClass}">${v > 0 ? '+' : ''}${money(v)}</span>`
              : '—'}
          </td>
          <td data-label="තත්ත්වය">${s.status === 'open'
                ? '<span class="pill warn">🔓 විවෘත</span>'
                : '<span class="pill ok">🔒 අවසන්</span>'}</td>
        </tr>`;
      }).join('') || '<tr><td colspan="10" class="empty">Shift වාර්තා නැත</td></tr>'}
      </tbody>
    </table>
    </div>

    <!-- Mobile Cards View -->
    <div class="mobile-only shift-cards-wrap">
      ${shifts.map(s => renderShiftCard(s, db)).join('') || '<div class="empty" style="padding:40px 20px;text-align:center">Shift වාර්තා නැත</div>'}
    </div>
  </div>
  </div>`;
}

function renderShiftCard(s, db){
  const v = s.variance || 0;
  const vClass = Math.abs(v) < 0.01 ? 'ok' : v > 0 ? 'warn' : 'bad';
  const expected = s.summary ? s.summary.expected : 0;
  const invCount = s.summary ? s.summary.invoices : (s.status==='open' ? (db.sales||[]).filter(x=>x.shiftId===s.id).length : '—');
  const openedStr = new Date(s.openedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const closedStr = s.closedAt
    ? new Date(s.closedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '🟢 සක්‍රීයයි (Active)';

  return `
    <div class="shift-card">
      <div class="shift-card-head">
        <div>
          <b class="shift-card-id">${esc(s.id)}</b>
          <div style="font-size:12px;color:var(--txt);margin-top:2px">👤 <b>${esc(s.cashierName)}</b></div>
        </div>
        <div>
          ${s.status === 'open'
            ? '<span class="pill warn">🔓 විවෘත</span>'
            : '<span class="pill ok">🔒 අවසන්</span>'}
        </div>
      </div>

      <div class="shift-card-meta">
        <div><small style="color:var(--muted)">ආරම්භය:</small> <span>${openedStr}</span></div>
        <div><small style="color:var(--muted)">අවසානය:</small> <span>${closedStr}</span></div>
        <div><small style="color:var(--muted)">බිල්පත්:</small> <span class="pill mute" style="font-size:10px;padding:1px 6px">${invCount} bills</span></div>
      </div>

      <div class="shift-card-grid">
        <div class="sc-stat">
          <small>ආරම්භක</small>
          <b>${money(s.openingFloat)}</b>
        </div>
        <div class="sc-stat">
          <small>අපේක්ෂිත</small>
          <b style="color:var(--primary)">${s.status === 'closed' ? money(expected) : '—'}</b>
        </div>
        <div class="sc-stat">
          <small>ගණන් කළ</small>
          <b>${s.closingCount != null ? money(s.closingCount) : '—'}</b>
        </div>
        <div class="sc-stat">
          <small>වෙනස්කම</small>
          <b>${s.status === 'closed' ? `<span class="pill ${vClass}" style="padding:2px 6px;font-size:11px">${v > 0 ? '+' : ''}${money(v)}</span>` : '—'}</b>
        </div>
      </div>
    </div>
  `;
}

window.pgShifts = pgShifts;
