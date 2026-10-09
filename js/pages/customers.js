/* =========================================================
   js/pages/customers.js - Customer Management & Credit Balances
   ========================================================= */

// Ensure state defaults
state.custSearch = state.custSearch || '';
state.custSort = state.custSort || 'name-asc';
state.custStatus = state.custStatus || 'all';
state.custPage = state.custPage || 1;
const CUST_PER_PAGE = 20;

function setCustFilter(key, value){
  if(key === 'search'){
    state.custSearch = value;
  } else if(key === 'sort'){
    state.custSort = value;
  } else if(key === 'status'){
    state.custStatus = value;
    document.querySelectorAll('.cust-status-tabs button').forEach(b => {
      const isAct = b.getAttribute('data-status') === value;
      b.classList.toggle('active', isAct);
    });
  }
  state.custPage = 1;
  renderCustList();

  const clearBtn = document.querySelector('.cust-search-clear');
  if(clearBtn){
    clearBtn.classList.toggle('hidden', !state.custSearch);
  }
}

const debouncedCustSearch = (typeof debounce === 'function')
  ? debounce(val => setCustFilter('search', val), 250)
  : (val => setCustFilter('search', val));
window.debouncedCustSearch = debouncedCustSearch;

function clearCustSearch(){
  state.custSearch = '';
  state.custPage = 1;
  const inp = document.getElementById('custSearch');
  if(inp) inp.value = '';
  renderCustList();
  document.querySelector('.cust-search-clear')?.classList.add('hidden');
}

function getCustomerMetrics(c, db){
  const custSales = (db.sales || []).filter(s =>
    s.customerId === c.id || (!s.customerId && s.customer === c.name)
  );
  const spent = custSales.reduce((a,s) => a + (s.total || 0), 0);
  const creditSales = custSales.filter(s => s.method === 'credit').reduce((a,s) => a + (s.total || 0), 0);
  const paid = (db.payments || []).filter(p => p.customerId === c.id).reduce((a,p) => a + (p.amount || 0), 0);
  const balance = Math.max(0, creditSales - paid);
  const limit = Number(c.creditLimit || 30000);
  return { spent, creditSales, paid, balance, limit, salesCount: custSales.length };
}

function getFilteredCustomers(){
  const db = window.DB || {};
  let list = (db.customers || []).slice();

  // Attach metrics
  let withMetrics = list.map(c => ({
    ...c,
    _m: getCustomerMetrics(c, db)
  }));

  // Search filter (name, phone, vehicle, notes)
  if((state.custSearch || '').trim()){
    const q = state.custSearch.toLowerCase().trim();
    withMetrics = withMetrics.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.vehicle || '').toLowerCase().includes(q) ||
      (c.notes || '').toLowerCase().includes(q)
    );
  }

  // Status filter ('all', 'owed', 'clear')
  if(state.custStatus === 'owed'){
    withMetrics = withMetrics.filter(c => c._m.balance > 0);
  } else if(state.custStatus === 'clear'){
    withMetrics = withMetrics.filter(c => c._m.balance <= 0);
  }

  // Sort
  switch(state.custSort){
    case 'name-asc':
      withMetrics.sort((a,b) => (a.name || '').localeCompare(b.name || '', 'si'));
      break;
    case 'name-desc':
      withMetrics.sort((a,b) => (b.name || '').localeCompare(a.name || '', 'si'));
      break;
    case 'spent-desc':
      withMetrics.sort((a,b) => b._m.spent - a._m.spent);
      break;
    case 'spent-asc':
      withMetrics.sort((a,b) => a._m.spent - b._m.spent);
      break;
    case 'owed-desc':
      withMetrics.sort((a,b) => b._m.balance - a._m.balance);
      break;
    case 'points-desc':
      withMetrics.sort((a,b) => (b.points || 0) - (a.points || 0));
      break;
    case 'recent':
      withMetrics.sort((a,b) => ((b.updatedAt || b.createdAt || b.id || '').localeCompare(a.updatedAt || a.createdAt || a.id || '')));
      break;
    default:
      withMetrics.sort((a,b) => (a.name || '').localeCompare(b.name || '', 'si'));
      break;
  }

  return withMetrics;
}

function updateCustCounts(){
  const db = window.DB || {};
  const customers = db.customers || [];
  const all = customers.length;
  let owed = 0;
  let clear = 0;

  for(const c of customers){
    const m = getCustomerMetrics(c, db);
    if(m.balance > 0) owed++;
    else clear++;
  }

  const set = (id, val) => {
    const el = document.getElementById(id);
    if(el) el.textContent = val;
  };
  set('cntCustAll', all);
  set('cntCustOwed', owed);
  set('cntCustClear', clear);

  const totalEl = document.getElementById('custCount');
  if(totalEl) totalEl.textContent = all;
}

function renderCustTableRow(c){
  const m = c._m || getCustomerMetrics(c, window.DB || {});
  const balance = m.balance;
  const spent = m.spent;
  const limit = m.limit;

  return `<tr>
    <td><b>${esc(c.name)}</b></td>
    <td>${esc(c.phone || '—')}</td>
    <td><span class="pill info">${esc(c.vehicle || '—')}</span></td>
    <td style="text-align:right;font-weight:700">${money(spent)}</td>
    <td style="text-align:right">
      ${balance > 0
        ? `<b style="color:var(--red);font-size:13px">${money(balance)}</b>`
        : `<span style="color:var(--green)">රු. 0.00</span>`}
    </td>
    <td style="text-align:right;color:var(--muted)">${money(limit)}</td>
    <td style="text-align:center">⭐ ${c.points || 0}</td>
    <td style="text-align:center;white-space:nowrap">
      ${balance > 0 && (typeof hasPermission === 'function' ? hasPermission('credit') : true)
        ? `<button class="btn btn-sm btn-green" onclick="openCreditPayment('${c.id}')" title="ණය පියවීම / Settle Credit">💵 ණය ගෙවන්න</button>`
        : ''}
      ${canEditCustomers() ? `
        <button class="btn btn-sm" onclick="editCustomer('${c.id}')" title="සංස්කරණය කරන්න">✏️</button>
      ` : `
        <button class="btn btn-sm" onclick="viewCustomer('${c.id}')" title="බලන්න">👁️</button>
      `}
      ${canDeleteCustomers() ? `
        <button class="btn btn-sm btn-red" onclick="delCustomer('${c.id}')" title="මකන්න">🗑️</button>
      ` : ''}
      ${!canEditCustomers() ? '<span style="color:var(--muted);font-size:11px;margin-left:4px">view only</span>' : ''}
    </td>
  </tr>`;
}

function renderCustCard(c){
  const m = c._m || getCustomerMetrics(c, window.DB || {});
  const balance = m.balance;
  const spent = m.spent;
  const limit = m.limit;

  return `
    <div class="cust-card">
      <div class="cust-card-top">
        <span class="cust-name">${esc(c.name)}</span>
        ${c.vehicle ? `<span class="cust-vehicle">🚗 ${esc(c.vehicle)}</span>` : ''}
      </div>
      ${c.phone ? `
        <div class="cust-phone">
          <span class="cp-icon">📞</span>
          <a href="tel:${esc(c.phone)}" style="color:inherit;text-decoration:none">${esc(c.phone)}</a>
        </div>
      ` : ''}
      <div class="cust-balance-block ${balance > 0 ? 'owed' : 'clear'}">
        <span>${balance > 0 ? 'ණය ශේෂය (Owed)' : 'ණය ශේෂය (Clear)'}</span>
        <span class="cb-value">${balance > 0 ? money(balance) : 'රු. 0.00'}</span>
      </div>
      <div class="cust-stats">
        <div>
          <small>මිලදී ගැනීම්</small>
          <b>${money(spent)}</b>
        </div>
        <div>
          <small>ණය සීමාව</small>
          <b>${money(limit)}</b>
        </div>
        <div>
          <small>ලකුණු</small>
          <b>⭐ ${c.points || 0}</b>
        </div>
      </div>
      <div class="cust-card-actions">
        ${balance > 0 && (typeof hasPermission === 'function' ? hasPermission('credit') : true) ? `
          <button class="btn-pay" onclick="openCreditPayment('${c.id}')" title="ණය පියවීම / Settle Credit">💵 ණය ගෙවන්න</button>
        ` : ''}
        ${canEditCustomers() ? `
          <button class="btn-edit" onclick="editCustomer('${c.id}')" title="සංස්කරණය">✏️</button>
        ` : `
          <button class="btn-view" onclick="viewCustomer('${c.id}')" title="බලන්න">👁️</button>
        `}
        ${canDeleteCustomers() ? `
          <button class="btn-del" onclick="delCustomer('${c.id}')" title="මකන්න">🗑️</button>
        ` : ''}
      </div>
    </div>
  `;
}

function renderCustPagination(total, totalPages){
  const el = document.getElementById('custPagination');
  if(!el) return;
  if(totalPages <= 1 || total === 0){
    el.innerHTML = '';
    return;
  }

  const cur = state.custPage;
  let html = '<div class="pg-controls">';

  html += `<button class="pg-btn" ${cur===1?'disabled':''} onclick="custGoToPage(${cur-1})">◀</button>`;

  const start = Math.max(1, Math.min(cur - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);

  for(let i = start; i <= end; i++){
    html += `<button class="pg-btn ${i===cur?'active':''}" onclick="custGoToPage(${i})">${i}</button>`;
  }

  html += `<button class="pg-btn" ${cur===totalPages?'disabled':''} onclick="custGoToPage(${cur+1})">▶</button>`;
  html += '</div>';
  html += `<div class="pg-info">${(cur-1)*CUST_PER_PAGE+1}-${Math.min(cur*CUST_PER_PAGE, total)} / ${total}</div>`;

  el.innerHTML = html;
}

function custGoToPage(n){
  state.custPage = n;
  renderCustList();
  document.querySelector('.cust-results')?.scrollIntoView({
    behavior: 'smooth', block: 'start'
  });
}

function renderCustList(){
  const list = getFilteredCustomers();
  updateCustCounts();

  const cntEl = document.getElementById('custResultsCount');
  if(cntEl) cntEl.textContent = list.length + ' පාරිභෝගිකයන්';

  const totalPages = Math.ceil(list.length / CUST_PER_PAGE) || 1;
  if(state.custPage > totalPages) state.custPage = totalPages;
  if(state.custPage < 1) state.custPage = 1;

  const start = (state.custPage - 1) * CUST_PER_PAGE;
  const end = start + CUST_PER_PAGE;
  const paged = list.slice(start, end);

  const infoEl = document.getElementById('custPaginationInfo');
  if(infoEl){
    infoEl.textContent = list.length > 0
      ? `${start + 1}-${Math.min(end, list.length)} / ${list.length}`
      : '';
  }

  // Desktop table view
  const tableBody = document.querySelector('.cust-table tbody');
  if(tableBody){
    const desktopItems = (window.innerWidth > 820) ? list : paged;
    tableBody.innerHTML = desktopItems.length
      ? desktopItems.map(c => renderCustTableRow(c)).join('')
      : `<tr><td colspan="8">
           <div class="empty" style="padding:40px 20px;text-align:center">
             <div class="e" style="font-size:32px;margin-bottom:6px">👥</div>
             <div style="font-weight:600">පාරිභෝගිකයන් හමු නොවීය</div>
             <small style="color:var(--muted)">ෆිල්ටර වෙනස් කරන්න හෝ නව පාරිභෝගිකයෙකු ඇතුළත් කරන්න</small>
           </div>
         </td></tr>`;
  }

  // Mobile cards view
  const cardsEl = document.getElementById('custCards');
  if(cardsEl){
    cardsEl.innerHTML = paged.length
      ? paged.map(c => renderCustCard(c)).join('')
      : `<div class="empty" style="padding:60px 20px;text-align:center">
           <div class="e" style="font-size:36px;margin-bottom:8px">👥</div>
           <div style="font-size:15px;font-weight:600">පාරිභෝගිකයන් හමු නොවීය</div>
           <small style="color:var(--muted)">ෆිල්ටර වෙනස් කරන්න හෝ නව පාරිභෝගිකයෙකු ඇතුළත් කරන්න</small>
         </div>`;
  }

  // Mobile pagination
  renderCustPagination(list.length, totalPages);
}

function pgCustomers(){
  const db = window.DB || {};
  const customers = db.customers || [];
  const list = getFilteredCustomers();
  const all = customers.length;
  let owedCnt = 0;
  let clearCnt = 0;
  customers.forEach(c => {
    const m = getCustomerMetrics(c, db);
    if(m.balance > 0) owedCnt++; else clearCnt++;
  });

  const totalPages = Math.ceil(list.length / CUST_PER_PAGE) || 1;
  const curPage = Math.min(Math.max(1, state.custPage || 1), totalPages);
  const start = (curPage - 1) * CUST_PER_PAGE;
  const end = start + CUST_PER_PAGE;
  const paged = list.slice(start, end);

  setTimeout(() => {
    renderCustList();
    if(state.custSearch){
      const inp = document.getElementById('custSearch');
      if(inp){
        inp.focus();
        try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch(_) {}
      }
    }
  }, 50);

  return `
    <div class="customers-page">
      <!-- Toolbar card -->
      <div class="cust-toolbar card">
        <div class="cust-header">
          <div>
            <h3>👥 පාරිභෝගික ලේඛනය</h3>
            <small>Customers · <span id="custCount">${all}</span> registered</small>
          </div>
          ${canEditCustomers() ? `
            <button class="btn btn-primary btn-add" onclick="editCustomer()">
              <span class="desktop-only">+ නව පාරිභෝගිකයා</span>
              <span class="mobile-only">+</span>
            </button>
          ` : ''}
        </div>

        <!-- Search row -->
        <div class="cust-search-row">
          <span class="cust-search-icon">🔍</span>
          <input id="custSearch"
                 type="text"
                 placeholder="සොයන්න (නම / දුරකථනය / වාහනය)..."
                 value="${esc(state.custSearch || '')}"
                 oninput="document.querySelector('.cust-search-clear')?.classList.toggle('hidden', !this.value); debouncedCustSearch(this.value)">
          <button class="cust-search-clear ${state.custSearch ? '' : 'hidden'}"
                  onclick="clearCustSearch()"
                  title="මකන්න">✕</button>
        </div>

        <!-- Dropdowns row (Sort) -->
        <div class="cust-dropdowns-row">
          <div class="cust-select-wrap">
            <label>පිළිවෙල (Sort)</label>
            <select id="custSort" onchange="setCustFilter('sort', this.value)">
              <option value="name-asc" ${state.custSort==='name-asc'?'selected':''}>නම (A → Z)</option>
              <option value="name-desc" ${state.custSort==='name-desc'?'selected':''}>නම (Z → A)</option>
              <option value="spent-desc" ${state.custSort==='spent-desc'?'selected':''}>මිලදී ගැනීම් (වැඩි → අඩු)</option>
              <option value="spent-asc" ${state.custSort==='spent-asc'?'selected':''}>මිලදී ගැනීම් (අඩු → වැඩි)</option>
              <option value="owed-desc" ${state.custSort==='owed-desc'?'selected':''}>ණය ශේෂය (වැඩි → අඩු)</option>
              <option value="points-desc" ${state.custSort==='points-desc'?'selected':''}>ලකුණු (වැඩි → අඩු)</option>
              <option value="recent" ${state.custSort==='recent'?'selected':''}>අලුත්ම (Recent)</option>
            </select>
          </div>
        </div>

        <!-- Status tabs row -->
        <div class="cust-status-tabs">
          <button class="${state.custStatus==='all'?'active':''}"
                  data-status="all"
                  onclick="setCustFilter('status','all')">
            👥 සියල්ල <span class="cnt" id="cntCustAll">${all}</span>
          </button>
          <button class="${state.custStatus==='owed'?'active':''}"
                  data-status="owed"
                  onclick="setCustFilter('status','owed')">
            💰 ණය <span class="cnt" id="cntCustOwed">${owedCnt}</span>
          </button>
          <button class="${state.custStatus==='clear'?'active':''}"
                  data-status="clear"
                  onclick="setCustFilter('status','clear')">
            ✅ ණය නෑ <span class="cnt" id="cntCustClear">${clearCnt}</span>
          </button>
        </div>
      </div>

      <!-- Results card -->
      <div class="cust-results card">
        <div class="cust-results-header">
          <span id="custResultsCount">${list.length} පාරිභෝගිකයන්</span>
          <span class="pagination-info" id="custPaginationInfo">${list.length > 0 ? `${start + 1}-${Math.min(end, list.length)} / ${list.length}` : ''}</span>
        </div>

        <!-- Desktop table view -->
        <div class="cust-table-view desktop-only tbl-wrap">
          <table class="cust-table">
            <thead>
              <tr>
                <th>නම</th>
                <th>දුරකථනය</th>
                <th>වාහනය</th>
                <th style="text-align:right">මුළු මිලදී ගැනීම්</th>
                <th style="text-align:right">ණය ශේෂය (Owed)</th>
                <th style="text-align:right">ණය සීමාව (Limit)</th>
                <th style="text-align:center">ලකුණු</th>
                <th style="text-align:center">ක්‍රියා</th>
              </tr>
            </thead>
            <tbody>
              ${list.length
                ? list.map(c => renderCustTableRow(c)).join('')
                : `<tr><td colspan="8">
                     <div class="empty" style="padding:40px 20px;text-align:center">
                       <div class="e" style="font-size:32px;margin-bottom:6px">👥</div>
                       <div style="font-weight:600">පාරිභෝගිකයන් හමු නොවීය</div>
                       <small style="color:var(--muted)">ෆිල්ටර වෙනස් කරන්න හෝ නව පාරිභෝගිකයෙකු ඇතුළත් කරන්න</small>
                     </div>
                   </td></tr>`}
            </tbody>
          </table>
        </div>

        <!-- Mobile cards view -->
        <div class="cust-cards-view mobile-only" id="custCards">
          ${paged.length
            ? paged.map(c => renderCustCard(c)).join('')
            : `<div class="empty" style="padding:60px 20px;text-align:center">
                 <div class="e" style="font-size:36px;margin-bottom:8px">👥</div>
                 <div style="font-size:15px;font-weight:600">පාරිභෝගිකයන් හමු නොවීය</div>
                 <small style="color:var(--muted)">ෆිල්ටර වෙනස් කරන්න හෝ නව පාරිභෝගිකයෙකු ඇතුළත් කරන්න</small>
               </div>`}
        </div>

        <!-- Mobile pagination -->
        <div class="cust-pagination mobile-only" id="custPagination"></div>
      </div>
    </div>
  `;
}

function viewCustomer(id){
  const db = window.DB || {};
  const c = (db.customers || []).find(x => x.id === id);
  if(!c) return;

  const sales = (db.sales || []).filter(s => s.customerId === id || (!s.customerId && s.customer === c.name));
  const spent = sales.reduce((a,s) => a + (s.total || 0), 0);
  const paid = (db.payments || []).filter(p => p.customerId === id).reduce((a,p) => a + (p.amount || 0), 0);
  const creditSales = sales.filter(s => s.method === 'credit').reduce((a,s) => a + (s.total || 0), 0);
  const balance = Math.max(0, creditSales - paid);

  openModal(
    '👤 පාරිභෝගික තොරතුරු',
    'Customer Details — ' + c.name,
  `<div class="customer-detail-body">
     <div class="pd-section">
       <div class="pd-row">
         <span class="pd-row-label">👤 නම</span>
         <span class="pd-row-value">${esc(c.name)}</span>
       </div>
       <div class="pd-row">
         <span class="pd-row-label">📞 දුරකථනය</span>
         <span class="pd-row-value">${esc(c.phone || '—')}</span>
       </div>
       <div class="pd-row">
         <span class="pd-row-label">🚗 වාහනය</span>
         <span class="pd-row-value">${esc(c.vehicle || '—')}</span>
       </div>
     </div>
     
     <div class="pd-section" style="border-top:1px solid var(--line);padding-top:12px">
       <div class="pd-row">
         <span class="pd-row-label">⭐ ලකුණු</span>
         <span class="pd-row-value">${c.points || 0}</span>
       </div>
       <div class="pd-row">
         <span class="pd-row-label">💰 මුළු මිලදී ගැනීම්</span>
         <span class="pd-row-value">${money(spent)}</span>
       </div>
       <div class="pd-row">
         <span class="pd-row-label">🧾 බිල්පත් ගණන</span>
         <span class="pd-row-value">${sales.length}</span>
       </div>
       <div class="pd-row">
         <span class="pd-row-label">📝 ණය ශේෂය</span>
         <span class="pd-row-value" style="color:${balance > 0 ? 'var(--red)' : 'var(--green)'};font-weight:700">
           ${money(balance)}
         </span>
       </div>
       <div class="pd-row">
         <span class="pd-row-label">🔒 ණය සීමාව</span>
         <span class="pd-row-value">${money(c.creditLimit || 0)}</span>
       </div>
     </div>
   </div>`,
  `<button class="btn" onclick="closeModal()">වසන්න</button>
   ${balance > 0 && typeof hasPermission === 'function' && hasPermission('credit') ? `
     <button class="btn btn-green" onclick="closeModal();openCreditPayment('${c.id}')">
       💵 ණය ගෙවන්න
     </button>
   ` : ''}`,
  false);
}

function editCustomer(id){
  if(!canEditCustomers()){
    toast('පාරිභෝගිකයන් සංස්කරණය කිරීමට අවසර නැත', 'err');
    return;
  }

  const db = window.DB || {};
  const c = id ? (db.customers || []).find(x => x.id === id) : { name:'', phone:'', vehicle:'', points:0, creditLimit:50000 };
  openModal(id ? '✏️ පාරිභෝගිකයා සංස්කරණය' : '➕ නව පාරිභෝගිකයා', 'Customer Profile',
  `<div>
     <label style="font-size:11.5px;color:var(--muted);font-weight:600">නම / Full Name *</label>
     <input id="cName" value="${esc(c.name)}" style="margin-top:4px">
   </div>
   <div class="grid2" style="margin-top:12px">
     <div>
       <label style="font-size:11.5px;color:var(--muted);font-weight:600">දුරකථනය / Phone</label>
       <input id="cPhone" value="${esc(c.phone)}" style="margin-top:4px">
     </div>
     <div>
       <label style="font-size:11.5px;color:var(--muted);font-weight:600">වාහන අංකය / Vehicle Reg No</label>
       <input id="cVeh" value="${esc(c.vehicle)}" placeholder="උදා: CAB-1234" style="margin-top:4px">
     </div>
   </div>
   <div class="grid2" style="margin-top:12px">
     <div>
       <label style="font-size:11.5px;color:var(--muted);font-weight:600">ණය සීමාව / Credit Limit (රු.)</label>
       <input id="cLimit" type="number" value="${c.creditLimit || 50000}" style="margin-top:4px">
     </div>
     <div>
       <label style="font-size:11.5px;color:var(--muted);font-weight:600">ලකුණු / Loyalty Points</label>
       <input id="cPoints" type="number" value="${c.points || 0}" style="margin-top:4px">
     </div>
   </div>`,
  `<button class="btn" onclick="closeModal()">අවලංගු</button>
   <button class="btn btn-primary" onclick="saveCustomer('${id||''}')">💾 සුරකින්න</button>`);
}

async function saveCustomer(id){
  if(!canEditCustomers()){
    toast('අවසර නැත', 'err');
    return;
  }

  const name = $('#cName')?.value.trim();
  if(!name){ toast('නම අවශ්‍යයි','err'); return; }

  const phone = $('#cPhone')?.value.trim() || '';
  const vehicle = $('#cVeh')?.value.trim().toUpperCase() || '';
  const creditLimit = Math.max(0, parseFloat($('#cLimit')?.value) || 0);
  const points = Math.max(0, parseInt($('#cPoints')?.value) || 0);

  const db = window.DB || {};
  if(!db.customers) db.customers = [];

  const data = { name, phone, vehicle, creditLimit, points };

  const curShop = (typeof currentShopId === 'function' && currentShopId()) ? currentShopId() : (window.state?.user?.shopId || 'SHOP-001');

  if(id){
    const c = db.customers.find(x => x.id === id);
    if(c){
      if(!c.shopId) c.shopId = curShop;
      Object.assign(c, data);
      if(window.FB && window.FB.fbSet) await window.FB.fbSet(window.FB.COL.customers, id, c);
    }
  } else {
    const newId = uid('C');
    const newCust = { id: newId, shopId: curShop, ...data, creditBalance: 0 };
    db.customers.push(newCust);
    if(window.FB && window.FB.fbSet) await window.FB.fbSet(window.FB.COL.customers, newId, newCust);
  }

  if(typeof saveDB === 'function') saveDB();
  closeModal();
  render();
  toast('පාරිභෝගික තොරතුරු සුරකින ලදී ✅');
}

async function delCustomer(id){
  if(!canDeleteCustomers()){
    toast('පාරිභෝගිකයන් මකා දැමීමට අවසර නැත', 'err');
    return;
  }

  if(!confirm('මෙම පාරිභෝගිකයා මකා දැමීමට අවශ්‍ය බව සහතිකද?')) return;
  const db = window.DB || {};
  db.customers = (db.customers || []).filter(c => c.id !== id);

  if(window.FB && window.FB.fbDelete){
    await window.FB.fbDelete(window.FB.COL.customers, id);
  }
  if(typeof saveDB === 'function') saveDB();

  render();
  toast('පාරිභෝගිකයා මකා දමන ලදී');
}

window.pgCustomers = pgCustomers;
window.setCustFilter = setCustFilter;
window.debouncedCustSearch = debouncedCustSearch;
window.clearCustSearch = clearCustSearch;
window.getFilteredCustomers = getFilteredCustomers;
window.getCustomerMetrics = getCustomerMetrics;
window.updateCustCounts = updateCustCounts;
window.renderCustList = renderCustList;
window.renderCustTableRow = renderCustTableRow;
window.renderCustCard = renderCustCard;
window.renderCustPagination = renderCustPagination;
window.custGoToPage = custGoToPage;
window.viewCustomer = viewCustomer;
window.editCustomer = editCustomer;
window.saveCustomer = saveCustomer;
window.delCustomer = delCustomer;


