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
  draftBannerDismissed: false,
  paymentType: 'credit', // 'credit' | 'full' | 'partial'
  paymentMethod: 'petty', // 'petty' | 'cash' | 'cheque' | 'bank'
  paidAmount: 0,
  chequeNo: '',
  chequeBank: '',
  chequeDate: today()
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
      <div class="card-h" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div>
          <h3 style="margin:0">➕ භාණ්ඩ එකතු කරන්න</h3>
          <small style="color:var(--muted)">Add Products to GRN · Enter=Add · Tab=Next · F2=Search · Esc=Clear</small>
        </div>
        <button type="button" class="btn btn-sm btn-primary" onclick="grnOpenNewProductModal()" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;padding:6px 12px;font-weight:700">
          ➕ නව භාණ්ඩයක් (New Item)
        </button>
      </div>

      <!-- Inline Add Row (6 Columns Modern Balanced Grid) -->
      <div class="grn-input-row-wrap">
        <div class="grn-input-row">
          <!-- Col 1: Product Cell -->
          <div class="grn-input-col grn-col-prod" style="position:relative">
            <label class="grn-input-col-label">
              <span class="grn-label-icon">📦</span>
              <span>භාණ්ඩය / Item</span>
              <kbd class="grn-label-kbd">F2</kbd>
            </label>
            <div id="grnSelectedProdBox" class="grn-selected-prod-box ${grnState.selectedProduct ? '' : 'empty'}"
                 tabindex="0"
                 onclick="grnOpenSearchOverlay()"
                 onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();grnOpenSearchOverlay();}">
              ${renderSelectedProdBox()}
            </div>

            <!-- Search Overlay Anchored to Inline Field -->
            <div id="grnSearchOverlay" class="grn-search-overlay hidden">
              <div class="grn-search-overlay-input-wrap">
                <div class="grn-search-input-box">
                  <input id="grnSearchInput" class="grn-search-input" autocomplete="off"
                         placeholder="භාණ්ඩය සොයන්න (නම / කේතය / OEM / Barcode)..."
                         title="සොයන්න (නම / කේතය / OEM / Barcode)"
                         oninput="grnSearchProducts(this.value)"
                         onkeydown="grnSearchKeydown(event)">
                  <button type="button" class="grn-scan-btn grn-barcode-badge" onclick="grnStartCameraScan()" title="Camera එකෙන් Barcode එක Scan කරන්න">📷 SCAN</button>
                </div>
                <button type="button" class="grn-overlay-close-btn" onclick="grnCloseSearchOverlay()" title="වසන්න (Close)">✕</button>
              </div>
              <div id="grnSearchDropdown" class="grn-search-dropdown grn-search-results"></div>
            </div>

            <div class="grn-col-subhint">
              <span id="grnProdSubhint">F2 හෝ Click කර සොයන්න</span>
            </div>
          </div>

          <!-- Col 2: Qty Cell -->
          <div class="grn-input-col grn-col-qty">
            <label class="grn-input-col-label">
              <span class="grn-label-icon">🔢</span>
              <span>ප්‍රමාණය / Qty</span>
            </label>
            <div class="grn-field-box">
              <input id="grnInputQty" type="number" step="1" min="1" value="1"
                     placeholder="1" oninput="recalcInlineTotal()" onkeydown="grnRowFieldKeydown(event)">
            </div>
            <div class="grn-qty-quick">
              <button type="button" onclick="grnQuickQty(1)" title="Add 1">+1</button>
              <button type="button" onclick="grnQuickQty(5)" title="Add 5">+5</button>
              <button type="button" onclick="grnQuickQty(10)" title="Add 10">+10</button>
              <button type="button" onclick="grnQuickQty(50)" title="Add 50">+50</button>
              <button type="button" onclick="grnQuickQty(100)" title="Add 100">+100</button>
            </div>
          </div>

          <!-- Col 3: Cost Cell -->
          <div class="grn-input-col grn-col-cost">
            <label class="grn-input-col-label">
              <span class="grn-label-icon">💵</span>
              <span>පිරිවැය / Cost</span>
            </label>
            <div class="grn-field-box grn-has-prefix">
              <span class="grn-field-affix">රු.</span>
              <input id="grnInputCost" type="number" step="0.01" min="0" value="0.00"
                     placeholder="0.00" oninput="recalcInlineTotal()" onkeydown="grnRowFieldKeydown(event)">
            </div>
            <div class="grn-col-subhint">
              <span id="grnCostSubhint">ඒකක මිල (Unit Cost)</span>
            </div>
          </div>

          <!-- Col 4: Discount Cell -->
          <div class="grn-input-col grn-col-disc">
            <label class="grn-input-col-label">
              <span class="grn-label-icon">🏷️</span>
              <span>වට්ටම % / Disc</span>
            </label>
            <div class="grn-field-box grn-has-suffix">
              <input id="grnInputDisc" type="number" step="0.1" min="0" max="100" value="0"
                     placeholder="0" oninput="recalcInlineTotal()" onkeydown="grnRowFieldKeydown(event)">
              <span class="grn-field-affix">%</span>
            </div>
            <div class="grn-col-subhint">
              <span id="grnDiscSubhint">වට්ටම් ප්‍රතිශතය</span>
            </div>
          </div>

          <!-- Col 5: Total Cell -->
          <div class="grn-input-col grn-col-total">
            <label class="grn-input-col-label">
              <span class="grn-label-icon">💰</span>
              <span>එකතුව / Total</span>
            </label>
            <div class="grn-input-total-box">
              <span id="grnInputTotal" class="grn-input-total-val">රු. 0.00</span>
              <span id="grnInputDiscSub" class="grn-input-disc-sub" style="display:none"></span>
            </div>
            <div class="grn-col-subhint" style="text-align:right">
              <span id="grnTotalSubhint">ශුද්ධ මුදල (Net)</span>
            </div>
          </div>

          <!-- Col 6: Add Button -->
          <div class="grn-input-col grn-col-add">
            <label class="grn-input-col-label grn-col-label-ghost">&nbsp;</label>
            <button type="button" class="btn btn-primary grn-btn-add-main" onclick="grnAddItem()" title="භාණ්ඩය එකතු කරන්න (Enter)">
              <span class="grn-btn-add-icon">➕</span>
              <span class="grn-btn-add-text">එකතු කරන්න</span>
            </button>
            <div class="grn-col-subhint grn-add-subhint">
              <kbd class="grn-subhint-kbd">Enter ↵</kbd>
            </div>
          </div>
        </div>

        <div class="grn-input-row-actions">
          <div class="grn-shortcuts-strip">
            <span class="grn-shortcut-pill"><kbd>Enter</kbd> <span>එකතු කරන්න (Add)</span></span>
            <span class="grn-shortcut-sep">•</span>
            <span class="grn-shortcut-pill"><kbd>Tab</kbd> <span>ඊළඟ කොටුව (Next)</span></span>
            <span class="grn-shortcut-sep">•</span>
            <span class="grn-shortcut-pill"><kbd>F2</kbd> <span>සොයන්න (Search)</span></span>
            <span class="grn-shortcut-sep">•</span>
            <span class="grn-shortcut-pill"><kbd>Esc</kbd> <span>Clear Row</span></span>
          </div>
        </div>
      </div>
    </div>

    <!-- 3. Received Items Table Card -->
    <div class="card grn-items-card">
      <div class="card-h">
        <h3>📋 ලැබූ භාණ්ඩ ලැයිස්තුව <small id="grnItemCountBadge">${grnItems.length} items</small></h3>
      </div>
      <div class="tbl-wrap grn-items-list-wrap">
        <table class="grn-items-table">
          <thead>
            <tr>
              <th style="width:110px">කේතය / Code</th>
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

    <!-- 4. Summary & Payment Card -->
    <div class="card grn-summary-card">
      <div class="card-h">
        <h3>📊 සාරාංශය සහ ගෙවීම් විස්තර <small>GRN Summary & Payment</small></h3>
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
    <div class="grn-footer-sticky grn-footer">
      <button type="button" class="btn btn-cancel grn-btn-cancel" onclick="grnClearDraft(true)">
        <span>❌</span>
        <span>අවලංගු</span>
      </button>
      <button type="button" class="btn btn-blue btn-draft grn-btn-draft" onclick="grnSaveDraft(true)">
        <span>💾</span>
        <span>Draft</span>
      </button>
      <button type="button" class="btn btn-green btn-save grn-btn-confirm" id="grnConfirmBtn"
              ${grnItems.length ? '' : 'disabled'} onclick="grnConfirmModal()" style="display:flex;align-items:center;justify-content:center;gap:8px">
        <span>💳</span>
        <span>ගෙවීම් සහ තහවුරු කිරීම (Payment & Confirm)</span>
      </button>
    </div>

  </div>`;
}

/* ---------- Helper: Render Selected Product in Inline Add Row ---------- */
function renderSelectedProdBox(){
  const p = grnState.selectedProduct;
  if(!p){
    return `
      <div class="grn-sp-empty-wrap">
        <span class="grn-sp-search-icon">🔍</span>
        <div class="grn-sp-empty-text">
          <span class="grn-sp-main-label">භාණ්ඩයක් තෝරා නැත (Click to search)</span>
          <span class="grn-sp-sub-label">නම, කේතය හෝ Barcode සොයන්න...</span>
        </div>
      </div>
      <div class="grn-sp-empty-badges">
        <kbd class="grn-key-badge">F2</kbd>
      </div>`;
  }
  return `
    <div class="grn-selected-prod-info">
      <div class="grn-sp-header-row">
        <span class="grn-sp-code-pill">${esc(p.code)}</span>
        <span class="grn-sp-unit-tag">(${esc(p.unit || 'pcs')})</span>
        <span class="grn-sp-name-text" title="${esc(p.name)}">${esc(p.name)}</span>
      </div>
      <div class="grn-sp-meta-row">
        <span class="grn-sp-meta-chip">📦 තොග: <b>${p.qty}</b></span>
        <span class="grn-sp-meta-chip">💵 පිරිවැය: <b>${money(p.cost)}</b></span>
        ${p.brand ? `<span class="grn-sp-meta-chip">🏷️ ${esc(p.brand)}</span>` : ''}
      </div>
    </div>
    <button type="button" class="grn-sp-clear-btn" onclick="event.stopPropagation();grnClearSelectedProduct()" title="ඉවත් කරන්න (Clear)">✕</button>`;
}

/* ---------- Helper: Render Table Rows (View & Inline Edit) ---------- */
function renderGrnTableRows(){
  if(!grnItems.length){
    return `<tr><td colspan="7" class="empty grn-items-empty" style="text-align:center;padding:26px;color:var(--muted)">භාණ්ඩ එකතු කර නැත (No items added yet)</td></tr>`;
  }

  const db = window.DB || {};

  return grnItems.map((r, i) => {
    const p = db.getProd ? db.getProd(r.pid) : (db.products || []).find(x => x.id === r.pid);
    const isEditing = grnState.editingIndex === i;

    if(isEditing){
      return `
      <tr class="grn-editing-row" style="background:#1b283d">
        <td data-label="කේතය">
          <span class="grn-p-code">${esc(r.code || (p ? p.code : r.pid))}</span>
        </td>
        <td data-label="භාණ්ඩය">
          <span class="grn-p-name">${esc(r.name || (p ? p.name : ''))}</span>
        </td>
        <td data-label="ප්රමාණය" style="text-align:center">
          <input id="grnEditQty_${i}" class="grn-edit-input" type="number" step="1" min="1"
                 value="${r.qty}" oninput="grnLiveRecalcEditRow(${i})"
                 onkeydown="if(event.key==='Enter')grnSaveEdit(${i}); if(event.key==='Escape')grnCancelEdit(${i});">
        </td>
        <td data-label="පිරිවැය" style="text-align:right">
          <input id="grnEditCost_${i}" class="grn-edit-input" type="number" step="0.01" min="0"
                 value="${r.cost}" oninput="grnLiveRecalcEditRow(${i})"
                 onkeydown="if(event.key==='Enter')grnSaveEdit(${i}); if(event.key==='Escape')grnCancelEdit(${i});">
        </td>
        <td data-label="වට්ටම" class="grn-col-disc ${r.disc ? '' : 'grn-disc-zero'}" style="text-align:center">
          <input id="grnEditDisc_${i}" class="grn-edit-input" type="number" step="0.1" min="0" max="100"
                 value="${r.disc || 0}" oninput="grnLiveRecalcEditRow(${i})"
                 onkeydown="if(event.key==='Enter')grnSaveEdit(${i}); if(event.key==='Escape')grnCancelEdit(${i});" style="width:65px">
        </td>
        <td data-label="එකතුව" style="text-align:right">
          <b id="grnEditTotal_${i}" style="color:var(--primary)">${money(r.total)}</b>
        </td>
        <td data-label="ක්රියා" style="text-align:center">
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
      <td data-label="කේතය"><span class="grn-p-code">${esc(r.code || (p ? p.code : r.pid))}</span></td>
      <td data-label="භාණ්ඩය">
        <span class="grn-p-name">${esc(r.name || (p ? p.name : ''))}</span>
        ${(p?.nameEn || p?.brand) ? `<small class="grn-p-sub" style="display:block;color:var(--muted);font-size:11px">${esc(p?.nameEn || '')} ${p?.brand ? '· ' + esc(p.brand) : ''}</small>` : ''}
      </td>
      <td data-label="ප්රමාණය" style="text-align:center">
        <b>${r.qty}</b> <small style="color:var(--muted)">${esc(r.unit || p?.unit || 'pcs')}</small>
      </td>
      <td data-label="පිරිවැය" style="text-align:right">${money(r.cost)}</td>
      <td data-label="වට්ටම" class="grn-col-disc ${disc > 0 ? '' : 'grn-disc-zero'}" style="text-align:center">
        ${disc > 0 ? `<span class="grn-disc-tag">-${disc}%</span>` : `<span style="color:var(--muted)">-</span>`}
      </td>
      <td data-label="එකතුව" style="text-align:right;font-weight:700;color:var(--primary)">
        ${money(r.total)}
      </td>
      <td data-label="ක්රියා" style="text-align:center">
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
    const cleanQ = (query || '').trim();
    dd.innerHTML = `
      <div class="grn-no-results grn-search-no-results">${cleanQ ? `🔍 "${esc(cleanQ)}" සඳහා භාණ්ඩ හමු නොවීය` : '🔍 භාණ්ඩ හමු නොවීය'}</div>
      <div class="grn-search-result grn-sr-add-new-item" onclick="grnOpenNewProductModal('${esc(cleanQ)}')" style="background:rgba(56,189,248,0.08);border-top:1px dashed var(--line);cursor:pointer;padding:12px 14px">
        <div class="grn-sr-left">
          <span class="grn-sr-name" style="color:#38bdf8;font-weight:700">➕ නව භාණ්ඩයක් ලියාපදිංචි කරන්න (Add New Product)</span>
          <small style="color:var(--muted)">${cleanQ ? `"${esc(cleanQ)}" නමින් හෝ කේතයෙන් අලුත් අමතර කොටසක් ඇතුළත් කරන්න` : 'නව අමතර කොටසක් Inventory එකට ඇතුළත් කර GRN කරන්න'}</small>
        </div>
      </div>
    `;
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
    `).join('') + `
      <div class="grn-search-result grn-sr-add-new-item" onclick="grnOpenNewProductModal($('#grnSearchInput')?.value || '')" style="background:rgba(56,189,248,0.04);border-top:1px dashed var(--line);cursor:pointer;padding:10px 14px">
        <div class="grn-sr-left">
          <span class="grn-sr-name" style="color:#38bdf8;font-weight:600">➕ නව භාණ්ඩයක් ලියාපදිංචි කරන්න (Add New Product)</span>
        </div>
      </div>
    `;
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

  const costHint = $('#grnCostSubhint');
  if(costHint) costHint.textContent = `පෙර: ${money(p.cost)}`;
  const prodHint = $('#grnProdSubhint');
  if(prodHint) prodHint.textContent = `තෝරාගත්: ${p.code}`;
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
  
  const costHint = $('#grnCostSubhint');
  if(costHint) costHint.textContent = 'ඒකක මිල (Unit Cost)';
  const prodHint = $('#grnProdSubhint');
  if(prodHint) prodHint.textContent = 'F2 හෝ Click කර සොයන්න';

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
    toast(`ℹ️ "${code}" කේතයෙන් භාණ්ඩයක් හමු නොවීය. නව භාණ්ඩයක් ලෙස ලියාපදිංචි කරන්න...`, 'info');
    grnOpenNewProductModal(code);
  }
}

/* ---------- Camera Barcode Scanner for GRN ---------- */
function grnStartCameraScan(){
  if(typeof BarcodeScanner !== 'undefined' && BarcodeScanner.open){
    BarcodeScanner.open((code) => {
      grnBarcodeLookup(code);
    });
  } else {
    toast('Camera Barcode Scanner සක්‍රීය නැත', 'warn');
  }
}

/* ---------- Add New Product Modal from GRN ---------- */
function grnOpenNewProductModal(initialCode = ''){
  const cleanCode = (initialCode || '').trim();
  const cats = ['Brake','Engine','Electrical','Body','Suspension','Filter','Lubricant','Battery','Other'];

  openModal('➕ නව අමතර කොටසක් (GRN සඳහා)', 'Register New Part (Initial Stock = 0, added via GRN)',
  `<div class="grid2">
     <div>
       <label style="font-size:11.5px;color:var(--muted);font-weight:600">කේතය / Barcode *</label>
       <div style="display:flex;gap:6px">
         <input id="grnNewPCode" value="${esc(cleanCode)}" placeholder="Barcode හෝ අංකය" style="flex:1">
         <button type="button" class="btn btn-sm btn-blue" onclick="scanBarcodeForField('#grnNewPCode')" title="Camera එකෙන් Barcode එක Scan කරන්න" style="padding:4px 10px;font-size:12px;white-space:nowrap;display:flex;align-items:center;gap:4px">
           📷 Scan
         </button>
       </div>
     </div>
     <div>
       <label style="font-size:11.5px;color:var(--muted);font-weight:600">කාණ්ඩය / Category</label>
       <select id="grnNewPCat">${cats.map(c=>`<option>${c}</option>`).join('')}</select>
     </div>
   </div>

   <div class="grid2" style="margin-top:12px">
     <div>
       <label style="font-size:11.5px;color:var(--muted);font-weight:600">නම (සිංහල) *</label>
       <input id="grnNewPName" placeholder="උදා: ඔයිල් ෆිල්ටර්">
     </div>
     <div>
       <label style="font-size:11.5px;color:var(--muted);font-weight:600">Name (English)</label>
       <input id="grnNewPNameEn" placeholder="e.g. Oil Filter">
     </div>
   </div>

   <!-- Compatibility -->
   <div style="background:rgba(255,255,255,0.02);border:1px solid var(--line);border-radius:10px;padding:12px;margin-top:14px">
     <div style="font-size:12px;font-weight:700;color:var(--primary);margin-bottom:8px">🚗 වාහන සහ අමතර කොටස් අනුකූලතාව (Compatibility)</div>
     <div class="grid2">
       <div><label style="font-size:11px;color:var(--muted)">OEM අංකය (උදා: 04465-02220)</label><input id="grnNewPOem" placeholder="04465-02220"></div>
       <div><label style="font-size:11px;color:var(--muted)">විකල්ප අංක / Alt Nos (කොමා වලින් වෙන් කරන්න)</label><input id="grnNewPAlt" placeholder="AN-688K, TN-401"></div>
     </div>
     <div class="grid2" style="margin-top:10px">
       <div><label style="font-size:11px;color:var(--muted)">වෙළඳ නාමය / Brand</label><input id="grnNewPBrand" placeholder="Denso, Toyota, etc."></div>
       <div><label style="font-size:11px;color:var(--muted)">වාහන මාදිලිය / Model</label><input id="grnNewPModel" placeholder="Corolla, Aqua, etc."></div>
     </div>
   </div>

   <!-- Pricing & Units -->
   <div class="grid3" style="margin-top:12px">
     <div>
       <label style="font-size:11.5px;color:var(--muted);font-weight:600">පිරිවැය / Cost (රු.)</label>
       <input id="grnNewPCost" type="number" step="0.01" min="0" placeholder="0.00" value="0.00">
     </div>
     <div>
       <label style="font-size:11.5px;color:var(--muted);font-weight:600">සිල්ලර මිල / Retail (රු.)</label>
       <input id="grnNewPPrice" type="number" step="0.01" min="0" placeholder="0.00" value="0.00">
     </div>
     <div>
       <label style="font-size:11.5px;color:var(--muted);font-weight:600">ඒකකය / Unit</label>
       <input id="grnNewPUnit" value="pcs" placeholder="pcs">
     </div>
   </div>

   <!-- Storage & Reorder -->
   <div class="grid3" style="margin-top:12px">
     <div>
       <label style="font-size:11px;color:var(--muted);font-weight:600">රාක්කය (Rack)</label>
       <input id="grnNewPRack" placeholder="A-01">
     </div>
     <div>
       <label style="font-size:11px;color:var(--muted);font-weight:600">පෙට්ටිය (Bin)</label>
       <input id="grnNewPBin" placeholder="B-1">
     </div>
     <div>
       <label style="font-size:11px;color:var(--muted);font-weight:600">අවම තොගය (Reorder)</label>
       <input id="grnNewPRe" type="number" value="5">
     </div>
   </div>

   <!-- Stock Notice -->
   <div style="background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.25);border-radius:8px;padding:10px 12px;font-size:12px;color:#38bdf8;margin-top:14px;display:flex;align-items:center;gap:8px">
     <span style="font-size:18px">📦</span>
     <div>
       <b>ආරම්භක තොගය: 0</b>
       <div style="font-size:11px;color:var(--muted)">මෙහිදී ආරම්භක තොගයක් එකතු නොවේ. භාණ්ඩයේ ලැබුණු තොග ප්‍රමාණය මෙම GRN ලේඛනය හරහා ස්වයංක්‍රීයව තොගයට එක්වනු ඇත.</div>
     </div>
   </div>`,
   `<button class="btn" onclick="closeModal()">අවලංගු</button>
    <button class="btn btn-primary" onclick="grnSaveNewProduct()">💾 සුරකින්න සහ GRN එකට තෝරන්න</button>`,
   true);
}

async function grnSaveNewProduct(){
  const v = s => $(s)?.value?.trim() || '';
  const code = v('#grnNewPCode');
  const name = v('#grnNewPName');

  if(!code || !name){
    toast('කරුණාකර කේතය (Barcode) සහ නම ඇතුළත් කරන්න', 'err');
    return;
  }

  const db = window.DB || {};
  if(!db.products) db.products = [];
  const curShop = (typeof currentShopId === 'function' && currentShopId()) ? currentShopId() : (window.state?.user?.shopId || 'SHOP-001');

  // Check if barcode already exists in same shop
  const existing = db.products.find(p => (p.code || '').toLowerCase() === code.toLowerCase() && (!p.shopId || p.shopId === curShop));
  if(existing){
    toast(`⚠️ "${code}" කේතයෙන් යුත් භාණ්ඩයක් දැනටමත් පවතී. එම භාණ්ඩය GRN එකට තෝරා ගන්නා ලදී.`, 'info');
    closeModal();
    grnCloseSearchOverlay();
    grnFillProduct(existing.id);
    return;
  }

  const splitClean = val => (val || '').split(',').map(x => x.trim()).filter(Boolean);
  const newId = uid('P');
  const costVal = parseFloat(v('#grnNewPCost')) || 0;
  const priceVal = parseFloat(v('#grnNewPPrice')) || 0;

  const newProd = {
    id: newId,
    shopId: curShop,
    code: code,
    name: name,
    nameEn: v('#grnNewPNameEn'),
    cat: v('#grnNewPCat') || 'Other',
    oemNo: v('#grnNewPOem'),
    altNos: splitClean(v('#grnNewPAlt')),
    brand: v('#grnNewPBrand'),
    model: v('#grnNewPModel'),
    chassis: [],
    engine: [],
    yearFrom: null,
    yearTo: null,
    rack: v('#grnNewPRack'),
    bin: v('#grnNewPBin'),
    warehouse: 'Main',
    cost: costVal,
    price: priceVal,
    priceWholesale: 0,
    qty: 0, // Initial stock is 0! The stock will be populated by this GRN!
    reorder: parseInt(v('#grnNewPRe')) || 5,
    unit: v('#grnNewPUnit') || 'pcs',
    warranty: 0,
    hasSerial: false,
    coreDeposit: 0,
    crossSell: [],
    active: true,
    createdAt: new Date().toISOString()
  };

  db.products.push(newProd);

  if(window.FB && window.FB.fbSet){
    try {
      await window.FB.fbSet(window.FB.COL.products, newId, newProd);
    } catch(e){
      console.warn('Firebase product save error:', e);
    }
  }

  if(typeof saveDB === 'function') saveDB();
  if(window.DB && typeof window.DB._persistLocalNow === 'function') window.DB._persistLocalNow();

  closeModal();
  grnCloseSearchOverlay();

  // Automatically select and fill this newly created product into the GRN inline row!
  grnFillProduct(newId);
  if(costVal > 0){
    const costInp = $('#grnInputCost');
    if(costInp) costInp.value = costVal.toFixed(2);
  }
  recalcInlineTotal();

  const qtyInp = $('#grnInputQty');
  if(qtyInp){
    qtyInp.focus();
    qtyInp.select();
  }

  toast('✅ නව භාණ්ඩය ලියාපදිංචි කර GRN එකට තෝරා ගන්නා ලදී!', 'ok');
}

window.grnStartCameraScan = grnStartCameraScan;
window.grnOpenNewProductModal = grnOpenNewProductModal;
window.grnSaveNewProduct = grnSaveNewProduct;

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
  // GRN does not require an active shift — inventory action, not cash drawer

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

  // After successful add, scroll to items list
  setTimeout(() => {
    const itemsCard = document.querySelector('.grn-items-card, .grn-items-list-wrap');
    if(itemsCard){
      itemsCard.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  }, 100);
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

  // Live recalculate payment displays & auto-update if Full payment
  grnRecalcPaymentDisplays(grandTotal);

  // Re-render table body
  const tbody = $('#grnTableBody');
  if(tbody) tbody.innerHTML = renderGrnTableRows();
}

/* ---------- GRN Payment Helpers (Credit, Petty Cash, Cheque, Partial) ---------- */
function grnGetEffectivePaidAmount(grandTotal){
  if(grandTotal == null){
    grandTotal = grnItems.reduce((a, r) => a + Number(r.total || 0), 0);
  }
  const pt = grnState.paymentType || 'credit';
  if(pt === 'credit') return 0;
  if(pt === 'full') return grandTotal;
  if(pt === 'partial'){
    const amt = parseFloat(grnState.paidAmount) || 0;
    return Math.min(grandTotal, Math.max(0, amt));
  }
  return 0;
}

function grnGetPaymentBadgeHtml(grandTotal){
  if(grandTotal == null){
    grandTotal = grnItems.reduce((a, r) => a + Number(r.total || 0), 0);
  }
  const pt = grnState.paymentType || 'credit';
  const effectivePaid = grnGetEffectivePaidAmount(grandTotal);
  if(pt === 'credit' || effectivePaid <= 0){
    return `<span class="pill err" style="font-size:11px">🔴 ණයට (Credit)</span>`;
  }
  if(pt === 'full' || effectivePaid >= grandTotal){
    const m = (grnState.paymentMethod || 'cash').toUpperCase();
    return `<span class="pill ok" style="font-size:11px">🟢 සම්පූර්ණ ගෙවා ඇත (${m})</span>`;
  }
  return `<span class="pill warn" style="font-size:11px">🟡 කොටසක් ගෙවීම (Partial: ${money(effectivePaid)})</span>`;
}

function grnSetPayType(type){
  grnState.paymentType = type;
  const grandTotal = grnItems.reduce((a, r) => a + Number(r.total || 0), 0);

  if(type === 'credit'){
    grnState.paidAmount = 0;
  } else if(type === 'full'){
    grnState.paidAmount = grandTotal;
  } else if(type === 'partial'){
    if(!grnState.paidAmount || grnState.paidAmount <= 0 || grnState.paidAmount >= grandTotal){
      grnState.paidAmount = Math.round((grandTotal / 2) * 100) / 100;
    }
  }

  // Update button active styles (supports both modal & inline IDs)
  ['btnModalPayCredit', 'btnModalPayFull', 'btnModalPayPartial', 'btnPayCredit', 'btnPayFull', 'btnPayPartial'].forEach(btnId => {
    const b = document.getElementById(btnId);
    if(b) b.classList.remove('btn-primary');
  });
  if(type === 'credit'){
    document.getElementById('btnModalPayCredit')?.classList.add('btn-primary');
    document.getElementById('btnPayCredit')?.classList.add('btn-primary');
  }
  if(type === 'full'){
    document.getElementById('btnModalPayFull')?.classList.add('btn-primary');
    document.getElementById('btnPayFull')?.classList.add('btn-primary');
  }
  if(type === 'partial'){
    document.getElementById('btnModalPayPartial')?.classList.add('btn-primary');
    document.getElementById('btnPayPartial')?.classList.add('btn-primary');
  }

  // Show/hide controls row
  ['grnModalPaymentControlsRow', 'grnPaymentControlsRow'].forEach(rowId => {
    const row = document.getElementById(rowId);
    if(row) row.style.display = (type === 'credit') ? 'none' : 'grid';
  });

  // Show/hide preset wrap in modal
  const presetWrap = document.getElementById('grnModalPresetWrap');
  if(presetWrap) presetWrap.style.display = (type === 'partial') ? 'flex' : 'none';

  // Update paid amount input
  ['grnModalPaidAmount', 'grnPaidAmount'].forEach(inpId => {
    const paidInp = document.getElementById(inpId);
    if(paidInp){
      paidInp.value = type === 'credit' ? '' : (grnState.paidAmount > 0 ? Number(grnState.paidAmount).toFixed(2) : '');
      paidInp.readOnly = (type === 'full');
      paidInp.style.background = (type === 'full') ? '#141f33' : '#0b1220';
      paidInp.style.opacity = (type === 'full') ? '0.9' : '1';
    }
  });

  // Show/hide cheque box
  ['grnModalChequeFieldsBox', 'grnChequeFieldsBox'].forEach(boxId => {
    const chqBox = document.getElementById(boxId);
    if(chqBox){
      chqBox.style.display = (type !== 'credit' && grnState.paymentMethod === 'cheque') ? 'block' : 'none';
    }
  });

  grnRecalcPaymentDisplays(grandTotal);
  grnOnFieldChange();
}

function grnOnPaymentMethodChange(){
  const sel = document.getElementById('grnModalPaymentMethod') || document.getElementById('grnPaymentMethod');
  if(sel) grnState.paymentMethod = sel.value;

  ['grnModalChequeFieldsBox', 'grnChequeFieldsBox'].forEach(boxId => {
    const chqBox = document.getElementById(boxId);
    if(chqBox){
      chqBox.style.display = (grnState.paymentType !== 'credit' && grnState.paymentMethod === 'cheque') ? 'block' : 'none';
    }
  });

  const grandTotal = grnItems.reduce((a, r) => a + Number(r.total || 0), 0);
  grnRecalcPaymentDisplays(grandTotal);
  grnOnFieldChange();
}

function grnSetPresetPayment(fraction){
  const grandTotal = grnItems.reduce((a, r) => a + Number(r.total || 0), 0);
  const amt = Math.round(grandTotal * fraction * 100) / 100;
  grnState.paidAmount = amt;

  ['grnModalPaidAmount', 'grnPaidAmount'].forEach(inpId => {
    const paidInp = document.getElementById(inpId);
    if(paidInp) paidInp.value = amt.toFixed(2);
  });

  grnRecalcPaymentDisplays(grandTotal);
  grnOnFieldChange();
}

function grnOnPaidAmountInput(val){
  const grandTotal = grnItems.reduce((a, r) => a + Number(r.total || 0), 0);
  let amt = parseFloat(val);
  if(isNaN(amt) || amt < 0) amt = 0;
  if(amt > grandTotal) amt = grandTotal;
  grnState.paidAmount = amt;

  grnRecalcPaymentDisplays(grandTotal);
  grnOnFieldChange();
}

function grnOnChequeFieldChange(){
  grnState.chequeNo = (document.getElementById('grnModalChequeNo') || document.getElementById('grnChequeNo'))?.value?.trim() || '';
  grnState.chequeBank = (document.getElementById('grnModalChequeBank') || document.getElementById('grnChequeBank'))?.value?.trim() || '';
  grnState.chequeDate = (document.getElementById('grnModalChequeDate') || document.getElementById('grnChequeDate'))?.value || today();
  grnOnFieldChange();
}

function grnRecalcPaymentDisplays(grandTotal){
  if(grandTotal == null){
    grandTotal = grnItems.reduce((a, r) => a + Number(r.total || 0), 0);
  }

  // If Full Payment, keep paidAmount in sync with grandTotal
  if(grnState.paymentType === 'full'){
    grnState.paidAmount = grandTotal;
    ['grnModalPaidAmount', 'grnPaidAmount'].forEach(inpId => {
      const paidInp = document.getElementById(inpId);
      if(paidInp) paidInp.value = grandTotal > 0 ? grandTotal.toFixed(2) : '';
    });
  }

  const effectivePaid = grnGetEffectivePaidAmount(grandTotal);
  const balanceDue = Math.max(0, grandTotal - effectivePaid);

  const dispTotal = document.getElementById('grnModalDispTotal') || document.getElementById('grnDispTotal');
  if(dispTotal) dispTotal.textContent = money(grandTotal);

  const dispPaid = document.getElementById('grnModalDispPaid') || document.getElementById('grnDispPaid');
  if(dispPaid) dispPaid.textContent = money(effectivePaid);

  const dispDue = document.getElementById('grnModalDispDue') || document.getElementById('grnDispDue');
  if(dispDue) dispDue.textContent = money(balanceDue) + (balanceDue > 0 ? ' (ණයට / Credit)' : ' (පියවා ඇත)');

  const badgeEl = document.getElementById('grnPaymentBadge');
  if(badgeEl) badgeEl.innerHTML = grnGetPaymentBadgeHtml(grandTotal);
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
    paymentType: grnState.paymentType || 'credit',
    paymentMethod: grnState.paymentMethod || 'petty',
    paidAmount: grnState.paidAmount || 0,
    chequeNo: grnState.chequeNo || '',
    chequeBank: grnState.chequeBank || '',
    chequeDate: grnState.chequeDate || today(),
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
  grnState.paymentType = draft.paymentType || 'credit';
  grnState.paymentMethod = draft.paymentMethod || 'petty';
  grnState.paidAmount = draft.paidAmount || 0;
  grnState.chequeNo = draft.chequeNo || '';
  grnState.chequeBank = draft.chequeBank || '';
  grnState.chequeDate = draft.chequeDate || today();
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
  grnState.paymentType = 'credit';
  grnState.paymentMethod = 'petty';
  grnState.paidAmount = 0;
  grnState.chequeNo = '';
  grnState.chequeBank = '';
  grnState.chequeDate = today();

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
  // GRN does not require an active shift

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
  const payType = grnState.paymentType || 'credit';
  const payMethod = payType === 'credit' ? 'credit' : (grnState.paymentMethod || 'petty');
  const effectivePaid = grnGetEffectivePaidAmount(grandTotal);
  const balanceDue = Math.max(0, grandTotal - effectivePaid);

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
    <div class="grn-payment-modal-body">
      <!-- 1. Invoice Header Summary Box -->
      <div class="grn-confirm-summary" style="background:#0b1220;border:1px solid var(--line);border-radius:10px;padding:12px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;border-bottom:1px dashed var(--line);padding-bottom:8px">
          <div>
            <span style="font-size:11px;color:var(--muted)">GRN අංකය:</span>
            <b style="color:var(--primary);font-size:16px;margin-left:4px">${nextNo}</b>
          </div>
          <div>
            <span style="font-size:11px;color:var(--muted)">දිනය:</span>
            <b style="font-size:13px;margin-left:4px">${dateVal}</b>
          </div>
        </div>
        <div class="grn-confirm-row" style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
          <span style="color:var(--muted)">Supplier / සැපයුම්කරු:</span> <b>${esc(sup)}</b>
        </div>
        <div class="grn-confirm-row" style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
          <span style="color:var(--muted)">Invoice No / ඉන්වොයිසිය:</span> <b>${esc(invNo || 'නැත (None)')}</b>
        </div>
        <div class="grn-confirm-row" style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
          <span style="color:var(--muted)">භාණ්ඩ එකතුව:</span> <b>${grnItems.length} items (${totalUnits} pcs)</b>
        </div>
        <div class="grn-confirm-row" style="display:flex;justify-content:space-between;align-items:center;font-size:15px;color:var(--primary);margin-top:6px;padding-top:8px;border-top:1px solid var(--line)">
          <span>මුළු එකතුව (Grand Total):</span>
          <b style="font-size:20px;font-weight:800">${money(grandTotal)}</b>
        </div>
      </div>

      <!-- 2. Interactive Payment Section (Separate Popup as requested) -->
      <div style="background:#0f172a;border:1px solid rgba(56,189,248,0.3);border-radius:12px;padding:14px;margin-bottom:12px;box-shadow:0 4px 15px rgba(0,0,0,0.3)">
        <div style="font-size:13px;font-weight:700;color:#38bdf8;margin-bottom:10px;display:flex;align-items:center;gap:6px">
          💳 ගෙවීමේ ආකාරය තෝරන්න (Select Payment Settlement)
        </div>

        <!-- 3 Segment Buttons -->
        <div class="grn-pay-types" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">
          <button type="button" class="btn btn-sm ${payType==='credit'?'btn-primary':''}"
                  id="btnModalPayCredit" onclick="grnSetPayType('credit')" style="font-weight:700;font-size:12px;padding:8px 6px">
            🔴 ණයට (Credit)
          </button>
          <button type="button" class="btn btn-sm ${payType==='full'?'btn-primary':''}"
                  id="btnModalPayFull" onclick="grnSetPayType('full')" style="font-weight:700;font-size:12px;padding:8px 6px">
            🟢 සම්පූර්ණ ගෙවීම (Full)
          </button>
          <button type="button" class="btn btn-sm ${payType==='partial'?'btn-primary':''}"
                  id="btnModalPayPartial" onclick="grnSetPayType('partial')" style="font-weight:700;font-size:12px;padding:8px 6px">
            🟡 කොටසක් ගෙවීම (Partial)
          </button>
        </div>

        <!-- Controls Row: Payment Method & Paid Amount -->
        <div id="grnModalPaymentControlsRow" style="display:${payType==='credit'?'none':'grid'};grid-template-columns:1fr 1fr;gap:12px;background:#060d19;border:1px solid var(--line);border-radius:10px;padding:12px;margin-bottom:12px">
          <div>
            <label class="grn-field-label" style="font-size:11.5px;color:var(--muted);font-weight:600">ගෙවන ක්‍රමය / Payment Method</label>
            <select id="grnModalPaymentMethod" onchange="grnOnPaymentMethodChange()" style="width:100%;font-size:13px">
              <option value="petty" ${payMethod==='petty'?'selected':''}>🪙 Petty Cash (පෙටි කෑෂ්)</option>
              <option value="cash" ${payMethod==='cash'?'selected':''}>💵 Cash (සාමාන්‍ය මුදල්)</option>
              <option value="cheque" ${payMethod==='cheque'?'selected':''}>📄 Cheque (චෙක්පත්)</option>
              <option value="bank" ${payMethod==='bank'?'selected':''}>🏦 Bank Transfer (බැංකු හුවමාරු)</option>
            </select>
          </div>

          <div>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <label class="grn-field-label" style="font-size:11.5px;color:var(--muted);font-weight:600">දැන් ගෙවන මුදල (Paid Amount)</label>
              <div id="grnModalPresetWrap" style="display:${payType==='partial'?'flex':'none'};gap:4px">
                <button type="button" class="btn btn-sm" onclick="grnSetPresetPayment(0.5)" style="padding:2px 7px;font-size:10.5px;height:auto;background:rgba(59,130,246,0.15);color:#93c5fd;border:1px solid rgba(59,130,246,0.3)">
                  50% (භාගයක්)
                </button>
                <button type="button" class="btn btn-sm" onclick="grnSetPresetPayment(0.25)" style="padding:2px 7px;font-size:10.5px;height:auto;background:rgba(59,130,246,0.15);color:#93c5fd;border:1px solid rgba(59,130,246,0.3)">
                  25%
                </button>
              </div>
            </div>
            <input type="number" id="grnModalPaidAmount" step="0.01" min="0" max="${grandTotal}"
                   value="${payType==='full' ? (grandTotal > 0 ? grandTotal.toFixed(2) : '') : (grnState.paidAmount > 0 ? Number(grnState.paidAmount).toFixed(2) : '')}"
                   placeholder="0.00"
                   ${payType==='full'?'readonly style="background:#141f33;opacity:0.9"':'style="background:#0b1220"'}
                   oninput="grnOnPaidAmountInput(this.value)">
          </div>
        </div>

        <!-- Cheque Info Box (Shown when Method == Cheque) -->
        <div id="grnModalChequeFieldsBox" style="display:${(payType!=='credit'&&payMethod==='cheque')?'block':'none'};background:#111c30;border:1px dashed #3b82f6;border-radius:10px;padding:12px;margin-bottom:12px">
          <div style="font-size:12px;font-weight:700;color:#93c5fd;margin-bottom:8px">
            📄 චෙක්පත් විස්තර (Cheque Details - Post-dated Cheque Ledger එකට එකතු වේ)
          </div>
          <div class="grid3" style="gap:10px">
            <div>
              <label class="grn-field-label" style="font-size:11px">චෙක්පත් අංකය / Cheque No *</label>
              <input id="grnModalChequeNo" value="${esc(grnState.chequeNo||'')}" placeholder="උදා: 789456" oninput="grnOnChequeFieldChange()">
            </div>
            <div>
              <label class="grn-field-label" style="font-size:11px">බැංකුව / Bank</label>
              <input id="grnModalChequeBank" value="${esc(grnState.chequeBank||'')}" placeholder="උදා: Commercial, BOC..." oninput="grnOnChequeFieldChange()">
            </div>
            <div>
              <label class="grn-field-label" style="font-size:11px">දිනය / Cheque Date *</label>
              <input type="date" id="grnModalChequeDate" value="${grnState.chequeDate||today()}" onchange="grnOnChequeFieldChange()">
            </div>
          </div>
        </div>

        <!-- Live Payment Calculation Strip -->
        <div class="grn-payment-calc-strip" style="display:flex;justify-content:space-between;align-items:center;background:#060d19;border:1px solid var(--line);padding:10px 14px;border-radius:8px;font-size:13px;flex-wrap:wrap;gap:8px">
          <div>
            <span style="color:var(--muted)">මුළු බිල:</span>
            <b id="grnModalDispTotal" style="color:var(--primary);margin-left:5px">${money(grandTotal)}</b>
          </div>
          <div>
            <span style="color:var(--muted)">දැන් ගෙවන මුදල:</span>
            <b id="grnModalDispPaid" style="color:#34d399;margin-left:5px">${money(effectivePaid)}</b>
          </div>
          <div>
            <span style="color:var(--muted)">සැපයුම්කරුට හිඟ මුදල:</span>
            <b id="grnModalDispDue" style="color:${balanceDue > 0 ? '#fca5a5' : '#34d399'};margin-left:5px">
              ${money(balanceDue)} ${balanceDue > 0 ? '(ණයට / Credit)' : '(පියවා ඇත)'}
            </b>
          </div>
        </div>
      </div>

      <!-- 3. Collapsible WAC Stock Update Preview -->
      <details style="background:rgba(255,255,255,0.02);border:1px solid var(--line);border-radius:8px;padding:8px 12px;margin-bottom:8px">
        <summary style="font-size:12px;color:var(--muted);cursor:pointer;font-weight:600">
          ⚖️ WAC Stock & Cost Update Preview (${wacItems.length} items)
        </summary>
        <div class="grn-wac-list" style="margin-top:8px">
          ${wacListHtml}
        </div>
      </details>
    </div>`;

  const modalFooter = `
    <button type="button" class="btn" onclick="closeModal()">අවලංගු / Cancel</button>
    <button type="button" class="btn btn-green btn-save" onclick="grnSave()" style="font-weight:700;padding:8px 18px;display:inline-flex;align-items:center;gap:6px">
      <span>✅</span>
      <span>GRN එක තහවුරු කර සුරකින්න (Confirm & Save)</span>
    </button>`;

  openModal('💳 GRN ගෙවීම් සහ තහවුරු කිරීම', 'GRN Payment & Settlement', modalBody, modalFooter);
}

/* ---------- Save GRN & Execute WAC Stock Update (Fail-safe Local-First) ---------- */
async function grnSave(){
  if(!grnItems.length) return;

  const db = window.DB || {};
  const sup = $('#grnSupplier')?.value || grnState.supplier || 'නොදන්නා සැපයුම්කරු';
  const invNo = $('#grnInvoiceNo')?.value || grnState.invoiceNo || '';
  const dateVal = $('#grnDate')?.value || grnState.date || today();
  const notesVal = $('#grnNotes')?.value || grnState.notes || '';

  const grandTotal = grnItems.reduce((a, r) => a + Number(r.total || 0), 0);
  const grossTotal = grnItems.reduce((a, r) => a + (Number(r.qty || 0) * Number(r.cost || 0)), 0);
  const totalDiscount = Math.max(0, grossTotal - grandTotal);

  const effectivePaid = grnGetEffectivePaidAmount(grandTotal);
  const balanceDue = Math.max(0, grandTotal - effectivePaid);
  const payType = grnState.paymentType || 'credit';
  const payMethod = payType === 'credit' ? 'credit' : (grnState.paymentMethod || 'cash');

  const chequeNo = (payMethod === 'cheque') ? (grnState.chequeNo || $('#grnModalChequeNo')?.value?.trim() || $('#grnChequeNo')?.value?.trim() || '') : '';
  const chequeBank = (payMethod === 'cheque') ? (grnState.chequeBank || $('#grnModalChequeBank')?.value?.trim() || $('#grnChequeBank')?.value?.trim() || '') : '';
  const chequeDate = (payMethod === 'cheque') ? (grnState.chequeDate || $('#grnModalChequeDate')?.value || $('#grnChequeDate')?.value || today()) : '';

  if(payMethod === 'cheque' && effectivePaid > 0 && !chequeNo){
    toast('කරුණාකර චෙක්පත් අංකය ඇතුළත් කරන්න (Cheque No is required)', 'err');
    return;
  }

  /* 1. Update Product WAC and Stock in Local In-Memory DB */
  const updatedProducts = [];
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
      updatedProducts.push(p);
    }
  }

  /* 2. Update Supplier Accounts Payable Balance in Local DB */
  const supObj = (db.suppliers || []).find(s => s.name === sup);
  const supId = supObj ? supObj.id : (sup === 'වෙනත්' ? 'SUP-WALKIN' : '');
  if(supObj){
    supObj.payable = (supObj.payable || 0) + balanceDue;
  }

  /* 3. Build & Save GRN Record in Local DB */
  if(!db.counters) db.counters = {};
  const grnNo = 'GRN-' + pad(db.counters.grn = (db.counters.grn || 0) + 1);

  const grnRecord = {
    id: uid('G'),
    no: grnNo,
    shopId: (typeof currentShopId === 'function' && currentShopId()) ? currentShopId() : (window.state?.user?.shopId || 'SHOP-001'),
    date: dateVal,
    supplier: sup,
    supplierId: supId,
    invoiceNo: invNo,
    notes: notesVal,
    items: JSON.parse(JSON.stringify(grnItems)),
    subtotal: grossTotal,
    discount: totalDiscount,
    total: grandTotal,
    paymentType: payType,
    paymentMethod: payMethod,
    paidAmount: effectivePaid,
    dueAmount: balanceDue,
    paymentStatus: balanceDue <= 0 ? 'paid' : (effectivePaid > 0 ? 'partial' : 'credit'),
    chequeNo,
    chequeBank,
    chequeDate,
    createdAt: new Date().toISOString()
  };

  if(!db.grns) db.grns = [];
  db.grns.push(grnRecord);

  /* 4. Record Supplier Payment if paidAmount > 0 */
  let payRecord = null;
  if(effectivePaid > 0){
    if(!db.supplierPayments) db.supplierPayments = [];
    payRecord = {
      id: uid('PAY'),
      shopId: grnRecord.shopId,
      supplierId: supId,
      supplierName: sup,
      grnId: grnRecord.id,
      grnNo: grnRecord.no,
      type: payMethod === 'cheque' ? 'cheque' : 'payment',
      amount: effectivePaid,
      method: payMethod,
      notes: `GRN ${grnRecord.no} ${payType === 'full' ? 'සම්පූර්ණ ගෙවීම' : 'කොටසක් ගෙවීම'} (${payMethod.toUpperCase()})`,
      date: dateVal,
      timestamp: new Date().toISOString(),
      createdBy: window.state?.user?.name || 'Staff',
      status: payMethod === 'cheque' ? 'pending' : 'cleared',
      chequeNo,
      bank: chequeBank,
      chequeDate
    };
    db.supplierPayments.push(payRecord);

    /* 4.1 If Petty Cash, also record in cash movements */
    if(payMethod === 'petty'){
      if(!db.cashMoves) db.cashMoves = [];
      const cashMoveRecord = {
        id: uid('CM'),
        shopId: grnRecord.shopId,
        type: 'cash_out',
        amount: effectivePaid,
        reason: `GRN ගෙවීම (${grnRecord.no} - ${sup})`,
        category: 'Supplier Payment',
        date: dateVal,
        timestamp: new Date().toISOString(),
        shiftId: window.state?.activeShift?.id || null,
        staff: window.state?.user?.name || 'Staff'
      };
      db.cashMoves.push(cashMoveRecord);
      if(window.shopAdd){
        window.shopAdd('cashMovements', cashMoveRecord).catch(e=>console.warn(e));
      }
    }
  }

  /* 5. Persist Local Database IMMEDIATELY (Fail-Safe Local First!) */
  if(typeof saveDB === 'function') saveDB(true);
  if(window.DB && typeof window.DB._persistLocalNow === 'function') window.DB._persistLocalNow();
  if(window.DB && typeof window.DB.persistLocal === 'function') window.DB.persistLocal();

  /* 6. Asynchronously sync to Firestore without blocking UI */
  (async () => {
    try {
      if(window.FB && window.FB.fbUpdate){
        for(const p of updatedProducts){
          window.FB.fbUpdate(window.FB.COL.products, p.id, { qty: p.qty, cost: p.cost }).catch(e=>console.warn(e));
        }
      }
      if(supObj && window.FB && window.FB.fbUpdate){
        window.FB.fbUpdate(window.FB.COL.suppliers, supObj.id, { payable: supObj.payable }).catch(e=>console.warn(e));
      }
      if(window.FB && window.FB.fbAdd){
        const addFn = window.shopAdd || window.FB.fbAdd;
        await addFn(window.FB.COL.grns, grnRecord);
        if(payRecord) await addFn(window.FB.COL.supplierPayments, payRecord);
      }
    } catch(err){
      console.warn('Background Firestore sync warning:', err);
    }
  })();

  /* 7. Clear Draft & Reset State for the Next GRN! */
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
  grnState.paymentType = 'credit';
  grnState.paymentMethod = 'petty';
  grnState.paidAmount = 0;
  grnState.chequeNo = '';
  grnState.chequeBank = '';
  grnState.chequeDate = today();

  /* 8. Close Payment Modal and Re-render GRN page (Clear and ready for next GRN!) */
  closeModal();
  render();

  /* 9. Open Dedicated Completion Screen / Receipt Modal */
  grnShowSuccessModal(grnRecord);
}

/* ---------- Completion / Success Modal & Receipt ---------- */
function grnShowSuccessModal(grn){
  if(!grn) return;
  const db = window.DB || {};
  const supName = grn.supplier || 'Walk-in Supplier';
  const items = grn.items || [];

  const bodyHtml = `
    <div class="grn-success-wrap" style="text-align:center;padding:6px 0">
      <div style="width:64px;height:64px;margin:0 auto 12px;background:rgba(16,185,129,0.15);border:2px solid #10b981;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:32px">
        ✅
      </div>
      <h2 style="margin:0 0 4px;font-size:20px;color:#34d399">GRN සාර්ථකව සම්පූර්ණ කරන ලදී!</h2>
      <div style="font-size:12px;color:var(--muted);margin-bottom:14px">තොග සහ සැපයුම්කරුගේ ලෙජරය යාවත්කාලීන විය (Stock & Ledger Updated)</div>

      <!-- Receipt Voucher Card -->
      <div class="card" style="text-align:left;background:#0b1220;border:1px solid var(--line);border-radius:12px;padding:14px;margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;border-bottom:1px dashed var(--line);padding-bottom:8px">
          <div>
            <div style="font-size:11px;color:var(--muted)">GRN අංකය:</div>
            <div style="font-size:17px;font-weight:800;color:var(--primary)">${esc(grn.no)}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;color:var(--muted)">දිනය සහ වේලාව:</div>
            <div style="font-size:12.5px;font-weight:600">${grn.date} · ${new Date(grn.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12.5px;margin-bottom:10px">
          <div>
            <span style="color:var(--muted)">සැපයුම්කරු:</span>
            <div style="font-weight:700;color:var(--txt)">${esc(supName)}</div>
          </div>
          <div>
            <span style="color:var(--muted)">ඉන්වොයිස් අංකය:</span>
            <div style="font-weight:600">${esc(grn.invoiceNo || 'නැත (None)')}</div>
          </div>
        </div>

        <!-- Items Table Snapshot -->
        <div style="max-height:150px;overflow-y:auto;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:4px 8px;margin-bottom:10px;background:#060d19">
          <table style="width:100%;font-size:12px">
            <thead>
              <tr style="color:var(--muted);border-bottom:1px solid var(--line)">
                <th style="text-align:left;padding:4px">භාණ්ඩය</th>
                <th style="text-align:center;padding:4px">ප්‍රමාණය</th>
                <th style="text-align:right;padding:4px">පිරිවැය</th>
                <th style="text-align:right;padding:4px">එකතුව</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(it => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.03)">
                  <td style="padding:4px"><b>${esc(it.code || '')}</b> <small style="color:var(--muted)">${esc(it.name || '')}</small></td>
                  <td style="text-align:center;padding:4px">${it.qty}</td>
                  <td style="text-align:right;padding:4px">${money(it.cost)}</td>
                  <td style="text-align:right;padding:4px;font-weight:600">${money(it.total)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Financial Summary -->
        <div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:10px;font-size:12.5px">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="color:var(--muted)">මුළු එකතුව (Grand Total):</span>
            <b style="font-size:15px;color:var(--primary)">${money(grn.total)}</b>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="color:var(--muted)">දැන් ගෙවූ මුදල (Paid Now):</span>
            <b style="color:${(grn.paidAmount||0)>0?'#34d399':'var(--muted)'}">
              ${money(grn.paidAmount||0)} ${grn.paymentMethod ? `(${grn.paymentMethod.toUpperCase()})` : ''}
            </b>
          </div>
          ${grn.chequeNo ? `
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:11.5px;color:var(--muted)">
              <span>චෙක්පත් විස්තර:</span>
              <b>${esc(grn.chequeNo)} (${esc(grn.chequeBank||'Bank')} · ${grn.chequeDate})</b>
            </div>
          ` : ''}
          <div style="display:flex;justify-content:space-between;border-top:1px dashed var(--line);padding-top:6px;margin-top:4px">
            <span style="color:${(grn.dueAmount||0)>0?'#fca5a5':'#34d399'};font-weight:600">සැපයුම්කරුට හිඟ ශේෂය (Balance Due):</span>
            <b style="color:${(grn.dueAmount||0)>0?'#fca5a5':'#34d399'}">
              ${money(grn.dueAmount||0)} ${(grn.dueAmount||0)>0?'(ණයට / Credit)':'(පියවා ඇත)'}
            </b>
          </div>
        </div>
      </div>
    </div>`;

  const footerHtml = `
    <button type="button" class="btn btn-blue" onclick="grnPrintReceipt('${grn.id}')" style="display:flex;align-items:center;gap:6px">
      🖨️ GRN බිල Print කරන්න
    </button>
    <button type="button" class="btn btn-green" onclick="closeModal();$('#grnSupplier')?.focus();" style="display:flex;align-items:center;gap:6px;font-weight:700">
      ➕ අලුත් GRN එකක් (New GRN)
    </button>
    <button type="button" class="btn" onclick="closeModal();grnShowHistory();">
      📜 ඉතිහාසය (History)
    </button>`;

  openModal('✅ GRN සාර්ථකයි', 'GRN Completion Receipt', bodyHtml, footerHtml);
}

/* ---------- GRN Voucher Print Function ---------- */
function grnPrintReceipt(grnId){
  const db = window.DB || {};
  const grn = (db.grns || []).find(g => g.id === grnId);
  if(!grn){
    toast('GRN වාර්තාව හමු නොවීය', 'err');
    return;
  }

  // Check Bluetooth thermal printer
  if(typeof Printer !== 'undefined' && Printer.isConnected && typeof Printer.printRaw === 'function'){
    try {
      const shop = (db.shops || [])[0] || { name: 'Auto Parts & Motors' };
      const lines = [];
      lines.push(shop.name || 'VEHICLE PARTS');
      lines.push('--------------------------------');
      lines.push(`GRN: ${grn.no}`);
      lines.push(`Date: ${grn.date}`);
      lines.push(`Supplier: ${grn.supplier || ''}`);
      if(grn.invoiceNo) lines.push(`Inv No: ${grn.invoiceNo}`);
      lines.push('--------------------------------');
      (grn.items || []).forEach(it => {
        lines.push(`${(it.code || '').slice(0, 14)} x${it.qty}`);
        lines.push(`  @${money(it.cost)} = ${money(it.total)}`);
      });
      lines.push('--------------------------------');
      lines.push(`TOTAL:  ${money(grn.total)}`);
      lines.push(`PAID:   ${money(grn.paidAmount || 0)} (${(grn.paymentMethod || 'CREDIT').toUpperCase()})`);
      lines.push(`DUE:    ${money(grn.dueAmount || 0)}`);
      lines.push('================================');
      lines.push('   STOCK UPDATED SUCCESS   ');
      lines.push('\n\n\n');
      Printer.printRaw(lines.join('\n'));
      toast('Thermal Printer එකට යවන ලදී', 'ok');
      return;
    } catch(e){
      console.warn('Thermal print fallback:', e);
    }
  }

  // Browser standard print window
  const win = window.open('', '_blank', 'width=700,height=800');
  if(!win){
    toast('Popup අවහිර කර ඇත (Please allow popups to print)', 'err');
    return;
  }
  const shop = (db.shops || [])[0] || { name: 'Auto Parts POS', phone: '' };
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>GRN Voucher - ${esc(grn.no)}</title>
      <style>
        body { font-family: 'Inter', -apple-system, sans-serif; padding: 24px; color: #111; max-width: 650px; margin: 0 auto; }
        .hdr { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; }
        .hdr h1 { margin: 0; font-size: 22px; }
        .hdr p { margin: 3px 0; font-size: 13px; color: #555; }
        .meta { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f4f4f4; }
        .totals { margin-top: 12px; border-top: 2px solid #222; padding-top: 10px; font-size: 14px; }
        .row { display: flex; justify-content: space-between; padding: 3px 0; }
        .row.grand { font-size: 16px; font-weight: bold; border-top: 1px solid #000; margin-top: 6px; padding-top: 6px; }
        .footer { margin-top: 36px; display: flex; justify-content: space-between; font-size: 12px; padding-top: 24px; }
        .sig { border-top: 1px dashed #666; width: 160px; text-align: center; padding-top: 4px; }
        @media print { button { display: none; } }
      </style>
    </head>
    <body>
      <div class="hdr">
        <h1>${esc(shop.name)}</h1>
        <p>GOODS RECEIVED NOTE (GRN) VOUCHER</p>
        <p>${shop.phone ? 'Tel: ' + esc(shop.phone) : ''}</p>
      </div>
      <div class="meta">
        <div>
          <b>GRN No:</b> ${esc(grn.no)}<br>
          <b>Supplier:</b> ${esc(grn.supplier || 'N/A')}<br>
          <b>Invoice No:</b> ${esc(grn.invoiceNo || 'N/A')}
        </div>
        <div style="text-align:right">
          <b>Date:</b> ${grn.date}<br>
          <b>Time:</b> ${new Date(grn.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}<br>
          <b>Status:</b> ${(grn.paymentStatus || 'CREDIT').toUpperCase()}
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Code</th>
            <th>Item Details</th>
            <th style="text-align:center">Qty</th>
            <th style="text-align:right">Unit Cost</th>
            <th style="text-align:right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${(grn.items || []).map((it, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td><b>${esc(it.code || '')}</b></td>
              <td>${esc(it.name || '')}</td>
              <td style="text-align:center">${it.qty}</td>
              <td style="text-align:right">${money(it.cost)}</td>
              <td style="text-align:right">${money(it.total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="totals">
        <div class="row"><span>Gross Subtotal:</span><span>${money(grn.subtotal || grn.total)}</span></div>
        ${grn.discount > 0 ? `<div class="row"><span>Discount:</span><span>- ${money(grn.discount)}</span></div>` : ''}
        <div class="row grand"><span>Grand Total:</span><span>${money(grn.total)}</span></div>
        <div class="row" style="color:green"><span>Paid Now (${esc((grn.paymentMethod || 'credit').toUpperCase())}):</span><span>${money(grn.paidAmount || 0)}</span></div>
        <div class="row" style="color:#d9534f;font-weight:bold"><span>Balance Due (Credit):</span><span>${money(grn.dueAmount || 0)}</span></div>
      </div>
      <div class="footer">
        <div class="sig">Prepared By (Storekeeper)</div>
        <div class="sig">Authorized By (Manager)</div>
        <div class="sig">Supplier Signature</div>
      </div>
      <script>
        window.onload = function(){ window.print(); };
      </script>
    </body>
    </html>
  `);
  win.document.close();
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
            <th style="text-align:right">වටිනාකම</th>
            <th style="text-align:center">ගෙවීම (Payment)</th>
            <th style="text-align:center">ක්‍රියා</th>
          </tr>
        </thead>
        <tbody>
          ${grns.map(g => {
            const paid = Number(g.paidAmount || 0);
            const total = Number(g.total || 0);
            const due = g.dueAmount != null ? Number(g.dueAmount) : Math.max(0, total - paid);
            const status = g.paymentStatus || (due <= 0 && paid > 0 ? 'paid' : (paid > 0 ? 'partial' : 'credit'));
            const method = (g.paymentMethod || 'cash').toUpperCase();

            let badgeHtml = '';
            if(status === 'paid'){
              badgeHtml = `<span class="pill ok" style="font-size:11px">🟢 Paid (${esc(method)})</span>`;
            } else if(status === 'partial'){
              badgeHtml = `<span class="pill warn" style="font-size:11px" title="Paid: ${money(paid)} · Due: ${money(due)}">🟡 Partial (${money(paid)})</span>`;
            } else {
              badgeHtml = `<span class="pill err" style="font-size:11px">🔴 ණයට (Credit)</span>`;
            }

            return `
            <tr>
              <td><b>${esc(g.no)}</b></td>
              <td>${esc(g.date)}</td>
              <td>${esc(g.supplier)}</td>
              <td><small>${esc(g.invoiceNo || '-')}</small></td>
              <td style="text-align:right;font-weight:700;color:var(--primary)">${money(g.total)}</td>
              <td style="text-align:center">${badgeHtml}</td>
              <td style="text-align:center">
                <button type="button" class="btn btn-sm btn-blue" onclick="grnViewDetails('${g.id}')">👁️ විස්තර</button>
              </td>
            </tr>`;
          }).join('') || '<tr><td colspan="7" class="empty" style="text-align:center;padding:18px">GRN වාර්තා නැත</td></tr>'}
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

  const paid = Number(g.paidAmount || 0);
  const total = Number(g.total || 0);
  const due = g.dueAmount != null ? Number(g.dueAmount) : Math.max(0, total - paid);
  const status = g.paymentStatus || (due <= 0 && paid > 0 ? 'paid' : (paid > 0 ? 'partial' : 'credit'));

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

    <!-- Payment Status Box -->
    <div style="background:#0b1220;border:1px solid var(--line);border-radius:10px;padding:12px">
      <div style="font-size:12.5px;font-weight:700;color:#38bdf8;margin-bottom:8px">💳 ගෙවීම් වාර්තාව (Payment Status)</div>
      <div class="grid3">
        <div>
          <small style="color:var(--muted)">ගෙවීමේ ආකාරය</small><br>
          <b>${status === 'paid' ? '🟢 සම්පූර්ණ ගෙවා ඇත (Paid)' : status === 'partial' ? '🟡 කොටසක් ගෙවා ඇත (Partial)' : '🔴 ණයට (Credit)'}</b>
        </div>
        <div>
          <small style="color:var(--muted)">ගෙවූ මුදල (Paid)</small><br>
          <b style="color:#34d399">${money(paid)} ${g.paymentMethod ? '(' + esc(g.paymentMethod).toUpperCase() + ')' : ''}</b>
        </div>
        <div>
          <small style="color:var(--muted)">හිඟ මුදල (Balance Due)</small><br>
          <b style="color:${due > 0 ? '#fca5a5' : '#34d399'}">${money(due)}</b>
        </div>
      </div>
      ${g.paymentMethod === 'cheque' && g.chequeNo ? `
        <div style="margin-top:8px;font-size:11.5px;color:var(--muted);border-top:1px dashed var(--line);padding-top:6px">
          📄 චෙක්පත් අංකය: <b>${esc(g.chequeNo)}</b> (${esc(g.chequeBank || 'Bank')} · දිනය: ${esc(g.chequeDate || '-')})
        </div>
      ` : ''}
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
    shopId: (typeof currentShopId === 'function' && currentShopId()) ? currentShopId() : (window.state?.user?.shopId || 'SHOP-001'),
    name,
    phone,
    contact,
    address,
    payable: 0,
    terms: '30 days'
  };

  db.suppliers.push(newSup);
  if(window.FB && window.FB.fbAdd){
    await (window.shopAdd ? window.shopAdd(window.FB.COL.suppliers, newSup) : window.FB.fbAdd(window.FB.COL.suppliers, newSup));
  }
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
window.grnCancel = grnClearDraft; // Cancel alias
window.grnKeyHandler = grnKeyHandler;
window.quickAddSupplier = quickAddSupplier;
window.saveQuickSupplier = saveQuickSupplier;
window.grnStartCameraScan = grnStartCameraScan;
window.grnOpenNewProductModal = grnOpenNewProductModal;
window.grnSaveNewProduct = grnSaveNewProduct;
window.grnSetPayType = grnSetPayType;
window.grnOnPaymentMethodChange = grnOnPaymentMethodChange;
window.grnSetPresetPayment = grnSetPresetPayment;
window.grnOnPaidAmountInput = grnOnPaidAmountInput;
window.grnOnChequeFieldChange = grnOnChequeFieldChange;
window.grnRecalcPaymentDisplays = grnRecalcPaymentDisplays;
window.grnGetEffectivePaidAmount = grnGetEffectivePaidAmount;
window.grnGetPaymentBadgeHtml = grnGetPaymentBadgeHtml;
window.grnShowSuccessModal = grnShowSuccessModal;
window.grnPrintReceipt = grnPrintReceipt;


