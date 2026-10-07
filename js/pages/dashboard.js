/* =====================================================
   js/pages/dashboard.js - Enhanced Dashboard with Insights
   ===================================================== */

function pgDashboard(){
  const t = today();
  const y = new Date(Date.now() - 86400000).toISOString().slice(0,10);

  const todays = DB.sales.filter(s => s.date.slice(0,10) === t);
  const yester = DB.sales.filter(s => s.date.slice(0,10) === y);

  const todayTotal = todays.reduce((a,s)=>a + s.total, 0);
  const yesterTotal = yester.reduce((a,s)=>a + s.total, 0);

  const low = DB.products.filter(p => p.qty <= p.reorder);
  const out = low.filter(p => p.qty === 0);
  const stockVal = DB.products.reduce((a,p)=>a + p.cost * p.qty, 0);
  const retailVal = DB.products.reduce((a,p)=>a + p.price * p.qty, 0);

  /* Trend calculations */
  const trendSales = pctChange(todayTotal, yesterTotal);
  const trendInvoices = pctChange(todays.length, yester.length);

  /* 7-day sales chart */
  const chart = last7Days();

  /* Top products (today) */
  const topProds = topProducts(todays, 5);

  /* Payment split */
  const payCash = todays.filter(s => s.method === 'cash').reduce((a,s)=>a + s.total, 0);
  const payCard = todays.filter(s => s.method === 'card').reduce((a,s)=>a + s.total, 0);
  const payCredit = todays.filter(s => s.method === 'credit').reduce((a,s)=>a + s.total, 0);
  const payTotal = payCash + payCard + payCredit || 1;
  const pctCash = Math.round(payCash / payTotal * 100);
  const pctCard = Math.round(payCard / payTotal * 100);
  const pctCredit = Math.round(payCredit / payTotal * 100);

  /* Dynamic Greeting based on time */
  const hr = new Date().getHours();
  const greet = hr < 12 ? 'සුබ උදෑසනක්' : hr < 17 ? 'සුබ දවසක්' : 'සුබ සවසක්';
  const emoji = hr < 12 ? '🌅' : hr < 17 ? '☀️' : '🌆';

  return `
  <!-- ============ GREETING HERO ============ -->
  <div class="dash-hero">
    <div class="greet">
      <h2>${emoji} ${greet}, ${esc(state.user.name)}!</h2>
      <p>අද දින විකුණුම් තත්ත්වය මෙසේයි. කිසියම් කරුණක් සිත් ඇදගන්නා සුළු නම් පහළ පියවර ගන්න.</p>
    </div>
    <div class="hero-actions">
      <button class="btn btn-primary" onclick="go('billing')">💰 නව බිලක්</button>
      ${state.user.role !== 'cashier'
        ? `<button class="btn btn-blue" onclick="go('grn')">📥 GRN</button>` : ''}
      <button class="btn" onclick="go('reports')">📊 වාර්තා</button>
    </div>
  </div>

  <!-- ============ STAT CARDS ============ -->
  <div class="stats">
    <div class="stat">
      <div class="ic ic-lg" style="background:rgba(245,158,11,.15);color:#fcd34d">💰</div>
      <div class="stack">
        <b class="big">${money(todayTotal)}</b>
        <span>අද විකුණුම්</span>
        ${trendBadge(trendSales)}
      </div>
    </div>

    <div class="stat">
      <div class="ic ic-lg" style="background:rgba(16,185,129,.15);color:#6ee7b7">🧾</div>
      <div class="stack">
        <b class="big">${todays.length}</b>
        <span>අද බිල්පත්</span>
        ${trendBadge(trendInvoices)}
      </div>
    </div>

    <div class="stat">
      <div class="ic ic-lg" style="background:rgba(239,68,68,.15);color:#fca5a5">⚠️</div>
      <div class="stack">
        <b class="big">${low.length}</b>
        <span>අඩු තොග භාණ්ඩ</span>
        <span class="stat-trend ${out.length ? 'down' : 'flat'}">
          ${out.length ? `🚫 ${out.length} අවසන්` : '✓ සියල්ල හොඳයි'}
        </span>
      </div>
    </div>

    <div class="stat">
      <div class="ic ic-lg" style="background:rgba(59,130,246,.15);color:#93c5fd">📦</div>
      <div class="stack">
        <b class="big">${DB.products.length}</b>
        <span>මුළු භාණ්ඩ</span>
        <span class="stat-trend flat">💰 රු. ${num(Math.round(retailVal/1000))}K තොගය</span>
      </div>
    </div>
  </div>

  <!-- ============ QUICK ACTIONS ============ -->
  <div class="quick-actions">
    <button class="qa-btn" onclick="go('billing')">
      <div class="qa-ic" style="background:rgba(245,158,11,.15);color:#fcd34d">💰</div>
      <div class="qa-t">POS බිල්පත්</div>
      <div class="qa-s">ඉක්මන් විකුණුම්</div>
    </button>
    <button class="qa-btn" onclick="go('inventory')">
      <div class="qa-ic" style="background:rgba(59,130,246,.15);color:#93c5fd">📦</div>
      <div class="qa-t">තොග බලන්න</div>
      <div class="qa-s">Inventory කළමනාකරණය</div>
    </button>
    <button class="qa-btn" onclick="go('customers')">
      <div class="qa-ic" style="background:rgba(139,92,246,.15);color:#c4b5fd">👥</div>
      <div class="qa-t">පාරිභෝගිකයන්</div>
      <div class="qa-s">${DB.customers.length} දෙනෙක්</div>
    </button>
    <button class="qa-btn" onclick="go('lowstock')">
      <div class="qa-ic" style="background:rgba(239,68,68,.15);color:#fca5a5">⚠️</div>
      <div class="qa-t">අඩු තොග</div>
      <div class="qa-s">${low.length} භාණ්ඩ</div>
    </button>
    ${state.user.role !== 'cashier'
      ? `<button class="qa-btn" onclick="go('grn')">
           <div class="qa-ic" style="background:rgba(16,185,129,.15);color:#6ee7b7">📥</div>
           <div class="qa-t">භාණ්ඩ ලැබීම</div>
           <div class="qa-s">නව GRN එකක්</div>
         </button>` : ''}
    ${state.user.role !== 'cashier'
      ? `<button class="qa-btn" onclick="go('reports')">
           <div class="qa-ic" style="background:rgba(245,158,11,.15);color:#fcd34d">📊</div>
           <div class="qa-t">වාර්තා</div>
           <div class="qa-s">විකුණුම් විශ්ලේෂණය</div>
         </button>` : ''}
  </div>

      <!-- ============ CHART + PAYMENT SPLIT ============ -->
  <div class="grid2" style="align-items:start;margin-bottom:14px">
    <div class="card">
      <div class="card-h">
        <h3>📈 දින 7 විකුණුම් ප්‍රවණතාව<small>Last 7 Days Sales</small></h3>
        <span class="pill info">💰 ${money(chart.total)}</span>
      </div>
      ${chart.days.every(d => d.value === 0) ? `
      <div class="chart-empty">
        <div style="font-size:28px;margin-bottom:6px">📊</div>
        <b style="font-size:13px;color:var(--txt)">පසුගිය දින 7 තුළ විකුණුම් නැත</b>
        <small style="color:var(--muted);font-size:11px">No sales in last 7 days</small>
      </div>` : `
      <div class="chart">
        ${chart.days.map(d => `
          <div class="chart-bar ${d.isToday ? 'today' : ''}" title="${d.label}: ${money(d.value)}">
            <div class="bar-val">${d.value > 0 ? 'රු.' + num(Math.round(d.value/1000)) + 'K' : ''}</div>
            <div class="bar-fill ${d.isEmpty ? 'empty' : ''}" style="height:${d.pct}%"></div>
            <div class="bar-lbl">${d.short}</div>
          </div>`).join('')}
      </div>`}
    </div>

    <div class="card">
      <div class="card-h">
        <h3>💳 ගෙවීම් ක්‍රම විශ්ලේෂණය<small>Payment Methods (Today)</small></h3>
      </div>
      <div class="pay-split">
        <div class="pay-row">
          <div class="pay-ic" style="background:rgba(16,185,129,.15);color:#6ee7b7">💵</div>
          <div class="pay-info">
            <b>මුදල් / Cash</b>
            <div class="progress">
              <div class="progress-fill ok" style="width:${pctCash}%"></div>
            </div>
            <small>${pctCash}% · ${todays.filter(s=>s.method==='cash').length} බිල්පත්</small>
          </div>
          <div class="pay-amt">${money(payCash)}</div>
        </div>

        <div class="pay-row">
          <div class="pay-ic" style="background:rgba(59,130,246,.15);color:#93c5fd">💳</div>
          <div class="pay-info">
            <b>කාඩ් / Card</b>
            <div class="progress">
              <div class="progress-fill" style="width:${pctCard}%;background:linear-gradient(90deg,#3b82f6,#2563eb)"></div>
            </div>
            <small>${pctCard}% · ${todays.filter(s=>s.method==='card').length} බිල්පත්</small>
          </div>
          <div class="pay-amt">${money(payCard)}</div>
        </div>

        <div class="pay-row">
          <div class="pay-ic" style="background:rgba(245,158,11,.15);color:#fcd34d">🕒</div>
          <div class="pay-info">
            <b>ණය / Store Credit</b>
            <div class="progress">
              <div class="progress-fill" style="width:${pctCredit}%;background:linear-gradient(90deg,#f59e0b,#d97706)"></div>
            </div>
            <small>${pctCredit}% · ${todays.filter(s=>s.method==='credit').length} බිල්පත්</small>
          </div>
          <div class="pay-amt">${money(payCredit)}</div>
        </div>

        <div style="border-top:1px dashed var(--line);padding-top:10px;margin-top:4px">
          <div class="srow" style="margin-bottom:2px">
            <span>මුළු එකතුව</span>
            <b style="color:var(--primary);font-size:15px">${money(payTotal)}</b>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ============ TOP PRODUCTS + ACTIVITY ============ -->
  <div class="grid2" style="align-items:start;margin-bottom:14px">
    <div class="card">
      <div class="card-h">
        <h3>🏆 අද වැඩිපුරම විකුණු<small>Top Selling Today</small></h3>
      </div>
      ${topProds.length ? `
      <div class="top-list">
        ${topProds.map((p,i)=>`
          <div class="top-item">
            <div class="rank r${i < 3 ? i+1 : 'n'}">${i+1}</div>
            <div class="ti-info">
              <b>${esc(p.name)}</b>
              <small>${p.code} · ${p.qty} ${p.unit || 'pcs'} විකුණා</small>
            </div>
            <div class="ti-amt">${money(p.amt)}</div>
          </div>`).join('')}
      </div>` : '<div class="empty"><div class="e">📦</div>අද විකුණුම් නැත</div>'}
    </div>

    <div class="card">
      <div class="card-h">
        <h3>🔔 අලුත්ම ක්‍රියාකාරකම්<small>Recent Activity</small></h3>
        <button class="btn btn-sm" onclick="go('pos')">සියල්ල</button>
      </div>
      <div class="feed">
        ${activityFeed().map(a=>`
          <div class="feed-item">
            <div class="fi-ic" style="background:${a.bg};color:${a.fg}">${a.ico}</div>
            <div class="fi-c">
              <b>${esc(a.title)}</b>
              <small>${esc(a.sub)}</small>
            </div>
            <div class="fi-t">${a.time}</div>
          </div>`).join('') || '<div class="empty">ක්‍රියාකාරකම් නැත</div>'}
      </div>
    </div>
  </div>

  <!-- ============ LOW STOCK ALERTS (Enhanced with Progress Bars) ============ -->
  <div class="card" style="margin-bottom:14px">
    <div class="card-h">
      <h3>⚠️ අඩු තොග භාණ්ඩ<small>Low Stock — Reorder Required</small></h3>
      <button class="btn btn-sm" onclick="go('lowstock')">සියල්ල බලන්න →</button>
    </div>
    ${low.length ? `
    <div class="tbl-wrap">
    <table>
      <thead><tr>
        <th>භාණ්ඩය</th>
        <th>වාහනය</th>
        <th style="width:180px">තොග මට්ටම</th>
        <th style="text-align:center">තොග</th>
        <th style="text-align:center">අවම</th>
        <th style="text-align:center">ඇණවුම් කරන්න</th>
      </tr></thead>
      <tbody>
      ${low.slice(0,6).map(p=>{
        const level = Math.min(100, Math.round(p.qty / Math.max(p.reorder*2, 1) * 100));
        const cls = p.qty === 0 ? 'bad' : p.qty <= p.reorder ? 'warn' : 'ok';
        const reorderQty = Math.max(p.reorder * 2 - p.qty, 1);
        return `<tr>
          <td>
            <b>${esc(p.name)}</b><br>
            <small style="color:var(--muted)">${p.code}</small>
          </td>
          <td><small>${esc(p.brand)} ${esc(p.model)}</small></td>
          <td>
            <div class="progress">
              <div class="progress-fill ${cls}" style="width:${Math.max(level,3)}%"></div>
            </div>
            <small style="color:var(--muted);font-size:10px">
              ${p.qty === 0 ? 'අවසන්!' : level + '% පවතී'}
            </small>
          </td>
          <td style="text-align:center">
            <span class="pill ${p.qty===0?'bad':'warn'}">${p.qty} ${p.unit}</span>
          </td>
          <td style="text-align:center;color:var(--muted)">${p.reorder}</td>
          <td style="text-align:center">
            <b style="color:var(--primary);font-family:'Inter',sans-serif">
              +${reorderQty}
            </b>
          </td>
        </tr>`;
      }).join('')}
      </tbody>
    </table>
    </div>` : `
    <div class="empty">
      <div class="e">✅</div>
      සියලු භාණ්ඩ ප්‍රමාණවත් තොගයක් පවතී
    </div>`}
  </div>

  <!-- ============ STOCK VALUE SUMMARY ============ -->
  <div class="card">
    <div class="card-h">
      <h3>💼 තොග වටිනාකම සාරාංශය<small>Stock Value Summary</small></h3>
    </div>
    <div class="grid3">
      <div class="stat" style="margin:0">
        <div class="ic" style="background:rgba(139,92,246,.15);color:#c4b5fd">🏷️</div>
        <div>
          <b style="font-size:16px">${money(stockVal)}</b>
          <span>පිරිවැය අගය / Cost Value</span>
        </div>
      </div>
      <div class="stat" style="margin:0">
        <div class="ic" style="background:rgba(16,185,129,.15);color:#6ee7b7">📈</div>
        <div>
          <b style="font-size:16px">${money(retailVal)}</b>
          <span>විකුණුම් අගය / Retail Value</span>
        </div>
      </div>
      <div class="stat" style="margin:0">
        <div class="ic" style="background:rgba(245,158,11,.15);color:#fcd34d">💵</div>
        <div>
          <b style="font-size:16px;color:var(--green)">${money(retailVal - stockVal)}</b>
          <span>අපේක්ෂිත ලාභය / Expected Profit</span>
        </div>
      </div>
    </div>
  </div>`;
}

/* =====================================================
   DASHBOARD HELPERS
   ===================================================== */

/* ප්‍රතිශත වෙනස් වීම */
function pctChange(now, before){
  if(before === 0) return now > 0 ? 100 : 0;
  return Math.round((now - before) / before * 100);
}

/* Trend badge */
function trendBadge(pct){
  if(pct > 0)  return `<span class="stat-trend up">▲ ${pct}% පෙර දිනට වඩා</span>`;
  if(pct < 0)  return `<span class="stat-trend down">▼ ${Math.abs(pct)}% පෙර දිනට වඩා</span>`;
  return `<span class="stat-trend flat">— වෙනසක් නැත</span>`;
}

/* අවසන් දින 7 විකුණුම් */
function last7Days(){
  const days = [];
  const short = ['ඉරි','සඳු','අඟ','බදා','බ්‍රහ','සිකු','සෙන'];

  for(let i = 6; i >= 0; i--){
    const d = new Date(Date.now() - i * 86400000);
    const iso = d.toISOString().slice(0,10);
    const total = DB.sales
      .filter(s => s.date.slice(0,10) === iso)
      .reduce((a,s)=>a + s.total, 0);
    days.push({
      iso,
      label: d.toLocaleDateString('en-GB'),
      short: short[d.getDay()],
      value: total,
      pct: 0,
      isToday: i === 0,
      isEmpty: total === 0
    });
  }

  const max = Math.max(...days.map(d => d.value), 1);
  days.forEach(d => {
    if(d.value === 0){
      d.pct = 0;
      d.isEmpty = true;
    } else {
      d.pct = Math.max(3, Math.round(d.value / max * 100));
      d.isEmpty = false;
    }
  });

  return { days, total: days.reduce((a,d)=>a + d.value, 0) };
}

/* වැඩිපුරම විකුණන භාණ්ඩ */
function topProducts(sales, limit = 5){
  const m = {};
  sales.forEach(s => s.items.forEach(i => {
    if(!m[i.pid]) m[i.pid] = {
      pid: i.pid, code: i.code, name: i.name,
      qty: 0, amt: 0, unit: getProd(i.pid)?.unit || 'pcs'
    };
    m[i.pid].qty += i.qty;
    m[i.pid].amt += i.qty * i.price;
  }));
  return Object.values(m).sort((a,b)=>b.qty - a.qty).slice(0, limit);
}

/* ක්‍රියාකාරකම් feed */
function activityFeed(){
  const items = [];

  /* Recent sales */
  DB.sales.slice(-5).reverse().forEach(s => {
    items.push({
      ico:'💰', bg:'rgba(16,185,129,.15)', fg:'#6ee7b7',
      title:`බිල්පත ${s.no}`,
      sub:`${s.customer} — ${money(s.total)}`,
      time:shortTime(s.date),
      ts: new Date(s.date).getTime()
    });
  });

  /* GRN */
  DB.grns.slice(-2).reverse().forEach(g => {
    items.push({
      ico:'📥', bg:'rgba(59,130,246,.15)', fg:'#93c5fd',
      title:`${g.no} — තොග ලැබීම`,
      sub:`${g.supplier} — ${money(g.total)}`,
      time:g.date,
      ts: new Date(g.date).getTime()
    });
  });

  /* Returns */
  DB.returns.slice(-2).reverse().forEach(r => {
    items.push({
      ico:'↩️', bg:'rgba(245,158,11,.15)', fg:'#fcd34d',
      title:`${r.no} — ආපසු භාරදීම`,
      sub:`${r.reason} — ${money(r.amount)}`,
      time:r.date,
      ts: new Date(r.date).getTime()
    });
  });

  return items.sort((a,b)=>b.ts - a.ts).slice(0, 6);
}

function shortTime(iso){
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now - d) / 60000);
  if(diff < 1)   return 'දැන්';
  if(diff < 60)  return diff + ' මිනිට';
  if(diff < 1440) return Math.floor(diff/60) + ' පැය';
  return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short' });
}

window.pgDashboard = pgDashboard;
