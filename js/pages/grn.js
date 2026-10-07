/* =========================================================
   js/pages/grn.js - Goods Received Note (GRN) & Weighted Average Costing (WAC)
   Fast, keyboard-friendly & responsive bulk-receiving for auto-parts POS
   ========================================================= */

var grnItems = window.grnItems = window.grnItems || [];

var grnState = window.grnState = window.grnState || {
  supplier: '',
  invoiceNo: '',
  date: today(),
  time: '',
  notes: '',
  selectedProduct: null,
  searchResults: [],
  activeSearchIndex: -1,
  editingIndex: -1,
  isDirty: false,
  lastSavedAt: null,
  draftBannerDismissed: false
};

/* ---------- Main Page Renderer ---------- */
function pgGRN(){
  const db = window.DB || {};
  const suppliers = db.suppliers || [];
  const nextNo = 'GRN-' + pad((db.counters?.grn || 0) + 1);
  const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const draft = (!grnState.draftBannerDismissed && grnItems.length === 0) ? grnCheckDraft() : null;

  // Calculate totals
  const totalUnits = grnItems.reduce((acc, it) => acc + Number(it.qty || 0), 0);
  const grossTotal = grnItems.reduce((acc, it) => acc + (Number(it.qty || 0) * Number(it.cost || 0)), 0);
  const grandTotal = grnItems.reduce((acc, it) => acc + Number(it.total || 0), 0);
  const totalDiscount = Math.max(0, grossTotal - grandTotal);

  setTimeout(() => {
    const box = $('#grnSelectedProdBox');
    if(box) box.focus();
  }, 120);

  return `
  <div class="grn-page">

    ${draft ? `
    <div class="grn-draft-banner" id="grnDraftBanner">
      <div class="grn-draft-banner-text">
        <span>⚠️ <b>සුරකින ලද කෙටුම්පතක් ඇත.</b> එය ලෝඩ් කරන්නද? <small style="color:var(--muted)">(${new Date(draft.savedAt).toLocaleTimeString()} - ${draft.items?.length || 0} items)</small></span>
      </div>
      <div class="grn-draft-banner-btns">
        <button type="button" class="btn btn-sm btn-primary" onclick="grnLoadDraft()">ලෝඩ් කරන්න / Load</button>
        <button type="button" class="btn btn-sm" onclick="grnDismissDraftBanner()">අලුතින් පටන් ගන්න / Dismiss</button>
      </div>
    </div>` : ''}

    <!-- Header -->
    <div class="grn-header">
      <div class="grn-title-wrap">
        <h2>📥 භාණ්ඩ ලැබීම් සටහන (GRN)</h2>
        <small>Goods Received Note · <span id="grnNoDisplay">${nextNo}</span></small>
      </div>
      <div class="grn-header-actions">
        <div id="grnDraftIndicator" class="grn-draft-indicator ${grnState.isDirty ? 'dirty' : ''}">
          <span class="dot"></span>
          <span id="grnDraftIndicatorText">${grnGetDraftIndicatorLabel()}</span>
        </div>
        <button type="button" class="btn btn-sm" onclick="grnShowHistory()">📜 ඉතිහාසය / History</button>
      </div>
    </div>

    <!-- 1. Supplier Section Card -->
    <div class="card grn-supplier-card">
      <div class="grn-sup-grid">
        <div>
          <label class="grn-field-label">🏢 සැපයුම්කරු / Supplier *</label>
          <div class="grn-sup-picker-row">
            <select id="grnSupplier" onchange="grnOnSupplierChange()">
              <option value="">-- සැපයුම්කරු තෝරන්න (Select Supplier) --</option>
              ${suppliers.map(s => `
                <option value="${esc(s.name)}" ${grnState.supplier === s.name ? 'selected' : ''}>
                  ${esc(s.name)} ${s.phone ? '· ' + esc(s.phone) : ''}
                </option>
              `).join('')}
              <option value="වෙනත්" ${grnState.supplier === 'වෙනත්' ? 'selected' : ''}>වෙනත් / Walk-in Supplier</option>
              <option value="__NEW__">+ අලුත් Supplier එකතු කරන්න</option>
            </select>
            <button type="button" class="btn btn-sm btn-blue" onclick="quickAddSupplier()" title="අලුත් Supplier">+ අලුත්</button>
          </div>
        </div>
        <div>
          <label class="grn-field-label">📄 Invoice No / බිල්පත් අංකය</label>
          <input id="grnInvoiceNo" placeholder="INV-SUP-2024-1234" value="${esc(grnState.invoiceNo || '')}" oninput="grnOnFieldChange()">
        </div>
        <div>
          <label class="grn-field-label">📅 දිනය / Date</label>
          <input type="date" id="grnDate" value="${grnState.date || today()}" onchange="grnOnFieldChange()">
        </div>
        <div>
          <label class="grn-field-label">⏰ වේලාව / Time</label>
          <input type="text" id="grnTime" value="${nowTime}" disabled style="opacity:0.75">
        </div>
      </div>
    </div>

    <!-- 2. Product Input Section Card -->
    <div class="card grn-search-card">
      <div class="card-h">
        <h3>➕ භාණ්ඩ එකතු කරන්න <small>Add Products to GRN · Enter=Add · Tab=Next · F2=Search · Esc=Clear</small></h3>
      </div>

      <!-- Inline Add Row (5 Columns) -->
      <div class="grn-input-row-wrap">
        <div class="grn-input-row">
          <!-- Col 1: Product Cell -->
          <div style="position:relative">
            <label class="grn-input-col-label">භාණ්ඩය / Item (F2)</label>
            <div id="grnSelectedProdBox" class="grn-selected-prod-box ${grnState.selectedProduct ? '' : 'empty'}"
                 tabindex="0"
                 onclick="grnOpenSearchOverlay()"
                 onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();grnOpenSearchOverlay();}">
              ${renderSelectedProdBox()}
            </div>

            <!-- Search Overlay Anchored to Inline Field -->
            <div id="grnSearchOverlay" class="grn-search-overlay hidden">
              <div class="grn-search-overlay-input-wrap">
                <input id="grnSearchInput" autocomplete="off"
                       placeholder="🔍 සොයන්න (නම / කේතය / OEM / Barcode)..."
                       oninput="grnSearchProducts(this.value)"
                       onkeydown="grnSearchKeydown(event)">
                <span class="grn-barcode-badge">📷 SCAN</span>
                <button type="button" class="grn-overlay-close-btn" onclick="grnCloseSearchOverlay()" title="Close">✕</button>
              </div>
              <div id="grnSearchDropdown" class="grn-search-dropdown"></div>
            </div>
          </div>

          <!-- Col 2: Qty Cell -->
          <div>
            <label class="grn-input-col-label">ප්‍රමාණය / Qty</label>
            <input id="grnInputQty" type="number" step="1" min="1" value="1"
                   placeholder="1" oninput="recalcInlineTotal()" onkeydown="grnRowFieldKeydown(event)">
            <div class="grn-qty-quick">
              <button type="button" onclick="grnQuickQty(1)">+1</button>
              <button type="button" onclick="grnQuickQty(5)">+5</button>
              <button type="button" onclick="grnQuickQty(10)">+10</button>
              <button type="button" onclick="grnQuickQty(50)">+50</button>
              <button type="button" onclick="grnQuickQty(100)">+100</button>
            </div>
          </div>

          <!-- Col 3: Cost Cell -->
          <div>
            <label class="grn-input-col-label">පිරිවැය / Cost</label>
            <input id="grnInputCost" type="number" step="0.01" min="0" value="0.00"
                   placeholder="0.00" oninput="recalcInlineTotal()" onkeydown="grnRowFieldKeydown(event)">
          </div>

          <!-- Col 4: Discount Cell -->
          <div>
            <label class="grn-input-col-label">වට්ටම % / Disc %</label>
            <input id="grnInputDisc" type="number" step="0.1" min="0" max="100" value="0"
                   placeholder="0" oninput="recalcInlineTotal()" onkeydown="grnRowFieldKeydown(event)">
          </div>

          <!-- Col 5: Total & Add -->
          <div>
            <label class="grn-input-col-label">එකතුව / Total</label>
            <div class="grn-input-total-box">
              <span id="grnInputTotal" class="grn-input-total-val">රු. 0.00</span>
              <span id="grnInputDiscSub" class="grn-input-disc-sub" style="display:none"></span>
            </div>
            <button type="button" class="btn btn-primary" style="margin-top:5px;width:100%;padding:5px 8px;font-size:12px;height:28px"
                    onclick="grnAddItem()">+ එකතු කරන්න (Add)</button>
          </div>
        </div>

        <div class="grn-input-row-actions">
          <span class="grn-hint">
            <kbd>Enter</kbd> = එකතු කරන්න &nbsp;|&nbsp;
            <kbd>Tab</kbd> = ඊළඟ කොටුව &nbsp;|&nbsp;
            <kbd>F2</kbd> = Search &nbsp;|&nbsp;
            <kbd>Esc</kbd> = Clear Row
          </span>
        </div>
      </div>
    </div>

    <!-- 3. Received Items Table Card -->
    <div class="card">
      <div class="card-h">
        <h3>📋 ලැබූ භාණ්ඩ ලැයිස්තුව <small id="grnItemCountBadge">${grnItems.length} items</small></h3>
      </div>
      <div class="tbl-wrap">
        <table class="grn-items-table">
          <thead>
            <tr>
              <th style="width:40px;text-align:center">#</th>
              <th>භාණ්ඩය / Item Details</th>
              <th style="text-align:center;width:120px">ප්‍රමාණය / Qty</th>
              <th style="text-align:right;width:130px">පිරිවැය / Unit Cost</th>
              <th style="text-align:center;width:100px">වට්ටම % / Disc</th>
              <th style="text-align:right;width:140px">එකතුව / Line Total</th>
              <th style="text-align:center;width:110px">ක්‍රියා / Actions</th>
            </tr>
          </thead>
          <tbody id="grnTableBody">
            ${renderGrnTableRows()}
          </tbody>
        </table>
      </div>
    </div>

    <!-- 4. Summary Card -->
    <div class="card">
      <div class="card-h">
        <h3>📊 සාරාංශය <small>GRN Summary & Notes</small></h3>
      </div>
      <div class="grn-summary">
        <div class="grn-summary-metrics">
          <div class="grn-summary-row">
            <span>භාණ්ඩ ගණන (Item Count):</span>
            <b id="grnSummaryItemCount">${grnItems.length}</b>
          </div>
          <div class="grn-summary-row">
            <span>මුළු ඒකක (Total Units):</span>
            <b id="grnSummaryTotalUnits">${num(totalUnits)} pcs</b>
          </div>
          <div class="grn-summary-row">
            <span>මුළු වට්ටම (Total Discount):</span>
            <b id="grnSummaryTotalDiscount" style="color:#fca5a5">${money(totalDiscount)}</b>
          </div>
          <div class="grn-summary-row total-row">
            <span>මුළු එකතුව (Grand Total):</span>
            <span id="grnSummaryGrandTotal" class="grn-summary-grand-total">${money(grandTotal)}</span>
          </div>
        </div>
        <div class="grn-notes-wrap">
          <label class="grn-field-label">📝 සටහන / Notes (Optional)</label>
          <textarea id="grnNotes" rows="3" placeholder="විස්තරය (උදා: Batch no, Delivery slip, Payment terms...)"
                    oninput="grnOnFieldChange()" style="resize:vertical">${esc(grnState.notes || '')}</textarea>
        </div>
      </div>
    </div>

    <!-- 5. Sticky Footer -->
    <div class="grn-footer-sticky">
      <button type="button" class="btn grn-btn-cancel" onclick="grnClearDraft(true)">
        ✕ අවලංගු කරන්න (Cancel)
      </button>
      <button type="button" class="btn btn-blue grn-btn-draft" onclick="grnSaveDraft(true)">
        💾 Draft Save (Ctrl+S)
      </button>
      <button type="button" class="btn btn-green grn-btn-confirm" id="grnConfirmBtn"
              ${grnItems.length ? '' : 'disabled'} onclick="grnConfirmModal()">
        ✅ GRN තහවුරු කරන්න (F9)
      </button>
    </div>

  </div>`;
}

/* ---------- Helper: Render Selected Product in Inline Add Row ---------- */
function renderSelectedProdBox(){
  const p = grnState.selectedProduct;
  if(!p){
    return `<span>🔍 භාණ්ඩයක් තෝරා නැත (Click to search)</span>`;
  }
  return `
    <div class="grn-selected-prod-info">
      <b>${esc(p.code)} <small style="font-weight:400;color:var(--muted)">(${esc(p.unit || 'pcs')})</small></b>
      <span>${esc(p.name)}</span>
      <small>දැනට තොග: <b>${p.qty}</b> | පිරිවැය: <b>${money(p.cost)}</b></small>
    </div>
    <button type="button" class="grn-sp-clear-btn" onclick="event.stopPropagation();grnClearSelectedProduct()" title="ඉවත් කරන්න">✕</button>`;
}

/* ---------- Helper: Render Table Rows (View & Inline Edit) ---------- */
function renderGrnTableRows(){
  if(!grnItems.length){
    return `<tr><td colspan="7" class="empty" style="text-align:center;padding:26px;color:var(--muted)">භාණ්ඩ එකතු කර නැත (No items added yet)</td></tr>`;
  }

  const db = window.DB || {};

  return grnItems.map((r, i) => {
    const p = db.getProd ? db.getProd(r.pid) : (db.products || []).find(x => x.id === r.pid);
    const isEditing = grnState.editingIndex === i;

    if(isEditing){
      return `
      <tr class="grn-editing-row" style="background:#1b283d">
        <td style="text-align:center"><b>${i + 1}</b></td>
        <td>
          <div class="grn-p-cell">
            <span class="grn-p-code">${esc(r.code || (p ? p.code : r.pid))}</span>
            <span class="grn-p-name">${esc(r.name || (p ? p.name : ''))}</span>
          </div>
        </td>
        <td style="text-align:center">
          <input id="grnEditQty_${i}" class="grn-edit-input" type="number" step="1" min="1"
                 value="${r.qty}" oninput="grnLiveRecalcEditRow(${i})"
                 onkeydown="if(event.key==='Enter')grnSaveEdit(${i}); if(event.key==='Escape')grnCancelEdit(${i});">
        </td>
        <td style="text-align:right">
          <input id="grnEditCost_${i}" class="grn-edit-input" type="number" step="0.01" min="0"
                 value="${r.cost}" oninput="grnLiveRecalcEditRow(${i})"
                 onkeydown="if(event.key==='Enter')grnSaveEdit(${i}); if(event.key==='Escape')grnCancelEdit(${i});">
        </td>
        <td style="text-align:center">
          <input id="grnEditDisc_${i}" class="grn-edit-input" type="number" step="0.1" min="0" max="100"
                 value="${r.disc || 0}" oninput="grnLiveRecalcEditRow(${i})"
                 onkeydown="if(event.key==='Enter')grnSaveEdit(${i}); if(event.key==='Escape')grnCancelEdit(${i});" style="width:65px">
        </td>
        <td style="text-align:right">
          <b id="grnEditTotal_${i}" style="color:var(--primary)">${money(r.total)}</b>
        </td>
        <td style="text-align:center">
          <div class="grn-actions-cell">
            <button type="button" class="btn btn-sm btn-green" onclick="grnSaveEdit(${i})" title="සුරකින්න">💾</button>
            <button type="button" class="btn btn-sm" onclick="grnCancelEdit(${i})" title="අවලංගු">✕</button>
          </div>
        </td>
      </tr>`;
    }

    const disc = Number(r.disc || 0);

    return `
    <tr>
      <td style="text-align:center;color:var(--muted)">${i + 1}</td>
      <td>
        <div class="grn-p-cell">
          <span class="grn-p-code">${esc(r.code || (p ? p.code : r.pid))}</span>
          <span class="grn-p-name">${esc(r.name || (p ? p.name : ''))}</span>
          <span class="grn-p-sub">${esc(p?.nameEn || '')} ${p?.brand ? '· ' + esc(p.brand) : ''}</span>
        </div>
      </td>
      <td style="text-align:center">
        <b>${r.qty}</b> <small style="color:var(--muted)">${esc(r.unit || p?.unit || 'pcs')}</small>
      </td>
      <td style="text-align:right">${money(r.cost)}</td>
      <td style="text-align:center">
        ${disc > 0 ? `<span class="grn-disc-tag">-${disc}%</span>` : `<span style="color:var(--muted)">-</span>`}
      </td>
      <td style="text-align:right;font-weight:700;color:var(--primary)">
        ${money(r.total)}
      </td>
      <td style="text-align:center">
        <div class="grn-actions-cell">
          <button type="button" class="btn btn-sm" onclick="grnEditItem(${i})" title="සංස්කරණය / Edit">✏️</button>
          <button type="button" class="btn btn-sm btn-red" onclick="grnDeleteItem(${i})" title="ඉවත් කරන්න / Delete">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ---------- Search Overlay & Product Autocomplete ---------- */
function grnOpenSearchOverlay(){
  const overlay = $('#grnSearchOverlay');
  if(!overlay) return;
  overlay.classList.remove('hidden');
  const inp = $('#grnSearchInput');
  if(inp){
    inp.focus();
    inp.select();
    grnSearchProducts(inp.value || '');
  }
}

function grnCloseSearchOverlay(){
  const overlay = $('#grnSearchOverlay');
  if(overlay) overlay.classList.add('hidden');
}

function grnSearchProducts(query){
  const q = (query || '').trim().toLowerCase();
  const dd = $('#grnSearchDropdown');
  if(!dd) return;

  const db = window.DB || {};
  const prods = (db.products || []).filter(p => p.active !== false);

  let matched = [];
  if(!q){
    matched = prods.slice(0, 8);
  } else {
    matched = prods.filter(p => {
      if((p.code || '').toLowerCase().includes(q)) return true;
      if((p.name || '').toLowerCase().includes(q)) return true;
      if((p.nameEn || '').toLowerCase().includes(q)) return true;
      if((p.oemNo || '').toLowerCase().includes(q)) return true;
      if((p.brand || '').toLowerCase().includes(q)) return true;
      if((p.model || '').toLowerCase().includes(q)) return true;
      if((p.cat || '').toLowerCase().includes(q)) return true;
      if((p.barcode || '').toLowerCase().includes(q)) return true;
      if(Array.isArray(p.altNos) && p.altNos.some(a => (a || '').toLowerCase().includes(q))) return true;
      if(Array.isArray(p.chassis) && p.chassis.some(c => (c || '').toLowerCase().includes(q))) return true;
      if(Array.isArray(p.engine) && p.engine.some(e => (e || '').toLowerCase().includes(q))) return true;
      return false;
    });
  }

  const results = matched.slice(0, 8);
  grnState.searchResults = results;
  grnState.activeSearchIndex = results.length > 0 ? 0 : -1;

  if(!results.length){
    dd.innerHTML = `<div class="grn-search-no-results">🔍 '${esc(query)}' සඳහා භාණ්ඩ හමු නොවීය</div>`;
  } else {
    dd.innerHTML = results.map((p, idx) => `
      <div class="grn-search-result ${idx === 0 ? 'active' : ''}" data-idx="${idx}"
           onclick="grnSelectProduct('${p.id}')">
        <div class="grn-sr-left">
          <span class="grn-sr-code">${esc(p.code)}</span>
          <span class="grn-sr-name">${esc(p.name)}</span>
          <span class="grn-sr-sub">${esc(p.nameEn || '')} ${p.brand ? '· ' + esc(p.brand) : ''} ${p.oemNo ? '· OEM: ' + esc(p.oemNo) : ''}</span>
        </div>
        <div class="grn-sr-right">
          <span class="grn-sr-cost">${money(p.cost)}</span>
          <span class="grn-sr-qty">තොග: ${p.qty} ${esc(p.unit || 'pcs')}</span>
        </div>
      </div>
    `).join('');
  }

  dd.classList.remove('hidden');
}

function grnSearchKeydown(e){
  const results = grnState.searchResults || [];
  const dd = $('#grnSearchDropdown');

  if(e.key === 'ArrowDown'){
    e.preventDefault();
    if(results.length > 0){
      grnState.activeSearchIndex = (grnState.activeSearchIndex + 1) % results.length;
      grnUpdateActiveSearchItem();
    }
    return;
  }

  if(e.key === 'ArrowUp'){
    e.preventDefault();
    if(results.length > 0){
      grnState.activeSearchIndex = (grnState.activeSearchIndex - 1 + results.length) % results.length;
      grnUpdateActiveSearchItem();
    }
    return;
  }

  if(e.key === 'Enter'){
    e.preventDefault();
    if(dd && !dd.classList.contains('hidden') && results.length > 0 && grnState.activeSearchIndex >= 0){
      const sel = results[grnState.activeSearchIndex];
      if(sel) grnSelectProduct(sel.id);
    } else {
      grnBarcodeLookup(e.target.value.trim());
    }
    return;
  }

  if(e.key === 'Escape'){
    e.preventDefault();
    grnCloseSearchOverlay();
    $('#grnSelectedProdBox')?.focus();
    return;
  }
}

function grnUpdateActiveSearchItem(){
  const dd = $('#grnSearchDropdown');
  if(!dd) return;
  const items = dd.querySelectorAll('.grn-search-result');
  items.forEach((item, idx) => {
    if(idx === grnState.activeSearchIndex){
      item.classList.add('active');
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('active');
    }
  });
}

function grnSelectProduct(productId){
  grnFillProduct(productId);
}

function grnFillProduct(productId){
  const db = window.DB || {};
  const p = db.getProd ? db.getProd(productId) : (db.products || []).find(x => x.id === productId);
  if(!p) return;

  grnState.selectedProduct = p;

  const box = $('#grnSelectedProdBox');
  if(box){
    box.className = 'grn-selected-prod-box';
    box.innerHTML = renderSelectedProdBox();
  }

  const costInp = $('#grnInputCost');
  if(costInp) costInp.value = Number(p.cost || 0).toFixed(2);

  const discInp = $('#grnInputDisc');
  if(discInp) discInp.value = 0;

  const qtyInp = $('#grnInputQty');
  if(qtyInp){
    qtyInp.value = 1;
    qtyInp.focus();
    qtyInp.select();
  }

  recalcInlineTotal();
  grnCloseSearchOverlay();

  const sInp = $('#grnSearchInput');
  if(sInp) sInp.value = '';
}

function grnClearSelectedProduct(){
  grnState.selectedProduct = null;
  const box = $('#grnSelectedProdBox');
  if(box){
    box.className = 'grn-selected-prod-box empty';
    box.innerHTML = renderSelectedProdBox();
  }
  const costInp = $('#grnInputCost');
  if(costInp) costInp.value = '0.00';
  const qtyInp = $('#grnInputQty');
  if(qtyInp) qtyInp.value = 1;
  const discInp = $('#grnInputDisc');
  if(discInp) discInp.value = 0;
  recalcInlineTotal();
}

/* ---------- Barcode Scanner Lookup ---------- */
function grnBarcodeLookup(code){
  if(!code) return;
  const q = code.trim().toLowerCase();
  const db = window.DB || {};
  const prods = (db.products || []).filter(p => p.active !== false);

  // 1. Exact match on code, oemNo, altNos, barcode
  const exact = prods.filter(p => {
    if((p.code || '').toLowerCase() === q) return true;
    if((p.oemNo || '').toLowerCase() === q) return true;
    if((p.barcode || '').toLowerCase() === q) return true;
    if(Array.isArray(p.altNos) && p.altNos.some(a => (a || '').toLowerCase() === q)) return true;
    return false;
  });

  if(exact.length === 1){
    grnFillProduct(exact[0].id);
    toast('භාණ්ඩය තෝරා ගන්නා ලදී: ' + exact[0].code);
    return;
  }

  if(exact.length > 1){
    grnState.searchResults = exact.slice(0, 8);
    grnState.activeSearchIndex = 0;
    grnSearchProducts(code);
    return;
  }

  // 2. Partial search fallback
  const partial = prods.filter(p => {
    if((p.code || '').toLowerCase().includes(q)) return true;
    if((p.name || '').toLowerCase().includes(q)) return true;
    if((p.nameEn || '').toLowerCase().includes(q)) return true;
    if((p.oemNo || '').toLowerCase().includes(q)) return true;
    if(Array.isArray(p.altNos) && p.altNos.some(a => (a || '').toLowerCase().includes(q))) return true;
    return false;
  });

  if(partial.length === 1){
    grnFillProduct(partial[0].id);
    toast('භාණ්ඩය තෝරා ගන්නා ලදී: ' + partial[0].code);
  } else if(partial.length > 1){
    grnSearchProducts(code);
  } else {
    toast('භාණ්ඩය හමු නොවීය', 'warn');
  }
}

/* ---------- Inline Row Calculations & Quick Qty ---------- */
function recalcInlineTotal(){
  const qty = parseFloat($('#grnInputQty')?.value) || 0;
  const cost = parseFloat($('#grnInputCost')?.value) || 0;
  const disc = Math.min(100, Math.max(0, parseFloat($('#grnInputDisc')?.value) || 0));

  const gross = qty * cost;
  const discAmount = gross * (disc / 100);
  const total = gross - discAmount;

  const totEl = $('#grnInputTotal');
  if(totEl) totEl.textContent = money(total);

  const subEl = $('#grnInputDiscSub');
  if(subEl){
    if(disc > 0 && discAmount > 0){
      subEl.style.display = 'block';
      subEl.textContent = `වට්ටම: − ${money(discAmount)}`;
    } else {
      subEl.style.display = 'none';
      subEl.textContent = '';
    }
  }

  return total;
}

function grnRecalcInputRow(){
  return recalcInlineTotal();
}

function grnQuickQty(amount){
  const inp = $('#grnInputQty');
  if(!inp) return;
  const cur = parseInt(inp.value) || 0;
  inp.value = cur <= 1 && cur !== 1 ? amount : (cur + amount);
  recalcInlineTotal();
}

function grnRowFieldKeydown(e){
  if(e.key === 'Enter'){
    e.preventDefault();
    grnAddItem();
  } else if(e.key === 'Escape'){
    e.preventDefault();
    grnClearSelectedProduct();
    $('#grnSelectedProdBox')?.focus();
  }
}

/* ---------- Add Item to GRN List ---------- */
function grnAddItem(){
  if(typeof requireActiveShift === 'function' && !requireActiveShift('GRN save')) return;

  const p = grnState.selectedProduct;
  if(!p){
    toast('කරුණාකර පළමුව භාණ්ඩයක් තෝරන්න (Select a product first)', 'warn');
    grnOpenSearchOverlay();
    return;
  }

  const qty = parseInt($('#grnInputQty')?.value) || 0;
  if(qty <= 0){
    toast('ප්‍රමාණය 0ට වඩා වැඩි විය යුතුය (Qty must be > 0)', 'warn');
    $('#grnInputQty')?.focus();
    return;
  }

  const cost = parseFloat($('#grnInputCost')?.value);
  if(isNaN(cost) || cost < 0){
    toast('පිරිවැය වැරදියි (Cost must be >= 0)', 'warn');
    $('#grnInputCost')?.focus();
    return;
  }

  const disc = Math.min(100, Math.max(0, parseFloat($('#grnInputDisc')?.value) || 0));
  const lineTotal = qty * cost * (1 - (disc / 100));

  // If item already exists in grnItems, merge quantity & update cost
  const existingIdx = grnItems.findIndex(x => x.pid === p.id);
  if(existingIdx >= 0){
    grnItems[existingIdx].qty += qty;
    grnItems[existingIdx].cost = cost;
    grnItems[existingIdx].disc = disc;
    grnItems[existingIdx].total = grnItems[existingIdx].qty * cost * (1 - (disc / 100));
    toast(`'${p.code}' ප්‍රමාණය වැඩි කළා (+${qty} pcs) ✅`);
  } else {
    grnItems.push({
      pid: p.id,
      code: p.code,
      name: p.name,
      nameEn: p.nameEn || '',
      unit: p.unit || 'pcs',
      qty,
      cost,
      disc,
      total: lineTotal
    });
    toast(`'${p.code}' GRN ලැයිස්තුවට එකතු කළා ✅`);
  }

  grnClearSelectedProduct();
  grnRecalculate();
  grnState.isDirty = true;
  grnUpdateDraftIndicator();

  $('#grnSelectedProdBox')?.focus();
}

/* ---------- Edit / Delete Row Helpers ---------- */
function grnEditItem(index){
  grnState.editingIndex = index;
  const tbody = $('#grnTableBody');
  if(tbody) tbody.innerHTML = renderGrnTableRows();

  setTimeout(() => {
    const qInp = $(`#grnEditQty_${index}`);
    if(qInp){
      qInp.focus();
      qInp.select();
    }
  }, 50);
}

function grnLiveRecalcEditRow(index){
  const q = parseFloat($(`#grnEditQty_${index}`)?.value) || 0;
  const c = parseFloat($(`#grnEditCost_${index}`)?.value) || 0;
  const d = Math.min(100, Math.max(0, parseFloat($(`#grnEditDisc_${index}`)?.value) || 0));
  const lineTot = q * c * (1 - (d / 100));

  const totEl = $(`#grnEditTotal_${index}`);
  if(totEl) totEl.textContent = money(lineTot);
}

function grnSaveEdit(index){
  if(index < 0 || index >= grnItems.length) return;

  const q = parseInt($(`#grnEditQty_${index}`)?.value) || 0;
  if(q <= 0){
    toast('ප්‍රමාණය 0ට වඩා වැඩි විය යුතුය', 'warn');
    $(`#grnEditQty_${index}`)?.focus();
    return;
  }

  const c = parseFloat($(`#grnEditCost_${index}`)?.value);
  if(isNaN(c) || c < 0){
    toast('පිරිවැය වැරදියි', 'warn');
    $(`#grnEditCost_${index}`)?.focus();
    return;
  }

  const d = Math.min(100, Math.max(0, parseFloat($(`#grnEditDisc_${index}`)?.value) || 0));

  grnItems[index].qty = q;
  grnItems[index].cost = c;
  grnItems[index].disc = d;
  grnItems[index].total = q * c * (1 - (d / 100));

  grnState.editingIndex = -1;
  grnRecalculate();
  grnState.isDirty = true;
  grnUpdateDraftIndicator();
  toast('භාණ්ඩය යාවත්කාලීන විය ✅');
}

function grnCancelEdit(index){
  grnState.editingIndex = -1;
  const tbody = $('#grnTableBody');
  if(tbody) tbody.innerHTML = renderGrnTableRows();
}

function grnDeleteItem(index){
  if(index < 0 || index >= grnItems.length) return;
  const item = grnItems[index];
  grnItems.splice(index, 1);

  if(grnState.editingIndex === index) grnState.editingIndex = -1;

  grnRecalculate();
  grnState.isDirty = true;
  grnUpdateDraftIndicator();
  toast(`'${item.code || 'භාණ්ඩය'}' ලැයිස්තුවෙන් ඉවත් කළා 🗑️`);
}

/* ---------- Recalculate Totals & Update DOM ---------- */
function grnRecalculate(){
  let totalUnits = 0;
  let grossTotal = 0;
  let grandTotal = 0;

  grnItems.forEach(it => {
    const q = Number(it.qty || 0);
    const c = Number(it.cost || 0);
    const d = Math.min(100, Math.max(0, Number(it.disc || 0)));
    const lineTotal = q * c * (1 - (d / 100));
    it.total = lineTotal;

    totalUnits += q;
    grossTotal += (q * c);
    grandTotal += lineTotal;
  });

  const totalDiscount = Math.max(0, grossTotal - grandTotal);

  // Update summary DOM elements
  const elCount = $('#grnSummaryItemCount');
  if(elCount) elCount.textContent = grnItems.length;

  const elBadge = $('#grnItemCountBadge');
  if(elBadge) elBadge.textContent = `${grnItems.length} items`;

  const elUnits = $('#grnSummaryTotalUnits');
  if(elUnits) elUnits.textContent = `${num(totalUnits)} pcs`;

  const elDisc = $('#grnSummaryTotalDiscount');
  if(elDisc) elDisc.textContent = money(totalDiscount);

  const elGrand = $('#grnSummaryGrandTotal');
  if(elGrand) elGrand.textContent = money(grandTotal);

  const btnConfirm = $('#grnConfirmBtn');
  if(btnConfirm) btnConfirm.disabled = (grnItems.length === 0);

  // Re-render table body
  const tbody = $('#grnTableBody');
  if(tbody) tbody.innerHTML = renderGrnTableRows();
}

/* ---------- Field Changes & Supplier Handlers ---------- */
function grnOnFieldChange(){
  grnState.invoiceNo = $('#grnInvoiceNo')?.value || '';
  grnState.date = $('#grnDate')?.value || today();
  grnState.notes = $('#grnNotes')?.value || '';
  grnState.isDirty = true;
  grnUpdateDraftIndicator();
}

function grnOnSupplierChange(){
  const supEl = $('#grnSupplier');
  if(!supEl) return;

  if(supEl.value === '__NEW__'){
    supEl.value = grnState.supplier || '';
    quickAddSupplier();
    return;
  }

  grnState.supplier = supEl.value;
  supEl.style.borderColor = '';
  grnOnFieldChange();
}

/* ---------- Draft Management (Auto-Save, Load, Clear) ---------- */
function grnGetDraftKey(){
  const uid = (typeof state !== 'undefined' && state.user && state.user.id) ? state.user.id : 'guest';
  return 'grn_draft_' + uid;
}

function grnCheckDraft(){
  try {
    const raw = localStorage.getItem(grnGetDraftKey());
    if(!raw) return null;
    const d = JSON.parse(raw);
    if(d && d.savedAt && (Date.now() - d.savedAt < 24 * 60 * 60 * 1000)){
      if((d.items && d.items.length > 0) || d.supplier || d.invoiceNo){
        return d;
      }
    }
  } catch(e){}
  return null;
}

function grnSaveDraft(manual = false){
  grnState.supplier = $('#grnSupplier')?.value || grnState.supplier || '';
  grnState.invoiceNo = $('#grnInvoiceNo')?.value || grnState.invoiceNo || '';
  grnState.date = $('#grnDate')?.value || grnState.date || today();
  grnState.notes = $('#grnNotes')?.value || grnState.notes || '';

  const draftData = {
    supplier: grnState.supplier,
    invoiceNo: grnState.invoiceNo,
    date: grnState.date,
    notes: grnState.notes,
    items: grnItems,
    savedAt: Date.now()
  };

  try {
    localStorage.setItem(grnGetDraftKey(), JSON.stringify(draftData));
    grnState.isDirty = false;
    grnState.lastSavedAt = Date.now();
    grnUpdateDraftIndicator();
    if(manual) toast('කෙටුම්පත සාර්ථකව සුරකින ලදී 💾');
  } catch(e){
    if(manual) toast('කෙටුම්පත සුරැකීමට නොහැකි විය', 'err');
  }
}

function grnLoadDraft(){
  const draft = grnCheckDraft();
  if(!draft){
    toast('සුරකින ලද කෙටුම්පතක් හමු නොවීය', 'warn');
    return;
  }

  grnState.supplier = draft.supplier || '';
  grnState.invoiceNo = draft.invoiceNo || '';
  grnState.date = draft.date || today();
  grnState.notes = draft.notes || '';
  grnState.draftBannerDismissed = true;
  grnState.isDirty = false;
  grnState.lastSavedAt = draft.savedAt || Date.now();

  grnItems.length = 0;
  (draft.items || []).forEach(it => grnItems.push(it));

  render();
  toast('කෙටුම්පත ලෝඩ් කරන ලදී ✅');
}

function grnDismissDraftBanner(){
  grnState.draftBannerDismissed = true;
  const b = $('#grnDraftBanner');
  if(b) b.remove();
}

function grnClearDraft(confirmFirst = false){
  if(confirmFirst && grnItems.length > 0){
    if(!confirm('සියලු තොරතුරු මකා දමා නව GRN එකක් ආරම්භ කරන්නද? (Clear all data?)')){
      return;
    }
  }

  try {
    localStorage.removeItem(grnGetDraftKey());
  } catch(e){}

  grnItems.length = 0;
  grnState.supplier = '';
  grnState.invoiceNo = '';
  grnState.date = today();
  grnState.notes = '';
  grnState.selectedProduct = null;
  grnState.isDirty = false;
  grnState.lastSavedAt = null;
  grnState.editingIndex = -1;
  grnState.draftBannerDismissed = true;

  render();
  toast('කෙටුම්පත ඉවත් කරන ලදී');
}

function grnGetDraftIndicatorLabel(){
  if(grnState.isDirty) return 'Unsaved changes 🟡';
  if(grnState.lastSavedAt){
    const s = Math.floor((Date.now() - grnState.lastSavedAt) / 1000);
    if(s < 10) return 'Draft Saved 💾';
    if(s < 60) return `Saved ${s}s ago 🟢`;
    return `Saved ${Math.floor(s / 60)}m ago 🟢`;
  }
  return 'Draft Ready 💾';
}

function grnUpdateDraftIndicator(){
  const ind = $('#grnDraftIndicator');
  const txt = $('#grnDraftIndicatorText');
  if(!ind || !txt) return;

  if(grnState.isDirty){
    ind.classList.add('dirty');
    txt.textContent = 'Unsaved changes 🟡';
  } else {
    ind.classList.remove('dirty');
    txt.textContent = grnGetDraftIndicatorLabel();
  }
}

/* ---------- Confirmation Modal with Weighted Average Cost (WAC) Preview ---------- */
function grnConfirmModal(){
  if(typeof requireActiveShift === 'function' && !requireActiveShift('GRN save')) return;

  const supEl = $('#grnSupplier');
  const sup = supEl?.value || grnState.supplier;

  if(!sup){
    toast('කරුණාකර සැපයුම්කරු තෝරන්න (Supplier required)', 'err');
    if(supEl){
      supEl.style.borderColor = 'var(--red)';
      supEl.focus();
    }
    return;
  }

  if(!grnItems.length){
    toast('GRN එක සඳහා අවම වශයෙන් එක් භාණ්ඩයක්වත් එකතු කරන්න', 'warn');
    return;
  }

  const db = window.DB || {};
  const nextNo = 'GRN-' + pad((db.counters?.grn || 0) + 1);
  const invNo = $('#grnInvoiceNo')?.value || grnState.invoiceNo || '';
  const dateVal = $('#grnDate')?.value || grnState.date || today();

  const totalUnits = grnItems.reduce((a, r) => a + Number(r.qty || 0), 0);
  const grandTotal = grnItems.reduce((a, r) => a + Number(r.total || 0), 0);

  // Calculate WAC for each received item
  const wacItems = grnItems.map(item => {
    const p = db.getProd ? db.getProd(item.pid) : (db.products || []).find(x => x.id === item.pid);
    const oldQty = Math.max(0, p ? Number(p.qty || 0) : 0);
    const oldCost = Number(p ? Number(p.cost || 0) : 0);
    const newQty = Number(item.qty || 0);
    const effectiveUnitCost = Number(item.cost || 0) * (1 - (Number(item.disc || 0) / 100));

    const totalQty = oldQty + newQty;
    const newAvgCost = totalQty > 0
      ? ((oldQty * oldCost) + (newQty * effectiveUnitCost)) / totalQty
      : effectiveUnitCost;
    const roundedNewAvg = Math.round(newAvgCost * 100) / 100;
    const diff = roundedNewAvg - oldCost;

    return {
      code: item.code || (p ? p.code : item.pid),
      name: item.name || (p ? p.name : ''),
      oldCost,
      newAvgCost: roundedNewAvg,
      diff,
      oldQty,
      newQty,
      totalQty
    };
  });

  const wacListHtml = wacItems.map(w => {
    const diffSign = w.diff > 0 ? `+${w.diff.toFixed(2)}` : (w.diff < 0 ? w.diff.toFixed(2) : '0.00');
    const diffClass = w.diff > 0 ? 'up' : (w.diff < 0 ? 'down' : 'same');
    return `
      <div class="grn-wac-item">
        <div class="grn-wac-prod">
          <b>${esc(w.code)}</b> <small style="color:var(--muted)">${esc(w.name)}</small>
        </div>
        <div class="grn-wac-calc">
          Old: ${money(w.oldCost)} → <b>New avg: ${money(w.newAvgCost)}</b>
          <span class="grn-wac-diff ${diffClass}">(${diffSign})</span>
        </div>
      </div>`;
  }).join('');

  const modalBody = `
    <div class="grn-confirm-summary">
      <div class="grn-confirm-row">
        <span>GRN අංකය:</span> <b>${nextNo}</b>
      </div>
      <div class="grn-confirm-row">
        <span>Supplier / සැපයුම්කරු:</span> <b>${esc(sup)}</b>
      </div>
      <div class="grn-confirm-row">
        <span>Invoice No / ඉන්වොයිසිය:</span> <b>${esc(invNo || 'නැත (None)')}</b>
      </div>
      <div class="grn-confirm-row">
        <span>දිනය / Date:</span> <b>${dateVal}</b>
      </div>
      <hr style="margin:8px 0;border:none;border-top:1px solid var(--line)">
      <div class="grn-confirm-row">
        <span>භාණ්ඩ ගණන (Items):</span> <b>${grnItems.length}</b>
      </div>
      <div class="grn-confirm-row">
        <span>මුළු ඒකක (Total Units):</span> <b>${totalUnits} pcs</b>
      </div>
      <div class="grn-confirm-row" style="font-size:15px;color:var(--primary);margin-top:4px">
        <span>මුළු එකතුව (Grand Total):</span> <b>${money(grandTotal)}</b>
      </div>
    </div>

    <div class="grn-wAC-preview-box">
      <div class="grn-wAC-title">⚖️ Weighted Average Cost (WAC) Update</div>
      <div class="grn-wac-list">
        ${wacListHtml}
      </div>
    </div>

    <div class="grn-confirm-warning">
      ⚠️ තහවුරු කිරීමෙන් පසු භාණ්ඩ නැවත ආපසු ගැනීමට නොහැක. (Stock and WAC will update immediately)
    </div>`;

  const modalFooter = `
    <button type="button" class="btn" onclick="closeModal()">අවලංගු / Cancel</button>
    <button type="button" class="btn btn-green" onclick="grnSave()">✅ තහවුරු කරන්න / Confirm & Save</button>`;

  openModal('✅ GRN තහවුරු කරන්න?', 'Confirm Goods Received Note', modalBody, modalFooter);
}

/* ---------- Save GRN & Execute WAC Stock Update ---------- */
async function grnSave(){
  if(typeof requireActiveShift === 'function' && !requireActiveShift('GRN save')) return;

  if(!grnItems.length) return;

  const db = window.DB || {};
  const sup = $('#grnSupplier')?.value || grnState.supplier || 'නොදන්නා සැපයුම්කරු';
  const invNo = $('#grnInvoiceNo')?.value || grnState.invoiceNo || '';
  const dateVal = $('#grnDate')?.value || grnState.date || today();
  const notesVal = $('#grnNotes')?.value || grnState.notes || '';

  const grandTotal = grnItems.reduce((a, r) => a + Number(r.total || 0), 0);
  const grossTotal = grnItems.reduce((a, r) => a + (Number(r.qty || 0) * Number(r.cost || 0)), 0);
  const totalDiscount = Math.max(0, grossTotal - grandTotal);

  /* 1. Update Product WAC and Stock */
  for(const r of grnItems){
    const p = db.getProd ? db.getProd(r.pid) : (db.products || []).find(x => x.id === r.pid);
    if(p){
      const currentQty = Math.max(0, Number(p.qty || 0));
      const currentCost = Number(p.cost || 0);
      const incomingQty = Number(r.qty || 0);
      const effectiveIncomingCost = Number(r.cost || 0) * (1 - (Number(r.disc || 0) / 100));

      const totalQty = currentQty + incomingQty;
      const weightedCost = totalQty > 0
        ? ((currentQty * currentCost) + (incomingQty * effectiveIncomingCost)) / totalQty
        : effectiveIncomingCost;

      p.cost = Math.round(weightedCost * 100) / 100;
      p.qty = totalQty;

      if(window.FB && window.FB.fbUpdate){
        await window.FB.fbUpdate(window.FB.COL.products, p.id, {
          qty: p.qty,
          cost: p.cost
        });
      }
    }
  }

  /* 2. Update Supplier Accounts Payable balance */
  const supObj = (db.suppliers || []).find(s => s.name === sup);
  if(supObj){
    supObj.payable = (supObj.payable || 0) + grandTotal;
    if(window.FB && window.FB.fbUpdate){
      window.FB.fbUpdate(window.FB.COL.suppliers, supObj.id, {
        payable: supObj.payable
      });
    }
  }

  /* 3. Build & Save GRN Record */
  if(!db.counters) db.counters = {};
  const grnNo = 'GRN-' + pad(db.counters.grn = (db.counters.grn || 0) + 1);

  const grnRecord = {
    id: uid('G'),
    no: grnNo,
    date: dateVal,
    supplier: sup,
    invoiceNo: invNo,
    notes: notesVal,
    items: JSON.parse(JSON.stringify(grnItems)),
    subtotal: grossTotal,
    discount: totalDiscount,
    total: grandTotal,
    createdAt: new Date().toISOString()
  };

  if(!db.grns) db.grns = [];
  db.grns.push(grnRecord);

  if(window.FB && window.FB.fbAdd){
    await window.FB.fbAdd(window.FB.COL.grns, grnRecord);
  }
  if(typeof saveDB === 'function') saveDB();

  /* 4. Clear Draft & State */
  try {
    localStorage.removeItem(grnGetDraftKey());
  } catch(e){}

  grnItems.length = 0;
  grnState.supplier = '';
  grnState.invoiceNo = '';
  grnState.date = today();
  grnState.notes = '';
  grnState.selectedProduct = null;
  grnState.isDirty = false;
  grnState.lastSavedAt = null;

  closeModal();
  render();
  toast(`GRN ${grnRecord.no} සාර්ථකව සුරකින ලදී ✅ සාමාන්‍ය පිරිවැය (WAC) සහ තොග යාවත්කාලීන විය`);
}

/* ---------- History Modal & Details Viewer ---------- */
function grnShowHistory(){
  const db = window.DB || {};
  const grns = (db.grns || []).slice().reverse().slice(0, 20);

  const body = `
  <div class="grn-history-modal">
    <div class="tbl-wrap">
      <table>
        <thead>
          <tr>
            <th>GRN අංකය</th>
            <th>දිනය</th>
            <th>සැපයුම්කරු</th>
            <th>Invoice No</th>
            <th style="text-align:center">භාණ්ඩ</th>
            <th style="text-align:right">වටිනාකම</th>
            <th style="text-align:center">ක්‍රියා</th>
          </tr>
        </thead>
        <tbody>
          ${grns.map(g => `
            <tr>
              <td><b>${esc(g.no)}</b></td>
              <td>${esc(g.date)}</td>
              <td>${esc(g.supplier)}</td>
              <td><small>${esc(g.invoiceNo || '-')}</small></td>
              <td style="text-align:center">${g.items?.length || 0}</td>
              <td style="text-align:right;font-weight:700;color:var(--primary)">${money(g.total)}</td>
              <td style="text-align:center">
                <button type="button" class="btn btn-sm btn-blue" onclick="grnViewDetails('${g.id}')">👁️ විස්තර</button>
              </td>
            </tr>
          `).join('') || '<tr><td colspan="7" class="empty" style="text-align:center;padding:18px">GRN වාර්තා නැත</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;

  openModal('📜 පෙර GRN වාර්තා', 'GRN History (Last 20)', body, `<button class="btn" onclick="closeModal()">වසන්න / Close</button>`, true);
}

function grnViewDetails(grnId){
  const db = window.DB || {};
  const g = (db.grns || []).find(x => x.id === grnId);
  if(!g){
    toast('GRN සටහන හමු නොවීය', 'err');
    return;
  }

  const body = `
  <div style="display:flex;flex-direction:column;gap:12px">
    <div class="grid3">
      <div><small style="color:var(--muted)">GRN අංකය</small><br><b>${esc(g.no)}</b></div>
      <div><small style="color:var(--muted)">සැපයුම්කරු</small><br><b>${esc(g.supplier)}</b></div>
      <div><small style="color:var(--muted)">දිනය</small><br><b>${esc(g.date)}</b></div>
    </div>
    <div class="grid2">
      <div><small style="color:var(--muted)">Invoice No</small><br><b>${esc(g.invoiceNo || 'නැත')}</b></div>
      <div><small style="color:var(--muted)">සටහන</small><br><span>${esc(g.notes || '-')}</span></div>
    </div>
    <hr style="border:none;border-top:1px solid var(--line)">
    <div class="tbl-wrap">
      <table>
        <thead>
          <tr>
            <th>භාණ්ඩය</th>
            <th style="text-align:center">ප්‍රමාණය</th>
            <th style="text-align:right">පිරිවැය</th>
            <th style="text-align:center">වට්ටම</th>
            <th style="text-align:right">එකතුව</th>
          </tr>
        </thead>
        <tbody>
          ${(g.items || []).map(it => {
            const p = db.getProd ? db.getProd(it.pid) : (db.products || []).find(x => x.id === it.pid);
            const lineTot = it.total != null ? it.total : (it.qty * it.cost * (1 - (Number(it.disc || 0) / 100)));
            return `
            <tr>
              <td><b>${esc(it.code || (p ? p.code : it.pid))}</b><br><small style="color:var(--muted)">${esc(it.name || (p ? p.name : ''))}</small></td>
              <td style="text-align:center">${it.qty}</td>
              <td style="text-align:right">${money(it.cost)}</td>
              <td style="text-align:center">${it.disc ? it.disc + '%' : '-'}</td>
              <td style="text-align:right;font-weight:700">${money(lineTot)}</td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4" style="text-align:right;font-weight:700">මුළු එකතුව (Total):</td>
            <td style="text-align:right;font-weight:700;color:var(--primary);font-size:14px">${money(g.total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>`;

  openModal(`📄 ${g.no} විස්තර`, `GRN Details · ${g.supplier}`, body, `
    <button class="btn" onclick="grnShowHistory()">⬅️ ආපසු (Back)</button>
    <button class="btn btn-primary" onclick="closeModal()">වසන්න (Close)</button>
  `, true);
}

/* ---------- Keyboard Shortcut Handler ---------- */
function grnKeyHandler(e){
  if(typeof state === 'undefined' || state.page !== 'grn') return;
  if($('#modalRoot')?.children?.length > 0) return; // let modal handle keys

  // F2: Open Search Overlay & Focus Search Input
  if(e.key === 'F2'){
    e.preventDefault();
    grnOpenSearchOverlay();
    return;
  }

  // F9: Confirm GRN Modal
  if(e.key === 'F9'){
    e.preventDefault();
    if(grnItems.length) grnConfirmModal();
    else toast('GRN එක සඳහා භාණ්ඩ එකතු කර නැත', 'warn');
    return;
  }

  // ESC: Close Search Overlay or Clear current row
  if(e.key === 'Escape'){
    const overlay = $('#grnSearchOverlay');
    if(overlay && !overlay.classList.contains('hidden')){
      e.preventDefault();
      grnCloseSearchOverlay();
      $('#grnSelectedProdBox')?.focus();
      return;
    }
    if(grnState.selectedProduct){
      e.preventDefault();
      grnClearSelectedProduct();
      $('#grnSelectedProdBox')?.focus();
      return;
    }
  }

  // Ctrl+S: Draft Save
  if((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')){
    e.preventDefault();
    grnSaveDraft(true);
    return;
  }

  // Ctrl+D: Delete Last Row
  if((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')){
    e.preventDefault();
    if(grnItems.length > 0){
      grnDeleteItem(grnItems.length - 1);
    } else {
      toast('ඉවත් කිරීමට භාණ්ඩ නැත', 'warn');
    }
    return;
  }
}

/* ---------- Quick Add Supplier Dialog ---------- */
function quickAddSupplier(){
  openModal('➕ නව සැපයුම්කරු', 'New Supplier',
  `<div>
     <label style="font-size:11.5px;color:var(--muted);font-weight:600">සැපයුම්කරුගේ නම / Company Name *</label>
     <input id="supName" placeholder="උදා: ABC Auto Traders" style="margin-top:4px">
   </div>
   <div class="grid2" style="margin-top:12px">
     <div>
       <label style="font-size:11.5px;color:var(--muted);font-weight:600">දුරකථනය / Phone</label>
       <input id="supPhone" placeholder="011-xxxxxxx" style="margin-top:4px">
     </div>
     <div>
       <label style="font-size:11.5px;color:var(--muted);font-weight:600">සම්බන්ධීකාරක / Contact Person</label>
       <input id="supContact" style="margin-top:4px">
     </div>
   </div>
   <div style="margin-top:12px">
     <label style="font-size:11.5px;color:var(--muted);font-weight:600">ලිපිනය / Address</label>
     <input id="supAddr" style="margin-top:4px">
   </div>`,
  `<button class="btn" onclick="closeModal()">අවලංගු</button>
   <button class="btn btn-primary" onclick="saveQuickSupplier()">💾 සුරකින්න</button>`);
}

async function saveQuickSupplier(){
  const name = $('#supName')?.value.trim();
  if(!name){ toast('නම අවශ්‍යයි', 'err'); return; }

  const phone = $('#supPhone')?.value.trim() || '';
  const contact = $('#supContact')?.value.trim() || '';
  const address = $('#supAddr')?.value.trim() || '';

  const db = window.DB || {};
  if(!db.suppliers) db.suppliers = [];

  const newSup = {
    id: uid('SUP'),
    name,
    phone,
    contact,
    address,
    payable: 0,
    terms: '30 days'
  };

  db.suppliers.push(newSup);
  if(window.FB && window.FB.fbAdd) await window.FB.fbAdd(window.FB.COL.suppliers, newSup);
  if(typeof saveDB === 'function') saveDB();

  grnState.supplier = newSup.name;
  closeModal();
  render();
  toast('සැපයුම්කරු එකතු කළා ✅');
}

/* ---------- Background Auto-Save & Click Listeners ---------- */
if(typeof window !== 'undefined' && !window._grnGlobalListenersBound){
  // Global keydown handler
  if(typeof window.addEventListener === 'function'){
    window.addEventListener('keydown', grnKeyHandler);
  }

  // Close search overlay on click outside
  if(typeof document !== 'undefined' && typeof document.addEventListener === 'function'){
    document.addEventListener('click', e => {
      if(!e.target || !e.target.closest) return;
      if(!e.target.closest('.grn-search-overlay') && !e.target.closest('#grnSelectedProdBox')){
        const ov = typeof $ === 'function' ? $('#grnSearchOverlay') : null;
        if(ov && !ov.classList.contains('hidden')) ov.classList.add('hidden');
      }
    });
  }

  // Auto-save interval check (every 3 seconds)
  setInterval(() => {
    if(typeof state !== 'undefined' && state.page === 'grn'){
      if(grnState.isDirty){
        grnSaveDraft(false);
      } else {
        grnUpdateDraftIndicator();
      }
    }
  }, 3000);

  window._grnGlobalListenersBound = true;
}

/* ---------- Global Exports ---------- */
window.grnItems = grnItems;
window.grnState = grnState;
window.pgGRN = pgGRN;
window.grnOpenSearchOverlay = grnOpenSearchOverlay;
window.grnCloseSearchOverlay = grnCloseSearchOverlay;
window.grnSearchProducts = grnSearchProducts;
window.grnSearchKeydown = grnSearchKeydown;
window.grnSelectProduct = grnSelectProduct;
window.grnFillProduct = grnFillProduct;
window.grnClearSelectedProduct = grnClearSelectedProduct;
window.grnBarcodeLookup = grnBarcodeLookup;
window.recalcInlineTotal = recalcInlineTotal;
window.grnRecalcInputRow = grnRecalcInputRow;
window.grnQuickQty = grnQuickQty;
window.grnRowFieldKeydown = grnRowFieldKeydown;
window.grnAddItem = grnAddItem;
window.grnEditItem = grnEditItem;
window.grnLiveRecalcEditRow = grnLiveRecalcEditRow;
window.grnSaveEdit = grnSaveEdit;
window.grnCancelEdit = grnCancelEdit;
window.grnDeleteItem = grnDeleteItem;
window.grnRecalculate = grnRecalculate;
window.grnOnFieldChange = grnOnFieldChange;
window.grnOnSupplierChange = grnOnSupplierChange;
window.grnSaveDraft = grnSaveDraft;
window.grnLoadDraft = grnLoadDraft;
window.grnClearDraft = grnClearDraft;
window.grnDismissDraftBanner = grnDismissDraftBanner;
window.grnShowHistory = grnShowHistory;
window.grnViewDetails = grnViewDetails;
window.grnConfirmModal = grnConfirmModal;
window.grnSave = grnSave;
window.saveGRN = grnSave; // Backward compatibility alias
window.addGrnRow = grnAddItem; // Backward compatibility alias
window.grnKeyHandler = grnKeyHandler;
window.quickAddSupplier = quickAddSupplier;
window.saveQuickSupplier = saveQuickSupplier;
