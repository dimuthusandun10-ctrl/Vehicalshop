/* =========================================================
   js/pages/billing.js - POS Billing Screen, Vehicle Search & Checkout
   ========================================================= */

let searchMode = 'text'; // 'text' | 'vehicle' | 'oem'
window._vehicleFilter = { brand:'', chassis:'', engine:'', year:'' };
window._shownCrossSellFor = window._shownCrossSellFor || new Set();

state.posPage = state.posPage || 1;
state.posSort = state.posSort || 'default';
const PER_PAGE = 20;

var checkoutState = window.checkoutState = window.checkoutState || {
  custId: '',
  method: 'cash',
  originalTotal: 0,
  total: 0,
  isRounded: false,
  received: 0,
  cardRef: '',
  notes: '',
  orderNo: ''
};

function pgBilling(){
  const db = DB || {};
  const cats = [...new Set((db.products || []).map(p=>p.cat))];
  const customers = db.customers || [];
  const activeShift = (typeof Shift !== 'undefined' && state.user) ? Shift.getActive(state.user.id) : null;

  return `
  ${!activeShift ? `
  <div class="shift-required-banner">
    <span>🔒 බිල්පත් නිකුත් කිරීමට පෙර Shift එකක් අරඹන්න</span>
    <button class="btn btn-sm btn-primary" onclick="openShiftModal()">
      🔓 දැන්ම අරඹන්න
    </button>
  </div>` : ''}
  <div class="pos ${!activeShift ? 'pos-locked' : ''}">
    <div class="pos-left">
      <div class="pos-tools" style="flex-direction:column;align-items:stretch;gap:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <!-- Search mode tabs -->
          <div class="range-tabs search-tabs">
            <button class="${searchMode==='text'?'active':''}" data-mode="text" onclick="switchSearchMode('text')">🔍 සාමාන්‍ය (Text)</button>
            <button class="${searchMode==='vehicle'?'active':''}" data-mode="vehicle" onclick="switchSearchMode('vehicle')">🚗 වාහනය (Vehicle)</button>
            <button class="${searchMode==='oem'?'active':''}" data-mode="oem" onclick="switchSearchMode('oem')">🔢 OEM අංකය (Code)</button>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <select onchange="state.catFilter=this.value;state.posPage=1;renderGrid()" style="width:160px;">
              <option value="all">සියලු කාණ්ඩ</option>
              ${cats.map(c=>`<option value="${c}" ${state.catFilter===c?'selected':''}>${c}</option>`).join('')}
            </select>
            <select id="posSort" onchange="setSortOrder(this.value)" style="width:160px;">
              <option value="default" ${(state.posSort||'default')==='default'?'selected':''}>පෙළගැස්ම · Default</option>
              <option value="name-asc" ${state.posSort==='name-asc'?'selected':''}>නම (A → Z)</option>
              <option value="name-desc" ${state.posSort==='name-desc'?'selected':''}>නම (Z → A)</option>
              <option value="price-asc" ${state.posSort==='price-asc'?'selected':''}>මිල (අඩු → වැඩි)</option>
              <option value="price-desc" ${state.posSort==='price-desc'?'selected':''}>මිල (වැඩි → අඩු)</option>
              <option value="stock-asc" ${state.posSort==='stock-asc'?'selected':''}>තොග (අඩු → වැඩි)</option>
              <option value="stock-desc" ${state.posSort==='stock-desc'?'selected':''}>තොග (වැඩි → අඩු)</option>
              <option value="code-asc" ${state.posSort==='code-asc'?'selected':''}>කේතය (A → Z)</option>
            </select>
          </div>
        </div>

        <div id="searchControls">
          ${renderSearchControlsHtml()}
        </div>
      </div>
      <div class="prod-grid-wrap">
        <div class="prod-grid" id="prodGrid"></div>
      </div>
      <div class="prod-pagination" id="prodPagination"></div>
    </div>

    <div class="pos-right">
      <div class="cart-header">
        <div style="display:flex;align-items:center;gap:8px">
          <h3 style="font-size:14px;margin:0">🛒 වත්මන් බිල</h3>
          <span style="font-size:10.5px;color:var(--muted)" id="cartCount">භාණ්ඩ 0</span>
        </div>
        <div class="cart-actions">
          <button class="btn btn-sm" onclick="holdBill()" title="ඉදිරියට තබන්න (Stock Lock)">⏸️ Hold</button>
          <button class="btn btn-sm btn-red" onclick="clearCart()" title="හිස් කරන්න (F8)">🗑️</button>
        </div>
      </div>
      <div class="cart-customer">
        <select id="cartCustomer" onchange="state.cartCustomer=this.value">
          <option value="" ${!state.cartCustomer?'selected':''}>👤 වෝක්-ඉන් (Walk-in)</option>
          ${customers.map(c=>`<option value="${c.id}" ${state.cartCustomer===c.id?'selected':''}>${esc(c.name)} — ${esc(c.vehicle||c.phone)}</option>`).join('')}
        </select>
      </div>
      <div class="cart-items" id="cartItems"></div>
      <div class="cart-sum" id="cartSum"></div>
    </div>
  </div>`;
}

function renderSearchControlsHtml(){
  if(searchMode === 'text'){
    return `
      <div style="position:relative; flex:1;">
        <input id="posSearch" placeholder="🔍 භාණ්ඩය සොයන්න (නම / කේතය / OEM / වාහන මාදිලිය)... [F2]"
               value="${esc(state.search)}"
               oninput="state.search=this.value;state.posPage=1;renderGrid()"
               onkeydown="if(event.key==='Enter')handleBarcodeScan(this.value)"
               style="padding-left:35px;padding-right:38px;">
        <span style="position:absolute; left:12px; top:10px; color:var(--muted); font-size:16px; pointer-events:none;">🔍</span>
        <span style="position:absolute; right:12px; top:10px; color:var(--muted); font-size:16px; cursor:pointer;" title="බාර්කෝඩ් ස්කෑනරය (F2)" onclick="focusSearch()">📷</span>
      </div>`;
  } else if(searchMode === 'vehicle'){
    const vf = window._vehicleFilter;
    const db = DB || {};
    const defaultBrands = ['Toyota', 'Nissan', 'Honda', 'Suzuki', 'Mitsubishi', 'Mazda'];
    const prodBrands = (db.products || []).map(p => p.brand).filter(Boolean);
    const brands = [...new Set([...defaultBrands, ...prodBrands])].sort();

    return `
      <div class="vehicle-filter-container">
        <div class="vehicle-filter-row">
          <select id="vBrand" onchange="window._vehicleFilter.brand=this.value;state.posPage=1;renderVehicleSearch()" style="width:140px">
            <option value="">වෙළඳ නාමය ▼</option>
            ${brands.map(b => `<option value="${esc(b)}" ${vf.brand===b?'selected':''}>${esc(b)}</option>`).join('')}
          </select>
          <input id="vChassis" placeholder="Chassis (උදා: NZE141)" value="${esc(vf.chassis)}"
                 oninput="this.value=this.value.toUpperCase();window._vehicleFilter.chassis=this.value.trim();state.posPage=1;renderVehicleSearch()" style="width:150px">
          <input id="vEngine" placeholder="Engine (උදා: 1NZ)" value="${esc(vf.engine)}"
                 oninput="this.value=this.value.toUpperCase();window._vehicleFilter.engine=this.value.trim();state.posPage=1;renderVehicleSearch()" style="width:130px">
          <input id="vYear" type="number" placeholder="වර්ෂය (Year)" value="${esc(vf.year)}"
                 oninput="window._vehicleFilter.year=this.value.trim();state.posPage=1;renderVehicleSearch()" style="width:105px">
          <button class="btn btn-sm" onclick="clearVehicleSearch()">✕ Clear</button>
        </div>
        <div class="vehicle-results-bar">
          <span id="vMatchBadge" class="vehicle-match-badge">🎯 සොයමින්...</span>
        </div>
      </div>`;
  } else if(searchMode === 'oem'){
    return `
      <div style="position:relative; flex:1;">
        <input id="posSearchOem" placeholder="🔢 OEM අංකය හෝ Alternate Part No (උදා: 04465 / AN-688)... [Enter=Add]"
               value="${esc(state.search)}"
               oninput="state.search=this.value;state.posPage=1;renderGrid()"
               onkeydown="if(event.key==='Enter')handleOemScan(this.value)"
               style="padding-left:35px">
        <span style="position:absolute; left:12px; top:10px; color:var(--muted); font-size:16px; pointer-events:none;">🔢</span>
      </div>`;
  }
}

function switchSearchMode(mode){
  searchMode = mode;
  state.search = '';
  state.posPage = 1;
  const c = $('#searchControls');
  if(c) c.innerHTML = renderSearchControlsHtml();
  $$('.search-tabs button').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-mode') === mode);
  });
  renderGrid();
  if(mode === 'text') setTimeout(focusSearch, 50);
  else if(mode === 'oem') setTimeout(() => $('#posSearchOem')?.focus(), 50);
}

function clearVehicleSearch(){
  window._vehicleFilter = { brand:'', chassis:'', engine:'', year:'' };
  state.posPage = 1;
  const c = $('#searchControls');
  if(c) c.innerHTML = renderSearchControlsHtml();
  renderGrid();
}

function renderVehicleSearch(){
  state.posPage = 1;
  renderGrid();
}

function handleBarcodeScan(val){
  const q = (val || '').trim().toLowerCase();
  if(!q) return;
  const db = DB || {};
  const exact = (db.products || []).find(p =>
    (p.code || '').toLowerCase() === q ||
    (p.oemNo || '').toLowerCase() === q ||
    (p.barcode || '').toLowerCase() === q
  );
  if(exact){
    addToCart(exact.id);
    state.search = '';
    const inp = $('#posSearch');
    if(inp) inp.value = '';
    renderGrid();
  }
}

function handleOemScan(val){
  const q = (val || '').trim().toLowerCase();
  if(!q) return;
  const db = DB || {};
  const exact = (db.products || []).find(p =>
    (p.oemNo || '').toLowerCase() === q ||
    (Array.isArray(p.altNos) && p.altNos.some(a => (a || '').toLowerCase() === q))
  );
  const match = exact || (db.products || []).find(p =>
    (p.oemNo || '').toLowerCase().includes(q) ||
    (Array.isArray(p.altNos) && p.altNos.some(a => (a || '').toLowerCase().includes(q)))
  );
  if(match){
    addToCart(match.id);
    state.search = '';
    const inp = $('#posSearchOem');
    if(inp) inp.value = '';
    renderGrid();
    toast(`${match.name} එකතු කළා ✅`);
  } else {
    toast('OEM අංකයට ගැලපෙන භාණ්ඩයක් හමු නොවීය', 'warn');
  }
}

function applySorting(list){
  const sorted = [...list];
  switch(state.posSort){
    case 'name-asc':
      sorted.sort((a,b) => (a.name || '').localeCompare(b.name || '', 'si'));
      break;
    case 'name-desc':
      sorted.sort((a,b) => (b.name || '').localeCompare(a.name || '', 'si'));
      break;
    case 'price-asc':
      sorted.sort((a,b) => (a.price || 0) - (b.price || 0));
      break;
    case 'price-desc':
      sorted.sort((a,b) => (b.price || 0) - (a.price || 0));
      break;
    case 'stock-asc':
      sorted.sort((a,b) => (a.qty || 0) - (b.qty || 0));
      break;
    case 'stock-desc':
      sorted.sort((a,b) => (b.qty || 0) - (a.qty || 0));
      break;
    case 'code-asc':
      sorted.sort((a,b) => (a.code || '').localeCompare(b.code || ''));
      break;
    default:
      // default: no sort, seed order
      break;
  }
  return sorted;
}

function renderGrid(){
  const db = DB || {};
  const q = (state.search || '').toLowerCase().trim();
  const vf = window._vehicleFilter || {};
  const cat = state.catFilter || 'all';

  // Calculate held quantities across all held bills
  const heldMap = {};
  (state.held || []).forEach(h => {
    (h.items || []).forEach(it => {
      heldMap[it.pid] = (heldMap[it.pid] || 0) + it.qty;
    });
  });

  const list = (db.products || []).filter(p => {
    // Category check
    if(cat !== 'all' && p.cat !== cat) return false;

    // Search filter based on mode
    if(searchMode === 'text'){
      if(!q) return true;
      const oemMatch = (p.oemNo || '').toLowerCase().includes(q);
      const altMatch = Array.isArray(p.altNos) && p.altNos.some(a => (a || '').toLowerCase().includes(q));
      return (p.name || '').toLowerCase().includes(q) ||
             (p.nameEn || '').toLowerCase().includes(q) ||
             (p.code || '').toLowerCase().includes(q) ||
             (p.model || '').toLowerCase().includes(q) ||
             (p.brand || '').toLowerCase().includes(q) ||
             oemMatch || altMatch;
    } else if(searchMode === 'oem'){
      if(!q) return true;
      const oemMatch = (p.oemNo || '').toLowerCase().includes(q);
      const altMatch = Array.isArray(p.altNos) && p.altNos.some(a => (a || '').toLowerCase().includes(q));
      return oemMatch || altMatch;
    } else if(searchMode === 'vehicle'){
      if(vf.brand && (p.brand || '').toLowerCase() !== vf.brand.toLowerCase()) return false;
      if(vf.chassis && !(p.chassis || []).some(c => (c || '').toUpperCase().includes(vf.chassis.toUpperCase()))) return false;
      if(vf.engine && !(p.engine || []).some(e => e.toUpperCase().includes(vf.engine.toUpperCase()))) return false;
      const yr = parseInt(vf.year);
      if(yr && (yr < (p.yearFrom || 1900) || yr > (p.yearTo || 2099))) return false;
      return true;
    }
    return true;
  });

  const badgeEl = $('#vMatchBadge');
  if(badgeEl){
    badgeEl.textContent = list.length ? `🎯 ${list.length} භාණ්ඩ හමු විය` : '⚠️ භාණ්ඩ හමු නොවීය';
    badgeEl.className = 'vehicle-match-badge ' + (list.length ? '' : 'empty');
  }

  const g = $('#prodGrid');
  if(!g) return;

  const activeShift = (typeof Shift !== 'undefined' && state.user) ? Shift.getActive(state.user.id) : null;
  const posEl = document.querySelector('.pos');
  if(posEl){
    posEl.classList.toggle('pos-locked', !activeShift);
  }

  // Apply sorting
  const sortedList = applySorting(list);

  // Pagination calculation
  const totalItems = sortedList.length;
  const totalPages = Math.ceil(totalItems / PER_PAGE) || 1;
  if(state.posPage > totalPages) state.posPage = totalPages;
  if(state.posPage < 1) state.posPage = 1;

  const start = (state.posPage - 1) * PER_PAGE;
  const end = start + PER_PAGE;
  const paginatedList = sortedList.slice(start, end);

  g.innerHTML = paginatedList.length ? paginatedList.map(p => {
    const heldQty = heldMap[p.id] || 0;
    const available = Math.max(0, p.qty - heldQty);
    const out = available <= 0;

    // Plain text stock formatting
    let stockText = `${available} ${p.unit || 'pcs'}`;
    let stockColor = 'var(--muted)';
    if(available === 0){
      stockText = 'අවසන්';
      stockColor = '#fca5a5';
    } else if(available <= 10){
      stockColor = '#fcd34d';
    }

    return `
    <div class="product-card-new ${out ? 'out-of-stock' : ''}" ${out ? '' : `onclick="addToCart('${p.id}')"`}>
      <div class="product-code">${esc(p.code)}</div>
      <button class="card-view-btn" type="button"
              onclick="event.stopPropagation(); showProductDetail('${p.id}')"
              title="විස්තර බලන්න">
        👁️
      </button>
      <div class="product-name-si">${esc(p.name)}</div>
      <div class="product-name-en">${esc(p.nameEn || '')}</div>
      <div class="product-meta">
        <span class="product-price">${money(p.price)}</span>
        <span class="product-stock" style="color:${stockColor}">${stockText}</span>
      </div>
    </div>`;
  }).join('') : `<div class="empty" style="grid-column:1/-1"><div class="e">${searchMode==='vehicle'?'🚗':searchMode==='oem'?'🔢':'🔍'}</div>${searchMode==='vehicle'?'භාණ්ඩ හමු නොවීය':'ගැලපෙන භාණ්ඩ හමු නොවීය'}</div>`;

  renderPagination(totalItems);
}

function renderPagination(totalItems){
  const el = $('#prodPagination');
  if(!el) return;

  if(!totalItems){
    el.innerHTML = `
      <div class="pg-info">පෙන්නුම් කරන්නේ 0-0 / මුළු 0</div>
      <div class="pg-controls"></div>`;
    return;
  }

  const totalPages = Math.ceil(totalItems / PER_PAGE) || 1;
  const curPage = Math.max(1, Math.min(state.posPage || 1, totalPages));
  const start = (curPage - 1) * PER_PAGE + 1;
  const end = Math.min(curPage * PER_PAGE, totalItems);

  // Show up to 5 page numbers (with ellipsis if more)
  let pages = [];
  if(totalPages <= 7){
    for(let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    let startPage = Math.max(2, curPage - 1);
    let endPage = Math.min(totalPages - 1, curPage + 1);

    if(curPage <= 3){
      startPage = 2;
      endPage = 4;
    } else if(curPage >= totalPages - 2){
      startPage = totalPages - 3;
      endPage = totalPages - 1;
    }

    if(startPage > 2) pages.push('...');
    for(let i = startPage; i <= endPage; i++) pages.push(i);
    if(endPage < totalPages - 1) pages.push('...');
    pages.push(totalPages);
  }

  el.innerHTML = `
    <div class="pg-info">පෙන්නුම් කරන්නේ ${start}-${end} / මුළු ${totalItems}</div>
    <div class="pg-controls">
      <button class="pg-btn" ${curPage === 1 ? 'disabled' : ''} onclick="goToPage(${curPage - 1})" title="කලින් පිටුව">◀</button>
      ${pages.map(p => {
        if(p === '...'){
          return `<span class="pg-btn ellipsis">...</span>`;
        }
        return `<button class="pg-btn ${p === curPage ? 'active' : ''}" onclick="goToPage(${p})">${p}</button>`;
      }).join('')}
      <button class="pg-btn" ${curPage === totalPages ? 'disabled' : ''} onclick="goToPage(${curPage + 1})" title="ඊළඟ පිටුව">▶</button>
    </div>
  `;
}

function goToPage(n){
  state.posPage = n;
  renderGrid();
  const wrap = document.querySelector('.prod-grid-wrap');
  if(wrap) wrap.scrollTop = 0;
}

function setSortOrder(order){
  state.posSort = order;
  state.posPage = 1;
  renderGrid();
}

function showProductDetail(pid){
  const db = DB || {};
  const p = db.getProd ? db.getProd(pid) : (db.products || []).find(x => x.id === pid);
  if(!p) return;

  const heldQty = (state.held || []).reduce((sum, h) => {
    const it = (h.items || []).find(x => x.pid === pid);
    return sum + (it ? it.qty : 0);
  }, 0);
  const available = Math.max(0, p.qty - heldQty);
  const out = available <= 0;

  let stockText = `${available} ${p.unit || 'pcs'}`;
  let stockColor = 'var(--muted)';
  if(available === 0){
    stockText = 'අවසන්';
    stockColor = '#fca5a5';
  } else if(available <= 10){
    stockColor = '#fcd34d';
  }

  // Build spec rows conditionally (skip empty/null/0)
  const rows = [];
  if(p.cat) rows.push({ label: '📦 කාණ්ඩය', val: esc(p.cat) });
  if(p.brand) rows.push({ label: '🏭 නිෂ්පාදකයා', val: esc(p.brand) });
  if(p.model) rows.push({ label: '🚗 වාහනය', val: esc(p.model) });
  if(p.oemNo) rows.push({ label: '🔢 OEM අංකය', val: esc(p.oemNo) });
  if(Array.isArray(p.altNos) && p.altNos.length > 0){
    rows.push({ label: '🔀 වෙනත් අංක', val: esc(p.altNos.join(', ')) });
  }
  if(Array.isArray(p.chassis) && p.chassis.length > 0){
    rows.push({ label: '🚙 Chassis', val: esc(p.chassis.join(', ')) });
  }
  if(Array.isArray(p.engine) && p.engine.length > 0){
    rows.push({ label: '⚙️ එන්ජිම', val: esc(p.engine.join(', ')) });
  }
  if(p.yearFrom || p.yearTo){
    rows.push({ label: '📅 වර්ෂය', val: `${p.yearFrom || '–'} – ${p.yearTo || '–'}` });
  }
  if(p.rack){
    rows.push({ label: '📍 රාක්කය', val: `${esc(p.rack)}${p.bin ? ' / ' + esc(p.bin) : ''}` });
  }
  if(p.warehouse){
    rows.push({ label: '🏭 ගබඩාව', val: esc(p.warehouse) });
  }
  if(p.warranty > 0){
    rows.push({ label: '🛡️ වගකීම', val: `${p.warranty} මාස` });
  }
  if(p.coreDeposit > 0){
    rows.push({ label: '🔋 Core Deposit', val: money(p.coreDeposit) });
  }

  const bodyHtml = `
  <div class="product-detail-body">
    <div class="pd-hero">
      <div class="pd-hero-name-si">${esc(p.name)}</div>
      <div class="pd-hero-name-en">${esc(p.nameEn || '')}</div>
      <span class="pd-hero-code">${esc(p.code)}</span>
      <div class="pd-hero-meta">
        <span class="pd-hero-price">${money(p.price)}</span>
        <span class="pd-hero-stock" style="color:${stockColor}">${stockText}</span>
      </div>
    </div>
    <div class="pd-section">
      ${rows.map(r => `
        <div class="pd-row">
          <span class="pd-row-label">${r.label}</span>
          <span class="pd-row-value">${r.val}</span>
        </div>
      `).join('')}
    </div>
  </div>`;

  const footerHtml = `
    <button type="button" class="btn" onclick="closeModal()">අවලංගු කරන්න</button>
    <button type="button" class="btn btn-primary" ${out ? 'disabled' : ''} onclick="addToCart('${p.id}'); closeModal();">
      ${out ? 'අවසන් (Out of stock)' : '🛒 එකතු කරන්න (Add to Cart)'}
    </button>`;

  openModal('🔧 සම්පූර්ණ විස්තර', 'Product Details', bodyHtml, footerHtml);
}

function addToCart(pid){
  if(typeof requireActiveShift === 'function' && !requireActiveShift('bill creation')) return;

  const db = DB || {};
  const p = db.getProd ? db.getProd(pid) : (db.products || []).find(x => x.id === pid);
  if(!p) return;

  // Calculate available stock minus held bills
  const heldQty = (state.held || []).reduce((sum, h) => {
    const it = (h.items || []).find(x => x.pid === pid);
    return sum + (it ? it.qty : 0);
  }, 0);

  const available = p.qty - heldQty;
  if(available <= 0){ toast('තොග අවසන් (Held බිල්පත් සඳහා වෙන් කර ඇත)!','err'); return; }

  const it = state.cart.find(c => c.pid === pid);
  if(it){
    if(it.qty >= available){ toast('පවතින තොග ප්‍රමාණය ඉක්මවයි','warn'); return; }
    it.qty++;
  } else {
    state.cart.push({
      pid: p.id,
      code: p.code,
      name: p.name,
      price: p.price,
      cost: p.cost || 0,
      rack: p.rack || '',
      bin: p.bin || '',
      oemNo: p.oemNo || '',
      warranty: p.warranty || 0,
      hasSerial: !!p.hasSerial,
      coreDeposit: Number(p.coreDeposit) || 0,
      useCoreExchange: false,
      qty: 1
    });
  }
  renderCart();
  checkCrossSell(p);
}

/* Feature 1.6: Cross-Sell Suggestions */
function checkCrossSell(p){
  if(!p || !Array.isArray(p.crossSell) || !p.crossSell.length) return;
  if(window._shownCrossSellFor.has(p.id)) return;

  const db = DB || {};
  const currentCartCodes = state.cart.map(c => (c.code || '').toUpperCase());
  const currentCartIds = state.cart.map(c => c.pid);

  // Find cross-sell products not in cart and in stock
  const suggestions = (db.products || []).filter(prod => {
    if(currentCartCodes.includes((prod.code || '').toUpperCase()) || currentCartIds.includes(prod.id)) return false;
    if(prod.qty <= 0) return false;
    return p.crossSell.some(csCode =>
      csCode.toUpperCase() === (prod.code || '').toUpperCase() ||
      csCode.toUpperCase() === prod.id.toUpperCase()
    );
  });

  if(!suggestions.length) return;

  window._shownCrossSellFor.add(p.id);
  showCrossSellToast(suggestions, p);
}

function showCrossSellToast(suggestions, sourceProd){
  const old = $('#crossSellToast');
  if(old) old.remove();

  const toastEl = document.createElement('div');
  toastEl.id = 'crossSellToast';
  toastEl.className = 'cross-sell-toast';
  toastEl.innerHTML = `
    <div class="cross-sell-header">
      <span>💡 මේකත් එක්ක මේවා යනවා:</span>
      <button class="close-x" style="font-size:16px;padding:0 4px" onclick="this.closest('#crossSellToast').remove()">✕</button>
    </div>
    <div class="cross-sell-items">
      ${suggestions.map(s => `
        <div class="cross-sell-item-row" id="cs-row-${s.id}">
          <div>
            <b>• ${esc(s.name)}</b>
            <span style="color:var(--primary);font-size:11.5px;margin-left:4px">(${money(s.price)})</span>
          </div>
          <button class="cross-sell-btn" onclick="addCrossSellItem('${s.id}')">+ එකතු කරන්න</button>
        </div>
      `).join('')}
    </div>
    <div class="cross-sell-progress"><div class="cross-sell-bar"></div></div>
  `;

  document.body.appendChild(toastEl);

  const timer = setTimeout(() => {
    if(toastEl.parentNode) {
      toastEl.style.opacity = '0';
      toastEl.style.transform = 'translateY(20px)';
      toastEl.style.transition = '.3s';
      setTimeout(() => toastEl.remove(), 300);
    }
  }, 8000);

  toastEl._timer = timer;
}

function addCrossSellItem(pid){
  addToCart(pid);
  const row = $(`#cs-row-${pid}`);
  if(row){
    row.innerHTML = `<span style="color:var(--green);font-size:11.5px">✅ එකතු කළා</span>`;
    setTimeout(() => {
      const parent = $(`#crossSellToast .cross-sell-items`);
      if(parent && !parent.querySelector('.cross-sell-btn')){
        $('#crossSellToast')?.remove();
      }
    }, 1200);
  }
}

function changeQty(pid, d){
  const it = state.cart.find(c => c.pid === pid); if(!it) return;
  const db = DB || {};
  const p = db.getProd ? db.getProd(pid) : (db.products || []).find(x => x.id === pid);
  it.qty += d;
  if(it.qty > p.qty){ it.qty = p.qty; toast('උපරිම තොගය','warn'); }
  if(it.qty <= 0) state.cart = state.cart.filter(c => c.pid !== pid);
  renderCart();
}

function setQty(pid, v){
  const it = state.cart.find(c => c.pid === pid); if(!it) return;
  const db = DB || {};
  const p = db.getProd ? db.getProd(pid) : (db.products || []).find(x => x.id === pid);
  let q = parseInt(v) || 0;
  if(q > p.qty) q = p.qty;
  if(q <= 0) state.cart = state.cart.filter(c => c.pid !== pid);
  else it.qty = q;
  renderCart();
}

function toggleCoreExchange(pid){
  const it = state.cart.find(c => c.pid === pid);
  if(it){
    it.useCoreExchange = !it.useCoreExchange;
    renderCart();
  }
}

function removeItem(pid){
  state.cart = state.cart.filter(c => c.pid !== pid);
  renderCart();
}

function clearCart(){
  if(state.cart.length && !confirm('බිල හිස් කරන්නද? (Clear Cart)')) return;
  state.cart = [];
  window._shownCrossSellFor = new Set();
  const csToast = $('#crossSellToast');
  if(csToast) csToast.remove();
  renderCart();
}

function calcTotals(){
  const sub = state.cart.reduce((a,c) => a + c.price * c.qty, 0);

  // Core deposit exchanges (e.g. old dead battery trade-in deduction)
  const coreDeduction = state.cart.reduce((a,c) => {
    const prod = (DB.getProd ? DB.getProd(c.pid) : null) || (DB.products || []).find(p => p.id === c.pid);
    const coreDeposit = Number(prod ? prod.coreDeposit : c.coreDeposit) || 0;
    return a + (c.useCoreExchange && coreDeposit > 0 ? coreDeposit * c.qty : 0);
  }, 0);

  let disc = 0;
  const val = parseFloat(window._discVal) || 0;
  if(window._discType === 'fixed') {
    disc = val;
  } else {
    disc = sub * (val / 100);
  }
  disc = Math.min(disc, sub);

  const taxableSub = Math.max(0, sub - disc - coreDeduction);
  const tax = taxableSub * ((DB?.shop?.tax || 0) / 100);
  const total = Math.max(0, taxableSub + tax);

  return { sub, disc, coreDeduction, tax, total };
}

function renderCart(){
  const box = $('#cartItems'); if(!box) return;
  const cc = $('#cartCount');
  if(cc) cc.textContent = 'භාණ්ඩ ' + state.cart.reduce((a,c) => a + c.qty, 0);

  box.innerHTML = state.cart.length ? state.cart.map(c => {
    const prod = (DB.getProd ? DB.getProd(c.pid) : null) || (DB.products || []).find(p => p.id === c.pid);
    const coreDeposit = Number(prod ? prod.coreDeposit : c.coreDeposit) || 0;
    const hasCore = coreDeposit > 0;

    return `
    <div class="cart-row">
      <div class="ci">
        <b>${esc(c.name)}</b>
        <div style="display:flex;align-items:center;gap:4px;margin-top:2px">
          <small>${c.code} · </small>
          ${hasPermission('price-override') ? `
            <input type="number" min="0" step="any" value="${c.price}" title="මිල වෙනස් කරන්න (Price Override)"
              style="width:75px;padding:1px 4px;font-size:11px;background:#0f172a;border:1px solid var(--line);border-radius:4px;color:var(--txt)"
              onchange="overrideCartItemPrice('${c.pid}', this.value)">
          ` : `<small>${money(c.price)}</small>`}
        </div>
        ${c.oemNo ? `<div class="cart-item-oem">OEM: ${esc(c.oemNo)}</div>` : ''}
        ${c.rack ? `<span class="cart-rack-pill">📍 ${esc(c.rack)}${c.bin?' / '+esc(c.bin):''}</span>` : ''}
        ${hasCore ? `
          <label class="core-deposit-row">
            <input type="checkbox" ${c.useCoreExchange?'checked':''} onchange="toggleCoreExchange('${c.pid}')">
            <span>🔋 පරණ කොටස භාරගත්තා <span class="core-amt">(−රු. ${num(coreDeposit)})</span></span>
          </label>` : ''}
      </div>
      <div class="qty-box">
        <button onclick="changeQty('${c.pid}',-1)">−</button>
        <input type="number" value="${c.qty}" min="1" onchange="setQty('${c.pid}',this.value)">
        <button onclick="changeQty('${c.pid}',1)">+</button>
      </div>
      <div style="text-align:right;min-width:80px">
        <b style="color:var(--primary);font-size:13px">${money(c.price*c.qty)}</b>
        <div><button class="btn btn-sm btn-red" style="padding:1px 6px;margin-top:3px" onclick="removeItem('${c.pid}')">✕</button></div>
      </div>
    </div>`;
  }).join('')
    : (!((typeof Shift !== 'undefined' && state.user) ? Shift.getActive(state.user.id) : null)
      ? '<div class="empty"><div class="e">🔒</div>Shift එකක් ආරම්භ කර නැත<br><small>බිල්පත් නිකුත් කිරීමට පළමුව Shift එකක් අරඹන්න</small></div>'
      : '<div class="empty"><div class="e">🛒</div>භාණ්ඩ එකතු කර නැත<br><small>වම් පසින් භාණ්ඩයක් තෝරන්න</small></div>');

  const {sub, disc, coreDeduction, tax, total} = calcTotals();
  const sum = $('#cartSum');
  if(sum) sum.innerHTML = `
    <div class="srow"><span>උප එකතුව / Subtotal</span><b>${money(sub)}</b></div>
    ${coreDeduction > 0 ? `<div class="srow"><span>🔋 පරණ කොටස් අඩුකිරීම</span><b style="color:var(--green)">− ${money(coreDeduction)}</b></div>` : ''}
    ${disc > 0 ? `<div class="srow"><span>වට්ටම / Discount</span><b style="color:var(--red)">− ${money(disc)}</b></div>` : ''}
    ${tax > 0 ? `<div class="srow"><span>බදු / Tax (${DB?.shop?.tax}%)</span><b>${money(tax)}</b></div>` : ''}
    <div class="srow total" style="font-size:24px"><span>මුළු එකතුව</span><span>${money(total)}</span></div>
    ${hasPermission('discounts') ? `
    <div style="display:flex;gap:7px;margin-top:10px;align-items:center">
      <div class="discount-toggle" style="flex:1">
        <button type="button" class="${(window._discType||'percent')==='percent'?'active':''}" onclick="window._discType='percent';renderCart()">% ප්‍රතිශතය</button>
        <button type="button" class="${window._discType==='fixed'?'active':''}" onclick="window._discType='fixed';renderCart()">රු. ස්ථාවර</button>
      </div>
      <input id="discVal" type="number" placeholder="වට්ටම" min="0" style="width:105px;padding:7px;font-size:13px"
             value="${window._discVal||''}" oninput="window._discVal=this.value;renderCart()">
    </div>` : ''}
    <button class="btn btn-green" style="width:100%;margin-top:10px;padding:12px;font-size:15px;font-weight:700" ${state.cart.length?'':'disabled'} onclick="openCheckout()">
      💳 ගෙවීමට (F4) → ${money(total)}
    </button>
    ${state.held.length?`<button class="btn btn-sm btn-blue" style="width:100%;margin-top:7px" onclick="showHeld()">⏸️ රඳවා ඇති බිල්පත් (${state.held.length})</button>`:''}`;
}

function overrideCartItemPrice(pid, val){
  if(!hasPermission('price-override')){
    toast('මිල වෙනස් කිරීමට ඔබට අවසර නැත', 'err');
    return;
  }
  const it = state.cart.find(c => c.pid === pid);
  const p = parseFloat(val);
  if(it && !isNaN(p) && p >= 0){
    it.price = p;
    renderCart();
  }
}

/* ⭐ Held Bills with Stock Reservation */
function holdBill(){
  if(!state.cart.length) return;

  const db = DB || {};
  // Verify stock is still available before holding
  for(const item of state.cart){
    const p = db.getProd ? db.getProd(item.pid) : (db.products || []).find(x => x.id === item.pid);
    const existingHolds = (state.held || []).reduce((sum, h) => {
      const it = (h.items || []).find(x => x.pid === item.pid);
      return sum + (it ? it.qty : 0);
    }, 0);
    if(p && (p.qty - existingHolds) < item.qty){
      toast(`${p.name} සඳහා ප්‍රමාණවත් තොගයක් නොමැත`, 'err');
      return;
    }
  }

  state.held.push({
    id: uid('H'),
    items: JSON.parse(JSON.stringify(state.cart)),
    time: new Date().toLocaleTimeString(),
    heldAt: Date.now(),
    customerId: $('#cartCustomer')?.value || state.cartCustomer || null
  });

  state.cart = [];
  window._shownCrossSellFor = new Set();
  const csToast = $('#crossSellToast');
  if(csToast) csToast.remove();

  renderCart();
  renderGrid(); // Refresh grid so reserved stock shows immediately
  toast('බිල රඳවා තබන ලදී — තොගය වෙන් කර ඇත ✅');
}

function showHeld(){
  if(!state.held.length) return;
  openModal('⏸️ රඳවා ඇති බිල්පත්','Held Bills (Stock Reserved)',
    state.held.map((h,i)=>`<div class="cart-row"><div class="ci"><b>බිල් #${i+1}</b>
      <small>${h.items.length} භාණ්ඩ · ${h.time}</small></div>
      <button class="btn btn-sm btn-primary" onclick="recall(${i})">අහුරන්න</button>
      <button class="btn btn-sm btn-red" onclick="state.held.splice(${i},1);renderGrid();showHeld()">✕</button></div>`).join('')
    , '<button class="btn" onclick="closeModal()">වසන්න</button>');
}

function recall(i){
  state.cart = state.held[i].items;
  if(state.held[i].customerId){
    state.cartCustomer = state.held[i].customerId;
  }
  state.held.splice(i,1);
  closeModal();
  renderCart();
  renderGrid();
  toast('බිල නැවත ලබාගත්තා');
}

/* Smart Denominations Generator */
function getSmartDenominations(total){
  const denoms = [];
  denoms.push(total); // Exact amount

  const candidates = [];
  if(total <= 100){
    candidates.push(Math.ceil(total / 10) * 10);
    candidates.push(Math.ceil(total / 20) * 20);
    candidates.push(Math.ceil(total / 50) * 50);
    candidates.push(100);
  } else if(total <= 1000){
    candidates.push(Math.ceil(total / 50) * 50);
    candidates.push(Math.ceil(total / 100) * 100);
    candidates.push(Math.ceil(total / 500) * 500);
    candidates.push(1000);
  } else if(total <= 5000){
    candidates.push(Math.ceil(total / 100) * 100);
    candidates.push(Math.ceil(total / 500) * 500);
    candidates.push(Math.ceil(total / 100) * 1000);
    candidates.push(Math.ceil(total / 2000) * 2000);
    candidates.push(5000);
  } else {
    candidates.push(Math.ceil(total / 500) * 500);
    candidates.push(Math.ceil(total / 1000) * 1000);
    candidates.push(Math.ceil(total / 5000) * 5000);
    candidates.push(Math.ceil(total / 10000) * 10000);
  }

  const higher = [...new Set(candidates)].filter(v => v > total).sort((a,b)=>a-b);
  for(const h of higher){
    if(denoms.length >= 4) break;
    denoms.push(h);
  }
  while(denoms.length < 4){
    const last = denoms[denoms.length - 1];
    denoms.push(last + (total < 1000 ? 100 : 500));
  }
  return denoms;
}

/* =====================================================
   CHECKOUT MODAL
   ===================================================== */
function getRoundedTotal(amt){
  return Math.ceil(Number(amt || 0) / 10) * 10;
}

function removeCheckoutKeyHandler(){
  if(window._checkoutKeyHandler){
    window.removeEventListener('keydown', window._checkoutKeyHandler);
    window._checkoutKeyHandler = null;
  }
}

function checkoutKeyHandler(e){
  if(!$('#modalRoot')?.children?.length){
    removeCheckoutKeyHandler();
    return;
  }
  if(e.key === 'Escape'){
    e.preventDefault();
    closeModal();
    return;
  }
  if(e.key === 'F9'){
    e.preventDefault();
    completeSale();
    return;
  }
  if(e.key === 'Enter' && e.target && e.target.id === 'coPaid'){
    e.preventDefault();
    completeSale();
    return;
  }
}

function renderCreditSectionHtml(){
  const db = DB || {};
  const cust = checkoutState.custId ? (db.getCustomer ? db.getCustomer(checkoutState.custId) : (db.customers||[]).find(c=>c.id===checkoutState.custId)) : null;
  const total = checkoutState.total;

  if(!cust){
    return `
      <div class="credit-warning">
        <span style="font-size:22px">⚠️</span>
        <div>
          <b style="display:block">ණය සඳහා පාරිභෝගිකයෙකු තෝරන්න</b>
          <div style="font-size:11.5px;opacity:0.85">Please select a registered customer to issue store credit</div>
        </div>
      </div>
    `;
  }

  const creditInfo = (typeof customerCreditBalance === 'function') ? customerCreditBalance(cust.id) : { balance: 0 };
  const limit = cust.creditLimit || 50000;
  const avail = Math.max(0, limit - creditInfo.balance);
  const newBalance = creditInfo.balance + total;
  const isOver = newBalance > limit;

  return `
    <div class="credit-info-block">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <b>👤 ${esc(cust.name)}</b>
        <span class="pill ${isOver ? 'bad' : 'warn'}">ණය ගිණුම (Store Credit)</span>
      </div>
      <div class="credit-info-row">
        <span>පවතින ණය ශේෂය (Current Balance):</span>
        <b style="color:${creditInfo.balance > 0 ? 'var(--red)' : 'var(--green)'}">${money(creditInfo.balance)}</b>
      </div>
      <div class="credit-info-row">
        <span>ණය සීමාව (Credit Limit):</span>
        <b>${money(limit)}</b>
      </div>
      <div class="credit-info-row">
        <span>ලබාගත හැකි ශේෂය (Available Credit):</span>
        <b style="color:var(--blue)">${money(avail)}</b>
      </div>
      <div class="credit-info-row" style="border-top:1px dashed var(--line);padding-top:6px;margin-top:2px">
        <span>මෙම බිලෙන් පසු මුළු ණය:</span>
        <b style="color:${isOver ? 'var(--red)' : 'var(--primary)'}">+ ${money(newBalance)}</b>
      </div>
      ${isOver ? `
        <div style="background:rgba(239,68,68,0.18);border-radius:6px;padding:8px;color:#fca5a5;font-size:11.5px;text-align:center;font-weight:600;margin-top:4px">
          ⚠️ අවධානය: මෙම බිලෙන් ණය සීමාව ඉක්මවයි! (Exceeds Credit Limit)
        </div>
      ` : ''}
    </div>
  `;
}

function openCheckout(){
  if(!hasPermission('billing')){
    toast('ඔබට බිල්පත් නිකුත් කිරීමට අවසර නැත (Billing permission required)', 'err');
    return;
  }
  if(typeof requireActiveShift === 'function' && !requireActiveShift('checkout')) return;

  if(!state.cart.length){
    toast('බිලට භාණ්ඩ එකතු කර නැත (Cart empty)','warn');
    return;
  }
  const db = DB || {};
  const {sub, disc, coreDeduction, tax, total} = calcTotals();
  const cartCust = $('#cartCustomer') ? $('#cartCustomer').value : state.cartCustomer;
  checkoutState.custId = cartCust || '';
  checkoutState.method = 'cash';
  checkoutState.originalTotal = total;
  checkoutState.total = total;
  checkoutState.isRounded = false;
  checkoutState.received = total;
  checkoutState.cardRef = '';
  checkoutState.notes = '';
  checkoutState.orderNo = 'INV-' + pad(db?.counters?.invoice || 1);

  const printReceipt = localStorage.getItem('pos.printReceipt') !== 'false';
  const customers = db?.customers || [];

  // Check for serialized items
  const serialItems = state.cart.filter(item => {
    const p = db.getProd ? db.getProd(item.pid) : (db.products || []).find(x => x.id === item.pid);
    return (p && p.hasSerial) || item.hasSerial;
  });

  const serialsHtml = serialItems.length ? `
    <div class="checkout-serials-card">
      <div class="checkout-serials-title">
        <span>🛡️ Serial Numbers Required</span>
      </div>
      ${serialItems.map(item => {
        const p = db.getProd ? db.getProd(item.pid) : (db.products || []).find(x => x.id === item.pid);
        const prefix = p?.brand ? (p.brand.slice(0, 3).toUpperCase() + '-' + new Date().getFullYear() + '-') : 'SN-';
        const rows = [];
        for(let u = 0; u < item.qty; u++){
          rows.push(`
            <div class="serial-input-row">
              <span style="font-size:11px;color:var(--muted);width:36px">#${u+1}:</span>
              <input class="co-serial-inp" data-pid="${item.pid}" data-idx="${u}"
                     placeholder="S/N: [${prefix}____]" autocomplete="off"
                     oninput="this.value=this.value.toUpperCase()">
            </div>
          `);
        }
        return `
          <div class="serial-input-group">
            <div style="font-size:12.5px;font-weight:600;display:flex;justify-content:space-between">
              <span>${esc(item.name)} × ${item.qty}</span>
              ${p?.warranty ? `<span class="pill ok" style="font-size:9.5px">🛡️ ${p.warranty}m වගකීම</span>` : ''}
            </div>
            ${rows.join('')}
          </div>
        `;
      }).join('')}
    </div>
  ` : '';

  const coreDepositSummaryHtml = coreDeduction > 0 ? `
    <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:12.5px">
      <div style="display:flex;justify-content:space-between;color:var(--muted)">
        <span>උප එකතුව:</span>
        <b>${money(sub)}</b>
      </div>
      <div style="display:flex;justify-content:space-between;color:#34d399;font-weight:700;margin:3px 0">
        <span>🔋 Core Deposit:</span>
        <span>− ${money(coreDeduction)}</span>
      </div>
      <div style="border-top:1px dashed var(--line);margin-top:4px;padding-top:4px;display:flex;justify-content:space-between;font-weight:700">
        <span>මුළු එකතුව:</span>
        <span style="color:var(--primary)">${money(total)}</span>
      </div>
    </div>
  ` : '';

  const bodyHtml = `
  <div class="checkout-modal">
    <!-- 1. TOTAL DUE BLOCK (Hero Section) -->
    <div class="total-hero">
      <div>
        <div class="total-hero-label-sin">💰 මුළු ගෙවිය යුතු මුදල</div>
        <div class="total-hero-label-en">Total Amount Due</div>
      </div>
      <div class="total-hero-amount">
        <span>${money(total)}</span>
      </div>
    </div>

    ${coreDepositSummaryHtml}

    <!-- 2. CUSTOMER SELECT ROW -->
    <div class="customer-select-row">
      <label>👤 පාරිභෝගිකයා <small>/ Customer</small></label>
      <select id="coCust" class="co-cust-select" onchange="onCustSelectChange(this.value)">
        <option value="" ${!checkoutState.custId ? 'selected' : ''}>👤 වෝක්-ඉන් (Walk-in)</option>
        ${customers.map(c => `
          <option value="${c.id}" ${checkoutState.custId === c.id ? 'selected' : ''}>
            ${esc(c.name)} — ${esc(c.vehicle || c.phone || '')}
          </option>
        `).join('')}
      </select>
    </div>

    <!-- SERIAL NUMBERS SECTION -->
    ${serialsHtml}

    <!-- 3. PAYMENT METHOD BUTTONS -->
    <div>
      <label class="section-label">💳 ගෙවීම් ක්‍රමය <small>/ Payment Method</small></label>
      <div class="method-grid">
        <button type="button" class="method-btn active" data-method="cash" onclick="selectMethod('cash')">
          <span class="method-icon">💵</span>
          <span class="method-sin">මුදල්</span>
          <span class="method-en">Cash</span>
        </button>
        <button type="button" class="method-btn" data-method="card" onclick="selectMethod('card')">
          <span class="method-icon">💳</span>
          <span class="method-sin">කාඩ්</span>
          <span class="method-en">Card</span>
        </button>
        <button type="button" class="method-btn" data-method="credit" onclick="selectMethod('credit')">
          <span class="method-icon">📝</span>
          <span class="method-sin">ණය</span>
          <span class="method-en">Credit</span>
        </button>
      </div>
    </div>

    <!-- 4. INVOICE NOTES FIELD -->
    <div class="notes-row">
      <label class="section-label">📝 සටහන <small>/ Notes (optional)</small></label>
      <input id="coNotes" placeholder="උදා: NZE141 ට fit කර බලන්න" autocomplete="off">
    </div>

    <!-- 5. CASH RECEIVED SECTION -->
    <div id="cashSection" class="cash-section">
      <div class="roundoff-row">
        <label class="section-label" style="margin:0">💵 ලැබුණු මුදල <small>/ Cash Received</small></label>
        <label class="roundoff-toggle">
          <input type="checkbox" id="coRound" onchange="toggleRoundOff(this.checked)">
          <span>මුදල වට කරන්න (Round to Rs. 10)</span>
        </label>
      </div>
      <div class="input-with-prefix">
        <span class="prefix">රු.</span>
        <input id="coPaid" type="number" step="0.01" value="${total.toFixed(2)}" oninput="updateChangeBox()">
      </div>
      <button type="button" class="quick-exact-btn" onclick="setPaidExact()">නිශ්චිත (Exact)</button>
      <div class="quick-add-grid">
        <button type="button" class="quick-add-btn" onclick="addToPaid(50)">+50</button>
        <button type="button" class="quick-add-btn" onclick="addToPaid(100)">+100</button>
        <button type="button" class="quick-add-btn" onclick="addToPaid(500)">+500</button>
        <button type="button" class="quick-add-btn" onclick="addToPaid(1000)">+1000</button>
      </div>
      <div id="coChangeBox" class="change-due-box positive">
        <span class="change-label">✅ ඉතිරිය <small style="color:inherit;opacity:0.8">/ Change Due</small></span>
        <span class="change-amount">රු. 0.00</span>
      </div>
    </div>

    <!-- 6. CARD SECTION (Hidden by default) -->
    <div id="cardSection" style="display:none">
      <div class="card-info-block">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <span style="font-size:22px">💳</span>
          <div>
            <b style="font-size:13.5px">POS Card Terminal Ready</b>
            <div style="font-size:11.5px;color:var(--muted)">කාඩ්පත් මැෂිමෙන් මුදල අය කර Ref # ඇතුළත් කරන්න</div>
          </div>
          <span class="pill ok" style="margin-left:auto">🟢 Ready</span>
        </div>
        <div style="margin-top:10px">
          <label class="section-label" style="font-size:11.5px;margin-bottom:4px">Approval Code / Slip Reference (විකල්ප)</label>
          <input id="coCardRef" placeholder="Slip # හෝ Auth Code ඇතුළත් කරන්න..." style="font-size:13px">
        </div>
      </div>
    </div>

    <!-- 7. CREDIT SECTION (Hidden by default) -->
    <div id="creditSection" style="display:none">
      ${renderCreditSectionHtml()}
    </div>
  </div>`;

  const footerHtml = `
  <div class="checkout-footer-wrap">
    <label class="print-toggle-row">
      <input type="checkbox" id="coPrint" ${printReceipt ? 'checked' : ''} onchange="localStorage.setItem('pos.printReceipt', this.checked)">
      <span>🖨️ බිල්පත මුද්‍රණය කරන්න <small style="color:var(--muted)">/ Print receipt</small></span>
    </label>
    <div class="checkout-footer">
      <button type="button" class="co-btn-cancel" onclick="closeModal()">අවලංගු කරන්න</button>
      <button type="button" class="co-btn-complete" id="coSubmitBtn" onclick="completeSale()">
        ✅ බිල්පත සම්පූර්ණ කරන්න
      </button>
    </div>
  </div>`;

  openModal('💳 ගෙවීම සම්පූර්ණ කරන්න', 'Complete Payment · ' + checkoutState.orderNo, bodyHtml, footerHtml);

  // Setup Keyboard Shortcuts (Feature S1)
  removeCheckoutKeyHandler();
  window._checkoutKeyHandler = checkoutKeyHandler;
  window.addEventListener('keydown', window._checkoutKeyHandler);

  // Auto-focus (Feature S4)
  setTimeout(() => {
    const inp = $('#coPaid');
    if(inp){
      inp.focus();
      inp.select();
    }
  }, 150);
}

function selectMethod(method){
  checkoutState.method = method;

  document.querySelectorAll('.method-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.method === method);
  });

  const cashSec = $('#cashSection');
  const cardSec = $('#cardSection');
  const creditSec = $('#creditSection');

  if(cashSec) cashSec.style.display = (method === 'cash') ? 'flex' : 'none';
  if(cardSec) cardSec.style.display = (method === 'card') ? 'block' : 'none';
  if(creditSec){
    creditSec.style.display = (method === 'credit') ? 'block' : 'none';
    if(method === 'credit'){
      creditSec.innerHTML = renderCreditSectionHtml();
    }
  }

  updateChangeBox();

  setTimeout(() => {
    if(method === 'cash'){
      const inp = $('#coPaid');
      if(inp){ inp.focus(); inp.select(); }
    } else {
      const btn = $('#coSubmitBtn');
      if(btn && !btn.disabled) btn.focus();
    }
  }, 100);
}

function setPaidExact(){
  const payable = checkoutState.total;
  const inp = $('#coPaid');
  if(inp){
    inp.value = payable.toFixed(2);
  }
  updateChangeBox();
}

function addToPaid(amount){
  const inp = $('#coPaid');
  if(!inp) return;
  const cur = parseFloat(inp.value) || 0;
  const next = cur + Number(amount);
  inp.value = next.toFixed(2);
  updateChangeBox();
}

function updateChangeBox(){
  const total = checkoutState.total;
  const method = checkoutState.method;
  const inp = $('#coPaid');
  const paid = inp ? (parseFloat(inp.value) || 0) : 0;
  const diff = paid - total;
  const isShort = diff < 0;
  const box = $('#coChangeBox');
  const btn = $('#coSubmitBtn');

  if(box){
    if(!isShort){
      box.className = 'change-due-box positive';
      box.innerHTML = `
        <span class="change-label">✅ ඉතිරිය <small style="color:inherit;opacity:0.8">/ Change Due</small></span>
        <span class="change-amount">${money(diff)}</span>
      `;
    } else {
      box.className = 'change-due-box negative';
      box.innerHTML = `
        <span class="change-label">⚠️ තව අවශ්‍යයි <small style="color:inherit;opacity:0.8">/ Amount Needed</small></span>
        <span class="change-amount">තව ${money(Math.abs(diff))} අවශ්‍යයි</span>
      `;
    }
  }

  if(btn){
    if(method === 'cash'){
      btn.disabled = isShort;
    } else if(method === 'card'){
      btn.disabled = false;
    } else if(method === 'credit'){
      const db = DB || {};
      const cust = checkoutState.custId ? (db.getCustomer ? db.getCustomer(checkoutState.custId) : (db.customers||[]).find(c=>c.id===checkoutState.custId)) : null;
      if(!cust){
        btn.disabled = true;
      } else {
        const creditInfo = (typeof customerCreditBalance === 'function') ? customerCreditBalance(cust.id) : { balance: 0 };
        const limit = cust.creditLimit || 50000;
        btn.disabled = (creditInfo.balance + total > limit);
      }
    }
  }
}

function toggleRoundOff(checked){
  checkoutState.isRounded = !!checked;
  const payable = checked ? getRoundedTotal(checkoutState.originalTotal) : checkoutState.originalTotal;
  checkoutState.total = payable;

  const heroAmt = document.querySelector('.total-hero-amount');
  if(heroAmt){
    if(checked && payable !== checkoutState.originalTotal){
      heroAmt.innerHTML = `
        <span class="original-striked">${money(checkoutState.originalTotal)}</span>
        <span class="rounded-total">${money(payable)}</span>
      `;
    } else {
      heroAmt.innerHTML = `<span>${money(payable)}</span>`;
    }
  }

  const inp = $('#coPaid');
  if(inp){
    inp.value = payable.toFixed(2);
  }

  const creditSec = $('#creditSection');
  if(creditSec && checkoutState.method === 'credit'){
    creditSec.innerHTML = renderCreditSectionHtml();
  }

  updateChangeBox();
}

function onCustSelectChange(val){
  checkoutState.custId = val;
  state.cartCustomer = val;
  const cc = $('#cartCustomer');
  if(cc) cc.value = val;

  const creditSec = $('#creditSection');
  if(creditSec && checkoutState.method === 'credit'){
    creditSec.innerHTML = renderCreditSectionHtml();
  }

  updateChangeBox();
}

function completeSale(){
  const db = DB || {};
  const method = checkoutState.method;
  const originalTotal = checkoutState.originalTotal;
  const isRound = $('#coRound') ? $('#coRound').checked : checkoutState.isRounded;
  const finalTotal = isRound ? getRoundedTotal(originalTotal) : originalTotal;
  const roundOff = isRound ? (finalTotal - originalTotal) : 0;
  const notes = ($('#coNotes')?.value || '').trim();
  const cardRef = ($('#coCardRef')?.value || '').trim();
  const doPrint = $('#coPrint') ? $('#coPrint').checked : (localStorage.getItem('pos.printReceipt') !== 'false');
  localStorage.setItem('pos.printReceipt', doPrint);

  // Validate serials if required
  const serialItems = state.cart.filter(item => {
    const p = db.getProd ? db.getProd(item.pid) : (db.products || []).find(x => x.id === item.pid);
    return (p && p.hasSerial) || item.hasSerial;
  });

  const itemSerials = {};
  const warrantyExpiry = {};
  for(const it of serialItems){
    const p = db.getProd ? db.getProd(it.pid) : (db.products || []).find(x => x.id === it.pid);
    const inputs = document.querySelectorAll(`.co-serial-inp[data-pid="${it.pid}"]`);
    const serials = Array.from(inputs).map(inp => inp.value.trim().toUpperCase()).filter(Boolean);
    if(serials.length < it.qty){
      toast(`කරුණාකර ${p?.name || it.name} සඳහා සියලු Serial අංක (${it.qty}) ඇතුළත් කරන්න`, 'err');
      return;
    }
    itemSerials[it.pid] = serials;
    const months = (p?.warranty || it.warranty || 0);
    if(months > 0){
      const expDate = new Date();
      expDate.setMonth(expDate.getMonth() + Number(months));
      warrantyExpiry[it.pid] = expDate.toISOString().slice(0, 10);
    }
  }

  let paid = 0;
  let change = 0;

  if(method === 'cash'){
    paid = parseFloat($('#coPaid')?.value) || 0;
    if(paid < finalTotal){
      toast('ගෙවීම ප්‍රමාණවත් නැත (Payment insufficient)','err');
      return;
    }
    change = paid - finalTotal;
  } else if(method === 'card'){
    paid = finalTotal;
    change = 0;
  } else if(method === 'credit'){
    if(!checkoutState.custId){
      toast('කරුණාකර පාරිභෝගිකයෙකු තෝරන්න (Select customer)','err');
      return;
    }
    const cust = (db.customers || []).find(c => c.id === checkoutState.custId);
    const credit = (typeof customerCreditBalance === 'function') ? customerCreditBalance(checkoutState.custId) : { balance: 0 };
    const limit = cust ? (cust.creditLimit || 50000) : 50000;

    if(credit.balance + finalTotal > limit){
      toast('පාරිභෝගිකයාගේ ණය සීමාව ඉක්මවයි (Exceeds credit limit)','err');
      return;
    }
    paid = 0;
    change = 0;
  }

  removeCheckoutKeyHandler();
  executeSaleRecord(finalTotal, method, paid, change, cardRef, notes, originalTotal, roundOff, doPrint, itemSerials, warrantyExpiry);
}

const submitCheckoutSale = completeSale;
const setPaymentMethod = selectMethod;
const setCheckoutReceived = (v) => { if($('#coPaid')) $('#coPaid').value = v; updateChangeBox(); };
const onCheckoutCashInput = updateChangeBox;
const onCheckoutCustChange = onCustSelectChange;

async function executeSaleRecord(total, method, paid, change, cardRef='', notes='', originalTotal=null, roundOff=0, doPrint=true, itemSerials={}, warrantyExpiry={}){
  const db = DB || {};
  const custId = checkoutState.custId;
  const cust = (db.customers || []).find(c => c.id === custId);
  const {sub, disc, coreDeduction, tax} = calcTotals();
  const no = checkoutState.orderNo || ('INV-' + pad(db.counters.invoice = (db.counters.invoice || 0) + 1));

  /* 1. Get active shift */
  const activeShift = (typeof Shift !== 'undefined' && state.user) ? Shift.getActive(state.user.id) : null;

  /* 2 & 3. Build sale object */
  const sale = {
    id: uid('S'),
    no,
    date: new Date().toISOString(),
    cashier: state.user ? state.user.name : 'කැෂියර්',
    customerId: checkoutState.custId || null,
    customer: cust?.name || 'වෝක්-ඉන්',
    vehicle: cust?.vehicle || '',
    items: JSON.parse(JSON.stringify(state.cart)),
    sub,
    disc,
    coreDeduction: coreDeduction || 0,
    itemSerials: itemSerials || {},
    warrantyExpiry: warrantyExpiry || {},
    tax,
    originalTotal: originalTotal != null ? originalTotal : total,
    roundOff: roundOff || 0,
    total,
    method, // 'cash' | 'card' | 'credit'
    paid,
    change,
    cardRef,
    notes: notes || '',
    status: method === 'credit' ? 'credit' : 'paid',
    shiftId: activeShift ? activeShift.id : null
  };

  /* 4. Reduce stock */
  sale.items.forEach(it => {
    const p = db.getProd ? db.getProd(it.pid) : (db.products || []).find(x => x.id === it.pid);
    if(p){
      p.qty = Math.max(0, p.qty - it.qty);
      if(window.FB && window.FB.fbUpdate){
        window.FB.fbUpdate(window.FB.COL.products, p.id, { qty: p.qty });
      }
    }
  });

  /* Loyalty points & customer credit balance update */
  if(cust){
    cust.points = (cust.points || 0) + Math.floor(total / 100);
    if(method === 'credit'){
      cust.creditBalance = (cust.creditBalance || 0) + total;
    }
    if(window.FB && window.FB.fbUpdate){
      window.FB.fbUpdate(window.FB.COL.customers, cust.id, {
        points: cust.points,
        creditBalance: cust.creditBalance || 0
      });
    }
  }

  /* 5. Save to Firestore (or DB fallback) */
  if(!db.sales) db.sales = [];
  db.sales.push(sale);

  if(window.FB && window.FB.fbAdd){
    await window.FB.fbAdd(window.FB.COL.sales, sale);
  }
  if(typeof saveDB === 'function') saveDB();

  /* 7. Clear cart & checkout state */
  state.cart = [];
  window._shownCrossSellFor = new Set();
  const csToast = $('#crossSellToast');
  if(csToast) csToast.remove();

  window._discVal = '';
  checkoutState.notes = '';
  checkoutState.cardRef = '';

  /* 8. Close modal */
  closeModal();

  /* 9. Re-render cart and product grid */
  renderCart();
  renderGrid();

  /* 10. Show receipt */
  showReceipt(sale);

  /* 11. Thermal Print if enabled */
  if(doPrint){
    setTimeout(() => {
      window.print();
    }, 400);
  }

  /* 12. Update shift badge */
  if(typeof updateShiftIndicator === 'function') updateShiftIndicator();

  /* 13. Toast */
  toast('බිල්පත ' + sale.no + ' සම්පූර්ණ විය ✅');
}

function showReceipt(s){
  const db = DB || {};
  const shop = db.shop || { name: 'Auto Parts Lanka', addr: '', phone: '', footer: '' };
  const hasWarrantyInfo = s.itemSerials && Object.keys(s.itemSerials).length > 0;
  const customerName = (s.customer === 'වෝක්-ඉන්' || !s.customer) ? 'Walk-in' : s.customer;
  const footerText = shop.footerEn || (shop.footer && !shop.footer.includes('ස්තූතියි') ? shop.footer : 'Thank you! Come again.');

  const body = `
  <div id="printArea">
    <div class="receipt">
      <h2>${esc(shop.name)}</h2>
      <div class="rc">${esc(shop.addr)}<br>☎ ${esc(shop.phone)}</div>
      <hr>
      <div class="tr"><span>Invoice No</span><b>${s.no}</b></div>
      <div class="tr"><span>Date</span><span>${new Date(s.date).toLocaleString('en-GB')}</span></div>
      <div class="tr"><span>Cashier</span><span>${esc(s.cashier)}</span></div>
      <div class="tr"><span>Customer</span><span>${esc(customerName)}</span></div>
      ${s.vehicle?`<div class="tr"><span>Vehicle No</span><span>${esc(s.vehicle)}</span></div>`:''}
      ${s.notes ? `<div style="font-size:11px;font-style:italic;color:#444;margin:4px 0;text-align:center"><em>Note: ${esc(s.notes)}</em></div>` : ''}
      <hr>
      <table>
        <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody>${s.items.map(i => {
          const prod = (db.getProd ? db.getProd(i.pid) : null) || (db.products || []).find(p => p.id === i.pid || p.code === i.code);
          const itemName = i.nameEn || prod?.nameEn || i.name;
          return `<tr>
          <td>
            ${esc(itemName)}<br>
            <small style="color:var(--muted)">${esc(i.code)}</small>
          </td>
          <td style="text-align:center">${i.qty}</td>
          <td style="text-align:right">${(i.price*i.qty).toFixed(2)}</td></tr>`;
        }).join('')}</tbody>
      </table>
      <hr>
      <div class="tr"><span>Subtotal</span><span>${s.sub.toFixed(2)}</span></div>
      ${s.coreDeduction>0?`<div class="tr"><span>Core Deposit</span><span>− ${s.coreDeduction.toFixed(2)}</span></div>`:''}
      ${s.disc>0?`<div class="tr"><span>Discount</span><span>− ${s.disc.toFixed(2)}</span></div>`:''}
      ${s.tax>0?`<div class="tr"><span>Tax</span><span>${s.tax.toFixed(2)}</span></div>`:''}
      ${s.roundOff?`<div class="tr"><span>Round-off</span><span>+ ${s.roundOff.toFixed(2)}</span></div>`:''}
      <div class="tt"><span>TOTAL</span><span>Rs. ${Number(s.total || 0).toLocaleString('en-LK', {minimumFractionDigits:2, maximumFractionDigits:2})}</span></div>
      <div class="tr" style="margin-top:6px"><span>Payment Method</span><span>${s.method==='cash'?'Cash':s.method==='card'?'Card':'Store Credit'}</span></div>
      ${s.cardRef?`<div class="tr"><span>Ref / Slip</span><span>${esc(s.cardRef)}</span></div>`:''}
      ${s.method==='cash'?`<div class="tr"><span>Cash Received</span><span>${Number(s.paid||0).toFixed(2)}</span></div><div class="tr"><span>Change</span><span>${Number(s.change||0).toFixed(2)}</span></div>`:''}
      ${s.method==='credit'?`<div class="tr"><span style="color:#b45309">Status</span><b style="color:#b45309">Amount Due (Store Credit)</b></div>`:''}
      
      ${hasWarrantyInfo ? `
      <hr>
      <div class="receipt-warranty-block">
        <div class="receipt-warranty-title">🛡️ Warranty Info</div>
        ${Object.entries(s.itemSerials).map(([pid, serials]) => {
          const item = (s.items || []).find(x => x.pid === pid) || {};
          const p = (db.getProd ? db.getProd(pid) : null) || (db.products || []).find(x => x.id === pid) || item;
          const exp = (s.warrantyExpiry && s.warrantyExpiry[pid]) || '—';
          const serialsList = (Array.isArray(serials) ? serials : [serials]).join(', ');
          const itemName = item.nameEn || p.nameEn || item.name || p.name || 'Item';
          return `
            <div style="margin-bottom:4px;line-height:1.3">
              <b>${esc(itemName)}</b><br>
              <span>S/N: ${esc(serialsList)}</span><br>
              <small>Valid until: ${esc(exp)}</small>
            </div>
          `;
        }).join('')}
      </div>` : ''}

      <hr>
      <div class="rc">${esc(footerText)}<br>*** ${esc(shop.name)} ***</div>
    </div>
  </div>`;

  openModal('🧾 බිල්පත','Receipt — ' + s.no, body,
    `<button class="btn" onclick="closeModal()">වසන්න</button>
     <button class="btn btn-primary" onclick="window.print()">🖨️ Thermal Print</button>`);
}

window.pgBilling = pgBilling;
window.switchSearchMode = switchSearchMode;
window.clearVehicleSearch = clearVehicleSearch;
window.renderVehicleSearch = renderVehicleSearch;
window.handleBarcodeScan = handleBarcodeScan;
window.handleOemScan = handleOemScan;
window.renderGrid = renderGrid;
window.showProductDetail = showProductDetail;
window.addToCart = addToCart;
window.checkCrossSell = checkCrossSell;
window.showCrossSellToast = showCrossSellToast;
window.addCrossSellItem = addCrossSellItem;
window.changeQty = changeQty;
window.setQty = setQty;
window.toggleCoreExchange = toggleCoreExchange;
window.removeItem = removeItem;
window.clearCart = clearCart;
window.calcTotals = calcTotals;
window.renderCart = renderCart;
window.holdBill = holdBill;
window.showHeld = showHeld;
window.recall = recall;
window.openCheckout = openCheckout;
window.selectMethod = selectMethod;
window.setPaidExact = setPaidExact;
window.addToPaid = addToPaid;
window.updateChangeBox = updateChangeBox;
window.toggleRoundOff = toggleRoundOff;
window.getRoundedTotal = getRoundedTotal;
window.onCustSelectChange = onCustSelectChange;
window.completeSale = completeSale;
window.submitCheckoutSale = submitCheckoutSale;
window.setPaymentMethod = setPaymentMethod;
window.setCheckoutReceived = setCheckoutReceived;
window.onCheckoutCashInput = onCheckoutCashInput;
window.onCheckoutCustChange = onCheckoutCustChange;
window.executeSaleRecord = executeSaleRecord;
window.showReceipt = showReceipt;
window.overrideCartItemPrice = overrideCartItemPrice;
window.goToPage = goToPage;
window.setSortOrder = setSortOrder;
window.applySorting = applySorting;
window.renderPagination = renderPagination;
