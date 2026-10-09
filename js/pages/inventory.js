/* =========================================================
   js/pages/inventory.js - Product & Auto Parts Inventory Management
   ========================================================= */

// Ensure state defaults
state.invSearch = state.invSearch || '';
state.invCategory = state.invCategory || 'all';
state.invSort = state.invSort || 'default';
state.invStatus = state.invStatus || 'all';
state.invPage = state.invPage || 1;
const INV_PER_PAGE = 20;

function setInvFilter(key, value){
  if(key === 'search'){
    state.invSearch = value;
  } else if(key === 'category'){
    state.invCategory = value;
  } else if(key === 'sort'){
    state.invSort = value;
  } else if(key === 'status'){
    state.invStatus = value;
  }
  state.invPage = 1;   // ⭐ reset page on any filter change
  renderInvList();

  // Show/hide clear button
  const clearBtn = document.querySelector('.inv-search-clear');
  if(clearBtn){
    clearBtn.classList.toggle('hidden', !state.invSearch);
  }
}

function clearInvSearch(){
  state.invSearch = '';
  state.invPage = 1;
  const inp = document.getElementById('invSearch');
  if(inp) inp.value = '';
  renderInvList();
  document.querySelector('.inv-search-clear')?.classList.add('hidden');
}

function getFilteredInventory(){
  const db = window.DB || {};
  let list = (db.products || []).slice();

  // Search filter
  if((state.invSearch || '').trim()){
    const q = state.invSearch.toLowerCase().trim();
    list = list.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.nameEn || '').toLowerCase().includes(q) ||
      (p.code || '').toLowerCase().includes(q) ||
      (p.oemNo || '').toLowerCase().includes(q) ||
      (Array.isArray(p.altNos) && p.altNos.some(a => (a || '').toLowerCase().includes(q))) ||
      (p.brand || '').toLowerCase().includes(q) ||
      (p.model || '').toLowerCase().includes(q) ||
      (p.rack || '').toLowerCase().includes(q)
    );
  }

  // Category filter
  if(state.invCategory && state.invCategory !== 'all'){
    list = list.filter(p => (p.cat || '').toLowerCase() === state.invCategory.toLowerCase());
  }

  // Status filter
  if(state.invStatus === 'low'){
    list = list.filter(p => p.qty > 0 && p.qty <= (p.reorder || 5));
  } else if(state.invStatus === 'out'){
    list = list.filter(p => (p.qty || 0) === 0);
  }

  // Sort
  switch(state.invSort){
    case 'name-asc':   list.sort((a,b) => (a.name||'').localeCompare(b.name||'','si')); break;
    case 'name-desc':  list.sort((a,b) => (b.name||'').localeCompare(a.name||'','si')); break;
    case 'price-asc':  list.sort((a,b) => (a.price || 0) - (b.price || 0)); break;
    case 'price-desc': list.sort((a,b) => (b.price || 0) - (a.price || 0)); break;
    case 'stock-asc':  list.sort((a,b) => (a.qty || 0) - (b.qty || 0)); break;
    case 'stock-desc': list.sort((a,b) => (b.qty || 0) - (a.qty || 0)); break;
    default:           list.sort((a,b) => (a.code||'').localeCompare(b.code||'')); break;
  }

  return list;
}

function updateInvCounts(){
  const db = window.DB || {};
  const products = db.products || [];
  const all = products.length;
  const low = products.filter(p => p.qty > 0 && p.qty <= (p.reorder || 5)).length;
  const out = products.filter(p => (p.qty || 0) === 0).length;

  const set = (id, val) => {
    const el = document.getElementById(id);
    if(el) el.textContent = val;
  };
  set('cntAll', all);
  set('cntLow', low);
  set('cntOut', out);

  const totalEl = document.getElementById('invCount');
  if(totalEl) totalEl.textContent = all;
}

function renderInvList(){
  const list = getFilteredInventory();
  updateInvCounts();

  // Update count
  const cntEl = document.getElementById('invResultsCount');
  if(cntEl) cntEl.textContent = list.length + ' භාණ්ඩ';

  // Paginate
  const start = (state.invPage - 1) * INV_PER_PAGE;
  const end = start + INV_PER_PAGE;
  const paged = list.slice(start, end);
  const totalPages = Math.ceil(list.length / INV_PER_PAGE) || 1;

  const infoEl = document.getElementById('invPaginationInfo');
  if(infoEl){
    infoEl.textContent = list.length > 0
      ? `${start + 1}-${Math.min(end, list.length)} / ${list.length}`
      : '';
  }

  // ─── DESKTOP TABLE ───
  const tableBody = document.querySelector('.inv-table tbody');
  if(tableBody){
    tableBody.innerHTML = paged.length
      ? paged.map(p => `
        <tr>
          <td style="font-family:'Inter',monospace;font-size:12px">
            <b>${esc(p.code)}</b>
            ${p.oemNo ? `<br><small style="color:var(--muted);font-size:10px">${esc(p.oemNo)}</small>` : ''}
          </td>
          <td>
            <b>${esc(p.name)}</b><br>
            <small style="color:var(--muted)">${esc(p.nameEn || '')}</small>
            ${p.warranty ? `<br><span class="pill ok" style="font-size:9px;padding:1px 5px">🛡️ ${p.warranty}m warranty</span>` : ''}
            ${p.hasSerial ? `<span class="pill info" style="font-size:9px;padding:1px 5px">🛡️ S/N Track</span>` : ''}
          </td>
          <td><span class="pill mute">${esc(p.cat || 'Other')}</span></td>
          <td>
            <small>${esc(p.brand || '')}<br>${esc(p.model || '')}</small>
          </td>
          <td style="text-align:right">${money(p.cost)}</td>
          <td style="text-align:right;color:var(--primary);font-weight:700">${money(p.price)}</td>
          <td style="text-align:center">
            <span class="pill ${p.qty===0?'bad':p.qty<=p.reorder?'warn':'ok'}">
              ${p.qty} ${esc(p.unit || 'pcs')}
            </span>
          </td>
          <td style="text-align:center;white-space:nowrap">
            <button class="btn btn-sm" onclick="editProduct('${p.id}')" title="සංස්කරණය">✏️</button>
            ${(hasPermission('delete-product') || state.user?.role === 'superadmin')
              ? `<button class="btn btn-sm btn-red" onclick="delProduct('${p.id}')" title="මකන්න">🗑️</button>` : ''}
          </td>
        </tr>`).join('')
      : `<tr><td colspan="8">
           <div class="empty" style="padding:40px 20px;text-align:center">
             <div class="e" style="font-size:32px;margin-bottom:6px">🔍</div>
             <div style="font-weight:600">භාණ්ඩ හමු නොවීය</div>
             <small style="color:var(--muted)">ෆිල්ටර වෙනස් කරන්න හෝ නව භාණ්ඩයක් ඇතුළත් කරන්න</small>
           </div>
         </td></tr>`;
  }

  // ─── MOBILE CARDS ───
  const cardsEl = document.getElementById('invCards');
  if(cardsEl){
    cardsEl.innerHTML = paged.length
      ? paged.map(p => renderInvCard(p)).join('')
      : `<div class="empty" style="padding:60px 20px;text-align:center">
           <div class="e" style="font-size:36px;margin-bottom:8px">🔍</div>
           <div style="font-size:15px;font-weight:600">භාණ්ඩ හමු නොවීය</div>
           <small style="color:var(--muted)">ෆිල්ටර වෙනස් කරන්න හෝ නව භාණ්ඩයක් එකතු කරන්න</small>
         </div>`;
  }

  // ─── PAGINATION ───
  renderInvPagination(list.length, totalPages);
}

function renderInvCard(p){
  const stockCls = p.qty === 0 ? 'bad' : p.qty <= (p.reorder || 5) ? 'warn' : 'ok';
  const stockLabel = p.qty === 0 ? 'අවසන්' : `${p.qty} ${p.unit || 'pcs'}`;

  return `
    <div class="inv-card">
      
      <!-- Top: code + stock -->
      <div class="inv-card-top">
        <span class="inv-card-code">${esc(p.code)}</span>
        <span class="pill ${stockCls}">${stockLabel}</span>
      </div>
      
      <!-- Name -->
      <div class="inv-card-name">${esc(p.name)}</div>
      <div class="inv-card-name-en">${esc(p.nameEn || '')}</div>
      
      <!-- Meta -->
      <div class="inv-card-meta">
        <span class="inv-cat-pill">${esc(p.cat || 'Other')}</span>
        ${p.rack ? `<span class="inv-rack">📍 ${esc(p.rack)}${p.bin ? '/' + esc(p.bin) : ''}</span>` : ''}
        ${p.warranty ? `<span class="inv-warranty">🛡️ ${p.warranty}m</span>` : ''}
      </div>
      
      <!-- Prices -->
      <div class="inv-card-prices">
        <div>
          <small>පිරිවැය</small>
          <b>${money(p.cost)}</b>
        </div>
        <div>
          <small>විකුණුම් මිල</small>
          <b class="price">${money(p.price)}</b>
        </div>
      </div>
      
      <!-- Actions -->
      <div class="inv-card-actions">
        <button onclick="viewProductDetail('${p.id}')" class="btn-view" title="බලන්න">👁️</button>
        <button onclick="editProduct('${p.id}')" class="btn-edit" title="සංස්කරණය">✏️</button>
        ${(hasPermission('delete-product') || state.user?.role==='superadmin')
          ? `<button onclick="delProduct('${p.id}')" class="btn-del" title="මකන්න">🗑️</button>` : ''}
      </div>
    </div>
  `;
}

function viewProductDetail(id){
  const db = window.DB || {};
  const p = db.getProd ? db.getProd(id) : (db.products || []).find(x => x.id === id);
  if(!p) return;
  openModal(
    `📦 ${esc(p.name)}`,
    `${esc(p.code)} · ${esc(p.cat || '')}`,
    `<div style="display:flex;flex-direction:column;gap:10px">
       <div style="display:flex;justify-content:space-between;align-items:center">
         <span class="pill ${p.qty===0?'bad':p.qty<=p.reorder?'warn':'ok'}">${p.qty} ${p.unit||'pcs'} in stock</span>
         <b style="color:var(--primary);font-size:16px">${money(p.price)}</b>
       </div>
       ${p.nameEn ? `<div><small style="color:var(--muted)">English:</small> <div>${esc(p.nameEn)}</div></div>` : ''}
       ${p.oemNo ? `<div><small style="color:var(--muted)">OEM Number:</small> <div>${esc(p.oemNo)}</div></div>` : ''}
       ${(p.brand || p.model) ? `<div><small style="color:var(--muted)">Vehicle Match:</small> <div>${esc(p.brand||'')} ${esc(p.model||'')}</div></div>` : ''}
       ${p.rack ? `<div><small style="color:var(--muted)">Rack / Bin:</small> <div>📍 ${esc(p.rack)}${p.bin ? ' / ' + esc(p.bin) : ''} (${esc(p.warehouse||'Main')})</div></div>` : ''}
       <div><small style="color:var(--muted)">Cost:</small> <div>${money(p.cost)}</div></div>
     </div>`,
    `<button class="btn btn-primary" onclick="closeModal();editProduct('${p.id}')">✏️ සංස්කරණය කරන්න</button>`
  );
}

function renderInvPagination(total, totalPages){
  const el = document.getElementById('invPagination');
  if(!el) return;
  if(totalPages <= 1 || total === 0){ el.innerHTML = ''; return; }

  const cur = state.invPage;
  let html = '<div class="pg-controls">';

  html += `<button class="pg-btn" ${cur===1?'disabled':''} 
           onclick="invGoToPage(${cur-1})">◀</button>`;

  // Page numbers (max 5 visible)
  const start = Math.max(1, Math.min(cur - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);

  for(let i = start; i <= end; i++){
    html += `<button class="pg-btn ${i===cur?'active':''}" 
             onclick="invGoToPage(${i})">${i}</button>`;
  }

  html += `<button class="pg-btn" ${cur===totalPages?'disabled':''} 
           onclick="invGoToPage(${cur+1})">▶</button>`;

  html += '</div>';
  html += `<div class="pg-info">${(cur-1)*INV_PER_PAGE+1}-${Math.min(cur*INV_PER_PAGE, total)} / ${total}</div>`;

  el.innerHTML = html;
}

function invGoToPage(n){
  state.invPage = n;
  renderInvList();
  document.querySelector('.inv-results')?.scrollIntoView({ 
    behavior: 'smooth', block: 'start' 
  });
}

function pgInventory(){
  const cats = ['Brake', 'Engine', 'Electrical', 'Body', 'Suspension', 'Filter', 'Lubricant', 'Battery', 'Other'];
  const list = getFilteredInventory();

  // Initialize view after render
  setTimeout(() => {
    renderInvList();
    if(state.invSearch){
      const inp = document.getElementById('invSearch');
      if(inp){
        inp.focus();
        try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch(_) {}
      }
    }
  }, 50);

  return `
    <div class="inventory-page">
      
      <!-- ⭐ Toolbar card -->
      <div class="inv-toolbar card">
        
        <!-- Header -->
        <div class="inv-header">
          <div>
            <h3>📦 භාණ්ඩ ලේඛනය</h3>
            <small>Inventory · <span id="invCount">0</span> items</small>
          </div>
          ${hasPermission('inventory') ? `
            <button class="btn btn-primary btn-add" onclick="editProduct()">
              <span class="desktop-only">+ නව භාණ්ඩය</span>
              <span class="mobile-only">+</span>
            </button>
          ` : ''}
        </div>
        
        <!-- ⭐ Search -->
        <div class="inv-search-row">
          <span class="inv-search-icon">🔍</span>
          <input id="invSearch" 
                 type="search"
                 placeholder="භාණ්ඩය සොයන්න (නම / කේතය / OEM)..."
                 value="${esc(state.invSearch || '')}"
                 oninput="setInvFilter('search', this.value)">
          <button class="inv-search-clear ${state.invSearch ? '' : 'hidden'}" onclick="clearInvSearch()">✕</button>
        </div>
        
        <!-- ⭐ Dropdowns row (2 cols) -->
        <div class="inv-dropdowns-row">
          <div class="inv-select-wrap">
            <label>කාණ්ඩය</label>
            <select onchange="setInvFilter('category', this.value)">
              <option value="all">සියලු කාණ්ඩ</option>
              ${cats.map(c => `
                <option value="${c}" ${state.invCategory===c?'selected':''}>${c}</option>
              `).join('')}
            </select>
          </div>
          <div class="inv-select-wrap">
            <label>වර්ගය</label>
            <select onchange="setInvFilter('sort', this.value)">
              <option value="default" ${state.invSort==='default'?'selected':''}>පෙළගැස්ම</option>
              <option value="name-asc" ${state.invSort==='name-asc'?'selected':''}>නම (A→Z)</option>
              <option value="name-desc" ${state.invSort==='name-desc'?'selected':''}>නම (Z→A)</option>
              <option value="price-asc" ${state.invSort==='price-asc'?'selected':''}>මිල (අඩු→වැඩි)</option>
              <option value="price-desc" ${state.invSort==='price-desc'?'selected':''}>මිල (වැඩි→අඩු)</option>
              <option value="stock-asc" ${state.invSort==='stock-asc'?'selected':''}>තොග (අඩු→වැඩි)</option>
              <option value="stock-desc" ${state.invSort==='stock-desc'?'selected':''}>තොග (වැඩි→අඩු)</option>
            </select>
          </div>
        </div>
        
        <!-- ⭐ Stock status quick filters -->
        <div class="inv-status-tabs">
          <button class="${!state.invStatus || state.invStatus==='all' ? 'active' : ''}" 
                  onclick="setInvFilter('status','all')">
            📊 සියල්ල <span class="cnt" id="cntAll">0</span>
          </button>
          <button class="${state.invStatus==='low' ? 'active' : ''}" 
                  onclick="setInvFilter('status','low')">
            ⚠️ අඩු තොග <span class="cnt" id="cntLow">0</span>
          </button>
          <button class="${state.invStatus==='out' ? 'active' : ''}" 
                  onclick="setInvFilter('status','out')">
            🚫 අවසන් <span class="cnt" id="cntOut">0</span>
          </button>
        </div>
        
      </div>
      
      <!-- ⭐ Results card -->
      <div class="inv-results card">
        
        <div class="inv-results-header">
          <span id="invResultsCount">0 භාණ්ඩ</span>
          <span class="pagination-info" id="invPaginationInfo"></span>
        </div>
        
        <!-- Desktop table view -->
        <div class="inv-table-view desktop-only">
          <div class="tbl-wrap">
            <table class="inv-table">
              <thead>
                <tr>
                  <th>කේතය / OEM</th>
                  <th>භාණ්ඩය</th>
                  <th>කාණ්ඩය</th>
                  <th>වාහන අනුකූලතාව</th>
                  <th style="text-align:right">පිරිවැය</th>
                  <th style="text-align:right">විකුණුම් මිල</th>
                  <th style="text-align:center">තොග</th>
                  <th style="text-align:center">ක්‍රියා</th>
                </tr>
              </thead>
              <tbody>
                <!-- Populated by renderInvList() -->
              </tbody>
            </table>
          </div>
        </div>
        
        <!-- ⭐ Mobile card view -->
        <div class="inv-cards-view mobile-only" id="invCards">
          <!-- Populated by renderInvList() -->
        </div>
        
        <!-- ⭐ Pagination (mobile) -->
        <div class="inv-pagination mobile-only" id="invPagination"></div>
        
      </div>
      
    </div>
  `;
}

function editProduct(id){
  const db = window.DB || {};
  const p = id ? (db.getProd ? db.getProd(id) : db.products.find(x => x.id === id)) : {
    code:'', name:'', nameEn:'', cat:'Engine', brand:'', model:'',
    oemNo:'', altNos:[], chassis:[], engine:[], yearFrom:'', yearTo:'',
    rack:'', bin:'', warehouse:'Main', cost:0, price:0, priceWholesale:0, qty:0, reorder:5,
    unit:'pcs', warranty:0, coreDeposit:0, hasSerial:false, crossSell:[]
  };
  const cats = ['Brake','Engine','Electrical','Body','Suspension','Filter','Lubricant','Battery','Other'];

  const altNosStr = Array.isArray(p.altNos) ? p.altNos.join(', ') : (p.altNos || '');
  const chassisStr = Array.isArray(p.chassis) ? p.chassis.join(', ') : (p.chassis || '');
  const engineStr = Array.isArray(p.engine) ? p.engine.join(', ') : (p.engine || '');
  const crossSellStr = Array.isArray(p.crossSell) ? p.crossSell.join(', ') : (p.crossSell || '');

  openModal(id ? '✏️ භාණ්ඩය සංස්කරණය' : '➕ නව අමතර කොටසක්', id ? 'Edit Auto Part' : 'New Auto Part',
  `<div class="grid2">
     <div><label style="font-size:11.5px;color:var(--muted);font-weight:600">කේතය / Item Code *</label>
       <input id="pCode" value="${esc(p.code)}"></div>
     <div><label style="font-size:11.5px;color:var(--muted);font-weight:600">කාණ්ඩය / Category</label>
       <select id="pCat">${cats.map(c=>`<option ${c===p.cat?'selected':''}>${c}</option>`).join('')}</select></div>
   </div>

   <div class="grid2" style="margin-top:12px">
     <div><label style="font-size:11.5px;color:var(--muted);font-weight:600">නම (සිංහල) *</label><input id="pName" value="${esc(p.name)}"></div>
     <div><label style="font-size:11.5px;color:var(--muted);font-weight:600">Name (English)</label><input id="pNameEn" value="${esc(p.nameEn||'')}"></div>
   </div>

   <!-- Auto Parts Compatibility Group -->
   <div style="background:rgba(255,255,255,0.02);border:1px solid var(--line);border-radius:10px;padding:12px;margin-top:14px">
     <div style="font-size:12px;font-weight:700;color:var(--primary);margin-bottom:8px">🚗 වාහන සහ අමතර කොටස් අනුකූලතාව (Compatibility)</div>
     <div class="grid2">
       <div><label style="font-size:11px;color:var(--muted)">OEM අංකය (උදා: 04465-02220)</label><input id="pOem" value="${esc(p.oemNo||'')}"></div>
       <div><label style="font-size:11px;color:var(--muted)">විකල්ප අංක / Alt Nos (කොමා වලින් වෙන් කරන්න)</label><input id="pAlt" value="${esc(altNosStr)}" placeholder="AN-688K, TN-401"></div>
     </div>
     <div class="grid2" style="margin-top:10px">
       <div><label style="font-size:11px;color:var(--muted)">වෙළඳ නාමය / Brand</label><input id="pBrand" value="${esc(p.brand||'')}"></div>
       <div><label style="font-size:11px;color:var(--muted)">වාහන මාදිලිය / Model</label><input id="pModel" value="${esc(p.model||'')}"></div>
     </div>
     <div class="grid2" style="margin-top:10px">
       <div><label style="font-size:11px;color:var(--muted)">Chassis Codes (කොමා වලින් වෙන් කරන්න)</label><input id="pChassis" value="${esc(chassisStr)}" placeholder="NZE141, GP5"></div>
       <div><label style="font-size:11px;color:var(--muted)">Engine Codes (කොමා වලින් වෙන් කරන්න)</label><input id="pEngine" value="${esc(engineStr)}" placeholder="1NZ-FE, L15A"></div>
     </div>
     <div class="grid2" style="margin-top:10px">
       <div><label style="font-size:11px;color:var(--muted)">ගැලපෙන වර්ෂය (සිට / From)</label><input id="pYFrom" type="number" value="${p.yearFrom||''}" placeholder="2006"></div>
       <div><label style="font-size:11px;color:var(--muted)">ගැලපෙන වර්ෂය (දක්වා / To)</label><input id="pYTo" type="number" value="${p.yearTo||''}" placeholder="2018"></div>
     </div>
   </div>

   <!-- Storage Location (Placed below category/brand section) -->
   <div style="background:rgba(255,255,255,0.02);border:1px solid var(--line);border-radius:10px;padding:12px;margin-top:14px">
     <div style="font-size:12px;font-weight:700;color:var(--blue);margin-bottom:8px">📍 ගබඩා ස්ථානය (Storage Location)</div>
     <div class="grid3">
       <div><label style="font-size:11px;color:var(--muted);font-weight:600">රාක්ක අංකය (Rack)</label><input id="pRack" value="${esc(p.rack||'')}" placeholder="A-01"></div>
       <div><label style="font-size:11px;color:var(--muted);font-weight:600">පෙට්ටි අංකය (Bin)</label><input id="pBin" value="${esc(p.bin||'')}" placeholder="B3"></div>
       <div><label style="font-size:11px;color:var(--muted);font-weight:600">ගබඩාව (Warehouse)</label><input id="pWarehouse" value="${esc(p.warehouse||'Main')}" placeholder="Main"></div>
     </div>
   </div>

   <div class="grid3" style="margin-top:12px">
     <div><label style="font-size:11.5px;color:var(--muted);font-weight:600">පිරිවැය / Cost</label><input id="pCost" type="number" value="${p.cost||0}"></div>
     <div><label style="font-size:11.5px;color:var(--muted);font-weight:600">සිල්ලර මිල / Retail</label><input id="pPrice" type="number" value="${p.price||0}"></div>
     <div><label style="font-size:11.5px;color:var(--muted);font-weight:600">තොග මිල / Wholesale</label><input id="pPriceWs" type="number" value="${p.priceWholesale||0}"></div>
   </div>

   <div class="grid3" style="margin-top:12px">
     <div><label style="font-size:11.5px;color:var(--muted);font-weight:600">තොගය / Qty</label><input id="pQty" type="number" value="${p.qty||0}"></div>
     <div><label style="font-size:11.5px;color:var(--muted);font-weight:600">අවම තොගය / Reorder</label><input id="pRe" type="number" value="${p.reorder||5}"></div>
     <div><label style="font-size:11.5px;color:var(--muted);font-weight:600">ඒකකය / Unit</label><input id="pUnit" value="${esc(p.unit||'pcs')}"></div>
   </div>

   <!-- Warranty & Serial Tracking -->
   <div class="grid2" style="margin-top:12px;align-items:center">
     <div>
       <label style="font-size:11.5px;color:var(--muted);font-weight:600">වගකීම් කාලය (මාස / Months)</label>
       <input id="pWar" type="number" value="${p.warranty||0}" placeholder="12">
     </div>
     <div style="padding-top:16px">
       <label style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;cursor:pointer">
         <input type="checkbox" id="pHasSerial" ${p.hasSerial?'checked':''} style="width:18px;height:18px">
         <span>Serial අංකය නිරීක්ෂණය කරන්නද? (Track S/N)</span>
       </label>
     </div>
   </div>

   <!-- Core Deposit & Cross-Sell -->
   <div class="grid2" style="margin-top:12px">
     <div>
       <label style="font-size:11.5px;color:var(--muted);font-weight:600">Core Deposit (රු.)</label>
       <input id="pCore" type="number" value="${p.coreDeposit||0}" placeholder="2000">
       <div style="font-size:10.5px;color:var(--muted);margin-top:3px">💡 පරණ කොටසක් භාරගත් විට අඩු කරන මුදල</div>
     </div>
     <div>
       <label style="font-size:11.5px;color:var(--muted);font-weight:600">සමඟ විකුණන්න (Cross-sell codes)</label>
       <input id="pCrossSell" value="${esc(crossSellStr)}" placeholder="OF-2002, AF-2003">
       <div style="font-size:10.5px;color:var(--muted);margin-top:3px">💡 මේ භාණ්ඩයත් එක්ක බොහෝ විට විකුණන codes</div>
     </div>
   </div>`,
  `<button class="btn" onclick="closeModal()">අවලංගු</button>
   <button class="btn btn-primary" onclick="saveProduct('${id||''}')">💾 සුරකින්න</button>`,
  true);
}

async function saveProduct(id){
  const v = s => $(s)?.value?.trim() || '';
  if(!v('#pCode') || !v('#pName')){ toast('කේතය සහ නම අවශ්‍යයි','err'); return; }

  const splitClean = val => (val || '').split(',').map(x => x.trim()).filter(Boolean);
  const splitCleanUpper = val => (val || '').split(',').map(x => x.trim().toUpperCase()).filter(Boolean);

  const data = {
    code: v('#pCode'),
    name: v('#pName'),
    nameEn: v('#pNameEn'),
    cat: v('#pCat'),
    oemNo: v('#pOem'),
    altNos: splitClean(v('#pAlt')),
    brand: v('#pBrand'),
    model: v('#pModel'),
    chassis: splitCleanUpper(v('#pChassis')),
    engine: splitCleanUpper(v('#pEngine')),
    yearFrom: parseInt(v('#pYFrom')) || null,
    yearTo: parseInt(v('#pYTo')) || null,
    rack: v('#pRack'),
    bin: v('#pBin'),
    warehouse: v('#pWarehouse') || 'Main',
    cost: parseFloat(v('#pCost')) || 0,
    price: parseFloat(v('#pPrice')) || 0,
    priceWholesale: parseFloat(v('#pPriceWs')) || 0,
    qty: parseInt(v('#pQty')) || 0,
    reorder: parseInt(v('#pRe')) || 0,
    unit: v('#pUnit') || 'pcs',
    warranty: parseInt(v('#pWar')) || 0,
    hasSerial: $('#pHasSerial') ? $('#pHasSerial').checked : false,
    coreDeposit: parseFloat(v('#pCore')) || 0,
    crossSell: splitCleanUpper(v('#pCrossSell')),
    active: true
  };

  const db = window.DB || {};
  if(!db.products) db.products = [];

  const curShop = (typeof currentShopId === 'function' && currentShopId()) ? currentShopId() : (window.state?.user?.shopId || 'SHOP-001');

  if(id){
    const p = db.getProd ? db.getProd(id) : db.products.find(x => x.id === id);
    if(p){
      if(!p.shopId) p.shopId = curShop;
      Object.assign(p, data);
      if(window.FB && window.FB.fbSet) await window.FB.fbSet(window.FB.COL.products, id, p);
    }
    toast('යාවත්කාලීන කළා ✅');
  } else {
    const newId = uid('P');
    const newProd = { id: newId, shopId: curShop, ...data };
    db.products.push(newProd);
    if(window.FB && window.FB.fbSet) await window.FB.fbSet(window.FB.COL.products, newId, newProd);
    toast('නව භාණ්ඩය එකතු කළා ✅');
  }

  if(typeof saveDB === 'function') saveDB();
  closeModal();
  render();
}

async function delProduct(id){
  if(!hasPermission('delete-product')){
    toast('භාණ්ඩ ඉවත් කිරීමට ඔබට අවසර නැත', 'err');
    return;
  }
  if(!confirm('මෙම භාණ්ඩය මකා දැමීමට අවශ්‍ය බව සහතිකද?')) return;
  const db = window.DB || {};
  db.products = (db.products || []).filter(p => p.id !== id);

  if(window.FB && window.FB.fbDelete){
    await window.FB.fbDelete(window.FB.COL.products, id);
  }
  if(typeof saveDB === 'function') saveDB();

  toast('මකා දමන ලදී');
  render();
}

window.pgInventory = pgInventory;
window.setInvFilter = setInvFilter;
window.clearInvSearch = clearInvSearch;
window.getFilteredInventory = getFilteredInventory;
window.updateInvCounts = updateInvCounts;
window.renderInvList = renderInvList;
window.renderInvCard = renderInvCard;
window.viewProductDetail = viewProductDetail;
window.renderInvPagination = renderInvPagination;
window.invGoToPage = invGoToPage;
window.editProduct = editProduct;
window.saveProduct = saveProduct;
window.delProduct = delProduct;
