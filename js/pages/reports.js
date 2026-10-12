/* =========================================================
   js/pages/reports.js - Business Analytics, P&L & CSV Exports
   Phase 7: Reports & Financials (P&L + Export + Payables)
   ========================================================= */

function pgReports(){
  const curTab = window.state.reportsTab || 'sales';
  const from = state.repFrom || today();
  const to = state.repTo || today();

  const TABS = [
    { id: 'sales', icon: '📊', si: 'විකුණුම් වාර්තාව', en: 'Sales Overview' },
    { id: 'pl',    icon: '💰', si: 'P&L ලාභ පාඩුව',    en: 'Profit & Loss' }
  ];

  return `
  <div class="reports-page">
    
    <!-- Top Tabs Row -->
    <div class="reports-tabs" style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
      ${TABS.map(t => `
        <button class="reports-tab ${curTab === t.id ? 'active' : ''}" 
                onclick="window.state.reportsTab = '${t.id}'; render();"
                style="display:flex;align-items:center;gap:6px;padding:9px 16px;border-radius:10px;font-size:13px;cursor:pointer">
          <span>${t.icon}</span>
          <b>${t.si}</b>
          <small style="opacity:0.7">· ${t.en}</small>
        </button>
      `).join('')}
    </div>

    <!-- Date Range Picker & Global Action Bar -->
    <div class="card" style="margin-bottom:14px">
      <div class="reports-date-range" style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
        <div style="min-width:150px;flex:1">
          <label style="font-size:11.5px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">සිට / From</label>
          <button type="button" class="date-picker-trigger" onclick="openReportsDatePicker('from')">
            <span class="dp-icon">📅</span>
            <span class="dp-value" id="dateFromLabel">${from}</span>
            <span class="dp-chevron">▾</span>
          </button>
        </div>
        <div style="min-width:150px;flex:1">
          <label style="font-size:11.5px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">දක්වා / To</label>
          <button type="button" class="date-picker-trigger" onclick="openReportsDatePicker('to')">
            <span class="dp-icon">📅</span>
            <span class="dp-value" id="dateToLabel">${to}</span>
            <span class="dp-chevron">▾</span>
          </button>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-sm" onclick="state.repFrom='${today()}';state.repTo='${today()}';render()">අද (Today)</button>
          <button class="btn btn-sm" onclick="setQuickReportsRange(7)">දින 7</button>
          <button class="btn btn-sm" onclick="setQuickReportsRange(30)">දින 30</button>
          <button class="btn btn-sm" onclick="window.print()">🖨️ මුද්‍රණය</button>
        </div>
      </div>

      <!-- Quick CSV Export Tools Row -->
      <div style="display:flex;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid var(--line);flex-wrap:wrap;align-items:center">
        <small style="color:var(--muted);font-weight:600;margin-right:4px">⬇️ Export:</small>
        <button class="btn btn-sm" onclick="exportSalesCSV()" title="විකුණුම් වාර්තාව CSV ලෙස බාගත කරන්න" style="font-size:12px;padding:5px 10px">
          📄 Sales CSV
        </button>
        <button class="btn btn-sm" onclick="exportPLCSV()" title="P&L දෛනික විස්තරය CSV ලෙස බාගත කරන්න" style="font-size:12px;padding:5px 10px">
          💰 P&L CSV
        </button>
        <button class="btn btn-sm" onclick="exportInventoryCSV()" title="සම්පූර්ණ තොග නාමාවලිය CSV ලෙස බාගත කරන්න" style="font-size:12px;padding:5px 10px">
          📦 Inventory CSV
        </button>
        <button class="btn btn-sm" onclick="exportCustomersCSV()" title="පාරිභෝගික නාමාවලිය සහ ණය ශේෂය CSV ලෙස බාගත කරන්න" style="font-size:12px;padding:5px 10px">
          👥 Customers CSV
        </button>
      </div>
    </div>

    <!-- Active Tab Body -->
    ${curTab === 'pl' ? repProfitLoss(from, to) : repSalesOverview(from, to)}

  </div>`;
}

/* =========================================================
   TAB 1: SALES OVERVIEW (REVENUE & TOP PRODUCTS)
   ========================================================= */
function repSalesOverview(from, to){
  const db = window.DB || {};
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
    .filter(r => r.status === 'approved' && (r.date || '').slice(0,10) >= from && (r.date || '').slice(0,10) <= to)
    .reduce((a,r) => a + (r.amount || 0), 0);

  return `
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
        <div class="card-h">
          <h3>🏆 වැඩිපුර විකුණු භාණ්ඩ<small>Top Selling Products</small></h3>
        </div>
        <div class="tbl-wrap">
          <table class="report-table reports-table reports-top-products">
            <thead>
              <tr><th>#</th><th>භාණ්ඩය</th><th style="text-align:center">ප්‍රමාණය</th><th style="text-align:right">ආදායම</th></tr>
            </thead>
            <tbody>
              ${top.map((p,i)=>`<tr>
                <td data-label="#">${i+1}</td>
                <td data-label="භාණ්ඩය">${esc(p.name)}<small>${p.code || ''}</small></td>
                <td data-label="ප්‍රමාණය" style="text-align:center"><span class="pill info">${p.qty}</span></td>
                <td data-label="ආදායම" style="text-align:right;color:var(--primary);font-weight:700">${money(p.amt)}</td>
              </tr>`).join('') || '<tr><td colspan="4" class="empty">දත්ත නැත</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-h">
          <h3>📄 බිල්පත් ලැයිස්තුව<small>Invoice List (${list.length})</small></h3>
          <button class="btn btn-sm" onclick="exportSalesCSV()">⬇️ CSV</button>
        </div>
        <div class="tbl-wrap">
          <table class="report-table reports-table reports-invoices">
            <thead>
              <tr><th>අංකය</th><th>දිනය</th><th>ක්‍රමය</th><th>කැෂියර්</th><th style="text-align:right">මුදල</th></tr>
            </thead>
            <tbody>
              ${list.slice().reverse().map(s=>`<tr>
                <td data-label="අංකය"><b>${s.no}</b></td>
                <td data-label="දිනය"><small>${new Date(s.date).toLocaleDateString('en-GB')}</small></td>
                <td data-label="ක්‍රමය"><span class="pill ${s.method==='cash'?'ok':s.method==='card'?'info':'warn'}">${s.method==='cash'?'මුදල්':s.method==='card'?'කාඩ්':'ණය'}</span></td>
                <td data-label="කැෂියර්"><small>${esc(s.cashier)}</small></td>
                <td data-label="මුදල" style="text-align:right;font-weight:700">${money(s.total)}</td>
              </tr>`).join('') || '<tr><td colspan="5" class="empty">දත්ත නැත</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card report-summary financial-summary" style="margin-top:14px">
      <div class="card-h"><h3>📊 සාරාංශය<small>Financial Summary</small></h3></div>
      <div class="srow"><span>මුළු විකුණුම් එකතුව</span><b>${money(total + disc)}</b></div>
      <div class="srow"><span>ලබා දුන් වට්ටම්</span><b style="color:var(--red)">− ${money(disc)}</b></div>
      <div class="srow"><span>ආපසු භාරදීම් (අනුමත)</span><b style="color:var(--red)">− ${money(approvedReturnsTotal)}</b></div>
      <div class="srow total"><span>ශුද්ධ ආදායම (Net Revenue)</span><span>${money(total - approvedReturnsTotal)}</span></div>
    </div>
  `;
}

/* =========================================================
   TAB 2: GROSS PROFIT / P&L REPORT (COGS & NET PROFIT)
   ========================================================= */
function repProfitLoss(from, to){
  const db = window.DB || {};
  const sales = (db.sales || []).filter(s => {
    const d = (s.date || '').slice(0,10);
    return d >= from && d <= to;
  });

  let totalRevenue = 0;
  let totalCOGS = 0;
  let totalDiscounts = 0;
  let totalRefunds = 0;

  // Per-day breakdown
  const dailyMap = {};

  sales.forEach(sale => {
    const day = (sale.date || '').slice(0,10) || today();
    if(!dailyMap[day]){
      dailyMap[day] = {
        revenue: 0,
        cogs: 0,
        profit: 0,
        invoices: 0,
        discounts: 0
      };
    }

    // Revenue
    const revenue = Number(sale.total || 0);
    totalRevenue += revenue;
    dailyMap[day].revenue += revenue;
    dailyMap[day].invoices++;

    // Discounts
    const disc = Number(sale.disc || 0);
    totalDiscounts += disc;
    dailyMap[day].discounts += disc;

    // COGS - calculate from items with snapshot fallback
    let saleCOGS = 0;
    (sale.items || []).forEach(item => {
      const product = db.getProd ? db.getProd(item.pid) : (db.products || []).find(p => p.id === item.pid);
      const unitCost = Number(item.costAtSale != null ? item.costAtSale : (item.cost != null ? item.cost : (product ? product.cost : 0))) || 0;
      const qty = Number(item.qty || 1);
      saleCOGS += unitCost * qty;
    });

    totalCOGS += saleCOGS;
    dailyMap[day].cogs += saleCOGS;

    const profit = revenue - saleCOGS;
    dailyMap[day].profit += profit;
  });

  // Refunds (approved returns in date range)
  const refunds = (db.returns || []).filter(r => {
    if(r.status !== 'approved') return false;
    const d = (r.date || '').slice(0,10);
    return d >= from && d <= to;
  });
  totalRefunds = refunds.reduce((a, r) => a + (Number(r.amount) || 0), 0);

  // Gross profit & margin
  const grossProfit = totalRevenue - totalCOGS;
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue * 100) : 0;

  // Net profit (after refunds)
  const netProfit = grossProfit - totalRefunds;

  // Daily breakdown array (sorted newest to oldest)
  const daily = Object.entries(dailyMap)
    .map(([date, d]) => ({ date, ...d }))
    .sort((a, b) => b.date.localeCompare(a.date));

  return `
    <div class="report-pl">
      
      <!-- Summary metrics cards -->
      <div class="report-metrics">
        <div class="report-metric">
          <div class="rm-icon" style="background:rgba(16,185,129,0.15);color:#6ee7b7">💰</div>
          <div>
            <div class="rm-label">මුළු ආදායම (Revenue)</div>
            <div class="rm-value" style="color:var(--primary)">${money(totalRevenue)}</div>
            <div class="rm-sub">${sales.length} බිල්පත්</div>
          </div>
        </div>
        
        <div class="report-metric">
          <div class="rm-icon" style="background:rgba(239,68,68,0.15);color:#fca5a5">📦</div>
          <div>
            <div class="rm-label">භාණ්ඩ පිරිවැය (COGS)</div>
            <div class="rm-value" style="color:#fca5a5">${money(totalCOGS)}</div>
            <div class="rm-sub">${(totalRevenue > 0 ? (totalCOGS / totalRevenue * 100) : 0).toFixed(1)}% of Revenue</div>
          </div>
        </div>
        
        <div class="report-metric">
          <div class="rm-icon" style="background:rgba(59,130,246,0.15);color:#93c5fd">📈</div>
          <div>
            <div class="rm-label">දළ ලාභය (Gross Profit)</div>
            <div class="rm-value" style="color:${grossProfit >= 0 ? '#6ee7b7' : '#fca5a5'}">
              ${money(grossProfit)}
            </div>
            <div class="rm-sub">Margin: ${grossMargin.toFixed(1)}%</div>
          </div>
        </div>
        
        <div class="report-metric">
          <div class="rm-icon" style="background:rgba(139,92,246,0.15);color:#c4b5fd">💵</div>
          <div>
            <div class="rm-label">ශුද්ධ ලාභය (Net Profit)</div>
            <div class="rm-value" style="color:${netProfit >= 0 ? '#6ee7b7' : '#fca5a5'}">
              ${money(netProfit)}
            </div>
            <div class="rm-sub">Refunds අඩු කර</div>
          </div>
        </div>
      </div>
      
      <!-- Breakdown Summary -->
      <div class="card" style="margin-top:14px">
        <div class="card-h">
          <h3>📊 ලාභ හා අලාභ සාරාංශය<small>P&L Financial Summary</small></h3>
        </div>
        
        <div class="srow"><span>මුළු විකුණුම් (Total Revenue)</span><b>${money(totalRevenue)}</b></div>
        <div class="srow"><span>ලබා දුන් වට්ටම් (Discounts)</span><b style="color:#fca5a5">− ${money(totalDiscounts)}</b></div>
        <div class="srow"><span>භාණ්ඩ පිරිවැය (Cost of Goods Sold - COGS)</span><b style="color:#fca5a5">− ${money(totalCOGS)}</b></div>
        <div class="srow" style="border-top:1px dashed var(--line);padding-top:8px;margin-top:6px">
          <span><b>දළ ලාභය (Gross Profit)</b></span>
          <b style="color:${grossProfit >= 0 ? '#6ee7b7' : '#fca5a5'};font-size:16px">
            ${money(grossProfit)}
          </b>
        </div>
        <div class="srow"><span>ආපසු භාරදීම් (Customer Refunds)</span><b style="color:#fca5a5">− ${money(totalRefunds)}</b></div>
        <div class="srow total" style="font-size:18px;margin-top:8px;padding-top:10px;border-top:2px solid var(--primary)">
          <span>ශුද්ධ ලාභය (Net Profit)</span>
          <span style="color:${netProfit >= 0 ? '#6ee7b7' : '#fca5a5'}">
            ${money(netProfit)}
          </span>
        </div>
      </div>
      
      <!-- Daily Breakdown Table -->
      <div class="card" style="margin-top:14px">
        <div class="card-h" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <div>
            <h3 style="margin:0">📅 දෛනික විස්තරය<small>Daily P&L Breakdown (${daily.length} දින)</small></h3>
          </div>
          <button class="btn btn-sm btn-primary" onclick="exportPLCSV()">⬇️ P&L CSV</button>
        </div>
        
        <div class="tbl-wrap">
          <table class="report-table">
            <thead>
              <tr>
                <th>දිනය</th>
                <th style="text-align:center">බිල්පත්</th>
                <th style="text-align:right">ආදායම</th>
                <th style="text-align:right">COGS</th>
                <th style="text-align:right">දළ ලාභය</th>
                <th style="text-align:center">Margin %</th>
              </tr>
            </thead>
            <tbody>
              ${daily.map(d => {
                const margin = d.revenue > 0 ? (d.profit / d.revenue * 100) : 0;
                return `
                  <tr>
                    <td data-label="දිනය"><b>${new Date(d.date).toLocaleDateString('en-GB')}</b></td>
                    <td data-label="බිල්පත්" style="text-align:center"><span class="pill info">${d.invoices}</span></td>
                    <td data-label="ආදායම" style="text-align:right;font-weight:600">${money(d.revenue)}</td>
                    <td data-label="COGS" style="text-align:right;color:#fca5a5">${money(d.cogs)}</td>
                    <td data-label="දළ ලාභය" style="text-align:right;color:${d.profit >= 0 ? '#6ee7b7' : '#fca5a5'};font-weight:700">${money(d.profit)}</td>
                    <td data-label="Margin %" style="text-align:center">
                      <span class="pill ${margin > 20 ? 'ok' : margin > 10 ? 'warn' : 'bad'}">
                        ${margin.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                `;
              }).join('') || '<tr><td colspan="6" class="empty">මෙම කාල පරාසය සඳහා දත්ත නොමැත</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
      
    </div>
  `;
}

/* =========================================================
   DATE RANGE & HELPER FUNCTIONS
   ========================================================= */
function setQuickReportsRange(days){
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(toDate.getDate() - (days - 1));
  state.repFrom = fromDate.toISOString().slice(0, 10);
  state.repTo = toDate.toISOString().slice(0, 10);
  render();
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

/* =========================================================
   CSV EXPORT GENERATORS
   ========================================================= */

function exportSalesCSV(){
  const db = window.DB || {};
  const from = state.repFrom || today();
  const to = state.repTo || today();
  
  const sales = (db.sales || []).filter(s => {
    const d = (s.date || '').slice(0, 10);
    return d >= from && d <= to;
  });
  
  const headers = [
    'Invoice', 'Date', 'Time', 'Cashier', 'Customer', 'Vehicle',
    'Method', 'Subtotal', 'Discount', 'Tax', 'Total',
    'Paid', 'Change', 'Items Count'
  ];
  
  const rows = sales.map(s => [
    s.no,
    (s.date || '').slice(0, 10),
    s.date ? new Date(s.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '',
    s.cashier || '',
    s.customer || '',
    s.vehicle || '',
    s.method || '',
    Number(s.sub || 0).toFixed(2),
    Number(s.disc || 0).toFixed(2),
    Number(s.tax || 0).toFixed(2),
    Number(s.total || 0).toFixed(2),
    Number(s.paid || 0).toFixed(2),
    Number(s.change || 0).toFixed(2),
    (s.items || []).length
  ]);
  
  downloadCSV(`sales-${from}_to_${to}.csv`, headers, rows);
}

function exportPLCSV(){
  const db = window.DB || {};
  const from = state.repFrom || today();
  const to = state.repTo || today();
  
  const sales = (db.sales || []).filter(s => {
    const d = (s.date || '').slice(0, 10);
    return d >= from && d <= to;
  });

  const dailyMap = {};
  sales.forEach(sale => {
    const day = (sale.date || '').slice(0, 10) || today();
    if(!dailyMap[day]){
      dailyMap[day] = { revenue: 0, cogs: 0, profit: 0, invoices: 0, discounts: 0 };
    }
    const rev = Number(sale.total || 0);
    dailyMap[day].revenue += rev;
    dailyMap[day].invoices++;
    dailyMap[day].discounts += Number(sale.disc || 0);

    let saleCOGS = 0;
    (sale.items || []).forEach(item => {
      const prod = db.getProd ? db.getProd(item.pid) : (db.products || []).find(p => p.id === item.pid);
      const unitCost = Number(item.costAtSale != null ? item.costAtSale : (item.cost != null ? item.cost : (prod ? prod.cost : 0))) || 0;
      saleCOGS += unitCost * Number(item.qty || 1);
    });
    dailyMap[day].cogs += saleCOGS;
    dailyMap[day].profit += (rev - saleCOGS);
  });

  const daily = Object.entries(dailyMap)
    .map(([date, d]) => ({ date, ...d }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const headers = [
    'Date', 'Invoices', 'Revenue (Rs.)', 'COGS (Rs.)',
    'Gross Profit (Rs.)', 'Gross Margin (%)', 'Discounts (Rs.)'
  ];

  const rows = daily.map(d => {
    const margin = d.revenue > 0 ? (d.profit / d.revenue * 100).toFixed(1) : '0.0';
    return [
      d.date,
      d.invoices,
      d.revenue.toFixed(2),
      d.cogs.toFixed(2),
      d.profit.toFixed(2),
      margin,
      d.discounts.toFixed(2)
    ];
  });

  downloadCSV(`pnl-${from}_to_${to}.csv`, headers, rows);
}

function exportInventoryCSV(){
  const db = window.DB || {};
  const activeShop = (typeof currentShopId === 'function') ? currentShopId() : null;
  const products = (db.products || []).filter(p => !activeShop || p.shopId === activeShop || !p.shopId);
  
  const headers = [
    'Code', 'Name (EN)', 'Name (SI)', 'Category', 'Brand', 'Model',
    'OEM No', 'Rack', 'Bin', 'Cost (Rs.)', 'Price (Rs.)', 'Qty', 'Reorder',
    'Unit', 'Warranty (months)', 'Core Deposit'
  ];
  
  const rows = products.map(p => [
    p.code || '',
    p.nameEn || '',
    p.name || '',
    p.cat || '',
    p.brand || '',
    p.model || '',
    p.oemNo || '',
    p.rack || '',
    p.bin || '',
    Number(p.cost || 0).toFixed(2),
    Number(p.price || 0).toFixed(2),
    p.qty || 0,
    p.reorder || 0,
    p.unit || 'pcs',
    p.warranty || 0,
    Number(p.coreDeposit || 0).toFixed(2)
  ]);
  
  downloadCSV(`inventory-${today()}.csv`, headers, rows);
}

function exportCustomersCSV(){
  const db = window.DB || {};
  const activeShop = (typeof currentShopId === 'function') ? currentShopId() : null;
  const customers = (db.customers || []).filter(c => !activeShop || c.shopId === activeShop || !c.shopId);
  
  const headers = [
    'Name', 'Phone', 'Vehicle', 'Points', 
    'Credit Limit (Rs.)', 'Current Balance (Rs.)', 
    'Total Spent (Rs.)', 'Last Purchase', 'Created At'
  ];
  
  const rows = customers.map(c => {
    const credit = (typeof customerCreditBalance === 'function') ? customerCreditBalance(c.id) : { balance: 0 };
    const sales = (db.sales || []).filter(s => s.customerId === c.id);
    const totalSpent = sales.reduce((a, s) => a + (Number(s.total) || 0), 0);
    const lastPurchase = sales.length > 0 ? 
      sales.slice().sort((a, b) => new Date(b.date) - new Date(a.date))[0].date.slice(0, 10) : '';
    
    return [
      c.name || '',
      c.phone || '',
      c.vehicle || '',
      c.points || 0,
      Number(c.creditLimit || 0).toFixed(2),
      Number(credit.balance || 0).toFixed(2),
      totalSpent.toFixed(2),
      lastPurchase,
      c.createdAt ? String(c.createdAt).slice(0, 10) : ''
    ];
  });
  
  downloadCSV(`customers-${today()}.csv`, headers, rows);
}

window.pgReports = pgReports;
window.repSalesOverview = repSalesOverview;
window.repProfitLoss = repProfitLoss;
window.setQuickReportsRange = setQuickReportsRange;
window.openReportsDatePicker = openReportsDatePicker;
window.exportSalesCSV = exportSalesCSV;
window.exportPLCSV = exportPLCSV;
window.exportInventoryCSV = exportInventoryCSV;
window.exportCustomersCSV = exportCustomersCSV;
