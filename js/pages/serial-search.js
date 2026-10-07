/* =========================================================
   js/pages/serial-search.js - Warranty & Serial Number Tracking
   ========================================================= */

window._serialQuery = window._serialQuery || '';

function pgSerialSearch(){
  const db = window.DB || {};
  const q = (window._serialQuery || '').trim().toUpperCase();

  // Find all serialized records across all sales
  const records = [];
  (db.sales || []).forEach(s => {
    if(!s.itemSerials) return;
    Object.entries(s.itemSerials).forEach(([pid, serials]) => {
      const p = (db.getProd ? db.getProd(pid) : null) || (s.items || []).find(it => it.pid === pid) || {};
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
            isValid
          });
        }
      });
    });
  });

  return `
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
      <button class="btn btn-primary" onclick="window._serialQuery=$('#serialSearchInp')?.value||'';render()">
        🔍 සොයන්න
      </button>
      ${window._serialQuery ? `<button class="btn" onclick="window._serialQuery='';render()">✕ Clear</button>` : ''}
    </div>
  </div>

  <div id="serialResultsContainer">
    ${renderSerialResultsHtml(records, q)}
  </div>`;
}

function renderSerialList(){
  const q = ($('#serialSearchInp')?.value || '').trim().toUpperCase();
  window._serialQuery = q;
  const db = window.DB || {};
  const records = [];
  (db.sales || []).forEach(s => {
    if(!s.itemSerials) return;
    Object.entries(s.itemSerials).forEach(([pid, serials]) => {
      const p = (db.getProd ? db.getProd(pid) : null) || (s.items || []).find(it => it.pid === pid) || {};
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
            isValid
          });
        }
      });
    });
  });

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
    <div class="serial-card">
      <div class="serial-card-left">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span style="font-family:'Inter',monospace;font-size:16px;font-weight:700;color:var(--primary)">
            🔑 ${esc(r.serial)}
          </span>
          ${r.isValid ? `
            <span class="serial-badge-valid">🟢 වලංගුයි — දින ${r.daysLeft} ඉතිරියි</span>
          ` : `
            <span class="serial-badge-expired">🔴 කල් ඉකුත් වී ඇත — දින ${Math.abs(r.daysLeft)} පෙර</span>
          `}
        </div>
        <b style="margin-top:6px;font-size:14.5px">
          ${esc(r.productName)} ${r.productNameEn ? `<small style="color:var(--muted)">(${esc(r.productNameEn)})</small>` : ''}
        </b>
        <div class="serial-card-meta">
          <span>👤 පාරිභෝගික: <b>${esc(r.customer)}</b></span>
          ${r.vehicle ? `<span>🚗 වාහනය: <b>${esc(r.vehicle)}</b></span>` : ''}
          <span>🧾 බිල් අංකය: <b>${esc(r.saleNo)}</b></span>
          <span>📅 විකුණු දිනය: <b>${new Date(r.saleDate).toLocaleDateString('en-GB')}</b></span>
          <span>⏳ වගකීම: <b>${esc(r.expiryDate)} දක්වා (${r.warrantyMonths} මාස)</b></span>
          ${r.rack ? `<span>📍 ස්ථානය: <b>${esc(r.rack)}${r.bin ? '/' + esc(r.bin) : ''}</b></span>` : ''}
        </div>
      </div>
      <div>
        <button class="btn btn-sm btn-primary" onclick="printWarrantyCard('${r.saleId}','${r.productId}','${esc(r.serial)}')">
          🖨️ Print Warranty Card
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

function printWarrantyCard(saleId, productId, serialNo){
  const db = window.DB || {};
  const sale = (db.sales || []).find(s => s.id === saleId) || {};
  const p = (db.getProd ? db.getProd(productId) : null) || (sale.items || []).find(it => it.pid === productId) || {};
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
