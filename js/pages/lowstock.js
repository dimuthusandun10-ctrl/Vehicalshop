/* =========================================================
   js/pages/lowstock.js - Low Stock & Reorder Alerts View
   ========================================================= */

// Ensure state defaults
state.lsSearch = state.lsSearch || '';
state.lsCategory = state.lsCategory || 'all';
state.lsUrgency = state.lsUrgency || 'all';
state.lsStatus = state.lsStatus || 'all';
state.lsPage = state.lsPage || 1;
const LS_PER_PAGE = 20;

function setLsFilter(key, value){
  if(key === 'search') state.lsSearch = value;
  else if(key === 'category') state.lsCategory = value;
  else if(key === 'urgency') state.lsUrgency = value;
  else if(key === 'status'){
    state.lsStatus = value;
    document.querySelectorAll('.ls-status-tabs button').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-status') === value);
    });
  }
  state.lsPage = 1;
  renderLsList();

  const clearBtn = document.querySelector('.ls-search-clear');
  if(clearBtn) clearBtn.classList.toggle('hidden', !state.lsSearch);
}

function clearLsSearch(){
  state.lsSearch = '';
  state.lsPage = 1;
  const inp = document.getElementById('lsSearch');
  if(inp) inp.value = '';
  renderLsList();
  document.querySelector('.ls-search-clear')?.classList.add('hidden');
}

function getFilteredLowStock(){
  const db = window.DB || {};
  let list = (db.products || []).filter(p => (p.qty || 0) <= (p.reorder || 5));

  // Search filter
  if((state.lsSearch || '').trim()){
    const q = state.lsSearch.toLowerCase().trim();
    list = list.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.nameEn || '').toLowerCase().includes(q) ||
      (p.code || '').toLowerCase().includes(q) ||
      (p.brand || '').toLowerCase().includes(q) ||
      (p.model || '').toLowerCase().includes(q) ||
      (p.oemNo || '').toLowerCase().includes(q)
    );
  }

  // Category filter
  if(state.lsCategory && state.lsCategory !== 'all'){
    list = list.filter(p => (p.cat || '').toLowerCase() === state.lsCategory.toLowerCase());
  }

  // Urgency filter
  if(state.lsUrgency === 'critical'){
    list = list.filter(p => (p.qty || 0) === 0);
  } else if(state.lsUrgency === 'urgent'){
    list = list.filter(p => (p.qty || 0) > 0 && (p.qty || 0) <= (p.reorder || 5) * 0.5);
  } else if(state.lsUrgency === 'warn'){
    list = list.filter(p => (p.qty || 0) > (p.reorder || 5) * 0.5 && (p.qty || 0) <= (p.reorder || 5));
  }

  // Status quick-tab filter
  if(state.lsStatus === 'out'){
    list = list.filter(p => (p.qty || 0) === 0);
  } else if(state.lsStatus === 'low'){
    list = list.filter(p => (p.qty || 0) > 0 && (p.qty || 0) <= (p.reorder || 5));
  }

  // Sort by urgency: out of stock & highest deficit first
  list.sort((a,b) => {
    const ua = (a.qty || 0) - (a.reorder || 5);
    const ub = (b.qty || 0) - (b.reorder || 5);
    return ua - ub;
  });

  return list;
}

function updateLsCounts(){
  const db = window.DB || {};
  const products = db.products || [];
  const all = products.filter(p => (p.qty || 0) <= (p.reorder || 5));
  const out = all.filter(p => (p.qty || 0) === 0);
  const low = all.filter(p => (p.qty || 0) > 0);

  const reorderValue = all.reduce((sum, p) => {
    const reorderQty = Math.max((p.reorder || 5) * 2 - (p.qty || 0), 1);
    return sum + (reorderQty * (p.cost || 0));
  }, 0);

  const set = (id, val) => {
    const el = document.getElementById(id);
    if(el) el.textContent = val;
  };
  set('cntLsAll', all.length);
  set('cntLsOut', out.length);
  set('cntLsLow', low.length);
  set('lsOutCount', out.length);
  set('lsLowCount', low.length);
  set('lsValueCount', 'රු. ' + Math.round(reorderValue).toLocaleString('en-LK'));
  set('lsTotalCount', all.length);
}

function renderLsTableRow(p){
  const reorder = p.reorder || 5;
  const reorderQty = Math.max(reorder * 2 - (p.qty || 0), 1);
  return `<tr>
    <td style="font-family:'Inter',monospace;font-size:12px">${esc(p.code)}</td>
    <td>
      <b>${esc(p.name)}</b><br>
      <small style="color:var(--muted)">${esc(p.nameEn || '')}</small>
    </td>
    <td><small>${esc(p.brand || '')} ${esc(p.model || '')}</small></td>
    <td style="text-align:center">
      <span class="pill ${p.qty===0?'bad':'warn'}">${p.qty}</span>
    </td>
    <td style="text-align:center">${reorder}</td>
    <td style="text-align:center">
      <b style="color:var(--primary)">+${reorderQty} ${esc(p.unit || 'pcs')}</b>
    </td>
    <td style="text-align:center;white-space:nowrap">
      ${state.user?.role !== 'cashier' ? `
        <button class="btn btn-sm btn-blue" onclick="editProduct('${p.id}')" title="සංස්කරණය">✏️</button>
      ` : ''}
    </td>
  </tr>`;
}

function renderLsCard(p){
  const isOut = (p.qty || 0) === 0;
  const reorder = p.reorder || 5;
  const reorderQty = Math.max(reorder * 2 - (p.qty || 0), 1);
  const stockPct = Math.min(100, Math.round(((p.qty || 0) / Math.max(reorder * 2, 1)) * 100));
  const stockCls = isOut ? 'bad' : ((p.qty || 0) <= reorder * 0.5 ? 'warn' : 'ok');

  return `
    <div class="ls-card ${isOut ? 'critical' : ''}">
      <div class="ls-card-top">
        <span class="ls-card-code">${esc(p.code)}</span>
        <span class="ls-card-badge ${stockCls}">
          ${isOut ? '🚫 අවසන්' : `⚠️ ${p.qty} / ${reorder}`}
        </span>
      </div>

      <div class="ls-card-name">${esc(p.name)}</div>
      ${p.nameEn ? `<div class="ls-card-name-en">${esc(p.nameEn)}</div>` : ''}

      ${p.rack ? `
        <div class="ls-card-rack">
          📍 ${esc(p.rack)}${p.bin ? '/' + esc(p.bin) : ''}
        </div>
      ` : ''}

      <!-- Stock progress -->
      <div class="ls-stock-bar">
        <div class="ls-stock-fill ${stockCls}" style="width:${Math.max(stockPct, 4)}%"></div>
      </div>

      <!-- Reorder info -->
      <div class="ls-reorder">
        <div>
          <small>නැවත ඇණවුම් කරන්න</small>
          <b>+${reorderQty} ${esc(p.unit || 'pcs')}</b>
        </div>
        <div>
          <small>වටිනාකම</small>
          <b>${money(reorderQty * (p.cost || 0))}</b>
        </div>
      </div>

      <!-- Actions -->
      <div class="ls-card-actions">
        ${state.user?.role !== 'cashier' ? `
          <button class="btn-grn" onclick="go('grn')">📥 GRN දාන්න</button>
          <button onclick="editProduct('${p.id}')" class="btn-edit" title="සංස්කරණය">✏️</button>
        ` : ''}
      </div>
    </div>
  `;
}

function renderLsPagination(total, totalPages){
  const el = document.getElementById('lsPagination');
  if(!el) return;
  if(totalPages <= 1 || total === 0){ el.innerHTML = ''; return; }

  const cur = state.lsPage;
  let html = '<div class="pg-controls">';
  html += `<button class="pg-btn" ${cur===1?'disabled':''} onclick="lsGoToPage(${cur-1})">◀</button>`;

  const start = Math.max(1, Math.min(cur - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  for(let i = start; i <= end; i++){
    html += `<button class="pg-btn ${i===cur?'active':''}" onclick="lsGoToPage(${i})">${i}</button>`;
  }

  html += `<button class="pg-btn" ${cur===totalPages?'disabled':''} onclick="lsGoToPage(${cur+1})">▶</button>`;
  html += '</div>';
  html += `<div class="pg-info">${(cur-1)*LS_PER_PAGE+1}-${Math.min(cur*LS_PER_PAGE, total)} / ${total}</div>`;
  el.innerHTML = html;
}

function lsGoToPage(n){
  state.lsPage = n;
  renderLsList();
  document.querySelector('.ls-results')?.scrollIntoView({
    behavior: 'smooth', block: 'start'
  });
}

function renderLsList(){
  const list = getFilteredLowStock();
  updateLsCounts();

  const cntEl = document.getElementById('lsResultsCount');
  if(cntEl) cntEl.textContent = list.length + ' භාණ්ඩ';

  const totalPages = Math.ceil(list.length / LS_PER_PAGE) || 1;
  if(state.lsPage > totalPages) state.lsPage = totalPages;
  if(state.lsPage < 1) state.lsPage = 1;

  const start = (state.lsPage - 1) * LS_PER_PAGE;
  const end = start + LS_PER_PAGE;
  const paged = list.slice(start, end);

  // Desktop table view
  const tableBody = document.querySelector('.ls-table tbody');
  if(tableBody){
    const desktopItems = (window.innerWidth > 820) ? list : paged;
    tableBody.innerHTML = desktopItems.length
      ? desktopItems.map(p => renderLsTableRow(p)).join('')
      : `<tr><td colspan="7">
           <div class="empty" style="padding:40px 20px;text-align:center">
             <div class="e" style="font-size:32px;margin-bottom:6px">✅</div>
             <div style="font-weight:600">අඩු තොග භාණ්ඩ නැත</div>
             <small style="color:var(--muted)">සියලු භාණ්ඩ ප්‍රමාණවත්</small>
           </div>
         </td></tr>`;
  }

  // Mobile cards view
  const cardsEl = document.getElementById('lsCards');
  if(cardsEl){
    cardsEl.innerHTML = paged.length
      ? paged.map(p => renderLsCard(p)).join('')
      : `<div class="empty" style="padding:60px 20px;text-align:center">
           <div class="e" style="font-size:36px;margin-bottom:8px">✅</div>
           <div style="font-size:15px;font-weight:600">අඩු තොග භාණ්ඩ නැත</div>
           <small style="color:var(--muted)">සියලු භාණ්ඩ ප්‍රමාණවත්</small>
         </div>`;
  }

  renderLsPagination(list.length, totalPages);
}

function pgLowStock(){
  const db = window.DB || {};
  const products = db.products || [];
  const defaultCats = ['Brake', 'Engine', 'Electrical', 'Body', 'Suspension', 'Filter', 'Lubricant', 'Battery', 'Other'];
  const cats = Array.from(new Set([...defaultCats, ...products.map(p => p.cat).filter(Boolean)]));

  const all = products.filter(p => (p.qty || 0) <= (p.reorder || 5));
  const out = all.filter(p => (p.qty || 0) === 0);
  const low = all.filter(p => (p.qty || 0) > 0);
  const reorderValue = all.reduce((sum, p) => {
    const reorderQty = Math.max((p.reorder || 5) * 2 - (p.qty || 0), 1);
    return sum + (reorderQty * (p.cost || 0));
  }, 0);

  const list = getFilteredLowStock();
  const totalPages = Math.ceil(list.length / LS_PER_PAGE) || 1;
  const curPage = Math.min(Math.max(1, state.lsPage || 1), totalPages);
  const start = (curPage - 1) * LS_PER_PAGE;
  const end = start + LS_PER_PAGE;
  const paged = list.slice(start, end);

  setTimeout(() => {
    renderLsList();
    if(state.lsSearch){
      const inp = document.getElementById('lsSearch');
      if(inp){
        inp.focus();
        try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch(_) {}
      }
    }
  }, 50);

  return `
    <div class="lowstock-page">
      <!-- Top actions -->
      <div class="ls-topbar">
        <div>
          <h3 style="font-size:15px;font-weight:700;margin:0 0 2px 0">⚠️ අඩු තොග භාණ්ඩ</h3>
          <small style="font-size:11px;color:var(--muted)">
            Reorder List · <span id="lsTotalCount">${all.length}</span> items
          </small>
        </div>
        ${state.user?.role !== 'cashier' ? `
          <button class="btn btn-primary btn-sm" onclick="go('grn')">📥 GRN එකක් සාදන්න</button>
        ` : ''}
      </div>

      <!-- Stat cards -->
      <div class="ls-stats">
        <div class="ls-stat out">
          <div class="ls-ic">🚫</div>
          <div>
            <b id="lsOutCount">${out.length}</b>
            <span>අවසන්</span>
          </div>
        </div>
        <div class="ls-stat low">
          <div class="ls-ic">⚠️</div>
          <div>
            <b id="lsLowCount">${low.length}</b>
            <span>අඩු තොග</span>
          </div>
        </div>
        <div class="ls-stat value">
          <div class="ls-ic">💰</div>
          <div>
            <b id="lsValueCount">රු. ${Math.round(reorderValue).toLocaleString('en-LK')}</b>
            <span>නැවත ඇණවුම් වටිනාකම</span>
          </div>
        </div>
      </div>

      <!-- Toolbar card -->
      <div class="ls-toolbar card">
        <!-- Search row -->
        <div class="ls-search-row">
          <span class="ls-search-icon">🔍</span>
          <input id="lsSearch" type="search"
                 placeholder="භාණ්ඩය සොයන්න (නම / කේතය)..."
                 value="${esc(state.lsSearch || '')}"
                 oninput="setLsFilter('search', this.value)">
          <button class="ls-search-clear ${state.lsSearch ? '' : 'hidden'}"
                  onclick="clearLsSearch()" title="මකන්න">✕</button>
        </div>

        <!-- Dropdowns row -->
        <div class="ls-dropdowns-row">
          <div class="ls-select-wrap">
            <label>කාණ්ඩය</label>
            <select onchange="setLsFilter('category', this.value)">
              <option value="all">සියලු කාණ්ඩ</option>
              ${cats.map(c => `
                <option value="${c}" ${state.lsCategory===c?'selected':''}>${c}</option>
              `).join('')}
            </select>
          </div>
          <div class="ls-select-wrap">
            <label>හදිසි මට්ටම</label>
            <select onchange="setLsFilter('urgency', this.value)">
              <option value="all" ${state.lsUrgency==='all'?'selected':''}>සියල්ල</option>
              <option value="critical" ${state.lsUrgency==='critical'?'selected':''}>🚨 අවසන් (0)</option>
              <option value="urgent" ${state.lsUrgency==='urgent'?'selected':''}>⚠️ හදිසි</option>
              <option value="warn" ${state.lsUrgency==='warn'?'selected':''}>⚡ සාමාන්‍ය</option>
            </select>
          </div>
        </div>

        <!-- Status tabs row -->
        <div class="ls-status-tabs">
          <button class="${!state.lsStatus||state.lsStatus==='all'?'active':''}"
                  data-status="all"
                  onclick="setLsFilter('status','all')">
            📊 සියල්ල <span class="cnt" id="cntLsAll">${all.length}</span>
          </button>
          <button class="${state.lsStatus==='out'?'active':''}"
                  data-status="out"
                  onclick="setLsFilter('status','out')">
            🚫 අවසන් <span class="cnt" id="cntLsOut">${out.length}</span>
          </button>
          <button class="${state.lsStatus==='low'?'active':''}"
                  data-status="low"
                  onclick="setLsFilter('status','low')">
            ⚠️ අඩු <span class="cnt" id="cntLsLow">${low.length}</span>
          </button>
        </div>
      </div>

      <!-- Results card -->
      <div class="ls-results card">
        <div class="ls-results-header">
          <span id="lsResultsCount">${list.length} භාණ්ඩ</span>
        </div>

        <!-- Desktop table view -->
        <div class="ls-table-view desktop-only tbl-wrap">
          <table class="ls-table">
            <thead>
              <tr>
                <th>කේතය</th>
                <th>භාණ්ඩය</th>
                <th>වාහනය</th>
                <th style="text-align:center">තොග</th>
                <th style="text-align:center">අවම</th>
                <th style="text-align:center">අවශ්‍ය ප්‍රමාණය</th>
                <th style="text-align:center">ක්‍රියා</th>
              </tr>
            </thead>
            <tbody>
              ${list.length
                ? list.map(p => renderLsTableRow(p)).join('')
                : `<tr><td colspan="7">
                     <div class="empty" style="padding:40px 20px;text-align:center">
                       <div class="e" style="font-size:32px;margin-bottom:6px">✅</div>
                       <div style="font-weight:600">අඩු තොග භාණ්ඩ නැත</div>
                       <small style="color:var(--muted)">සියලු භාණ්ඩ ප්‍රමාණවත්</small>
                     </div>
                   </td></tr>`}
            </tbody>
          </table>
        </div>

        <!-- Mobile cards view -->
        <div class="ls-cards-view mobile-only" id="lsCards">
          ${paged.length
            ? paged.map(p => renderLsCard(p)).join('')
            : `<div class="empty" style="padding:60px 20px;text-align:center">
                 <div class="e" style="font-size:36px;margin-bottom:8px">✅</div>
                 <div style="font-size:15px;font-weight:600">අඩු තොග භාණ්ඩ නැත</div>
                 <small style="color:var(--muted)">සියලු භාණ්ඩ ප්‍රමාණවත්</small>
               </div>`}
        </div>

        <!-- Mobile pagination -->
        <div class="ls-pagination mobile-only" id="lsPagination"></div>
      </div>
    </div>
  `;
}

// Window exports
window.pgLowStock = pgLowStock;
window.setLsFilter = setLsFilter;
window.clearLsSearch = clearLsSearch;
window.getFilteredLowStock = getFilteredLowStock;
window.updateLsCounts = updateLsCounts;
window.renderLsList = renderLsList;
window.renderLsTableRow = renderLsTableRow;
window.renderLsCard = renderLsCard;
window.renderLsPagination = renderLsPagination;
window.lsGoToPage = lsGoToPage;
