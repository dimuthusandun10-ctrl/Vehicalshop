/* =========================================================
   js/pages/billing.js - POS Billing Screen, Vehicle Search & Checkout
   ========================================================= */

let searchMode = 'text'; // 'text' | 'vehicle' | 'oem'
window._vehicleFilter = { brand:'', chassis:'', engine:'', year:'' };
window._shownCrossSellFor = window._shownCrossSellFor || new Set();

const debouncedProductSearch = (typeof debounce === 'function')
  ? debounce((val) => {
      state.search = val;
      state.posPage = 1;
      renderGrid();
    }, 250)
  : ((val) => {
      state.search = val;
      state.posPage = 1;
      renderGrid();
    });
window.debouncedProductSearch = debouncedProductSearch;

const debouncedVehicleSearch = (typeof debounce === 'function')
  ? debounce(() => {
      state.posPage = 1;
      renderVehicleSearch();
    }, 250)
  : (() => {
      state.posPage = 1;
      renderVehicleSearch();
    });
window.debouncedVehicleSearch = debouncedVehicleSearch;

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
  const pendingShift = (typeof Shift !== 'undefined' && state.user && Shift.getPendingBalanceShift) ? Shift.getPendingBalanceShift(state.user.id) : null;

  return `
  ${!activeShift ? `
  <div class="shift-required-banner" style="${pendingShift ? 'background:linear-gradient(90deg,rgba(239,68,68,.25),rgba(245,158,11,.25));border:1px solid rgba(239,68,68,.5)' : ''}">
    <span>${pendingShift ? '🛑 ඔබගේ Shift එක පරිපාලක විසින් නවතා ඇත — කරුණාකර මුදල් ඇතුළත් කර අවසන් කරන්න' : '🔒 බිල්පත් නිකුත් කිරීමට පෙර Shift එකක් අරඹන්න'}</span>
    <button class="btn btn-sm ${pendingShift ? 'btn-yellow' : 'btn-primary'}" onclick="${pendingShift ? `openSettlePendingModal('${pendingShift.id}')` : 'openShiftModal()'}" style="font-weight:700">
      ${pendingShift ? '💰 මුදල් ඇතුළත් කරන්න' : '🔓 දැන්ම අරඹන්න'}
    </button>
  </div>` : ''}
  <div class="pos ${!activeShift ? 'pos-locked' : ''}">
    <div class="pos-left">
      <div class="pos-tools" style="flex-direction:column;align-items:stretch;gap:8px">
        <!-- Hardware Quick Actions Bar (Camera Scanner, Bluetooth Printer, Barcode Labels) -->
        <div class="pos-hardware-actions">
          <button type="button" class="btn btn-sm pos-hw-btn pos-hw-camera" onclick="if(window.BarcodeScanner) BarcodeScanner.open(); else focusSearch();" title="කැමරාවෙන් Barcode ස්කෑන් කරන්න (Camera Barcode Scanner)">
            📷 <span>ස්කෑනරය</span>
          </button>
          <button type="button" id="posPrinterStatusBtn" class="btn btn-sm pos-hw-btn pos-hw-printer ${(window.Printer && window.Printer.isConnected)?'connected':''}" onclick="openPrinterQuickModal()" title="Bluetooth Thermal Printer සම්බන්ධ කරන්න">
            🖨️ <span id="posPrinterStatusText">${(window.Printer && window.Printer.isConnected)?'සම්බන්ධයි':'Printer'}</span>
          </button>
          <button type="button" class="btn btn-sm pos-hw-btn pos-hw-labels" onclick="go('labels')" title="Barcode ලේබල් මුද්‍රණය කරන්න (Print Labels)">
            🏷️ <span>ලේබල්</span>
          </button>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <!-- Search mode tabs (Icon-only with active expand) -->
          ${renderSearchTabsHtml()}
          <div class="pos-tools-filters" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
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

    <!-- Backdrop for mobile (only visible when cart is open) -->
    <div class="pos-cart-backdrop" id="cartBackdrop" onclick="closeMobileCart()"></div>

    <!-- Right: Cart (mobile = bottom sheet, desktop = side panel) -->
    <div class="pos-right" id="cartPanel">
      <!-- Drag handle (mobile only) -->
      <div class="cart-drag-handle"></div>

      <div class="cart-header">
        <div style="display:flex;align-items:center;gap:8px">
          <h3 style="font-size:14px;margin:0">🛒 වත්මන් බිල <span id="cartItemCount"></span></h3>
          <span style="font-size:10.5px;color:var(--muted)" id="cartCount">භාණ්ඩ 0</span>
        </div>
        <div class="cart-actions">
          <button class="btn btn-sm" onclick="holdBill()" title="ඉදිරියට තබන්න (Stock Lock)">⏸️ Hold</button>
          <button class="btn btn-sm btn-red" onclick="clearCart()" title="හිස් කරන්න (F8)">🗑️</button>
          <button class="cart-close-btn" onclick="closeMobileCart()" title="වසන්න">✕</button>
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
  </div>

  <!-- FAB (mobile only, hidden on desktop via CSS) -->
  <button class="pos-fab mobile-only hidden-fab" id="posFab" onclick="openMobileCart()" title="කරත්ත බලන්න">
    <span class="fab-icon">🛒</span>
    <span class="fab-badge" id="fabCount">0</span>
  </button>`;
}

function renderSearchTabsHtml(){
  return `
  <div class="search-tabs icon-tabs">
    <button class="icon-tab ${searchMode==='text'?'active':''}" 
            data-mode="text" onclick="switchSearchMode('text')"
            title="සාමාන්ය සෙවීම · Text Search">
      <span class="it-icon">🔍</span>
      <span class="it-label">
        <span class="it-label-si">සාමාන්ය</span>
        <span class="it-label-en">Text</span>
      </span>
    </button>
    
    <button class="icon-tab ${searchMode==='vehicle'?'active':''}" 
            data-mode="vehicle" onclick="switchSearchMode('vehicle')"
            title="වාහනය අනුව · Search by Vehicle">
      <span class="it-icon">🚗</span>
      <span class="it-label">
        <span class="it-label-si">වාහනය</span>
        <span class="it-label-en">Vehicle</span>
      </span>
    </button>
    
    <button class="icon-tab ${searchMode==='oem'?'active':''}" 
            data-mode="oem" onclick="switchSearchMode('oem')"
            title="OEM අංකය · Search by Code">
      <span class="it-icon">🔢</span>
      <span class="it-label">
        <span class="it-label-si">OEM අංකය</span>
        <span class="it-label-en">Code</span>
      </span>
    </button>
  </div>`;
}

function renderSearchControlsHtml(){
  if(searchMode === 'text'){
    return `
      <div class="search-input-wrap" style="position:relative; flex:1;">
        <span class="search-icon" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--muted); font-size:16px; pointer-events:none;">🔍</span>
        <input id="posSearch" placeholder="භාණ්ඩය සොයන්න (නම / කේතය / OEM / වාහන මාදිලිය)... [F2]"
               value="${esc(state.search)}"
               oninput="debouncedProductSearch(this.value)"
               onkeydown="if(event.key==='Enter')handleBarcodeScan(this.value)"
               style="padding-left:35px;padding-right:38px;">
        <span class="barcode-icon barcode-btn" style="position:absolute; right:12px; top:50%; transform:translateY(-50%); color:var(--muted); font-size:16px; cursor:pointer;" title="Camera Barcode ස්කෑනරය (F2)" onclick="if(window.BarcodeScanner) BarcodeScanner.open(); else focusSearch();">📷</span>
      </div>`;
  } else if(searchMode === 'vehicle'){
    const vf = window._vehicleFilter;
    const db = DB || {};
    const defaultBrands = ['Toyota', 'Nissan', 'Honda', 'Suzuki', 'Mitsubishi', 'Mazda'];
    const prodBrands = (db.products || []).map(p => p.brand).filter(Boolean);
    const brands = [...new Set([...defaultBrands, ...prodBrands])].sort();

    return `
      <div class="vehicle-filter-container">
        <div class="vehicle-filter-row vehicle-search-row">
          <select id="vBrand" class="brand-select" onchange="window._vehicleFilter.brand=this.value;state.posPage=1;renderVehicleSearch()" style="width:140px">
            <option value="">වෙළඳ නාමය ▼</option>
            ${brands.map(b => `<option value="${esc(b)}" ${vf.brand===b?'selected':''}>${esc(b)}</option>`).join('')}
          </select>
          <input id="vChassis" placeholder="Chassis (උදා: NZE141)" value="${esc(vf.chassis)}"
                 oninput="this.value=this.value.toUpperCase();window._vehicleFilter.chassis=this.value.trim();debouncedVehicleSearch()" style="width:150px">
          <input id="vEngine" placeholder="Engine (උදා: 1NZ)" value="${esc(vf.engine)}"
                 oninput="this.value=this.value.toUpperCase();window._vehicleFilter.engine=this.value.trim();debouncedVehicleSearch()" style="width:130px">
          <input id="vYear" type="number" placeholder="වර්ෂය (Year)" value="${esc(vf.year)}"
                 oninput="window._vehicleFilter.year=this.value.trim();debouncedVehicleSearch()" style="width:105px">
          <button class="btn btn-sm" onclick="clearVehicleSearch()">✕ Clear</button>
        </div>
        <div class="vehicle-results-bar">
          <span id="vMatchBadge" class="vehicle-match-badge">🎯 සොයමින්...</span>
        </div>
      </div>`;
  } else if(searchMode === 'oem'){
    return `
      <div class="search-input-wrap" style="position:relative; flex:1;">
        <span class="search-icon" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--muted); font-size:16px; pointer-events:none;">🔢</span>
        <input id="posSearchOem" placeholder="OEM අංකය හෝ Alternate Part No (උදා: 04465 / AN-688)... [Enter=Add]"
               value="${esc(state.search)}"
               oninput="debouncedProductSearch(this.value)"
               onkeydown="if(event.key==='Enter')handleOemScan(this.value)"
               style="padding-left:35px;padding-right:38px;">
        <span class="barcode-icon barcode-btn" style="position:absolute; right:12px; top:50%; transform:translateY(-50%); color:var(--muted); font-size:16px; cursor:pointer;" title="Camera Barcode ස්කෑනරය (Enter)" onclick="if(window.BarcodeScanner) BarcodeScanner.open(); else $('#posSearchOem')?.focus();">📷</span>
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
  if(!q) return null;

  const db = DB || {};
  const activeShop = (typeof currentShopId === 'function')
    ? currentShopId()
    : (window.state?.user?.shopId || window.state?.activeShopId || 'SHOP-001');

  // 1. Strict Active Shop Filter
  const shopProducts = (db.products || []).filter(p =>
    !activeShop || activeShop === 'all' || p.shopId === activeShop || (!p.shopId && activeShop === 'SHOP-001')
  );

  const exact = shopProducts.find(p =>
    (p.code || '').toLowerCase() === q ||
    (p.oemNo || '').toLowerCase() === q ||
    (p.barcode || '').toLowerCase() === q ||
    (Array.isArray(p.altNos) && p.altNos.some(a => String(a).toLowerCase() === q))
  );

  if(exact){
    // 2. Stock Warning & Audio Feedback
    const isOut = (exact.qty <= 0);
    if(window.BarcodeScanner && window.BarcodeScanner.beep){
      window.BarcodeScanner.beep(isOut ? 'warn' : 'success');
    }

    addToCart(exact.id);
    state.search = '';
    const inp = $('#posSearch') || $('#posSearchOem');
    if(inp) inp.value = '';
    renderGrid();

    const priceStr = (typeof money === 'function') ? ` (${money(exact.price)})` : '';
    if(isOut){
      if(typeof toast === 'function') toast(`⚠️ ${exact.name || exact.nameEn}${priceStr} Cart එකට එක්විය (තොග අවසන්: 0)`, 'warn');
    } else {
      if(typeof toast === 'function') toast(`✅ ${exact.name || exact.nameEn}${priceStr} Cart එකට එකතු කරන ලදී`, 'ok');
    }
    return exact;
  } else {
    // 3. Foreign / Invalid Barcode Detection & Error Audio Alert
    if(window.BarcodeScanner && window.BarcodeScanner.beep){
      window.BarcodeScanner.beep('error');
    }

    const otherShopMatch = (db.products || []).find(p =>
      (p.code || '').toLowerCase() === q ||
      (p.oemNo || '').toLowerCase() === q ||
      (p.barcode || '').toLowerCase() === q ||
      (Array.isArray(p.altNos) && p.altNos.some(a => String(a).toLowerCase() === q))
    );

    const activeShopObj = (db.shops || []).find(s => s.id === activeShop) || window.state?.activeShop;
    const shopName = activeShopObj?.name || activeShop || 'මෙම සාප්පුව';

    if(otherShopMatch){
      if(typeof toast === 'function') toast(`❌ Barcode "${val}" '${shopName}' සාප්පුවට අයත් නොවේ (වෙනත් සාප්පුවක භාණ්ඩයකි)`, 'err');
    } else {
      if(typeof toast === 'function') toast(`❌ Barcode "${val}" '${shopName}' සාප්පුවට අයත් භාණ්ඩයක් නොවේ`, 'err');
    }

    // Do NOT pollute search input with invalid barcode! Keep search clean!
    return null;
  }
}

if(typeof window !== 'undefined' && !window._barcodeScannedListenerAttached){
  window.addEventListener('barcodeScanned', (e) => {
    if(e && e.detail && e.detail.code){
      handleBarcodeScan(e.detail.code);
    }
  });
  window._barcodeScannedListenerAttached = true;
}

// =========================================================
// Global USB Barcode Scanner Wedge Listener
// Handles physical USB / Bluetooth handheld barcode guns
// =========================================================
let _usbBarcodeBuf = '';
let _usbLastKeyTime = 0;

if(typeof window !== 'undefined' && !window._usbBarcodeListenerAttached){
  window.addEventListener('keydown', (e) => {
    // Active only on billing page
    if(window.state?.page !== 'billing') return;
    if(e.ctrlKey || e.altKey || e.metaKey) return;

    const activeEl = document.activeElement;
    // Don't intercept if user is in an unrelated dialog field (like customer notes, discount, etc.)
    const isSpecialInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') && 
                           (activeEl.id !== 'posSearch' && activeEl.id !== 'posSearchOem');

    const now = Date.now();
    const timeDelta = now - _usbLastKeyTime;
    _usbLastKeyTime = now;

    // USB barcode guns type < 50ms per key. If longer than 65ms, manual typing -> reset buffer
    if(timeDelta > 65){
      _usbBarcodeBuf = '';
    }

    if(e.key === 'Enter'){
      if(_usbBarcodeBuf.length >= 3){
        const scanned = _usbBarcodeBuf.trim();
        _usbBarcodeBuf = '';
        if(!isSpecialInput){
          e.preventDefault();
          e.stopPropagation();
          handleBarcodeScan(scanned);
        }
      }
    } else if(e.key && e.key.length === 1){
      _usbBarcodeBuf += e.key;
    }
  }, true);

  window._usbBarcodeListenerAttached = true;
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
      // 1. Direct match
      const directBrand = !vf.brand || (p.brand || '').toLowerCase() === vf.brand.toLowerCase();
      const directChassis = !vf.chassis || (p.chassis || []).some(c => (c || '').toUpperCase().includes(vf.chassis.toUpperCase()));
      const directEngine = !vf.engine || (p.engine || []).some(e => (e || '').toUpperCase().includes(vf.engine.toUpperCase()));
      const yr = parseInt(vf.year, 10);
      const directYear = !yr || (yr >= (p.yearFrom || 1900) && yr <= (p.yearTo || 2099));

      if(directBrand && directChassis && directEngine && directYear){
        p._interchangeMatch = false; // Direct fit
        return true;
      }

      // 2. Part Interchange Cross-Reference Match
      const interchanges = db.interchanges || [];
      const intMatch = interchanges.some(item => {
        const isThisProduct = item.productId === p.id || item.productCode === p.code || (item.alternates || []).includes(p.code);
        if(!isThisProduct) return false;

        return (item.fitsVehicles || []).some(v => {
          const vBrand = !vf.brand || (v.brand || '').toLowerCase().includes(vf.brand.toLowerCase());
          const vChassis = !vf.chassis || (v.chassis || []).some(c => (c || '').toUpperCase().includes(vf.chassis.toUpperCase()));
          const vEngine = !vf.engine || (v.engine || []).some(e => (e || '').toUpperCase().includes(vf.engine.toUpperCase()));
          const vYear = !yr || (yr >= (v.yearFrom || 1900) && yr <= (v.yearTo || 2099));
          return vBrand && vChassis && vEngine && vYear;
        });
      });

      if(intMatch){
        p._interchangeMatch = true; // 🔄 Interchange
        return true;
      }

      return false;
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
      <div class="product-code" style="display:flex;align-items:center;justify-content:space-between">
        <span>${esc(p.code)}</span>
        ${searchMode === 'vehicle' ? `
          <span class="ic-badge ${p._interchangeMatch ? 'badge-interchange' : 'badge-direct'}" style="font-size:9.5px;padding:1px 5px;border-radius:4px">
            ${p._interchangeMatch ? '🔄 Interchange' : 'Direct fit'}
          </span>
        ` : ''}
      </div>
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
      costAtSale: p.cost || 0,
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

  // FAB bounce animation + haptic feedback
  updateFab();
  const fab = document.getElementById('posFab');
  if(fab){
    fab.style.transform = 'scale(1.1)';
    setTimeout(() => {
      const f = document.getElementById('posFab');
      if(f) f.style.transform = '';
    }, 150);
    if(navigator.vibrate){
      try { navigator.vibrate(30); } catch(e){}
    }
  }
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
  window._discVal = '';
  window._shownCrossSellFor = new Set();
  const csToast = $('#crossSellToast');
  if(csToast) csToast.remove();
  renderCart();
  closeMobileCart();
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
  const isPercent = (window._discType || 'percent') === 'percent';
  let val = parseFloat(window._discVal) || 0;
  if(val < 0) val = 0;

  if(isPercent) {
    if(val > 100) val = 100;
    disc = sub * (val / 100);
  } else {
    if(val > sub) val = sub;
    disc = val;
  }
  disc = Math.min(disc, sub);

  const taxableSub = Math.max(0, sub - disc - coreDeduction);
  const tax = taxableSub * ((DB?.shop?.tax || 0) / 100);
  const total = Math.max(0, taxableSub + tax);

  return { sub, disc, coreDeduction, tax, total };
}

/* Discount management helpers (preserve focus, restrict to numbers, enforce 100% and subtotal limits) */
function setDiscountType(type){
  window._discType = type;
  const isPercent = type === 'percent';
  const sub = state.cart.reduce((a,c) => a + c.price * c.qty, 0);

  let val = parseFloat(window._discVal);
  if(!isNaN(val)){
    if(isPercent && val > 100){
      window._discVal = '100';
    } else if(!isPercent && val > sub){
      window._discVal = sub > 0 ? String(sub) : '';
    }
  }

  const inp = document.getElementById('discVal');
  if(inp){
    inp.value = window._discVal || '';
    inp.placeholder = isPercent ? '0 - 100%' : (sub > 0 ? `උපරිම ${sub}` : 'වට්ටම');
    inp.title = isPercent ? 'ප්‍රතිශතය උපරිම 100%' : (sub > 0 ? `ස්ථාවර වට්ටම උපරිම ${money(sub)}` : 'ස්ථාවර වට්ටම');
  }

  const toggle = document.querySelector('.discount-toggle');
  if(toggle){
    const btns = toggle.querySelectorAll('button');
    if(btns.length >= 2){
      btns[0].classList.toggle('active', isPercent);
      btns[1].classList.toggle('active', !isPercent);
    }
  }

  updateCartTotalsUI();
}

function onDiscountKeyDown(e){
  // Allow navigation & editing keys
  const navKeys = ['Backspace', 'Tab', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'Escape', 'Home', 'End'];
  if(navKeys.includes(e.key)) return;

  // Allow copy/paste/select-all
  if((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x', 'z'].includes(e.key.toLowerCase())) return;

  // Disallow invalid characters for positive numbers ('-', '+', 'e', 'E')
  if(e.key === '-' || e.key === '+' || e.key.toLowerCase() === 'e'){
    e.preventDefault();
    return;
  }

  // Allow only single decimal point
  if(e.key === '.'){
    const val = e.target.value || '';
    if(val.includes('.')){
      e.preventDefault();
    }
    return;
  }

  // Allow only digits 0-9
  if(!/^[0-9]$/.test(e.key)){
    e.preventDefault();
  }
}

function handleDiscountInput(el){
  if(!el) return;
  const isPercent = (window._discType || 'percent') === 'percent';
  const sub = state.cart.reduce((a,c) => a + c.price * c.qty, 0);

  // Sanitize input: allow only digits and at most one decimal point
  let raw = el.value.replace(/[^0-9.]/g, '');
  const parts = raw.split('.');
  if(parts.length > 2){
    raw = parts[0] + '.' + parts.slice(1).join('');
  }

  let numVal = parseFloat(raw);

  if(!isNaN(numVal)){
    if(isPercent){
      // Maximum 100%
      if(numVal > 100){
        raw = '100';
      }
    } else {
      // Maximum is subtotal of cart items
      if(numVal > sub){
        raw = sub > 0 ? String(sub) : '0';
      }
    }
  }

  // Update input field if sanitized or clamped
  if(el.value !== raw){
    const cursor = el.selectionStart;
    el.value = raw;
    try {
      el.setSelectionRange(cursor, cursor);
    } catch(err){}
  }

  window._discVal = raw;
  updateCartTotalsUI();
}

function updateCartTotalsUI(){
  const {sub, disc, coreDeduction, tax, total} = calcTotals();

  // Discount row
  const discRow = document.getElementById('cartSumDisc');
  if(discRow){
    discRow.style.display = disc > 0 ? 'flex' : 'none';
    const discAmt = discRow.querySelector('.disc-amt');
    if(discAmt) discAmt.textContent = `− ${money(disc)}`;
  }

  // Tax row
  const taxRow = document.getElementById('cartSumTax');
  if(taxRow){
    taxRow.style.display = tax > 0 ? 'flex' : 'none';
    const taxAmt = taxRow.querySelector('.tax-amt');
    if(taxAmt) taxAmt.textContent = money(tax);
  }

  // Total row
  const totalVal = document.getElementById('cartSumTotalVal');
  if(totalVal){
    totalVal.textContent = money(total);
  }

  // Checkout button
  const checkoutBtn = document.getElementById('cartCheckoutBtn');
  if(checkoutBtn){
    checkoutBtn.disabled = !state.cart.length;
    checkoutBtn.innerHTML = `💳 ගෙවීමට (F4) → ${money(total)}`;
  }

  updateFab();
}

// Expose helpers globally
window.setDiscountType = setDiscountType;
window.onDiscountKeyDown = onDiscountKeyDown;
window.handleDiscountInput = handleDiscountInput;
window.updateCartTotalsUI = updateCartTotalsUI;

function renderCart(){
  const box = $('#cartItems'); if(!box) return;
  const itemCount = state.cart.reduce((a,c) => a + c.qty, 0);
  const countText = 'භාණ්ඩ ' + itemCount;
  const cc = $('#cartCount');
  if(cc) cc.textContent = countText;
  const cic = $('#cartItemCount');
  if(cic) cic.textContent = `(${countText})`;

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
  const isPercent = (window._discType || 'percent') === 'percent';

  // Clamp _discVal if cart items changed
  let numVal = parseFloat(window._discVal);
  if(!isNaN(numVal)){
    if(isPercent && numVal > 100){
      window._discVal = '100';
    } else if(!isPercent && numVal > sub){
      window._discVal = sub > 0 ? String(sub) : '';
    }
  }

  // Remember focus if discVal was focused
  const wasDiscFocused = (document.activeElement && document.activeElement.id === 'discVal');
  const selStart = wasDiscFocused ? document.activeElement.selectionStart : null;

  const sum = $('#cartSum');
  if(sum) sum.innerHTML = `
    <div class="srow"><span>උප එකතුව / Subtotal</span><b>${money(sub)}</b></div>
    ${coreDeduction > 0 ? `<div class="srow"><span>🔋 පරණ කොටස් අඩුකිරීම</span><b style="color:var(--green)">− ${money(coreDeduction)}</b></div>` : ''}
    <div class="srow" id="cartSumDisc" style="${disc > 0 ? 'display:flex' : 'display:none'}">
      <span>වට්ටම / Discount</span><b class="disc-amt" style="color:var(--red)">− ${money(disc)}</b>
    </div>
    ${(DB?.shop?.tax > 0) ? `
      <div class="srow" id="cartSumTax" style="${tax > 0 ? 'display:flex' : 'display:none'}">
        <span>බදු / Tax (${DB?.shop?.tax}%)</span><b class="tax-amt">${money(tax)}</b>
      </div>` : ''}
    <div class="srow total" id="cartSumTotal" style="font-size:24px">
      <span>මුළු එකතුව</span><span id="cartSumTotalVal">${money(total)}</span>
    </div>
    ${hasPermission('discounts') ? `
    <div style="display:flex;gap:7px;margin-top:10px;align-items:center">
      <div class="discount-toggle" style="flex:1">
        <button type="button" class="${isPercent ? 'active' : ''}" onclick="setDiscountType('percent')">% ප්‍රතිශතය</button>
        <button type="button" class="${!isPercent ? 'active' : ''}" onclick="setDiscountType('fixed')">රු. ස්ථාවර</button>
      </div>
      <input id="discVal" type="text" inputmode="decimal" 
             placeholder="${isPercent ? '0 - 100%' : (sub > 0 ? 'උපරිම ' + sub : 'වට්ටම')}" 
             title="${isPercent ? 'ප්‍රතිශතය උපරිම 100%' : (sub > 0 ? 'ස්ථාවර වට්ටම උපරිම ' + money(sub) : 'ස්ථාවර වට්ටම')}"
             style="width:105px;padding:7px;font-size:13px;text-align:right;font-weight:600"
             value="${window._discVal || ''}" 
             onkeydown="onDiscountKeyDown(event)"
             oninput="handleDiscountInput(this)">
    </div>` : ''}
    <button id="cartCheckoutBtn" class="btn btn-green" style="width:100%;margin-top:10px;padding:12px;font-size:15px;font-weight:700" ${state.cart.length?'':'disabled'} onclick="openCheckout()">
      💳 ගෙවීමට (F4) → ${money(total)}
    </button>
    ${state.held.length?`<button class="btn btn-sm btn-blue" style="width:100%;margin-top:7px" onclick="showHeld()">⏸️ රඳවා ඇති බිල්පත් (${state.held.length})</button>`:''}
  `;

  if(wasDiscFocused){
    const newInp = document.getElementById('discVal');
    if(newInp){
      newInp.focus();
      try { newInp.setSelectionRange(selStart, selStart); } catch(e){}
    }
  }

  // Update FAB badge and state
  updateFab();
  initCartSwipeGesture();
}

function openMobileCart(){
  const panel = document.getElementById('cartPanel');
  const backdrop = document.getElementById('cartBackdrop');
  if(panel) panel.classList.add('open');
  if(backdrop) backdrop.classList.add('open');
  document.body.classList.add('cart-open');      // ⭐
  document.body.style.overflow = 'hidden';

  // Hide FAB while cart panel is open so it doesn't peek through
  const fab = document.getElementById('posFab');
  if(fab){
    fab.style.opacity = '0';
    fab.style.pointerEvents = 'none';
  }

  // Focus first input if any
  setTimeout(() => {
    const firstInput = panel?.querySelector('input[type="number"]');
    if(firstInput) firstInput.focus();
  }, 350);
}

function closeMobileCart(){
  const panel = document.getElementById('cartPanel');
  const backdrop = document.getElementById('cartBackdrop');
  if(panel) panel.classList.remove('open');
  if(backdrop) backdrop.classList.remove('open');
  document.body.classList.remove('cart-open');   // ⭐
  document.body.style.overflow = '';

  // Restore FAB visibility
  const fab = document.getElementById('posFab');
  if(fab){
    fab.style.opacity = '';
    fab.style.pointerEvents = '';
  }
}

function updateFab(){
  const fab = document.getElementById('posFab');
  if(!fab) return;

  const itemCount = (state.cart || []).reduce((a,c) => a + c.qty, 0);
  const {total} = (typeof calcTotals === 'function') ? calcTotals() : {total: 0};

  // ⭐ HIDE if empty
  if(itemCount === 0){
    fab.classList.add('hidden-fab');
    fab.classList.remove('has-items', 'empty');
    // Also auto-close cart panel if open
    if(typeof closeMobileCart === 'function') closeMobileCart();
    return;
  }

  // Show when items exist
  fab.classList.remove('hidden-fab');
  fab.classList.add('has-items');
  fab.classList.remove('empty');

  // Update count (item count only — no price)
  const countEl = document.getElementById('fabCount');
  const totalEl = document.getElementById('fabTotal');

  if(countEl) countEl.textContent = String(itemCount);

  // ⭐ REMOVE price display
  if(totalEl) totalEl.remove();  // remove element entirely
}

// Swipe-down to close on drag handle (mobile only)
function initCartSwipeGesture(){
  const handle = document.querySelector('.cart-drag-handle');
  if(!handle || handle._hasSwipe) return;
  handle._hasSwipe = true;
  let startY = 0;
  handle.addEventListener('touchstart', e => {
    startY = e.touches[0].clientY;
  }, {passive: true});
  handle.addEventListener('touchmove', e => {
    const diff = e.touches[0].clientY - startY;
    if(diff > 0){
      const panel = document.getElementById('cartPanel');
      if(panel) panel.style.transform = `translateY(${diff}px)`;
    }
  }, {passive: true});
  handle.addEventListener('touchend', e => {
    const diff = e.changedTouches[0].clientY - startY;
    const panel = document.getElementById('cartPanel');
    if(diff > 100){
      closeMobileCart();
    }
    if(panel) panel.style.transform = '';
  });
}

// Auto-close mobile cart on window resize > 820px
if(typeof window !== 'undefined' && !window._posResizeBound){
  window._posResizeBound = true;
  window.addEventListener('resize', () => {
    if(window.innerWidth > 820){
      closeMobileCart();
    }
  });
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
    customerId: $('#cartCustomer')?.value || state.cartCustomer || null,
    discVal: window._discVal || '',
    discType: window._discType || 'percent'
  });

  state.cart = [];
  window._discVal = '';
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
  window._discVal = state.held[i].discVal || '';
  window._discType = state.held[i].discType || 'percent';
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

  // ⭐ Close mobile cart BEFORE opening checkout modal
  const wasCartOpen = Boolean(document.getElementById('cartPanel')?.classList.contains('open'));
  if(typeof closeMobileCart === 'function') closeMobileCart();

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
  checkoutState.orderNo = '';

  const printReceipt = localStorage.getItem('pos.printReceipt') !== 'false';
  const customers = db?.customers || [];

  // Check for serialized items
  const serialItems = state.cart.filter(item => {
    const p = db.getProd ? db.getProd(item.pid) : (db.products || []).find(x => x.id === item.pid);
    return (p && p.hasSerial) || item.hasSerial;
  });

  const serialsHtml = serialItems.length ? `
    <div class="checkout-serials-card">
      <div class="checkout-serials-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>🛡️ Serial Numbers Required</span>
        <button type="button" class="btn btn-sm btn-primary" onclick="scanNextEmptySerialCheckout()" 
                title="Serial Barcode එකින් එක Scan කරන්න" 
                style="font-size:11px;padding:3px 9px;display:inline-flex;align-items:center;gap:4px">
          📷 <span>Scan Serial</span>
        </button>
      </div>
      ${serialItems.map(item => {
        const p = db.getProd ? db.getProd(item.pid) : (db.products || []).find(x => x.id === item.pid);
        const prefix = p?.brand ? (p.brand.slice(0, 3).toUpperCase() + '-' + new Date().getFullYear() + '-') : 'SN-';
        const rows = [];
        for(let u = 0; u < item.qty; u++){
          const inputId = `coSerial_${item.pid}_${u}`;
          rows.push(`
            <div class="serial-input-row">
              <span style="font-size:11px;color:var(--muted);width:32px;font-weight:600">#${u+1}:</span>
              <input id="${inputId}" class="co-serial-inp" data-pid="${item.pid}" data-idx="${u}"
                     placeholder="S/N: [${prefix}____]" autocomplete="off"
                     oninput="this.value=this.value.toUpperCase()"
                     onkeydown="if(event.key==='Enter'){event.preventDefault();focusNextSerialOrCheckout(this);}">
              <button type="button" class="co-serial-scan-btn"
                      onclick="scanSerialForCheckout('${inputId}')"
                      title="Camera එකෙන් Serial Barcode එක Scan කරන්න">
                📷 <span>Scan</span>
              </button>
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

  const doOpenCheckoutModal = () => {
    openModal('💳 ගෙවීම සම්පූර්ණ කරන්න', 'Complete Payment', bodyHtml, footerHtml);

    // Setup Keyboard Shortcuts (Feature S1)
    removeCheckoutKeyHandler();
    window._checkoutKeyHandler = checkoutKeyHandler;
    window.addEventListener('keydown', window._checkoutKeyHandler);

    // Auto-focus: If serial numbers required, focus first empty serial input, else coPaid
    setTimeout(() => {
      const firstSerial = document.querySelector('.co-serial-inp');
      if(firstSerial && !firstSerial.value){
        firstSerial.focus();
      } else {
        const inp = $('#coPaid');
        if(inp){
          inp.focus();
          inp.select();
        }
      }
    }, 150);
  };

  if(wasCartOpen){
    setTimeout(doOpenCheckoutModal, 250);   // matches cart slide-down animation
  } else {
    doOpenCheckoutModal();
  }
}

/* ---------- Serial Barcode Scanner Helpers for Checkout ---------- */
function scanSerialForCheckout(inputId){
  if(typeof BarcodeScanner !== 'undefined' && BarcodeScanner.open){
    BarcodeScanner.open((code) => {
      const cleanCode = (code || '').trim().toUpperCase();
      const inp = document.getElementById(inputId);
      if(inp){
        inp.value = cleanCode;
        inp.focus();
        if(typeof toast === 'function') toast('Serial අංකය ඇතුළත් විය: ' + cleanCode, 'ok');

        // Auto-focus next empty serial input if available
        const allInps = Array.from(document.querySelectorAll('.co-serial-inp'));
        const curIdx = allInps.indexOf(inp);
        if(curIdx >= 0 && curIdx < allInps.length - 1){
          const nextInp = allInps[curIdx + 1];
          if(nextInp && !nextInp.value){
            setTimeout(() => nextInp.focus(), 350);
          }
        } else {
          // If all serials are filled, focus paid input
          const paidInp = document.getElementById('coPaid');
          if(paidInp){
            setTimeout(() => { paidInp.focus(); paidInp.select(); }, 350);
          }
        }
      }
    }, { requireShopProduct: false });
  } else {
    if(typeof toast === 'function') toast('Camera Barcode Scanner සක්‍රීය නැත', 'warn');
  }
}

function scanNextEmptySerialCheckout(){
  const allInps = Array.from(document.querySelectorAll('.co-serial-inp'));
  const firstEmpty = allInps.find(inp => !inp.value.trim());
  if(!firstEmpty){
    if(typeof toast === 'function') toast('සියලුම Serial අංක දැනටමත් සම්පූර්ණ කර ඇත', 'info');
    return;
  }

  if(typeof BarcodeScanner !== 'undefined' && BarcodeScanner.open){
    BarcodeScanner.open((code) => {
      const cleanCode = (code || '').trim().toUpperCase();
      const inps = Array.from(document.querySelectorAll('.co-serial-inp'));
      const target = inps.find(inp => !inp.value.trim());
      if(target){
        target.value = cleanCode;
        if(typeof toast === 'function') toast(`Serial #${target.dataset.idx ? Number(target.dataset.idx)+1 : ''} ඇතුළත් විය: ${cleanCode}`, 'ok');

        // Check if there are more empty ones
        const remaining = inps.filter(inp => !inp.value.trim());
        if(remaining.length === 0){
          if(typeof toast === 'function') toast('සියලු Serial අංක ඇතුළත් කර අවසන්!', 'ok');
          if(BarcodeScanner.close) BarcodeScanner.close();
          const paidInp = document.getElementById('coPaid');
          if(paidInp){
            setTimeout(() => { paidInp.focus(); paidInp.select(); }, 350);
          }
        }
      } else {
        if(BarcodeScanner.close) BarcodeScanner.close();
      }
    }, { requireShopProduct: false });
  } else {
    if(typeof toast === 'function') toast('Camera Barcode Scanner සක්‍රීය නැත', 'warn');
  }
}

function focusNextSerialOrCheckout(currentInp){
  const allInps = Array.from(document.querySelectorAll('.co-serial-inp'));
  const curIdx = allInps.indexOf(currentInp);
  if(curIdx >= 0 && curIdx < allInps.length - 1){
    allInps[curIdx + 1].focus();
  } else {
    const paidInp = document.getElementById('coPaid');
    if(paidInp){
      paidInp.focus();
      paidInp.select();
    }
  }
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
  const shopId = (typeof currentShopId === 'function' && currentShopId()) ? currentShopId() : (window.state?.user?.shopId || 'SHOP-001');

  // Prevent double-click race condition
  if(window._isSubmittingSale) return;
  window._isSubmittingSale = true;
  const submitBtn = $('#coSubmitBtn');
  if(submitBtn){
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ සුරකිමින්... (Processing...)';
  }

  /* 1. Get active shift */
  const activeShift = (typeof Shift !== 'undefined' && state.user) ? Shift.getActive(state.user.id) : null;

  /* 2. Build base sale object */
  const sale = {
    id: uid('S'),
    shopId,
    date: new Date().toISOString(),
    cashier: state.user ? state.user.name : 'කැෂියර්',
    customerId: custId || null,
    customer: cust?.name || 'වෝක්-ඉන්',
    vehicle: cust?.vehicle || '',
    items: (state.cart || []).map(item => {
      const prod = db.getProd ? db.getProd(item.pid) : (db.products || []).find(x => x.id === item.pid);
      const costSnap = item.costAtSale != null ? item.costAtSale : (item.cost != null ? item.cost : (prod ? prod.cost : 0));
      return {
        ...item,
        cost: costSnap,
        costAtSale: costSnap
      };
    }),
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

  const customerUpdate = cust ? {
    id: cust.id,
    pointsEarned: Math.floor(total / 100),
    creditAdded: (method === 'credit' ? total : 0)
  } : null;

  let txRes = null;
  if(window.FB && typeof window.FB.executeSaleTransaction === 'function'){
    txRes = await window.FB.executeSaleTransaction(sale, state.cart, customerUpdate);
  } else {
    const no = 'INV-' + pad(db.counters.invoice = (db.counters.invoice || 0) + 1);
    sale.no = no;
    txRes = { ok: true, invoiceNo: no, sale };
  }

  if(!txRes.ok){
    window._isSubmittingSale = false;
    if(submitBtn){
      submitBtn.disabled = false;
      submitBtn.textContent = '✅ බිල්පත සම්පූර්ණ කරන්න';
    }

    if(txRes.code === 'OUT_OF_STOCK'){
      toast(txRes.message, 'err');
      if(txRes.productId){
        const prod = db.getProd ? db.getProd(txRes.productId) : (db.products || []).find(x => x.id === txRes.productId);
        if(prod && txRes.availableQty != null){
          prod.qty = txRes.availableQty;
          if(window.DB && typeof window.DB.persistLocal === 'function') window.DB.persistLocal();
        }
      }
      renderCart();
      renderGrid();
      return;
    }

    toast(`❌ බිල්පත සුරැකීම අසාර්ථක විය: ${txRes.message || 'Error'}`, 'err');
    return;
  }

  // Transaction succeeded!
  window._isSubmittingSale = false;
  const finalSale = txRes.sale || sale;
  finalSale.no = txRes.invoiceNo;

  // 3. Update local in-memory products
  if(txRes.updatedProducts && Array.isArray(txRes.updatedProducts)){
    txRes.updatedProducts.forEach(u => {
      const p = db.getProd ? db.getProd(u.id) : (db.products || []).find(x => x.id === u.id);
      if(p) p.qty = u.newQty;
    });
  } else {
    sale.items.forEach(it => {
      const p = db.getProd ? db.getProd(it.pid) : (db.products || []).find(x => x.id === it.pid);
      if(p) p.qty = Math.max(0, (p.qty || 0) - it.qty);
    });
  }

  // 4. Update customer loyalty points & credit balance in local memory
  if(cust){
    cust.points = (cust.points || 0) + Math.floor(total / 100);
    if(method === 'credit'){
      cust.creditBalance = (cust.creditBalance || 0) + total;
    }
  }

  // 5. Update local sales list & counters
  if(!db.sales) db.sales = [];
  db.sales.push(finalSale);
  if(txRes.nextNum) db.counters.invoice = Math.max(db.counters.invoice || 0, txRes.nextNum);

  if(typeof saveDB === 'function') saveDB(true);
  if(window.DB && typeof window.DB._persistLocalNow === 'function') window.DB._persistLocalNow();

  /* 6. Auto-track Core Scrap Battery if core deduction applied */
  if(finalSale.coreDeduction > 0 || (finalSale.items || []).some(it => it.useCoreExchange)){
    try {
      const coreItems = (finalSale.items || []).filter(it => it.useCoreExchange || (Number(it.coreDeposit) > 0));
      const targetItems = coreItems.length ? coreItems : (finalSale.items || []);
      for(const cItem of targetItems){
        const scrapItem = {
          productId: cItem.pid,
          productName: cItem.name || 'වාහන බැටරි (Core Battery)',
          category: 'battery',
          source: 'customer_exchange',
          quantity: cItem.qty || 1,
          sourceSaleId: finalSale.no,
          customerName: finalSale.customer,
          depositPaid: finalSale.coreDeduction || ((cItem.coreDeposit || 2000) * (cItem.qty || 1)),
          recordedBy: state.user?.name || 'Staff',
          date: today()
        };
        if(typeof window.addScrapInventory === 'function'){
          window.addScrapInventory(scrapItem).catch(err => console.warn('addScrapInventory err:', err));
        } else if(window.DB && typeof window.DB.addScrapInventory === 'function'){
          window.DB.addScrapInventory(scrapItem).catch(err => console.warn('DB.addScrapInventory err:', err));
        }
      }
    } catch(scErr){
      console.warn('Scrap auto-increment warning:', scErr);
    }
  }

  /* 7. Clear cart & checkout state */
  state.cart = [];
  window._shownCrossSellFor = new Set();
  const csToast = $('#crossSellToast');
  if(csToast) csToast.remove();

  window._discVal = '';
  checkoutState.notes = '';
  checkoutState.cardRef = '';
  checkoutState.orderNo = '';

  /* 8. Close modal & mobile cart */
  closeModal();
  closeMobileCart();

  /* 9. Re-render cart and product grid */
  renderCart();
  renderGrid();

  /* 10. Show receipt */
  showReceipt(finalSale);

  /* 11. Hardware: Cash Drawer & Thermal Print */
  if(window.Printer && window.Printer.isConnected){
    // Auto-open cash drawer on cash sales if enabled
    if(method === 'cash' && window.Printer.autoDrawer){
      window.Printer.openCashDrawer().catch(err => console.warn('Cash drawer kickout error:', err));
    }
    // Auto-print receipt directly over Bluetooth ESC/POS
    if(doPrint && window.Printer.autoPrint){
      window.Printer.printReceipt(finalSale).catch(err => {
        console.error('Bluetooth thermal print error, falling back to browser print:', err);
        window.print();
      });
    }
  } else if(doPrint){
    // Fallback to browser print dialog
    setTimeout(() => {
      window.print();
    }, 400);
  }

  /* 12. Update shift badge */
  if(typeof updateShiftIndicator === 'function') updateShiftIndicator();

  /* 13. Toast */
  toast('බිල්පත ' + finalSale.no + ' සම්පූර්ණ විය ✅');
}

function reprintCurrentReceipt(){
  if(window._lastReceiptSale && window.Printer && window.Printer.isConnected){
    window.Printer.printReceipt(window._lastReceiptSale);
  } else {
    window.print();
  }
}
window.reprintCurrentReceipt = reprintCurrentReceipt;

function showReceipt(s){
  window._lastReceiptSale = s;
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
      <table class="receipt-items-table no-card">
        <thead>
          <tr>
            <th style="text-align:left">Item</th>
            <th style="text-align:center;width:40px">Qty</th>
            <th style="text-align:right;width:75px">Amount</th>
          </tr>
        </thead>
        <tbody>${s.items.map(i => {
          const prod = (db.getProd ? db.getProd(i.pid) : null) || (db.products || []).find(p => p.id === i.pid || p.code === i.code);
          const itemName = i.nameEn || prod?.nameEn || i.name;
          return `<tr>
          <td style="text-align:left">
            <div class="r-item-name">${esc(itemName)}</div>
            <small class="r-item-code">${esc(i.code)}</small>
          </td>
          <td style="text-align:center;font-weight:600">${i.qty}</td>
          <td style="text-align:right;font-weight:700">${(i.price*i.qty).toFixed(2)}</td></tr>`;
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
    `<button class="btn btn-primary" onclick="reprintCurrentReceipt()" style="flex:1.2;font-weight:700">🖨️ Print Receipt</button>
     <button class="btn" onclick="closeModal()" style="flex:1">වසන්න</button>`);
}

window.pgBilling = pgBilling;
window.renderSearchTabsHtml = renderSearchTabsHtml;
window.renderSearchControlsHtml = renderSearchControlsHtml;
window.switchSearchMode = switchSearchMode;
window.clearVehicleSearch = clearVehicleSearch;
window.renderVehicleSearch = renderVehicleSearch;
window.debouncedProductSearch = debouncedProductSearch;
window.debouncedVehicleSearch = debouncedVehicleSearch;
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
function updateBillingPrinterBtn(){
  const btn = document.getElementById('posPrinterStatusBtn');
  const txt = document.getElementById('posPrinterStatusText');
  const isConn = window.Printer && window.Printer.isConnected;
  if(btn){
    btn.classList.toggle('connected', Boolean(isConn));
  }
  if(txt){
    txt.textContent = isConn ? 'සම්බන්ධයි' : 'Printer';
  }
}

function openPrinterQuickModal(){
  const isConn = window.Printer && window.Printer.isConnected;
  const pName = (window.Printer && window.Printer.printerName) || 'Bluetooth Thermal Printer';
  const width = (window.Printer && window.Printer.paperWidth) || '58';
  const autoP = (window.Printer && window.Printer.autoPrint) !== false;
  const autoD = (window.Printer && window.Printer.autoDrawer) !== false;

  const html = `
    <div class="printer-modal-content">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;padding:12px;background:var(--panel2,#0b1325);border-radius:10px;border:1px solid var(--line)">
        <span style="font-size:28px">🖨️</span>
        <div style="flex:1;min-width:0">
          <h4 style="margin:0;font-size:14.5px;color:var(--txt)">${esc(pName)}</h4>
          <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${isConn?'#10b981':'#94a3b8'}"></span>
            <small style="color:${isConn?'#10b981':'#94a3b8'};font-weight:700;font-size:11.5px">
              ${isConn ? 'සම්බන්ධ වී ඇත (Connected)' : 'සම්බන්ධ වී නොමැත (Disconnected)'}
            </small>
          </div>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px">
        ${!isConn ? `
          <button class="btn btn-primary" onclick="closeModal();if(window.Printer)Printer.connect().then(ok=>{if(ok&&window.updateBillingPrinterBtn)updateBillingPrinterBtn();})" style="width:100%;padding:12px 14px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;font-size:13px;white-space:normal;line-height:1.35;text-align:center">
            🔗 Bluetooth Printer සම්බන්ධ කරන්න (Connect)
          </button>
        ` : `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <button class="btn btn-primary" onclick="if(window.Printer)Printer.testPrint()" style="padding:10px 6px;font-size:12px;justify-content:center">
              🧪 Test Print (පරීක්ෂා)
            </button>
            <button class="btn" onclick="if(window.Printer)Printer.openCashDrawer()" style="padding:10px 6px;font-size:12px;justify-content:center">
              🚪 Cash Drawer (ලාච්චුව)
            </button>
          </div>
          <button class="btn" onclick="if(window.reprintLastReceipt)reprintLastReceipt();else if(window.Printer&&window._lastReceiptSale)Printer.printReceipt(window._lastReceiptSale);" style="padding:10px;font-size:12px;justify-content:center">
            🧾 අවසන් බිල මුද්‍රණය (Last Receipt)
          </button>
          <button class="btn btn-red" onclick="if(window.Printer)Printer.disconnect();closeModal();if(window.updateBillingPrinterBtn)updateBillingPrinterBtn();" style="padding:10px;font-size:12px;justify-content:center">
            🔌 ඉවත් කරන්න (Disconnect)
          </button>
        `}
      </div>

      <div style="background:var(--panel2,#0b1325);padding:14px;border-radius:10px;border:1px solid var(--line);display:flex;flex-direction:column;gap:12px;font-size:12.5px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <span>කඩදාසි ප්‍රමාණය (Paper Width):</span>
          <select onchange="localStorage.setItem('pos.printerWidth', this.value);if(window.toast)toast('කඩදාසි ප්‍රමාණය '+this.value+'mm ලෙස සුරකින ලදී','ok');if(window.updateBillingPrinterBtn)updateBillingPrinterBtn();" style="padding:6px 10px;border-radius:6px;width:95px;background:var(--bg,#080d1a);color:var(--txt,#fff);border:1px solid var(--line);font-size:13px">
            <option value="58" ${width==='58'?'selected':''}>58mm</option>
            <option value="80" ${width==='80'?'selected':''}>80mm</option>
          </select>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <span>බිල අවසන් කළ පසු Auto Print:</span>
          <input type="checkbox" ${autoP?'checked':''} onchange="localStorage.setItem('pos.printer.autoprint', this.checked);if(window.toast)toast('Auto Print '+ (this.checked?'සක්‍රියයි':'අක්‍රියයි'),'info')" style="width:18px;height:18px;accent-color:#10b981;cursor:pointer">
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <span>මුදල් ලාච්චුව Auto Open (Cash Drawer):</span>
          <input type="checkbox" ${autoD?'checked':''} onchange="localStorage.setItem('pos.printer.autodrawer', this.checked);if(window.toast)toast('Auto Drawer '+ (this.checked?'සක්‍රියයි':'අක්‍රියයි'),'info')" style="width:18px;height:18px;accent-color:#10b981;cursor:pointer">
        </div>
      </div>
    </div>
  `;

  if(typeof openModal === 'function'){
    openModal(
      '🖨️ Thermal Printer කළමනාකරණය',
      'ESC/POS 58mm / 80mm Settings',
      html,
      `<button class="btn btn-sm" onclick="closeModal()">වසන්න (Close)</button>`
    );
  }
}

window.openMobileCart = openMobileCart;
window.closeMobileCart = closeMobileCart;
window.updateFab = updateFab;
window.updateBillingPrinterBtn = updateBillingPrinterBtn;
window.openPrinterQuickModal = openPrinterQuickModal;
window.scanSerialForCheckout = scanSerialForCheckout;
window.scanNextEmptySerialCheckout = scanNextEmptySerialCheckout;
window.focusNextSerialOrCheckout = focusNextSerialOrCheckout;


