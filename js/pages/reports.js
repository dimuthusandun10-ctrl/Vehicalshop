/* =========================================================
   js/pages/reports.js - Business Analytics & Sales Reports
   ========================================================= */

function pgReports(){
  const db = window.DB || {};
  const from = state.repFrom, to = state.repTo;
  const list = (db.sales || []).filter(s => {
    const d = (s.date || '').slice(0,10);
    return d >= from && d <= to;
  });
  const total = list.reduce((a,s) => a + (s.total || 0), 0);
  const cash   = list.filter(s => s.method === 'cash').reduce((a,s) => a + (s.total || 0), 0);
  const card   = list.filter(s => s.method === 'card').reduce((a,s) => a + (s.total || 0), 0);
  const credit = list.filter(s => s.method === 'credit').reduce((a,s) => a + (s.total || 0), 0);
  const disc   = list.reduce((a,s) => a + (s.disc || 0), 0);

  // Top products
  const pm = {};
  list.forEach(s => (s.items || []).forEach(i => {
    pm[i.pid] = pm[i.pid] || { name: i.name, code: i.code, qty: 0, amt: 0 };
    pm[i.pid].qty += i.qty;
    pm[i.pid].amt += i.qty * (i.effectivePrice || i.price);
  }));
  const top = Object.values(pm).sort((a,b) => b.qty - a.qty).slice(0,8);

  const approvedReturnsTotal = (db.returns || [])
    .filter(r => r.status === 'approved' && r.date >= from && r.date <= to)
    .reduce((a,r) => a + (r.amount || 0), 0);

  return `
  <div class="reports-page">
    <div class="card" style="margin-bottom:14px">
      <div class="reports-date-range" style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
        <div style="min-width:160px;flex:1"><label style="font-size:11.5px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">සිට / From</label>
          <button type="button" class="date-picker-trigger" onclick="openReportsDatePicker('from')">
            <span class="dp-icon">📅</span>
            <span class="dp-value" id="dateFromLabel">${from}</span>
            <span class="dp-chevron">▾</span>
          </button>
        </div>
        <div style="min-width:160px;flex:1"><label style="font-size:11.5px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">දක්වා / To</label>
          <button type="button" class="date-picker-trigger" onclick="openReportsDatePicker('to')">
            <span class="dp-icon">📅</span>
            <span class="dp-value" id="dateToLabel">${to}</span>
            <span class="dp-chevron">▾</span>
          </button>
        </div>
        <button class="btn btn-sm" onclick="state.repFrom='${today()}';state.repTo='${today()}';render()">අද</button>
        <button class="btn btn-sm" onclick="window.print()">🖨️ මුද්‍රණය</button>
      </div>
    </div>

    <div class="stats">
      <div class="stat"><div class="ic" style="background:rgba(245,158,11,.15);color:#fcd34d">💰</div>
        <div><b>${money(total)}</b><span>මුළු ආදායම / Total Sales</span></div></div>
      <div class="stat"><div class="ic" style="background:rgba(16,185,129,.15);color:#6ee7b7">💵</div>
        <div><b>${money(cash)}</b><span>මුදල් ගෙවීම් / Cash</span></div></div>
      <div class="stat"><div class="ic" style="background:rgba(59,130,246,.15);color:#93c5fd">💳</div>
        <div><b>${money(card)}</b><span>කාඩ් ගෙවීම් / Card</span></div></div>
      <div class="stat"><div class="ic" style="background:rgba(245,158,11,.15);color:#fcd34d">🕒</div>
        <div><b>${money(credit)}</b><span>ණය විකුණුම් / Credit</span></div></div>
    </div>

    <div class="grid2" style="align-items:start">
      <div class="card">
        <div class="card-h"><h3>🏆 වැඩිපුර විකුණු භාණ්ඩ<small>Top Selling Products</small></h3></div>
        <div class="tbl-wrap">
        <table class="report-table reports-table reports-top-products"><thead><tr><th>#</th><th>භාණ්ඩය</th><th style="text-align:center">ප්‍රමාණය</th><th style="text-align:right">ආදායම</th></tr></thead><tbody>
        ${top.map((p,i)=>`<tr>
          <td data-label="#">${i+1}</td>
          <td data-label="භාණ්ඩය">${esc(p.name)}<small>${p.code}</small></td>
          <td data-label="ප්‍රමාණය" style="text-align:center"><span class="pill info">${p.qty}</span></td>
          <td data-label="ආදායම" style="text-align:right;color:var(--primary);font-weight:700">${money(p.amt)}</td></tr>`).join('')
          || '<tr><td colspan="4" class="empty">දත්ත නැත</td></tr>'}
        </tbody></table></div>
      </div>

      <div class="card">
        <div class="card-h"><h3>📄 බිල්පත් ලැයිස්තුව<small>Invoice List</small></h3></div>
        <div class="tbl-wrap">
        <table class="report-table reports-table reports-invoices"><thead><tr><th>අංකය</th><th>දිනය</th><th>ක්‍රමය</th><th>කැෂියර්</th><th style="text-align:right">මුදල</th></tr></thead><tbody>
        ${list.slice().reverse().map(s=>`<tr>
          <td data-label="අංකය"><b>${s.no}</b></td>
          <td data-label="දිනය"><small>${new Date(s.date).toLocaleDateString('en-GB')}</small></td>
          <td data-label="ක්‍රමය"><span class="pill ${s.method==='cash'?'ok':s.method==='card'?'info':'warn'}">${s.method==='cash'?'මුදල්':s.method==='card'?'කාඩ්':'ණය'}</span></td>
          <td data-label="කැෂියර්"><small>${esc(s.cashier)}</small></td>
          <td data-label="මුදල" style="text-align:right;font-weight:700">${money(s.total)}</td></tr>`).join('')
          || '<tr><td colspan="5" class="empty">දත්ත නැත</td></tr>'}
        </tbody></table></div>
      </div>
    </div>

    <div class="card report-summary financial-summary" style="margin-top:14px">
      <div class="card-h"><h3>📊 සාරාංශය<small>Financial Summary</small></h3></div>
      <div class="srow"><span>මුළු විකුණුම් එකතුව</span><b>${money(total + disc)}</b></div>
      <div class="srow"><span>ලබා දුන් වට්ටම්</span><b style="color:var(--red)">− ${money(disc)}</b></div>
      <div class="srow"><span>ආපසු භාරදීම් (අනුමත)</span><b style="color:var(--red)">− ${money(approvedReturnsTotal)}</b></div>
      <div class="srow total"><span>ශුද්ධ ආදායම (Net Revenue)</span><span>${money(total - approvedReturnsTotal)}</span></div>
    </div>
  </div>`;
}

function openReportsDatePicker(target){
  const value = target === 'from' ? state.repFrom : state.repTo;
  if(typeof openDatePicker !== 'function'){
    console.warn('DatePicker component not loaded');
    return;
  }
  openDatePicker(target, {
    value,
    onConfirm: (newValue, rangeEnd) => {
      if(rangeEnd){
        state.repFrom = newValue;
        state.repTo = rangeEnd;
      } else {
        if(target === 'from') state.repFrom = newValue;
        else state.repTo = newValue;
      }
      if(typeof render === 'function') render();
      else if(typeof go === 'function') go('reports');
    }
  });
}

window.pgReports = pgReports;
window.openReportsDatePicker = openReportsDatePicker;
