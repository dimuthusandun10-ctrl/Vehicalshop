/* =========================================================
   js/pages/serial-search.js - Warranty & Serial Number Tracking
   Enhanced: Direct Warranty Claim, Instant Replacement & History
   ========================================================= */

window._serialQuery = window._serialQuery || '';

function pgSerialSearch(){
  const db = window.DB || {};
  const q = (window._serialQuery || '').trim().toUpperCase();

  const records = getSerializedRecords(db, q);

  return `
  <div class="serial-search-page">
  <div class="serial-search-hero">
    <div class="card-h" style="margin-bottom:8px">
      <h3>🛡️ Serial අංකය සහ වගකීම් සොයන්න<small>Warranty & Serial Number Lookup</small></h3>
      <span class="pill info">ලියාපදිංචි Serial: ${records.length}</span>
    </div>
    <div class="serial-search-input-wrap">
      <input id="serialSearchInp" placeholder="🔍 Serial අංකය ඇතුළත් කරන්න (උදා: AMR-2024-A001)..."
             value="${esc(window._serialQuery || '')}"
             oninput="window._serialQuery=this.value;renderSerialList()"
             onkeydown="if(event.key==='Enter'){window._serialQuery=this.value;render();}">
      <button type="button" class="btn btn-muted" onclick="scanSerialForSearch()" title="Camera එකෙන් Serial Barcode එක ස්කෑන් කරන්න" style="display:flex;align-items:center;gap:4px">
        📷 <span>Scan</span>
      </button>
      <button class="btn btn-primary" onclick="window._serialQuery=$('#serialSearchInp')?.value||'';render()">
        🔍 සොයන්න
      </button>
      ${window._serialQuery ? `<button class="btn" onclick="window._serialQuery='';render()">✕ Clear</button>` : ''}
    </div>
  </div>

  <div id="serialResultsContainer">
    ${renderSerialResultsHtml(records, q)}
  </div>
  </div>`;
}

function scanSerialForSearch(){
  if(typeof BarcodeScanner !== 'undefined' && BarcodeScanner.open){
    BarcodeScanner.open((code) => {
      const inp = document.getElementById('serialSearchInp');
      if(inp){
        inp.value = code;
        window._serialQuery = code;
        renderSerialList();
      }
    }, { requireShopProduct: false });
  } else {
    toast('Camera Scanner සක්‍රීය නැත', 'warn');
  }
}

function getSerializedRecords(db, q){
  const records = [];
  (db.sales || []).forEach(s => {
    if(!s.itemSerials) return;
    Object.entries(s.itemSerials).forEach(([pid, serials]) => {
      const p = (db.getProd ? db.getProd(pid) : null) || (s.items || []).find(it => it.pid === pid) || (db.products || []).find(x => x.id === pid) || {};
      const expDateStr = (s.warrantyExpiry && s.warrantyExpiry[pid])
        ? s.warrantyExpiry[pid]
        : calcExpiryDateStr(s.date, p.warranty || 0);

      const expDate = new Date(expDateStr + 'T23:59:59');
      const now = new Date();
      const diffMs = expDate.getTime() - now.getTime();
      const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const isValid = daysLeft >= 0;

      (Array.isArray(serials) ? serials : [serials]).forEach(serial => {
        if(!serial) return;
        const upperSerial = String(serial).trim().toUpperCase();

        if(!q || upperSerial.includes(q) || (s.customer || '').toUpperCase().includes(q) || (s.vehicle || '').toUpperCase().includes(q) || (s.no || '').toUpperCase().includes(q)){
          // Check if this serial was already claimed
          const isClaimed = Boolean(
            (s.claimedSerials && s.claimedSerials.includes(upperSerial)) ||
            (db.returns || []).some(r => r.serial === upperSerial || (r.items && r.items.some(it => it.serial === upperSerial || (it.serials && it.serials.includes(upperSerial)))))
          );

          const claimRecord = (db.returns || []).find(r => 
            r.serial === upperSerial || 
            (r.items && r.items.some(it => it.serial === upperSerial || (it.serials && it.serials.includes(upperSerial))))
          ) || null;

          const replacedBy = (s.replacementSerials && s.replacementSerials[upperSerial]) || (claimRecord ? claimRecord.newSerial : null);

          records.push({
            serial: upperSerial,
            productId: pid,
            productName: p.name || 'වාහන අමතර කොටස',
            productNameEn: p.nameEn || '',
            productCode: p.code || '',
            oemNo: p.oemNo || '',
            rack: p.rack || '',
            bin: p.bin || '',
            warrantyMonths: p.warranty || 0,
            saleId: s.id,
            saleNo: s.no,
            saleDate: s.date,
            customer: s.customer || 'වෝක්-ඉන්',
            vehicle: s.vehicle || '',
            cashier: s.cashier || '',
            expiryDate: expDateStr,
            daysLeft,
            isValid,
            isClaimed,
            claimRecord,
            replacedBy
          });
        }
      });
    });
  });
  return records;
}

function renderSerialList(){
  const q = ($('#serialSearchInp')?.value || '').trim().toUpperCase();
  window._serialQuery = q;
  const db = window.DB || {};
  const records = getSerializedRecords(db, q);
  const c = $('#serialResultsContainer');
  if(c) c.innerHTML = renderSerialResultsHtml(records, q);
}

function renderSerialResultsHtml(records, q){
  if(!records.length){
    return `
    <div class="card empty" style="padding:48px 20px">
      <div class="e">🛡️</div>
      <div style="font-size:15px;font-weight:600;margin-bottom:4px">
        ${q ? `'${esc(q)}' සඳහා Serial අංකයක් හමු නොවීය` : 'ලියාපදිංචි Serial අංක නොමැත'}
      </div>
      <small style="color:var(--muted)">විකුණුම් බිල්පතක් නිකුත් කිරීමේදී Serial අංකය ඇතුළත් කළ පසු මෙහි දිස්වේ</small>
    </div>`;
  }

  return records.map(r => `
    <div class="serial-card" style="${r.isClaimed ? 'border-color:rgba(239,68,68,0.3);background:rgba(239,68,68,0.03)' : ''}">
      <div class="serial-card-left">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span style="font-family:'Inter',monospace;font-size:16px;font-weight:700;color:var(--primary)">
            🔑 ${esc(r.serial)}
          </span>
          ${r.isClaimed ? `
            <span class="pill bad" style="font-size:11px;font-weight:700;background:rgba(239,68,68,0.18);border:1px solid rgba(239,68,68,0.35);color:#fca5a5">
              ⚠️ මීට පෙර Claim කරන ලදී (${r.claimRecord?.date || 'Claimed'})
            </span>
          ` : r.isValid ? `
            <span class="serial-badge-valid">🟢 වලංගුයි — දින ${r.daysLeft} ඉතිරියි</span>
          ` : `
            <span class="serial-badge-expired">🔴 කල් ඉකුත් වී ඇත — දින ${Math.abs(r.daysLeft)} පෙර</span>
          `}
        </div>

        <b style="margin-top:6px;font-size:14.5px;display:block">
          ${esc(r.productName)} ${r.productNameEn ? `<small style="color:var(--muted)">(${esc(r.productNameEn)})</small>` : ''}
        </b>

        ${r.replacedBy ? `
          <div style="margin-top:4px;font-size:12px;color:#6ee7b7;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);padding:4px 8px;border-radius:6px;display:inline-flex;align-items:center;gap:6px">
            🔄 <b>මාරු කළ නව S/N:</b> <code>${esc(r.replacedBy)}</code>
          </div>
        ` : ''}

        <div class="serial-card-meta">
          <span>👤 පාරිභෝගික: <b>${esc(r.customer)}</b></span>
          ${r.vehicle ? `<span>🚗 වාහනය: <b>${esc(r.vehicle)}</b></span>` : ''}
          <span>🧾 බිල් අංකය: <b>${esc(r.saleNo)}</b></span>
          <span>📅 විකුණු දිනය: <b>${new Date(r.saleDate).toLocaleDateString('en-GB')}</b></span>
          <span>⏳ වගකීම: <b>${esc(r.expiryDate)} දක්වා (${r.warrantyMonths} මාස)</b></span>
          ${r.rack ? `<span>📍 ස්ථානය: <b>${esc(r.rack)}${r.bin ? '/' + esc(r.bin) : ''}</b></span>` : ''}
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:7px;align-items:flex-end;justify-content:center">
        ${r.isClaimed ? `
          <button class="btn btn-sm btn-muted" onclick="showClaimDetailsModal('${esc(r.serial)}')" style="font-size:12px;display:flex;align-items:center;gap:5px">
            📋 Claim විස්තර
          </button>
        ` : `
          <button class="btn btn-sm ${r.isValid ? 'btn-green' : 'btn-yellow'}" 
                  onclick="openWarrantyClaimModal('${r.saleId}','${r.productId}','${esc(r.serial)}', ${!r.isValid})" 
                  style="font-weight:700;font-size:12px;padding:6px 14px;display:flex;align-items:center;gap:5px">
            🔄 ${r.isValid ? 'Warranty Claim කරන්න' : 'කල් ඉකුත් Claim'}
          </button>
        `}
        <button class="btn btn-sm btn-primary" onclick="printWarrantyCard('${r.saleId}','${r.productId}','${esc(r.serial)}')">
          🖨️ Warranty Card
        </button>
      </div>
    </div>
  `).join('');
}

function calcExpiryDateStr(dateStr, months){
  const d = new Date(dateStr || new Date());
  d.setMonth(d.getMonth() + Number(months || 0));
  return d.toISOString().slice(0, 10);
}

/* =========================================================
   WARRANTY CLAIM MODAL & REPLACEMENT WORKFLOW
   ========================================================= */
function openWarrantyClaimModal(saleId, productId, serialNo, isExpired = false){
  const db = window.DB || {};
  const sale = (db.sales || []).find(s => s.id === saleId) || {};
  const p = (db.getProd ? db.getProd(productId) : null) || (sale.items || []).find(it => it.pid === productId) || (db.products || []).find(x => x.id === productId) || {};

  const expDateStr = (sale.warrantyExpiry && sale.warrantyExpiry[productId])
    ? sale.warrantyExpiry[productId]
    : calcExpiryDateStr(sale.date, p.warranty || 0);

  const expDate = new Date(expDateStr + 'T23:59:59');
  const now = new Date();
  const diffMs = expDate.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const isValid = daysLeft >= 0;

  openModal(
    '🔄 Warranty Claim & Replacement',
    `Serial: ${esc(serialNo)} · ${esc(p.name || 'Product')}`,
    `<div style="display:flex;flex-direction:column;gap:14px">
       
       <!-- Info summary card -->
       <div style="background:#0b1220;border:1px solid ${isValid ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'};border-radius:12px;padding:14px">
         <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:8px">
           <div>
             <span style="font-size:11px;color:var(--muted)">SERIAL NUMBER (දෝෂ සහිත ඒකකය):</span>
             <div style="font-family:'Inter',monospace;font-size:17px;font-weight:700;color:var(--primary);margin-top:2px">
               🔑 ${esc(serialNo)}
             </div>
           </div>
           <div>
             ${isValid 
               ? `<span class="pill ok" style="font-size:11px">🟢 වගකීම වලංගුයි (තව දින ${daysLeft})</span>`
               : `<span class="pill bad" style="font-size:11px">🔴 වගකීම කල් ඉකුත් වී ඇත (දින ${Math.abs(daysLeft)} පෙර)</span>`}
           </div>
         </div>

         <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(160px, 1fr));gap:8px;font-size:12px;color:var(--muted);border-top:1px solid rgba(255,255,255,0.06);padding-top:8px">
           <div>භාණ්ඩය: <b style="color:var(--txt)">${esc(p.name || 'Product')}</b></div>
           <div>පාරිභෝගික: <b style="color:var(--txt)">${esc(sale.customer || 'වෝක්-ඉන්')}</b></div>
           ${sale.vehicle ? `<div>වාහනය: <b style="color:var(--txt)">${esc(sale.vehicle)}</b></div>` : ''}
           <div>බිල්පත් අංකය: <b style="color:var(--txt)">${esc(sale.no || '—')}</b></div>
           <div>විකිණූ දිනය: <b style="color:var(--txt)">${sale.date ? new Date(sale.date).toLocaleDateString('en-GB') : '—'}</b></div>
           <div>කල් ඉකුත්වන්නේ: <b style="color:var(--txt)">${esc(expDateStr)}</b></div>
         </div>
       </div>

       <!-- Action Resolution Type Selection -->
       <div>
         <label style="font-size:12px;color:var(--muted);font-weight:600;display:block;margin-bottom:6px">Claim ක්‍රියාමාර්ගය / Resolution Type *</label>
         <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:8px">
           <label style="display:flex;align-items:center;gap:8px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.3);padding:10px 12px;border-radius:8px;cursor:pointer">
             <input type="radio" name="wcAction" value="replace" checked onchange="toggleClaimResolution('replace')" style="accent-color:#10b981">
             <div>
               <b style="font-size:12px;color:#6ee7b7;display:block">🔄 භාණ්ඩ මාරුව</b>
               <small style="color:var(--muted);font-size:10px">New Unit Replacement</small>
             </div>
           </label>
           <label style="display:flex;align-items:center;gap:8px;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.3);padding:10px 12px;border-radius:8px;cursor:pointer">
             <input type="radio" name="wcAction" value="refund" onchange="toggleClaimResolution('refund')" style="accent-color:#3b82f6">
             <div>
               <b style="font-size:12px;color:#93c5fd;display:block">↩️ මුදල් / Credit</b>
               <small style="color:var(--muted);font-size:10px">Refund / Store Credit</small>
             </div>
           </label>
           <label style="display:flex;align-items:center;gap:8px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);padding:10px 12px;border-radius:8px;cursor:pointer">
             <input type="radio" name="wcAction" value="supplier" onchange="toggleClaimResolution('supplier')" style="accent-color:#f59e0b">
             <div>
               <b style="font-size:12px;color:#fcd34d;display:block">🏢 සැපයුම්කරුට</b>
               <small style="color:var(--muted);font-size:10px">Send to Supplier</small>
             </div>
           </label>
         </div>
       </div>

       <!-- Dynamic Section: Replacement Serial Input -->
       <div id="wcReplaceSection" style="background:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.2);border-radius:8px;padding:12px">
         <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
           <label style="font-size:12px;color:#6ee7b7;font-weight:600">නව භාණ්ඩයේ Serial අංකය / Replacement Unit S/N *</label>
           <small style="color:var(--muted);font-size:11px">වත්මන් තොගය: <b>${p.qty || 0}</b></small>
         </div>
         <div style="display:flex;gap:6px">
           <input id="wcNewSerial" placeholder="උදා: AMR-2026-N0099..." style="font-family:'Inter',monospace;font-weight:700;text-transform:uppercase" oninput="this.value=this.value.toUpperCase()">
           <button type="button" class="btn btn-primary btn-sm" onclick="scanBarcodeForField('#wcNewSerial', false)" style="white-space:nowrap;display:flex;align-items:center;gap:4px">
             📷 <span>Scan</span>
           </button>
         </div>
         <small style="display:block;color:var(--muted);font-size:11px;margin-top:4px">
           නව ඒකකය පාරිභෝගිකයාට ලබා දීමෙන් පසු stock එකෙන් 1 ක් අඩු වන අතර නව Warranty Card එකක් මුද්‍රණය කළ හැක.
         </small>
       </div>

       <!-- Dynamic Section: Refund/Credit Notice -->
       <div id="wcRefundSection" style="display:none;background:rgba(59,130,246,0.05);border:1px solid rgba(59,130,246,0.2);border-radius:8px;padding:12px">
         <div style="font-size:13px;color:#93c5fd;font-weight:600">ආපසු ලබාදෙන මුදල: ${money(p.price || 0)}</div>
         <small style="color:var(--muted);font-size:11.5px;display:block;margin-top:2px">
           ආපසු භාරදීම් (Returns) පද්ධතිය හරහා පාරිභෝගිකයාගේ ගිණුමට Store Credit ලෙස හෝ මුදල් ආපසු ගෙවීමක් ලෙස සටහන් වේ.
         </small>
       </div>

       <!-- Dynamic Section: Supplier Notice -->
       <div id="wcSupplierSection" style="display:none;background:rgba(245,158,11,0.05);border:1px solid rgba(245,158,11,0.2);border-radius:8px;padding:12px">
         <div style="font-size:13px;color:#fcd34d;font-weight:600">🏢 සැපයුම්කරුට යැවීම (Company Warranty Claim)</div>
         <small style="color:var(--muted);font-size:11.5px;display:block;margin-top:2px">
           මෙම ඒකකය සමාගමට යවා අලුත්වැඩියාවෙන් හෝ නව ඒකකයක් ලැබුණු පසු පාරිභෝගිකයාට භාර දීමට සටහන් වේ.
         </small>
       </div>

       <!-- Defect / Fault Reason -->
       <div>
         <label style="font-size:12px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">දෝෂයේ ස්වභාවය / Defect Reason *</label>
         <select id="wcDefect" style="width:100%">
           <option value="බැටරිය චාර්ජ් නොවීම (Not Charging / Low Voltage)">බැටරිය චාර්ජ් නොවීම (Not Charging / Low Voltage)</option>
           <option value="සෛල කැඩීම (Dead Cell / Internal Short)">සෛල කැඩීම (Dead Cell / Internal Short)</option>
           <option value="ලීක් වීම (Acid / Oil Leakage)">ලීක් වීම (Acid / Oil Leakage)</option>
           <option value="අධිකව රත්වීම (Overheating)">අධිකව රත්වීම (Overheating)</option>
           <option value="ක්‍රියා විරහිත වීම (Component Failure)">ක්‍රියා විරහිත වීම (Component Failure)</option>
           <option value="වෙනත් දෝෂයක් (Other Defect)">වෙනත් දෝෂයක් (Other Defect)</option>
         </select>
       </div>

       <!-- Fault notes -->
       <div>
         <label style="font-size:12px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">විස්තරාත්මක සටහන / Fault Note (optional)</label>
         <textarea id="wcNote" rows="2" placeholder="උදා: සෛල 2ක් ඩෙඩ් වී ඇත. මීටර් රීඩින්ග් 10.2V..." style="width:100%"></textarea>
       </div>

     </div>`,
    `<button class="btn" onclick="closeModal()">අවලංගු</button>
     <button class="btn btn-green" onclick="confirmWarrantyClaim('${sale.id}','${p.id || productId}','${esc(serialNo)}')" style="font-weight:700;padding:9px 20px">
       ✅ Claim එක තහවුරු කරන්න
     </button>`,
    false
  );
}

function toggleClaimResolution(type){
  const repSec = document.getElementById('wcReplaceSection');
  const refSec = document.getElementById('wcRefundSection');
  const supSec = document.getElementById('wcSupplierSection');
  if(repSec) repSec.style.display = (type === 'replace') ? 'block' : 'none';
  if(refSec) refSec.style.display = (type === 'refund') ? 'block' : 'none';
  if(supSec) supSec.style.display = (type === 'supplier') ? 'block' : 'none';
}

async function confirmWarrantyClaim(saleId, productId, oldSerial){
  const db = window.DB || {};
  const s = (db.sales || []).find(x => x.id === saleId);
  if(!s){ toast('බිල්පත් වාර්තාව හමු නොවීය','err'); return; }

  const p = (db.getProd ? db.getProd(productId) : null) || (s.items || []).find(it => it.pid === productId) || (db.products || []).find(x => x.id === productId) || {};

  const action = document.querySelector('input[name="wcAction"]:checked')?.value || 'replace';
  const defect = $('#wcDefect')?.value || 'Warranty Defect';
  const note = ($('#wcNote')?.value || '').trim();
  const newSerial = ($('#wcNewSerial')?.value || '').trim().toUpperCase();

  if(action === 'replace'){
    if(!newSerial){
      toast('කරුණාකර ලබාදෙන නව භාණ්ඩයේ Serial අංකය ඇතුළත් කරන්න','err');
      return;
    }
    if(newSerial === oldSerial){
      toast('නව Serial අංකය පැරණි අංකයට වඩා වෙනස් විය යුතුය','err');
      return;
    }
  }

  // 1. Mark serial as claimed in sale
  s.claimedSerials = s.claimedSerials || [];
  if(!s.claimedSerials.includes(oldSerial)){
    s.claimedSerials.push(oldSerial);
  }

  // 2. If replacement: deduct 1 qty from stock and store replacement link
  if(action === 'replace'){
    s.replacementSerials = s.replacementSerials || {};
    s.replacementSerials[oldSerial] = newSerial;

    // Deduct stock for new unit
    const prodObj = (db.products || []).find(x => x.id === productId);
    if(prodObj){
      prodObj.qty = Math.max(0, (prodObj.qty || 0) - 1);
      if(window.FB && window.FB.fbSet){
        window.FB.fbSet(window.FB.COL.products, prodObj.id, prodObj).catch(e => console.warn(e));
      }
    }
  }

  // 3. Create record in returns collection
  if(!db.counters) db.counters = {};
  const retNo = 'CLM-' + pad(db.counters.ret = (db.counters.ret || 0) + 1);

  const claimDoc = {
    id: uid('R'),
    no: retNo,
    shopId: (typeof currentShopId === 'function' && currentShopId()) ? currentShopId() : (s.shopId || window.state?.user?.shopId || 'SHOP-001'),
    invoice: s.no,
    saleId: s.id,
    customerId: s.customerId || null,
    customer: s.customer || 'වෝක්-ඉන්',
    date: today(),
    createdAt: new Date().toISOString(),
    type: action === 'replace' ? 'warranty_replacement' : (action === 'refund' ? 'warranty_refund' : 'supplier_claim'),
    reason: `[Warranty Claim] ${defect}`,
    notes: note,
    serial: oldSerial,
    oldSerial: oldSerial,
    newSerial: (action === 'replace') ? newSerial : null,
    items: [{
      pid: productId,
      name: p.name || 'Warranty Item',
      qty: 1,
      price: p.price || 0,
      serial: oldSerial
    }],
    amount: (action === 'refund') ? (p.price || 0) : 0,
    status: (action === 'replace') ? 'approved' : ((state.user?.role !== 'cashier') ? 'approved' : 'pending'),
    requestedBy: state.user ? state.user.name : 'කැෂියර්',
    requestedById: state.user ? state.user.id : null,
    approvedBy: (action === 'replace' || state.user?.role !== 'cashier') ? (state.user?.name || 'Admin') : null,
    approvedAt: (action === 'replace' || state.user?.role !== 'cashier') ? new Date().toISOString() : null
  };

  if(!db.returns) db.returns = [];
  db.returns.push(claimDoc);

  // Sync to Firestore & Local DB
  if(window.FB && window.FB.fbSet){
    await window.FB.fbSet(window.FB.COL.sales, s.id, s).catch(e => console.warn(e));
    await (window.shopAdd ? window.shopAdd(window.FB.COL.returns, claimDoc) : window.FB.fbAdd(window.FB.COL.returns, claimDoc)).catch(e => console.warn(e));
  }
  if(typeof saveDB === 'function') saveDB(true);

  closeModal();
  toast('✅ Warranty Claim සාර්ථකව සටහන් විය!', 'ok');
  renderSerialList();

  // If replacement was chosen, offer to print new Warranty Card!
  if(action === 'replace'){
    setTimeout(() => {
      printWarrantyCard(s.id, productId, newSerial);
    }, 450);
  }
}

function showClaimDetailsModal(serialNo){
  const db = window.DB || {};
  const claim = (db.returns || []).find(r => 
    r.serial === serialNo || 
    (r.items && r.items.some(it => it.serial === serialNo || (it.serials && it.serials.includes(serialNo))))
  );

  if(!claim){
    toast('Claim විස්තර හමු නොවීය','warn');
    return;
  }

  openModal(
    '📋 Warranty Claim විස්තර',
    `S/N: ${esc(serialNo)} · ${esc(claim.no || '')}`,
    `<div style="display:flex;flex-direction:column;gap:12px">
       <div style="background:#0b1220;border:1px solid rgba(239,68,68,0.25);border-radius:10px;padding:14px">
         <div style="display:flex;justify-content:space-between;margin-bottom:8px">
           <b style="color:var(--primary);font-size:14px">${esc(claim.no || 'Claim Record')}</b>
           <span class="pill ok" style="font-size:11px">${esc(claim.status || 'Processed')}</span>
         </div>
         <div class="srow"><span>Claim දිනය:</span><b>${esc(claim.date)}</b></div>
         <div class="srow"><span>මුල් බිල්පත:</span><b>${esc(claim.invoice || '—')}</b></div>
         <div class="srow"><span>පාරිභෝගික:</span><b>${esc(claim.customer || '—')}</b></div>
         <div class="srow"><span>පැරණි S/N:</span><b style="color:#f87171">${esc(claim.oldSerial || serialNo)}</b></div>
         ${claim.newSerial ? `<div class="srow"><span>මාරු කළ නව S/N:</span><b style="color:#34d399">${esc(claim.newSerial)}</b></div>` : ''}
         <div class="srow"><span>වර්ගය:</span><b>${claim.type === 'warranty_replacement' ? '🔄 භාණ්ඩ මාරුව (Replacement)' : (claim.type === 'warranty_refund' ? '↩️ මුදල් ආපසු (Refund)' : '🏢 සමාගමට යැවීම')}</b></div>
         <div class="srow"><span>හේතුව:</span><b style="color:#fcd34d">${esc(claim.reason || '—')}</b></div>
         ${claim.notes ? `<div class="srow"><span>සටහන්:</span><span>${esc(claim.notes)}</span></div>` : ''}
         <div class="srow"><span>වාර්තා කළේ:</span><span>${esc(claim.requestedBy || '—')}</span></div>
       </div>
     </div>`,
    `<button class="btn btn-primary" onclick="closeModal()">හරි (Close)</button>`
  );
}

/* =========================================================
   WARRANTY CERTIFICATE CARD PRINT
   ========================================================= */
function printWarrantyCard(saleId, productId, serialNo){
  const db = window.DB || {};
  const sale = (db.sales || []).find(s => s.id === saleId) || {};
  const p = (db.getProd ? db.getProd(productId) : null) || (sale.items || []).find(it => it.pid === productId) || (db.products || []).find(x => x.id === productId) || {};
  const shop = db.shop || { name: 'Auto Parts Lanka', addr: 'No. 25, Main Street, Colombo 11', phone: '011-234 5678' };

  const expDateStr = (sale.warrantyExpiry && sale.warrantyExpiry[productId])
    ? sale.warrantyExpiry[productId]
    : calcExpiryDateStr(sale.date, p.warranty || 0);

  const expDate = new Date(expDateStr + 'T23:59:59');
  const now = new Date();
  const diffMs = expDate.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const isValid = daysLeft >= 0;

  const cardHtml = `
  <div id="printArea">
    <div class="warranty-card">
      <div class="warranty-card-h">
        <h2>🛡️ ${esc(shop.name)}</h2>
        <p>${esc(shop.addr)} · ☎ ${esc(shop.phone)}</p>
        <div style="font-size:13px;font-weight:700;margin-top:8px;text-transform:uppercase;letter-spacing:1px;color:#000">
          වාහන අමතර කොටස් වගකීම් සහතිකය<br>
          <span style="font-size:11px;font-weight:600;color:#555">WARRANTY CERTIFICATE CARD</span>
        </div>
      </div>

      <div class="warranty-card-body">
        <table>
          <tr>
            <td>Serial Number (S/N):</td>
            <td><b style="font-size:14px;font-family:monospace;color:#000">${esc(serialNo)}</b></td>
          </tr>
          <tr>
            <td>භාණ්ඩය / Product:</td>
            <td><b>${esc(p.name || '')}</b><br><small style="color:#555">${esc(p.nameEn || '')}</small></td>
          </tr>
          ${p.oemNo ? `
          <tr>
            <td>OEM අංකය:</td>
            <td style="font-family:monospace">${esc(p.oemNo)}</td>
          </tr>` : ''}
          <tr>
            <td>පාරිභෝගිකයා / Customer:</td>
            <td><b>${esc(sale.customer || 'වෝක්-ඉන්')}</b></td>
          </tr>
          ${sale.vehicle ? `
          <tr>
            <td>වාහන අංකය / Vehicle:</td>
            <td><b>${esc(sale.vehicle)}</b></td>
          </tr>` : ''}
          <tr>
            <td>බිල් අංකය / Invoice:</td>
            <td><b>${esc(sale.no || '—')}</b></td>
          </tr>
          <tr>
            <td>මිලදී ගත් දිනය / Date:</td>
            <td>${sale.date ? new Date(sale.date).toLocaleDateString('en-GB') : today()}</td>
          </tr>
          <tr>
            <td>වගකීම් කාලය / Period:</td>
            <td><b>${p.warranty || 0} මාස (Months)</b></td>
          </tr>
          <tr>
            <td>කල් ඉකුත්වන දිනය / Expiry:</td>
            <td><b style="font-size:13px;color:#000">${esc(expDateStr)}</b></td>
          </tr>
          <tr>
            <td>වත්මන් තත්ත්වය / Status:</td>
            <td>${isValid ? '<b style="color:#047857">🟢 වලංගුයි (Active Warranty)</b>' : '<b style="color:#b91c1c">🔴 කල් ඉකුත් වී ඇත (Expired)</b>'}</td>
          </tr>
        </table>
      </div>

      <div class="warranty-card-footer">
        <p><b>වගකීම් කොන්දේසි:</b> වගකීම් හිමිකම් පෑමේදී මෙම සහතිකය සහ මුල් බිල්පත ඉදිරිපත් කළ යුතුය. අනතුරු, වැරදි භාවිතය හෝ අනවසර අලුත්වැඩියාවන් සඳහා වගකීම අදාළ නොවේ.</p>
        <div style="display:flex;justify-content:space-between;margin-top:24px;padding:0 12px">
          <div style="border-top:1px dashed #444;width:120px;text-align:center;padding-top:4px">අලෙවිකරු අත්සන</div>
          <div style="border-top:1px dashed #444;width:120px;text-align:center;padding-top:4px">පාරිභෝගික අත්සන</div>
        </div>
      </div>
    </div>
  </div>`;

  openModal('🛡️ වගකීම් කාඩ්පත මුද්‍රණය', 'Warranty Certificate · ' + serialNo, cardHtml,
    `<button class="btn" onclick="closeModal()">වසන්න</button>
     <button class="btn btn-primary" onclick="window.print()">🖨️ මුද්‍රණය කරන්න (Print)</button>`);
}

window.pgSerialSearch = pgSerialSearch;
window.renderSerialList = renderSerialList;
window.printWarrantyCard = printWarrantyCard;
window.calcExpiryDateStr = calcExpiryDateStr;
window.scanSerialForSearch = scanSerialForSearch;
window.openWarrantyClaimModal = openWarrantyClaimModal;
window.toggleClaimResolution = toggleClaimResolution;
window.confirmWarrantyClaim = confirmWarrantyClaim;
window.showClaimDetailsModal = showClaimDetailsModal;
