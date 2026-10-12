/* =========================================================
   js/pages/interchange.js - Part Interchange & Vehicle Compatibility Matrix
   Phase 8: Automotive Specifics (Cross-Compatibility)
   ========================================================= */

window.state = window.state || {};
state.interchangeSearch = state.interchangeSearch || '';
state.interchangeBrand = state.interchangeBrand || 'all';
state.interchangeChassis = state.interchangeChassis || 'all';

function pgInterchange(){
  const db = window.DB || {};
  const activeShop = (typeof currentShopId === 'function') ? currentShopId() : null;
  const interchanges = (db.interchanges || []).filter(i => !activeShop || i.shopId === activeShop || !i.shopId);
  const products = (db.products || []).filter(p => !activeShop || p.shopId === activeShop || !p.shopId);

  // Extract all unique brands and chassis for filters
  const brandSet = new Set();
  const chassisSet = new Set();

  interchanges.forEach(int => {
    (int.fitsVehicles || []).forEach(v => {
      if(v.brand) brandSet.add(v.brand);
      (v.chassis || []).forEach(c => chassisSet.add(c));
    });
  });

  products.forEach(p => {
    if(p.brand) brandSet.add(p.brand);
    (p.chassis || []).forEach(c => chassisSet.add(c));
  });

  const brands = Array.from(brandSet).sort();
  const chassisList = Array.from(chassisSet).sort();

  // Filter interchanges
  const q = (state.interchangeSearch || '').trim().toLowerCase();
  const selBrand = state.interchangeBrand || 'all';
  const selChassis = state.interchangeChassis || 'all';

  let list = interchanges.filter(item => {
    if(selBrand !== 'all'){
      const hasBrand = (item.fitsVehicles || []).some(v => v.brand === selBrand);
      if(!hasBrand) return false;
    }
    if(selChassis !== 'all'){
      const hasChassis = (item.fitsVehicles || []).some(v => (v.chassis || []).includes(selChassis));
      if(!hasChassis) return false;
    }
    if(q){
      const codeMatch = (item.productCode || '').toLowerCase().includes(q);
      const altMatch = (item.alternates || []).some(a => a.toLowerCase().includes(q));
      const vehMatch = (item.fitsVehicles || []).some(v => 
        (v.brand || '').toLowerCase().includes(q) ||
        (v.model || '').toLowerCase().includes(q) ||
        (v.chassis || []).some(c => c.toLowerCase().includes(q)) ||
        (v.engine || []).some(e => e.toLowerCase().includes(q))
      );
      const prod = db.getProd ? db.getProd(item.productId) : products.find(p => p.id === item.productId);
      const nameMatch = prod ? (prod.name || '').toLowerCase().includes(q) : false;
      return codeMatch || altMatch || vehMatch || nameMatch;
    }
    return true;
  });

  // Calculate unique vehicle models covered
  let totalVehicles = 0;
  interchanges.forEach(int => totalVehicles += (int.fitsVehicles || []).length);

  return `
    <div class="interchange-page">
      
      <!-- Top Header Row -->
      <div class="interchange-header">
        <div>
          <h3>🔄 Part Interchange <small>වාහන අනුකූලතා හා ආදේශක අමතර කොටස් නාමාවලිය (Vehicle Compatibility)</small></h3>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="openInterchangeModal()" style="display:flex;align-items:center;gap:6px;font-weight:700">
            <span>+ නව Interchange එකක්</span>
          </button>
        </div>
      </div>

      <!-- High Level Metrics -->
      <div class="stats" style="margin-bottom:14px">
        <div class="stat">
          <div class="ic" style="background:rgba(59,130,246,0.15);color:#93c5fd">🚗</div>
          <div>
            <b>${totalVehicles}</b>
            <span>වාහන මාදිලි ආවරණය (Vehicle Fits)</span>
          </div>
        </div>
        <div class="stat">
          <div class="ic" style="background:rgba(245,158,11,0.15);color:#fcd34d">🔄</div>
          <div>
            <b>${interchanges.length}</b>
            <span>Interchange Matrices</span>
          </div>
        </div>
        <div class="stat">
          <div class="ic" style="background:rgba(16,185,129,0.15);color:#6ee7b7">📦</div>
          <div>
            <b>${products.length}</b>
            <span>ලියාපදිංචි භාණ්ඩ (Products)</span>
          </div>
        </div>
      </div>

      <!-- Search & Filters Toolbar -->
      <div class="interchange-toolbar card">
        <div class="interchange-search-row">
          <span style="font-size:16px">🔍</span>
          <input type="search" id="intSearchInp"
                 placeholder="වාහනය, චැසි අංකය (HA12, MH21...), එන්ජිම (K10B, 1NZ) හෝ භාණ්ඩ කේතය සොයන්න..."
                 value="${esc(state.interchangeSearch || '')}"
                 oninput="state.interchangeSearch = this.value; render();">
          ${state.interchangeSearch ? `<button class="btn btn-sm" onclick="state.interchangeSearch=''; render();">✕</button>` : ''}
        </div>

        <div class="interchange-filters-row">
          <div class="interchange-filter-item">
            <label>වාහන වර්ගය / Brand</label>
            <select onchange="state.interchangeBrand = this.value; render();">
              <option value="all">සියලු වර්ග (All Brands)</option>
              ${brands.map(b => `<option value="${esc(b)}" ${selBrand === b ? 'selected' : ''}>${esc(b)}</option>`).join('')}
            </select>
          </div>
          <div class="interchange-filter-item">
            <label>චැසි කේතය / Chassis</label>
            <select onchange="state.interchangeChassis = this.value; render();">
              <option value="all">සියලු Chassis (All)</option>
              ${chassisList.map(c => `<option value="${esc(c)}" ${selChassis === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- Interchange Cards Grid -->
      ${list.length > 0 ? `
        <div class="interchange-grid">
          ${list.map(item => renderInterchangeCard(item, db)).join('')}
        </div>
      ` : `
        <div class="card" style="padding:50px 20px;text-align:center">
          <div style="font-size:42px;margin-bottom:12px">🔄</div>
          <div style="font-size:16px;font-weight:700;margin-bottom:6px">ගැලපෙන Interchange දත්ත හමු නොවීය</div>
          <p style="color:var(--muted);font-size:12.5px;max-width:400px;margin:0 auto 16px">
            සෙවුම් පදය වෙනස් කරන්න හෝ නව වාහන ආදේශක දත්ත (Part Interchange) එකක් එක් කරන්න.
          </p>
          <button class="btn btn-primary" onclick="openInterchangeModal()">+ නව Interchange එකක් එක් කරන්න</button>
        </div>
      `}

    </div>
  `;
}

function renderInterchangeCard(item, db){
  const prod = db.getProd ? db.getProd(item.productId) : (db.products || []).find(p => p.id === item.productId || p.code === item.productCode);
  const vehicles = item.fitsVehicles || [];
  const alternates = item.alternates || [];

  return `
    <div class="interchange-card">
      <div>
        <div class="ic-top">
          <div>
            <div class="ic-title">
              <span>🚗</span>
              <span>${vehicles.length > 0 ? `${esc(vehicles[0].brand)} ${esc(vehicles[0].model)}` : 'සාමාන්‍ය ගැලපුම'}</span>
            </div>
            <div class="ic-years">
              ${vehicles.length > 0 && vehicles[0].yearFrom ? `${vehicles[0].yearFrom} – ${vehicles[0].yearTo || 'දක්වා'}` : 'සියලු වර්ෂ'}
              ${vehicles.length > 1 ? `<span style="color:var(--muted);font-size:11px;font-weight:400"> (+තවත් ${vehicles.length - 1}ක්)</span>` : ''}
            </div>
          </div>
          <span class="pill ok" style="font-size:11px;padding:3px 8px">Active</span>
        </div>

        <!-- Chassis & Engine Badges -->
        <div class="ic-tags">
          ${vehicles.flatMap(v => v.chassis || []).slice(0, 5).map(c => `<span class="chassis-tag">#${esc(c)}</span>`).join('')}
          ${vehicles.flatMap(v => v.engine || []).slice(0, 3).map(e => `<span class="engine-tag">⚡ ${esc(e)}</span>`).join('')}
        </div>

        <!-- Compatible Products Box -->
        <div class="ic-products-list">
          <div class="ic-products-heading">
            <span>ගැලපෙන භාණ්ඩ (Compatible Parts):</span>
            <span style="color:var(--primary)">${alternates.length + 1} parts</span>
          </div>

          <!-- Primary Product -->
          <div class="ic-item-row">
            <div class="ic-item-info">
              <span class="ic-item-code">${esc(item.productCode || prod?.code || 'N/A')}</span>
              <span class="ic-item-name">${esc(prod ? prod.name : 'මූලික භාණ්ඩය')}</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <span class="ic-badge badge-direct">Direct fit</span>
              ${prod ? `<span class="pill ${prod.qty > 0 ? 'info' : 'bad'}" style="font-size:10px">${prod.qty} pcs</span>` : ''}
            </div>
          </div>

          <!-- Alternative Interchange Parts -->
          ${alternates.slice(0, 3).map(altCode => {
            const altProd = (db.products || []).find(p => p.code === altCode);
            return `
              <div class="ic-item-row">
                <div class="ic-item-info">
                  <span class="ic-item-code" style="color:#fbbf24">${esc(altCode)}</span>
                  <span class="ic-item-name">${esc(altProd ? altProd.name : 'ආදේශක අමතර කොටස')}</span>
                </div>
                <div style="display:flex;align-items:center;gap:6px">
                  <span class="ic-badge badge-interchange">🔄 Interchange</span>
                  ${altProd ? `<span class="pill ${altProd.qty > 0 ? 'info' : 'bad'}" style="font-size:10px">${altProd.qty} pcs</span>` : ''}
                </div>
              </div>
            `;
          }).join('')}

          ${alternates.length > 3 ? `
            <div style="font-size:11px;color:var(--muted);text-align:center;padding-top:4px">
              + තවත් ආදේශක ${alternates.length - 3} ක් ඇත
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Card Action Buttons -->
      <div class="ic-actions">
        <button class="btn btn-sm" onclick="viewInterchangeDetails('${item.id}')" style="flex:1;display:flex;justify-content:center;align-items:center;gap:5px">
          <span>👁️ විස්තර බලන්න</span>
        </button>
        <button class="btn btn-sm btn-primary" onclick="openInterchangeModal('${item.id}')" title="සංස්කරණය">
          <span>✏️ සංස්කරණය</span>
        </button>
      </div>
    </div>
  `;
}

/* =========================================================
   VIEW INTERCHANGE DETAILS MODAL
   ========================================================= */
function viewInterchangeDetails(interchangeId){
  const db = window.DB || {};
  const item = (db.interchanges || []).find(i => i.id === interchangeId);
  if(!item) return;

  const prod = db.getProd ? db.getProd(item.productId) : (db.products || []).find(p => p.id === item.productId || p.code === item.productCode);
  const vehicles = item.fitsVehicles || [];
  const alternates = item.alternates || [];

  const modalBody = `
    <div style="display:flex;flex-direction:column;gap:14px;padding:4px 0">
      
      <!-- Primary Product Summary -->
      <div style="background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:12px">
        <div style="font-size:11.5px;color:var(--muted);font-weight:600;margin-bottom:4px">මූලික භාණ්ඩය (Reference Part):</div>
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <div>
            <b style="font-size:16px;color:var(--primary)">${esc(item.productCode || prod?.code || 'N/A')}</b>
            <div style="font-size:13px;font-weight:600">${esc(prod ? prod.name : '—')}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:14px;font-weight:700">${prod ? money(prod.price) : '—'}</div>
            <small style="color:var(--muted)">තොග: ${prod ? prod.qty : 0} pcs</small>
          </div>
        </div>
      </div>

      <!-- Compatible Vehicles Table -->
      <div>
        <h4 style="margin:0 0 8px;font-size:13px;color:var(--txt)">🚗 ගැලපෙන වාහන නාමාවලිය (Fits Vehicles):</h4>
        <div class="tbl-wrap" style="max-height:220px;overflow-y:auto">
          <table class="report-table" style="font-size:12px">
            <thead>
              <tr>
                <th>වර්ගය / Model</th>
                <th>වර්ෂ</th>
                <th>Chassis</th>
                <th>Engine</th>
                <th>සටහන්</th>
              </tr>
            </thead>
            <tbody>
              ${vehicles.map(v => `
                <tr>
                  <td><b>${esc(v.brand)}</b> ${esc(v.model)}</td>
                  <td>${v.yearFrom || '—'} – ${v.yearTo || 'දක්වා'}</td>
                  <td>${(v.chassis || []).map(c => `<span class="chassis-tag">${esc(c)}</span>`).join(' ')}</td>
                  <td>${(v.engine || []).map(e => `<span class="engine-tag">${esc(e)}</span>`).join(' ')}</td>
                  <td><small style="color:var(--muted)">${esc(v.notes || 'Direct fit')}</small></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Alternative Products Grid -->
      <div>
        <h4 style="margin:0 0 8px;font-size:13px;color:var(--txt)">🔄 ආදේශක අමතර කොටස් (Cross-Interchange Parts):</h4>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${alternates.map(altCode => {
            const altProd = (db.products || []).find(p => p.code === altCode);
            return `
              <div style="display:flex;justify-content:space-between;align-items:center;background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:8px 12px">
                <div>
                  <b style="color:#fbbf24">${esc(altCode)}</b>
                  <div style="font-size:12px;color:var(--txt)">${esc(altProd ? altProd.name : 'Cross Reference Part')}</div>
                </div>
                <div style="display:flex;align-items:center;gap:8px">
                  ${altProd ? `
                    <span style="font-weight:700;font-size:13px">${money(altProd.price)}</span>
                    <span class="pill ${altProd.qty > 0 ? 'ok' : 'bad'}">${altProd.qty} in stock</span>
                  ` : '<span class="pill warn">External Code</span>'}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

    </div>
  `;

  openModal(
    '🔄 Compatibility Details',
    `${item.productCode} — වාහන අනුකූලතා විස්තරය`,
    modalBody,
    `<button class="btn" onclick="closeModal()">වසන්න</button>
     <button class="btn btn-primary" onclick="closeModal(); openInterchangeModal('${item.id}')">✏️ සංස්කරණය</button>`
  );
}

/* =========================================================
   ADD / EDIT INTERCHANGE MODAL
   ========================================================= */
let _editInterchangeVehicles = [];

function openInterchangeModal(interchangeId = null){
  const db = window.DB || {};
  const activeShop = (typeof currentShopId === 'function') ? currentShopId() : null;
  const products = (db.products || []).filter(p => !activeShop || p.shopId === activeShop || !p.shopId);

  let item = null;
  if(interchangeId){
    item = (db.interchanges || []).find(i => i.id === interchangeId);
  }

  _editInterchangeVehicles = item && Array.isArray(item.fitsVehicles) ? JSON.parse(JSON.stringify(item.fitsVehicles)) : [
    { brand: 'Maruti', model: 'Alto', chassis: ['HA12'], engine: ['F8D'], yearFrom: 2000, yearTo: 2012, notes: 'Direct fit' }
  ];

  const modalBody = `
    <div style="display:flex;flex-direction:column;gap:12px;padding:4px 0">
      
      <!-- Product Selection -->
      <div>
        <label style="font-size:12px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">මූලික භාණ්ඩය තෝරන්න (Select Product)</label>
        <select id="intProdSelect" onchange="onInterchangeProdSelect()" style="width:100%;padding:9px;border-radius:8px">
          <option value="">-- භාණ්ඩයක් තෝරන්න --</option>
          ${products.map(p => `
            <option value="${p.id}" data-code="${esc(p.code)}" ${(item && (item.productId === p.id || item.productCode === p.code)) ? 'selected' : ''}>
              ${esc(p.code)} — ${esc(p.name)} (${esc(p.brand || '')})
            </option>
          `).join('')}
        </select>
      </div>

      <!-- Fits Vehicles Interactive Builder -->
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <label style="font-size:12px;color:var(--muted);font-weight:600">ගැලපෙන වාහන ලැයිස්තුව (Fits Vehicles)</label>
          <button type="button" class="btn btn-sm btn-primary" onclick="addInterchangeVehicleRow()" style="font-size:11px;padding:3px 8px">
            + වාහනයක් එක් කරන්න
          </button>
        </div>

        <div id="intVehiclesContainer" style="display:flex;flex-direction:column;gap:8px;max-height:220px;overflow-y:auto">
          ${renderInterchangeVehicleInputs()}
        </div>
      </div>

      <!-- Alternates Input -->
      <div>
        <label style="font-size:12px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">
          ආදේශක කේත (Alternative Product Codes - කොමාවකින් වෙන් කරන්න)
        </label>
        <input id="intAlternatesInp" placeholder="උදා: OF-2003, OF-2004, Vic C-224..."
               value="${esc((item && item.alternates ? item.alternates : []).join(', '))}"
               style="width:100%">
      </div>

    </div>
  `;

  const modalFooter = `
    <button class="btn" onclick="closeModal()">අවලංගු</button>
    <button class="btn btn-primary" onclick="saveInterchangeRecord('${interchangeId || ''}')">
      💾 සුරකින්න (Save Interchange)
    </button>
  `;

  openModal(
    item ? '✏️ Interchange සංස්කරණය' : '🔄 නව Part Interchange එකක්',
    'Vehicle Cross-Compatibility Matrix Editor',
    modalBody,
    modalFooter
  );
}

function renderInterchangeVehicleInputs(){
  if(!_editInterchangeVehicles.length){
    return `<div style="font-size:12px;color:var(--muted);padding:10px;text-align:center">වාහන ඇතුළත් කර නැත</div>`;
  }
  return _editInterchangeVehicles.map((v, idx) => `
    <div style="background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:11px;font-weight:700;color:var(--primary)">වාහනය #${idx + 1}</span>
        <button type="button" class="btn btn-sm" onclick="removeInterchangeVehicleRow(${idx})" style="color:#ef4444;padding:2px 6px;font-size:11px">✕ මකන්න</button>
      </div>
      <div class="grid3" style="gap:6px">
        <div>
          <input placeholder="Brand (Maruti, Toyota...)" value="${esc(v.brand || '')}" oninput="_editInterchangeVehicles[${idx}].brand = this.value" style="font-size:12px;padding:6px">
        </div>
        <div>
          <input placeholder="Model (Alto, Axio...)" value="${esc(v.model || '')}" oninput="_editInterchangeVehicles[${idx}].model = this.value" style="font-size:12px;padding:6px">
        </div>
        <div>
          <input placeholder="Chassis (HA12, HA24...)" value="${esc((v.chassis || []).join(', '))}" oninput="_editInterchangeVehicles[${idx}].chassis = this.value.split(',').map(s=>s.trim()).filter(Boolean)" style="font-size:12px;padding:6px">
        </div>
      </div>
      <div class="grid3" style="gap:6px">
        <div>
          <input placeholder="Engine (K10B, 1NZ...)" value="${esc((v.engine || []).join(', '))}" oninput="_editInterchangeVehicles[${idx}].engine = this.value.split(',').map(s=>s.trim()).filter(Boolean)" style="font-size:12px;padding:6px">
        </div>
        <div>
          <input type="number" placeholder="Year From (2000)" value="${v.yearFrom || ''}" oninput="_editInterchangeVehicles[${idx}].yearFrom = parseInt(this.value, 10) || null" style="font-size:12px;padding:6px">
        </div>
        <div>
          <input type="number" placeholder="Year To (2015)" value="${v.yearTo || ''}" oninput="_editInterchangeVehicles[${idx}].yearTo = parseInt(this.value, 10) || null" style="font-size:12px;padding:6px">
        </div>
      </div>
    </div>
  `).join('');
}

function addInterchangeVehicleRow(){
  _editInterchangeVehicles.push({
    brand: '',
    model: '',
    chassis: [],
    engine: [],
    yearFrom: 2000,
    yearTo: 2020,
    notes: 'Direct fit'
  });
  const container = document.getElementById('intVehiclesContainer');
  if(container) container.innerHTML = renderInterchangeVehicleInputs();
}

function removeInterchangeVehicleRow(idx){
  _editInterchangeVehicles.splice(idx, 1);
  const container = document.getElementById('intVehiclesContainer');
  if(container) container.innerHTML = renderInterchangeVehicleInputs();
}

function onInterchangeProdSelect(){
  // No-op or auto-populate helper
}

async function saveInterchangeRecord(interchangeId){
  const sel = document.getElementById('intProdSelect');
  const altsInp = document.getElementById('intAlternatesInp');

  const pid = sel ? sel.value : '';
  if(!pid){
    toast('කරුණාකර භාණ්ඩයක් තෝරන්න', 'err');
    return;
  }

  const db = window.DB || {};
  const prod = (db.products || []).find(p => p.id === pid);
  const pCode = prod ? prod.code : (sel.selectedOptions[0]?.getAttribute('data-code') || 'OF-2000');
  const alternates = (altsInp ? altsInp.value : '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const shopId = (typeof currentShopId === 'function' && currentShopId()) ? currentShopId() : (window.state?.user?.shopId || 'SHOP-001');

  const record = {
    id: interchangeId || ('INT-' + Date.now()),
    shopId,
    productId: pid,
    productCode: pCode,
    fitsVehicles: _editInterchangeVehicles.filter(v => v.brand || v.model || (v.chassis && v.chassis.length)),
    alternates,
    updatedAt: new Date().toISOString(),
    updatedBy: window.state?.user?.name || 'Staff'
  };

  db.interchanges = db.interchanges || [];
  const existingIdx = db.interchanges.findIndex(i => i.id === record.id);
  if(existingIdx >= 0){
    db.interchanges[existingIdx] = record;
  } else {
    db.interchanges.push(record);
  }

  try {
    if(existingIdx >= 0){
      if(window.shopUpdate) await window.shopUpdate('interchanges', record.id, record);
      else if(window.FB && window.FB.fbSet) await window.FB.fbSet('interchanges', record.id, record);
    } else {
      if(window.shopAdd) await window.shopAdd('interchanges', record);
      else if(window.FB && window.FB.fbSet) await window.FB.fbSet('interchanges', record.id, record);
    }
  } catch(e){
    console.warn('Interchange save warning:', e);
  }

  if(typeof db.persistLocal === 'function') db.persistLocal();
  closeModal();
  render();
  toast('✅ Part Interchange සාර්ථකව සුරකින ලදී', 'ok');
}

window.pgInterchange = pgInterchange;
window.renderInterchangeCard = renderInterchangeCard;
window.viewInterchangeDetails = viewInterchangeDetails;
window.openInterchangeModal = openInterchangeModal;
window.addInterchangeVehicleRow = addInterchangeVehicleRow;
window.removeInterchangeVehicleRow = removeInterchangeVehicleRow;
window.onInterchangeProdSelect = onInterchangeProdSelect;
window.saveInterchangeRecord = saveInterchangeRecord;
