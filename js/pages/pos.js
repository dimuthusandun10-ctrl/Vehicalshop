/* =====================================================
   js/pages/pos.js - POS TERMINAL: Invoice history & Payment tracking
   ===================================================== */

/* filters state */
state.posFilters = state.posFilters || {
  range: 'today',
  customDate: '',
  customFrom: '',
  customTo: '',
  customType: '',
  method: 'all',
  search: '',
  sort: 'newest'
};

function getCurrentDateLabel(){
  const f = state.posFilters || {};
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const fullMonths = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  function fmtD(isoStr){
    if(!isoStr) return '';
    const parts = String(isoStr).trim().split('-');
    if(parts.length === 3){
      const day = parseInt(parts[2], 10);
      const mIdx = parseInt(parts[1], 10) - 1;
      const yr = parts[0];
      return `${String(day).padStart(2, '0')} ${monthNames[mIdx] || ''} ${yr}`;
    }
    return isoStr;
  }

  if(f.range === 'custom'){
    if(f.customType === 'year' && f.customDate){
      return f.customDate;
    }
    if(f.customType === 'month' && f.customDate){
      const parts = f.customDate.split('-');
      if(parts.length >= 2){
        const mIdx = parseInt(parts[1], 10) - 1;
        return `${fullMonths[mIdx] || parts[1]} ${parts[0]}`;
      }
      return f.customDate;
    }
    if(f.customFrom && f.customTo && f.customFrom !== f.customTo){
      return `${fmtD(f.customFrom)} – ${fmtD(f.customTo)}`;
    }
    if(f.customDate){
      return fmtD(f.customDate);
    }
    if(f.customFrom){
      return fmtD(f.customFrom);
    }
    return 'තෝරාගත් දිනය';
  }

  if(f.range === 'today') {
    const t = typeof today === 'function' ? today() : new Date().toISOString().slice(0,10);
    return `${fmtD(t)} (අද)`;
  }
  if(f.range === 'yesterday') {
    const y = new Date(Date.now() - 86400000).toISOString().slice(0,10);
    return `${fmtD(y)} (ඊයේ)`;
  }
  if(f.range === 'week') return 'අවසන් දින 7';
  if(f.range === 'month') {
    const d = new Date();
    return `${fullMonths[d.getMonth()]} ${d.getFullYear()}`;
  }
  if(f.range === 'all') return 'සියලු බිල්පත්';

  return 'දිනය තෝරන්න';
}

function getPosDateFilterIcon(){
  const f = state.posFilters || {};
  if(f.range === 'custom'){
    if(f.customType === 'year') return '🗓️';
    if(f.customType === 'month') return '📆';
    return '📅';
  }
  if(f.range === 'month') return '📆';
  if(f.range === 'week') return '📆';
  if(f.range === 'all') return '📜';
  return '📅';
}

function methodBadge(m){
  const map = {
    cash:   ['ok',   '💵 මුදල්'],
    card:   ['info', '💳 කාඩ්'],
    credit: ['warn', '📝 ණය (Credit)']
  };
  const [cls, label] = map[m] || ['mute', m || 'වෙනත්'];
  return `<span class="pill ${cls}">${label}</span>`;
}

function renderPosInvoiceCard(s){
  const timeStr = new Date(s.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const dateStr = new Date(s.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  const itemCount = Array.isArray(s.items) ? s.items.length : 0;

  return `
    <div class="pos-card" onclick="viewSale('${s.id}')">
      <div class="pos-card-head">
        <div class="pos-card-no-wrap">
          <b class="pos-card-no">${esc(s.no)}</b>
          <span class="pos-card-time">🕒 ${timeStr} · ${dateStr}</span>
        </div>
        <div class="pos-card-badges">
          ${methodBadge(s.method)}
        </div>
      </div>

      <div class="pos-card-body">
        <div class="pos-card-cust">
          <span class="pos-card-cust-name">👤 ${esc(s.customer || 'Walk-in Customer')}</span>
          ${s.vehicle ? `<span class="pos-card-cust-veh">🚗 ${esc(s.vehicle)}</span>` : ''}
        </div>
        <div class="pos-card-cashier">
          <small style="color:var(--muted)">🧑‍💼 ${esc(s.cashier || '—')} ${itemCount ? `· අයිතම ${itemCount}` : ''}</small>
        </div>
      </div>

      <div class="pos-card-foot">
        <div class="pos-card-amt-wrap">
          <span class="pos-card-amt-lbl">මුළු එකතුව:</span>
          <b class="pos-card-amt">${money(s.total)}</b>
          ${s.disc > 0 ? `<small class="pos-card-disc">−${money(s.disc)} වට්ටම</small>` : ''}
        </div>
        <div class="pos-card-actions" onclick="event.stopPropagation()">
          <button type="button" class="btn btn-sm btn-subtle" onclick="viewSale('${s.id}')" title="බලන්න">👁️ බලන්න</button>
          <button type="button" class="btn btn-sm btn-primary" onclick="printSale('${s.id}')" title="මුද්‍රණය">🖨️ මුද්‍රණය</button>
        </div>
      </div>
    </div>
  `;
}

function pgPos(){
  const list = filteredSales();
  const stats = salesStats(list);

  return `
  <div class="pos-terminal">
  <!-- ============ STAT CARDS ============ -->
  <div class="stats">
    <div class="stat">
      <div class="ic ic-lg" style="background:rgba(245,158,11,.15);color:#fcd34d">💰</div>
      <div><b class="big">${money(stats.total)}</b><span>මුළු ආදායම (${stats.count})</span></div>
    </div>
    <div class="stat">
      <div class="ic ic-lg" style="background:rgba(16,185,129,.15);color:#6ee7b7">💵</div>
      <div><b class="big">${money(stats.cash)}</b><span>මුදල් ගෙවීම්</span></div>
    </div>
    <div class="stat">
      <div class="ic ic-lg" style="background:rgba(59,130,246,.15);color:#93c5fd">💳</div>
      <div><b class="big">${money(stats.card)}</b><span>කාඩ්පත් ගෙවීම්</span></div>
    </div>
    <div class="stat">
      <div class="ic ic-lg" style="background:rgba(245,158,11,.15);color:#fcd34d">🕒</div>
      <div><b class="big" style="color:var(--red)">${money(stats.credit)}</b><span>ණය විකුණුම්</span></div>
    </div>
  </div>

  <!-- ============ FILTER BAR ============ -->
  <div class="card pos-inv-filter-card" style="margin-bottom:14px;padding:12px">
    <div class="pos-inv-filter-bar">
      <!-- Desktop only range tabs -->
      <div class="range-tabs pos-range-tabs desktop-only">
        ${[
          ['today','📅 අද'],
          ['yesterday','⏪ ඊයේ'],
          ['week','📆 සතිය'],
          ['month','🗓️ මාසය'],
          ['all','📜 සියල්ල']
        ].map(([v,l])=>`
          <button class="${state.posFilters.range===v?'active':''}"
                  onclick="setPosFilter('range','${v}')">${l}</button>`).join('')}
        <button class="${state.posFilters.range==='custom'?'active':''}"
                onclick="openPosDateFilter()"
                title="දිනය තෝරන්න (Calendar)">
          ${state.posFilters.range==='custom' && state.posFilters.customDate ? '📅 ' + state.posFilters.customDate : '📅 දින දසුන'}
        </button>
      </div>

      <!-- Mobile only: Single Calendar Button -->
      <button class="mobile-only date-filter-btn"
              onclick="openPosDateFilter()"
              type="button"
              title="දිනය තෝරන්න (Select Date)">
        <span class="df-icon">${getPosDateFilterIcon()}</span>
        <span class="df-label">${getCurrentDateLabel()}</span>
        <span class="df-arrow">▾</span>
      </button>

      <div class="pos-inv-search-wrap">
        <input id="posSearchInv"
               placeholder="බිල්පත් සොයන්න..."
               title="බිල් අංකය / පාරිභෝගික / වාහන අංකය සොයන්න"
               value="${esc(state.posFilters.search)}"
               oninput="debouncedPosSearch(this.value)">
        <span class="pos-inv-search-icon">🔍</span>
      </div>

      <!-- ⭐ Payment Method & Sort Filters -->
      <div class="pos-inv-filter-group">
        <select class="pos-filter-select" onchange="setPosFilter('method',this.value)">
          <option value="all"    ${state.posFilters.method==='all'?'selected':''}>සියලු ගෙවීම්</option>
          <option value="cash"   ${state.posFilters.method==='cash'?'selected':''}>💵 මුදල්</option>
          <option value="card"   ${state.posFilters.method==='card'?'selected':''}>💳 කාඩ්</option>
          <option value="credit" ${state.posFilters.method==='credit'?'selected':''}>📝 ණය (Credit)</option>
        </select>

        <select class="pos-filter-select" onchange="setPosFilter('sort',this.value)">
          <option value="newest" ${state.posFilters.sort==='newest'?'selected':''}>අලුත්ම මුලින්</option>
          <option value="oldest" ${state.posFilters.sort==='oldest'?'selected':''}>පරණ මුලින්</option>
          <option value="amount" ${state.posFilters.sort==='amount'?'selected':''}>මුදල වැඩිපුර</option>
        </select>
      </div>

      <div class="pos-inv-btn-group">
        <button class="btn btn-sm pos-btn-csv" onclick="exportSalesCSV()" title="CSV බාගන්න">⬇️ CSV</button>
        <button class="btn btn-primary btn-sm pos-btn-new" onclick="go('billing')">+ නව බිල</button>
      </div>
    </div>
  </div>

  <!-- ============ INVOICE TABLE ============ -->
  <div class="card">
    <div class="card-h">
      <h3>🧾 බිල්පත් ලැයිස්තුව<small>${list.length} invoices found</small></h3>
      ${state.posFilters.range !== 'today'
        ? `<span class="pill info">${rangeLabel(state.posFilters.range)}</span>`
        : `<span class="pill ok">අද දිනය</span>`}
    </div>

    ${list.length ? `
    <!-- Desktop Table View -->
    <div class="desktop-only tbl-wrap">
    <table class="invoice-table">
      <thead><tr>
        <th>අංකය</th>
        <th>වේලාව</th>
        <th>පාරිභෝගිකයා</th>
        <th>කැෂියර්</th>
        <th>ගෙවීම් ක්‍රමය</th>
        <th style="text-align:right">මුදල</th>
        <th style="text-align:center">ක්‍රියා</th>
      </tr></thead>
      <tbody>
      ${list.map(s => `
        <tr class="invoice-row" onclick="viewSale('${s.id}')">
          <td data-label="අංකය"><b>${s.no}</b></td>
          <td data-label="වේලාව">
            <div style="font-size:12.5px">${new Date(s.date).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div>
            <small style="color:var(--muted)">${new Date(s.date).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}</small>
          </td>
          <td data-label="පාරිභෝගිකයා">
            ${esc(s.customer)}
            ${s.vehicle ? `<br><small style="color:var(--muted)">🚗 ${esc(s.vehicle)}</small>` : ''}
          </td>
          <td data-label="කැෂියර්"><small>${esc(s.cashier)}</small></td>
          <td data-label="ගෙවීම් ක්‍රමය">
            ${methodBadge(s.method)}
          </td>
          <td data-label="මුදල" class="amount" style="text-align:right">
            <b style="color:var(--primary);font-family:'Inter',sans-serif;font-size:13px">${money(s.total)}</b>
            ${s.disc > 0 ? `<br><small style="color:var(--red);font-size:10px">−${money(s.disc)} වට්ටම</small>` : ''}
          </td>
          <td data-label="" style="text-align:center;white-space:nowrap">
            <button class="btn btn-sm" onclick="event.stopPropagation();viewSale('${s.id}')" title="බලන්න">👁️</button>
            <button class="btn btn-sm" onclick="event.stopPropagation();printSale('${s.id}')" title="මුද්‍රණය">🖨️</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>
    </div>

    <!-- Mobile Cards View -->
    <div class="mobile-only pos-cards-wrap" id="posInvoiceCards">
      ${list.map(s => renderPosInvoiceCard(s)).join('')}
    </div>` : `
    <div class="empty" style="padding:60px 20px">
      <div class="e">🧾</div>
      <div style="font-size:14px;margin-bottom:6px">බිල්පත් හමු නොවීය</div>
      <small style="color:var(--muted)">ෆිල්ටර වෙනස් කර බලන්න හෝ නව බිලක් සාදන්න</small>
      <div style="margin-top:14px">
        <button class="btn btn-primary btn-sm" onclick="go('billing')">+ නව බිල</button>
      </div>
    </div>`}
  </div>
  </div>`;
}

/* ---------- filters ---------- */
function setPosFilter(key, value){
  state.posFilters[key] = value;
  if(key === 'range' && value !== 'custom'){
    state.posFilters.customDate = '';
    state.posFilters.customFrom = '';
    state.posFilters.customTo = '';
    state.posFilters.customType = '';
  }
  render();
  if(key === 'search'){
    const inp = document.getElementById('posSearchInv');
    if(inp){
      inp.focus();
      const len = inp.value.length;
      try { inp.setSelectionRange(len, len); } catch(_) {}
    }
  }
}

const debouncedPosSearch = (typeof debounce === 'function')
  ? debounce(val => setPosFilter('search', val), 250)
  : (val => setPosFilter('search', val));
window.debouncedPosSearch = debouncedPosSearch;

function rangeLabel(r){
  if(r === 'custom') return getCurrentDateLabel();
  return {today:'අද',yesterday:'ඊයේ',week:'අවසන් දින 7',month:'මෙම මාසය',all:'සියල්ල'}[r] || r;
}

function filteredSales(){
  const f = state.posFilters;
  const now = new Date();
  const todayISO = today();
  const yestISO  = new Date(Date.now() - 86400000).toISOString().slice(0,10);

  const db = window.DB || {};
  let list = (db.sales || []).slice();

  /* range */
  if(f.range === 'today')          list = list.filter(s => (s.date||'').slice(0,10) === todayISO);
  else if(f.range === 'yesterday') list = list.filter(s => (s.date||'').slice(0,10) === yestISO);
  else if(f.range === 'week'){
    const d = new Date(Date.now() - 6*86400000).toISOString().slice(0,10);
    list = list.filter(s => (s.date||'').slice(0,10) >= d);
  } else if(f.range === 'month'){
    const d = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
    list = list.filter(s => (s.date||'').slice(0,10) >= d);
  } else if(f.range === 'custom'){
    if(f.customFrom && f.customTo){
      list = list.filter(s => {
        const sd = (s.date||'').slice(0,10);
        return sd >= f.customFrom && sd <= f.customTo;
      });
    } else if(f.customDate){
      const q = f.customDate.trim();
      if(q.length === 10){
        list = list.filter(s => (s.date||'').slice(0,10) === q);
      } else if(q.length === 7){
        list = list.filter(s => (s.date||'').slice(0,7) === q);
      } else if(q.length === 4){
        list = list.filter(s => (s.date||'').slice(0,4) === q);
      }
    }
  }

  /* method */
  if(f.method !== 'all') list = list.filter(s => s.method === f.method);

  /* search */
  if(f.search && f.search.trim()){
    const q = f.search.toLowerCase();
    list = list.filter(s =>
      (s.no || '').toLowerCase().includes(q) ||
      (s.customer || '').toLowerCase().includes(q) ||
      (s.vehicle  || '').toLowerCase().includes(q) ||
      (s.cashier  || '').toLowerCase().includes(q)
    );
  }

  /* sort */
  list.sort((a,b) => {
    if(f.sort === 'newest') return new Date(b.date) - new Date(a.date);
    if(f.sort === 'oldest') return new Date(a.date) - new Date(b.date);
    if(f.sort === 'amount') return b.total - a.total;
    return 0;
  });

  return list;
}

function salesStats(list){
  return {
    count: list.length,
    total:  list.reduce((a,s) => a + (s.total || 0), 0),
    cash:   list.filter(s => s.method === 'cash').reduce((a,s) => a + (s.total || 0), 0),
    card:   list.filter(s => s.method === 'card').reduce((a,s) => a + (s.total || 0), 0),
    credit: list.filter(s => s.method === 'credit').reduce((a,s) => a + (s.total || 0), 0)
  };
}

/* ---------- CSV export ---------- */
function exportSalesCSV(){
  const list = filteredSales();
  if(!list.length){ toast('බිල්පත් නැත','err'); return; }

  const rows = [
    ['Invoice','Date','Time','Cashier','Customer','Vehicle','Method','Subtotal','Discount','Total'],
    ...list.map(s => [
      s.no,
      new Date(s.date).toLocaleDateString('en-GB'),
      new Date(s.date).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),
      s.cashier, s.customer, s.vehicle || '',
      s.method, (s.sub||s.total).toFixed(2), (s.disc||0).toFixed(2), s.total.toFixed(2)
    ])
  ];

  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sales-${today()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('CSV බාගත කළා ✅');
}

/* ---------- view sale receipt ---------- */
function viewSale(id){
  const db = window.DB || {};
  const s = (db.sales || []).find(x => x.id === id);
  if(s && typeof showReceipt === 'function') showReceipt(s);
}

function printSale(id){
  const db = window.DB || {};
  const s = (db.sales || []).find(x => x.id === id);
  if(!s) return;
  if(typeof showReceipt === 'function') showReceipt(s);
  setTimeout(() => window.print(), 400);
}

/* ---------- date picker integration ---------- */
function openPosDateFilter(){
  if(typeof openDatePicker !== 'function'){
    if(typeof toast === 'function') toast('දින දසුන සක්‍රීය නැත', 'err');
    return;
  }
  const f = state.posFilters;
  const initialVal = f.customDate || (typeof today === 'function' ? today() : new Date().toISOString().slice(0,10));

  openDatePicker('posDate', {
    value: initialVal,
    onConfirm: (val, toVal) => {
      state.posFilters.range = 'custom';

      if(toVal){
        state.posFilters.customFrom = val;
        state.posFilters.customTo = toVal;
        state.posFilters.customDate = val === toVal ? val : `${val} to ${toVal}`;
        state.posFilters.customType = 'range';
        render();
        return;
      }

      const str = String(val).trim();
      const parts = str.split('-');

      if(parts.length === 3){
        state.posFilters.customDate = str;
        state.posFilters.customFrom = str;
        state.posFilters.customTo = str;
        state.posFilters.customType = 'day';
      } else if(parts.length === 2){
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const lastDay = new Date(y, m, 0).getDate();
        const padM = String(m).padStart(2, '0');
        state.posFilters.customDate = str;
        state.posFilters.customFrom = `${y}-${padM}-01`;
        state.posFilters.customTo = `${y}-${padM}-${String(lastDay).padStart(2, '0')}`;
        state.posFilters.customType = 'month';
      } else if(parts.length === 1 && /^\d{4}$/.test(parts[0])){
        const y = parts[0];
        state.posFilters.customDate = str;
        state.posFilters.customFrom = `${y}-01-01`;
        state.posFilters.customTo = `${y}-12-31`;
        state.posFilters.customType = 'year';
      } else {
        state.posFilters.customDate = str;
        state.posFilters.customFrom = str;
        state.posFilters.customTo = str;
        state.posFilters.customType = 'day';
      }
      render();
    }
  });
}

function openPosDatePicker(){
  openPosDateFilter();
}

window.pgPos = pgPos;
window.methodBadge = methodBadge;
window.setPosFilter = setPosFilter;
window.debouncedPosSearch = debouncedPosSearch;
window.openPosDatePicker = openPosDatePicker;
window.openPosDateFilter = openPosDateFilter;
window.getCurrentDateLabel = getCurrentDateLabel;
window.getPosDateFilterIcon = getPosDateFilterIcon;
window.filteredSales = filteredSales;
window.salesStats = salesStats;
window.exportSalesCSV = exportSalesCSV;
window.viewSale = viewSale;
window.printSale = printSale;

