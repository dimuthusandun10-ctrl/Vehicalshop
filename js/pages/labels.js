/* =========================================================
   js/pages/labels.js - Barcode Label Printing
   Phase 6: Hardware Integration (Thermal Label Printing)
   ========================================================= */

function pgLabels(){
  const db = window.DB || {};
  const products = db.products || [];
  const search = (window._labelSearch || '').trim().toLowerCase();

  const filtered = products.filter(p => {
    if(!search) return true;
    return (
      (p.name && p.name.toLowerCase().includes(search)) ||
      (p.nameEn && p.nameEn.toLowerCase().includes(search)) ||
      (p.code && p.code.toLowerCase().includes(search)) ||
      (p.oemNo && p.oemNo.toLowerCase().includes(search)) ||
      (p.barcode && p.barcode.toLowerCase().includes(search))
    );
  });

  return `
  <div class="labels-page" style="padding:16px;max-width:1100px;margin:0 auto">
    <div class="card">
      <div class="card-h" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div>
          <h3 style="margin:0;font-size:18px">🏷️ Barcode ලේබල් මුද්‍රණය · Barcode Label Printing</h3>
          <small style="color:var(--muted)">GRN තොග හෝ සාප්පු භාණ්ඩ සඳහා Barcode Stickers මුද්‍රණය කරන්න (${products.length} භාණ්ඩ)</small>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-sm" onclick="go('inventory')">📦 Inventory</button>
          <button class="btn btn-primary btn-sm" onclick="go('grn')">📥 GRN වෙත</button>
        </div>
      </div>

      <!-- Settings & Filter Controls -->
      <div class="card" style="margin-top:14px;background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:16px">
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:14px;align-items:end">
          <div>
            <label style="font-size:12px;color:var(--muted);font-weight:600">ලේබල් ප්‍රමාණය / Label Size</label>
            <select id="labelSize" style="margin-top:4px">
              <option value="40x30">40mm × 30mm (Compact Sticker)</option>
              <option value="50x30" selected>50mm × 30mm (Standard)</option>
              <option value="58x40">58mm × 40mm (Large / Pos)</option>
            </select>
          </div>

          <div>
            <label style="font-size:12px;color:var(--muted);font-weight:600">පෙරනිමි පිටපත් ගණන / Default Copies</label>
            <input type="number" id="labelCopies" value="1" min="1" max="100" style="margin-top:4px" onchange="applyGlobalCopies(this.value)">
          </div>

          <div style="display:flex;flex-direction:column;gap:6px">
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
              <input type="checkbox" id="showPrice" checked style="width:16px;height:16px">
              <span>මිල පෙන්වන්න (Show Price)</span>
            </label>
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
              <input type="checkbox" id="showShop" checked style="width:16px;height:16px">
              <span>සාප්පුවේ නම පෙන්වන්න (Show Shop)</span>
            </label>
          </div>

          <div>
            <label style="font-size:12px;color:var(--muted);font-weight:600">භාණ්ඩ සෙවීම / Search Product</label>
            <input type="search" placeholder="කේතය හෝ නම සොයන්න..." value="${esc(window._labelSearch || '')}"
                   oninput="window._labelSearch = this.value; render();" style="margin-top:4px">
          </div>
        </div>

        <div class="labels-action-grid">
          <button class="btn btn-sm" onclick="toggleAllLabels(true)" style="width:100%;justify-content:center;padding:8px 4px;font-size:12px">
            ✅ සියල්ල තෝරන්න
          </button>
          <button class="btn btn-sm" onclick="toggleAllLabels(false)" style="width:100%;justify-content:center;padding:8px 4px;font-size:12px">
            ❌ ඉවත් කරන්න
          </button>
          <button class="btn btn-sm" onclick="previewLabels()" style="width:100%;justify-content:center;padding:8px 4px;font-size:12px">
            👁️ පෙරදසුන
          </button>
          <button class="btn btn-primary btn-sm" onclick="printLabels()" style="width:100%;justify-content:center;padding:8px 4px;font-size:12px;font-weight:700">
            🖨️ ලේබල් මුද්‍රණය
          </button>
        </div>
      </div>

      <!-- Products Grid / Selection List -->
      <div style="margin-top:16px">
        <h4 style="font-size:14px;margin-bottom:10px;color:var(--txt)">ලේබල් මුද්‍රණය කිරීමට භාණ්ඩ තෝරන්න:</h4>
        <div style="max-height:480px;overflow-y:auto;border:1px solid var(--line);border-radius:10px;background:var(--panel)">
          <table class="tbl no-card label-table" style="width:100%;border-collapse:collapse;font-size:12.5px">
            <thead>
              <tr style="background:var(--panel2);position:sticky;top:0;z-index:2">
                <th style="width:40px;text-align:center"><input type="checkbox" id="thSelectAll" onchange="toggleAllLabels(this.checked)"></th>
                <th style="width:110px">කේතය (Code)</th>
                <th>භාණ්ඩයේ නම (Product Name)</th>
                <th style="width:110px" class="desktop-cell">OEM අංකය</th>
                <th style="width:100px;text-align:right">මිල (Rs.)</th>
                <th style="width:75px;text-align:center">තොග</th>
                <th style="width:95px;text-align:center">පිටපත් (Qty)</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length ? filtered.map(p => `
                <tr class="label-row" style="border-bottom:1px solid var(--line)" onclick="if(!event.target.closest('input,button,select,a')){ const cb = this.querySelector('.label-cb'); if(cb){ cb.checked = !cb.checked; cb.dispatchEvent(new Event('change')); } }">
                  <td class="cell-cb" style="text-align:center">
                    <input type="checkbox" class="label-cb" data-pid="${esc(p.id)}" onchange="updateSelectedCount(); this.closest('.label-row')?.classList.toggle('selected', this.checked)">
                  </td>
                  <td class="cell-code">
                    <span class="lbl-code-tag"><b>${esc(p.code || 'N/A')}</b></span>
                    ${p.oemNo ? `<span class="lbl-oem-tag">OEM: ${esc(p.oemNo)}</span>` : ''}
                  </td>
                  <td class="cell-name">
                    <div class="lbl-name-main">${esc(p.name)}</div>
                    ${p.nameEn ? `<small class="lbl-name-en" style="color:var(--muted)">${esc(p.nameEn)}</small>` : ''}
                  </td>
                  <td class="cell-oem desktop-cell">${esc(p.oemNo || '-')}</td>
                  <td class="cell-price" style="text-align:right"><b class="lbl-price-val">Rs. ${Number(p.price || 0).toFixed(2)}</b></td>
                  <td class="cell-stock" style="text-align:center"><span class="pill ${p.qty > 0 ? 'ok' : 'bad'}">${p.qty}</span></td>
                  <td class="cell-qty" style="text-align:center">
                    <input type="number" class="lip-qty" data-pid="${esc(p.id)}" value="1" min="1" max="99"
                           style="width:55px;padding:3px 6px;text-align:center;border-radius:6px">
                  </td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="7" style="text-align:center;padding:24px;color:var(--muted)">
                    භාණ්ඩ හමු නොවීය (No products found)
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>

      <div class="labels-bottom-bar">
        <span id="lblSelectedCount" style="font-size:13.5px;color:var(--txt);font-weight:700">තෝරාගත් භාණ්ඩ: 0</span>
        <div class="bottom-btns" style="display:flex;gap:8px">
          <button class="btn" onclick="previewLabels()" style="flex:1;justify-content:center;padding:10px 8px;font-size:13px">👁️ පෙරදසුන</button>
          <button class="btn btn-primary" onclick="printLabels()" style="flex:1;justify-content:center;padding:10px 8px;font-size:13px;font-weight:700">🖨️ ලේබල් මුද්‍රණය</button>
        </div>
      </div>
    </div>
  </div>
  `;
}

function updateSelectedCount(){
  const checked = document.querySelectorAll('.label-cb:checked');
  const countEl = document.getElementById('lblSelectedCount');
  if(countEl){
    countEl.textContent = `තෝරාගත් භාණ්ඩ: ${checked.length}`;
  }
}

function toggleAllLabels(select){
  document.querySelectorAll('.label-cb').forEach(cb => {
    cb.checked = Boolean(select);
    cb.closest('.label-row')?.classList.toggle('selected', Boolean(select));
  });
  const th = document.getElementById('thSelectAll');
  if(th) th.checked = Boolean(select);
  updateSelectedCount();
}

function applyGlobalCopies(val){
  const num = Math.max(1, parseInt(val, 10) || 1);
  document.querySelectorAll('.lip-qty').forEach(inp => {
    inp.value = num;
  });
}

function getSelectedLabelItems(){
  const db = window.DB || {};
  const selected = [];

  document.querySelectorAll('.label-cb:checked').forEach(cb => {
    const pid = cb.getAttribute('data-pid');
    const qtyInp = document.querySelector(`.lip-qty[data-pid="${pid}"]`);
    const qty = parseInt(qtyInp?.value, 10) || 1;
    const prod = (db.products || []).find(x => x.id === pid);

    if(prod){
      for(let i = 0; i < qty; i++){
        selected.push(prod);
      }
    }
  });

  return selected;
}

function printLabels(){
  const selected = getSelectedLabelItems();
  if(!selected.length){
    if(typeof toast === 'function') toast('කරුණාකර මුද්‍රණය සඳහා අවම වශයෙන් එක් භාණ්ඩයක් තෝරන්න', 'warn');
    return;
  }

  const db = window.DB || {};
  const shop = db.shop || { name: 'Auto Parts Lanka' };
  const showPrice = document.getElementById('showPrice') ? document.getElementById('showPrice').checked : true;
  const showShop = document.getElementById('showShop') ? document.getElementById('showShop').checked : true;
  const size = (document.getElementById('labelSize') ? document.getElementById('labelSize').value : '50x30');
  const [widthMm, heightMm] = size.split('x');

  const labelHtml = selected.map(p => {
    const code = p.code || p.oemNo || p.barcode || '000000';
    return `
      <div class="label-item-box" style="width:${widthMm}mm;height:${heightMm}mm;">
        ${showShop ? `<div class="lp-shop">${esc(shop.name || '')}</div>` : ''}
        <div class="lp-name">${esc(p.nameEn || p.name)}</div>
        <svg class="lp-barcode" data-code="${esc(code)}"></svg>
        <div class="lp-code">${esc(code)}</div>
        ${showPrice ? `<div class="lp-price">Rs. ${Number(p.price || 0).toFixed(2)}</div>` : ''}
      </div>
    `;
  }).join('');

  const printWin = window.open('', '_blank');
  if(!printWin){
    if(typeof toast === 'function') toast('❌ Popup window එක Browser එකෙන් block විය. කරුණාකර Popups allow කරන්න.', 'err');
    return;
  }

  printWin.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Print Barcode Labels</title>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
  <style>
    @page { margin: 0; size: auto; }
    body {
      margin: 0;
      padding: 4mm;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #fff;
      display: flex;
      flex-wrap: wrap;
      gap: 2mm;
    }
    .label-item-box {
      box-sizing: border-box;
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border: 1px dashed #cbd5e1;
      padding: 1.5mm;
      page-break-inside: avoid;
      overflow: hidden;
      background: #fff;
      text-align: center;
    }
    .lp-shop {
      font-size: 8px;
      font-weight: 700;
      color: #334155;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }
    .lp-name {
      font-size: 9.5px;
      font-weight: 700;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
      margin: 0.5mm 0;
    }
    .lp-barcode {
      display: block;
      width: 88% !important;
      max-width: 88% !important;
      height: 12mm !important;
      margin: 1mm auto !important;
    }
    .lp-code {
      font-size: 8.5px;
      font-family: monospace;
      font-weight: 600;
      color: #1e293b;
      margin-top: 0.5mm;
    }
    .lp-price {
      font-size: 11px;
      font-weight: 800;
      color: #000;
      margin-top: 0.5mm;
    }
    @media print {
      body { padding: 0; }
      .label-item-box { border: none; }
    }
  </style>
</head>
<body>
  ${labelHtml}
  <script>
    window.onload = function(){
      document.querySelectorAll('.lp-barcode').forEach(svg => {
        try {
          const code = svg.getAttribute('data-code');
          JsBarcode(svg, code, {
            format: 'CODE128',
            width: 1.4,
            height: 40,
            displayValue: false,
            margin: 0
          });
          const w = svg.getAttribute('width');
          const h = svg.getAttribute('height');
          if(w && h){
            svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
            svg.removeAttribute('width');
            svg.removeAttribute('height');
          }
          svg.style.width = '88%';
          svg.style.maxWidth = '88%';
        } catch(e){
          console.warn('Barcode render error:', e);
        }
      });
      setTimeout(() => {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>`);
  printWin.document.close();
}

function previewLabels(){
  const selected = getSelectedLabelItems();
  if(!selected.length){
    if(typeof toast === 'function') toast('කරුණාකර පෙරදසුන සඳහා අවම වශයෙන් එක් භාණ්ඩයක් තෝරන්න', 'warn');
    return;
  }

  const sample = selected.slice(0, 6);
  const db = window.DB || {};
  const shop = db.shop || { name: 'Auto Parts Lanka' };
  const showPrice = document.getElementById('showPrice') ? document.getElementById('showPrice').checked : true;
  const showShop = document.getElementById('showShop') ? document.getElementById('showShop').checked : true;
  const size = (document.getElementById('labelSize') ? document.getElementById('labelSize').value : '50x30');
  const [widthMm, heightMm] = size.split('x').map(s => parseInt(s, 10) || 30);
  const cardWidth = 220; // px
  const cardHeight = Math.max(125, Math.round((heightMm / widthMm) * cardWidth));

  const previewHtml = `
    <div style="padding:10px">
      <div style="font-size:12px;color:var(--muted);margin-bottom:12px">
        මුළු ලේබල් ගණන: <b>${selected.length}</b> (පෙරදසුන සඳහා මුල් 6 පෙන්වයි · ප්‍රමාණය: ${size}mm)
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:14px;justify-content:center;max-height:380px;overflow-y:auto;padding:16px;background:#141f33;border-radius:10px">
        ${sample.map(p => {
          const code = p.code || p.oemNo || p.barcode || '000000';
          return `
            <div style="box-sizing:border-box;width:${cardWidth}px;min-height:${cardHeight}px;background:#fff;color:#000;border-radius:8px;padding:8px 12px;text-align:center;box-shadow:0 4px 14px rgba(0,0,0,0.4);display:flex;flex-direction:column;justify-content:space-between;align-items:center;overflow:hidden">
              <div style="width:100%;overflow:hidden">
                ${showShop ? `<div style="font-size:8.5px;color:#475569;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(shop.name)}</div>` : ''}
                <div style="font-size:11px;font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:2px 0">${esc(p.nameEn || p.name)}</div>
              </div>
              <div style="width:100%;display:flex;justify-content:center;align-items:center;margin:3px 0;overflow:hidden">
                <svg class="preview-barcode-svg" data-code="${esc(code)}" style="display:block;max-width:88%;height:32px"></svg>
              </div>
              <div style="width:100%;overflow:hidden">
                <div style="font-size:9.5px;font-family:monospace;font-weight:700;color:#1e293b;letter-spacing:0.5px">${esc(code)}</div>
                ${showPrice ? `<div style="font-size:12px;font-weight:800;color:#000;margin-top:2px">Rs. ${Number(p.price || 0).toFixed(2)}</div>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  if(typeof openModal === 'function'){
    openModal(
      '🏷️ Barcode ලේබල් පෙරදසුන (Preview)',
      'Label Preview',
      previewHtml,
      `<button class="btn" onclick="closeModal()">වසන්න (Close)</button>
       <button class="btn btn-primary" onclick="closeModal(); printLabels()">🖨️ මුද්‍රණය කරන්න (Print Now)</button>`
    );

    // Render barcodes in preview with responsive SVG scaling
    setTimeout(() => {
      if(window.JsBarcode){
        document.querySelectorAll('.preview-barcode-svg').forEach(svg => {
          try {
            const code = svg.getAttribute('data-code');
            JsBarcode(svg, code, {
              format: 'CODE128',
              displayValue: false,
              margin: 0,
              height: 40
            });
            const w = svg.getAttribute('width');
            const h = svg.getAttribute('height');
            if(w && h){
              svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
              svg.removeAttribute('width');
              svg.removeAttribute('height');
            }
            svg.style.width = '88%';
            svg.style.maxWidth = '88%';
            svg.style.height = '34px';
          } catch(err){
            console.warn('Preview barcode render error:', err);
          }
        });
      }
    }, 80);
  }
}

window.pgLabels = pgLabels;
window.printLabels = printLabels;
window.previewLabels = previewLabels;
window.updateSelectedCount = updateSelectedCount;
window.toggleAllLabels = toggleAllLabels;
window.applyGlobalCopies = applyGlobalCopies;
