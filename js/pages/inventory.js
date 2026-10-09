/* =========================================================
   js/pages/inventory.js - Product & Auto Parts Inventory Management
   ========================================================= */

function pgInventory(){
  const db = window.DB || {};
  const q = (window._invQ||'').toLowerCase().trim();
  const list = (db.products || []).filter(p => !q
    || (p.name || '').toLowerCase().includes(q)
    || (p.nameEn || '').toLowerCase().includes(q)
    || (p.code || '').toLowerCase().includes(q)
    || (p.oemNo || '').toLowerCase().includes(q)
    || (p.brand || '').toLowerCase().includes(q)
    || (p.model || '').toLowerCase().includes(q)
    || (p.rack || '').toLowerCase().includes(q)
    || (Array.isArray(p.altNos) && p.altNos.some(a => a.toLowerCase().includes(q)))
    || (Array.isArray(p.chassis) && p.chassis.some(c => c.toLowerCase().includes(q)))
  );

  return `
  <div class="card">
    <div class="card-h">
      <h3>📦 භාණ්ඩ ලැයිස්තුව<small>Inventory — ${db.products?.length || 0} items</small></h3>
      <div style="display:flex;gap:8px">
        <input placeholder="🔍 නම / කේතය / OEM / Rack..." style="width:240px" value="${esc(window._invQ||'')}"
               oninput="window._invQ=this.value;render()">
        ${hasPermission('inventory') ? '<button class="btn btn-primary btn-sm" onclick="editProduct()">+ නව භාණ්ඩය</button>' : ''}
      </div>
    </div>
    <div class="tbl-wrap">
    <table><thead><tr>
      <th>කේතය / OEM</th>
      <th>භාණ්ඩය</th>
      <th>කාණ්ඩය</th>
      <th>වාහන අනුකූලතාව</th>
      <th>ස්ථානය (Rack)</th>
      <th style="text-align:right">පිරිවැය</th>
      <th style="text-align:right">විකුණුම් මිල</th>
      <th style="text-align:center">තොග</th>
      <th>ක්‍රියා</th>
    </tr></thead><tbody>
    ${list.map(p => `<tr>
      <td style="font-family:'Inter',monospace;font-size:12px">
        <b>${p.code}</b>
        ${p.oemNo ? `<br><small style="color:var(--primary);font-size:10px">OEM: ${esc(p.oemNo)}</small>` : ''}
      </td>
      <td>
        <b>${esc(p.name)}</b><br>
        <small style="color:var(--muted)">${esc(p.nameEn || '')}</small>
        ${p.warranty ? `<br><span class="pill ok" style="font-size:9px;padding:1px 5px">🛡️ ${p.warranty}m warranty</span>` : ''}
        ${p.hasSerial ? `<span class="pill info" style="font-size:9px;padding:1px 5px">🛡️ S/N Track</span>` : ''}
        ${p.coreDeposit ? `<span class="pill warn" style="font-size:9px;padding:1px 5px">♻️ Core Rs.${p.coreDeposit}</span>` : ''}
        ${(p.crossSell && p.crossSell.length) ? `<br><small style="color:var(--muted);font-size:10px">🔗 Cross: ${esc(p.crossSell.join(', '))}</small>` : ''}
      </td>
      <td><span class="pill mute">${p.cat}</span></td>
      <td>
        <small><b>${esc(p.brand || '')}</b> ${esc(p.model || '')}</small>
        ${(p.chassis && p.chassis.length) ? `<br><small style="color:var(--muted)">Chassis: ${esc(p.chassis.join(', '))}</small>` : ''}
        ${(p.engine && p.engine.length) ? `<br><small style="color:var(--muted)">Engine: ${esc(p.engine.join(', '))}</small>` : ''}
      </td>
      <td>
        ${p.rack ? `<span class="pill info" style="font-size:10.5px">📍 ${p.rack}${p.bin ? ' / ' + p.bin : ''}</span>` : '<span style="color:var(--muted)">—</span>'}
        ${p.warehouse && p.warehouse !== 'Main' ? `<br><small style="color:var(--muted)">(${esc(p.warehouse)})</small>` : ''}
      </td>
      <td style="text-align:right">${money(p.cost)}</td>
      <td style="text-align:right;color:var(--primary);font-weight:700">${money(p.price)}</td>
      <td style="text-align:center">
        <span class="pill ${p.qty===0?'bad':p.qty<=p.reorder?'warn':'ok'}">${p.qty} ${p.unit||'pcs'}</span>
      </td>
      <td style="white-space:nowrap">
        <button class="btn btn-sm" onclick="editProduct('${p.id}')">✏️</button>
        ${hasPermission('delete-product') ? `<button class="btn btn-sm btn-red" onclick="delProduct('${p.id}')">🗑️</button>` : ''}
      </td></tr>`).join('') || '<tr><td colspan="9" class="empty">භාණ්ඩ හමු නොවීය</td></tr>'}
    </tbody></table></div>
  </div>`;
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
window.editProduct = editProduct;
window.saveProduct = saveProduct;
window.delProduct = delProduct;
