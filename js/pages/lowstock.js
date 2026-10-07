/* =========================================================
   js/pages/lowstock.js - Low Stock & Reorder Alerts View
   ========================================================= */

function pgLowStock(){
  const low = DB.products.filter(p=>p.qty<=p.reorder).sort((a,b)=>(a.qty-a.reorder)-(b.qty-b.reorder));
  const out = low.filter(p=>p.qty===0);
  return `
  <div class="stats">
    <div class="stat"><div class="ic" style="background:rgba(239,68,68,.15);color:#fca5a5">🚫</div>
      <div><b>${out.length}</b><span>තොග අවසන් / Out of Stock</span></div></div>
    <div class="stat"><div class="ic" style="background:rgba(245,158,11,.15);color:#fcd34d">⚠️</div>
      <div><b>${low.length}</b><span>අඩු තොග / Low Stock</span></div></div>
  </div>
  <div class="card">
    <div class="card-h"><h3>⚠️ අඩු තොග භාණ්ඩ<small>Reorder List</small></h3>
      ${state.user.role!=='cashier'?`<button class="btn btn-primary btn-sm" onclick="go('grn')">📥 GRN එකක් සාදන්න</button>`:''}</div>
    <div class="tbl-wrap">
    <table><thead><tr><th>කේතය</th><th>භාණ්ඩය</th><th>වාහනය</th><th style="text-align:center">තොග</th>
      <th style="text-align:center">අවම</th><th style="text-align:center">අවශ්‍ය ප්‍රමාණය</th><th></th></tr></thead><tbody>
    ${low.map(p=>`<tr>
      <td style="font-family:'Inter',monospace;font-size:12px">${p.code}</td>
      <td><b>${esc(p.name)}</b><br><small style="color:var(--muted)">${esc(p.nameEn)}</small></td>
      <td><small>${esc(p.brand)} ${esc(p.model)}</small></td>
      <td style="text-align:center"><span class="pill ${p.qty===0?'bad':'warn'}">${p.qty}</span></td>
      <td style="text-align:center">${p.reorder}</td>
      <td style="text-align:center"><b style="color:var(--primary)">${Math.max(p.reorder*2-p.qty,1)} ${p.unit}</b></td>
      <td>${state.user.role!=='cashier'?`<button class="btn btn-sm btn-blue" onclick="editProduct('${p.id}')">✏️</button>`:''}</td>
    </tr>`).join('') || '<tr><td colspan="7" class="empty">✅ අඩු තොග භාණ්ඩ නැත</td></tr>'}
    </tbody></table></div>
  </div>`;
}

window.pgLowStock = pgLowStock;
