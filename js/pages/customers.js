/* =========================================================
   js/pages/customers.js - Customer Management & Credit Balances
   ========================================================= */

function pgCustomers(){
  const db = window.DB || {};
  const customers = db.customers || [];

  return `
  <div class="card">
    <div class="card-h">
      <h3>👥 පාරිභෝගික ලේඛනය<small>Customers — ${customers.length} registered</small></h3>
      ${canEditCustomers() ? `
        <button class="btn btn-primary btn-sm" onclick="editCustomer()">+ නව පාරිභෝගිකයා</button>
      ` : ''}
    </div>
    <div class="tbl-wrap">
    <table><thead><tr>
      <th>නම</th>
      <th>දුරකථනය</th>
      <th>වාහනය</th>
      <th style="text-align:right">මුළු මිලදී ගැනීම්</th>
      <th style="text-align:right">ණය ශේෂය (Owed)</th>
      <th style="text-align:right">ණය සීමාව (Limit)</th>
      <th style="text-align:center">ලකුණු</th>
      <th style="text-align:center">ක්‍රියා</th>
    </tr></thead><tbody>
    ${customers.map(c => {
      /* ⭐ Match by customer ID */
      const custSales = (db.sales || []).filter(s =>
        s.customerId === c.id || (!s.customerId && s.customer === c.name)
      );
      const spent = custSales.reduce((a,s) => a + (s.total || 0), 0);
      const creditSales = custSales.filter(s => s.method === 'credit').reduce((a,s) => a + (s.total || 0), 0);
      const paid = (db.payments || []).filter(p => p.customerId === c.id).reduce((a,p) => a + (p.amount || 0), 0);
      const balance = Math.max(0, creditSales - paid);
      const limit = Number(c.creditLimit || 30000);

      return `<tr>
        <td><b>${esc(c.name)}</b></td>
        <td>${esc(c.phone || '—')}</td>
        <td><span class="pill info">${esc(c.vehicle || '—')}</span></td>
        <td style="text-align:right;font-weight:700">${money(spent)}</td>
        <td style="text-align:right">
          ${balance > 0
            ? `<b style="color:var(--red);font-size:13px">${money(balance)}</b>`
            : `<span style="color:var(--green)">රු. 0.00</span>`}
        </td>
        <td style="text-align:right;color:var(--muted)">${money(limit)}</td>
        <td style="text-align:center">⭐ ${c.points || 0}</td>
        <td style="text-align:center;white-space:nowrap">
          ${balance > 0 && (typeof hasPermission === 'function' ? hasPermission('credit') : true)
            ? `<button class="btn btn-sm btn-green" onclick="openCreditPayment('${c.id}')" title="ණය පියවීම / Settle Credit">💵 ණය ගෙවන්න</button>`
            : ''}
          ${canEditCustomers() ? `
            <button class="btn btn-sm" onclick="editCustomer('${c.id}')" title="සංස්කරණය කරන්න">✏️</button>
          ` : `
            <button class="btn btn-sm" onclick="viewCustomer('${c.id}')" title="බලන්න">👁️</button>
          `}
          ${canDeleteCustomers() ? `
            <button class="btn btn-sm btn-red" onclick="delCustomer('${c.id}')" title="මකන්න">🗑️</button>
          ` : ''}
          ${!canEditCustomers() ? '<span style="color:var(--muted);font-size:11px;margin-left:4px">view only</span>' : ''}
        </td></tr>`;
    }).join('') || '<tr><td colspan="8" class="empty">පාරිභෝගිකයන් නැත</td></tr>'}
    </tbody></table></div>
  </div>`;
}

function viewCustomer(id){
  const db = window.DB || {};
  const c = (db.customers || []).find(x => x.id === id);
  if(!c) return;

  const sales = (db.sales || []).filter(s => s.customerId === id || (!s.customerId && s.customer === c.name));
  const spent = sales.reduce((a,s) => a + (s.total || 0), 0);
  const paid = (db.payments || []).filter(p => p.customerId === id).reduce((a,p) => a + (p.amount || 0), 0);
  const creditSales = sales.filter(s => s.method === 'credit').reduce((a,s) => a + (s.total || 0), 0);
  const balance = Math.max(0, creditSales - paid);

  openModal(
    '👤 පාරිභෝගික තොරතුරු',
    'Customer Details — ' + c.name,
  `<div class="customer-detail-body">
     <div class="pd-section">
       <div class="pd-row">
         <span class="pd-row-label">👤 නම</span>
         <span class="pd-row-value">${esc(c.name)}</span>
       </div>
       <div class="pd-row">
         <span class="pd-row-label">📞 දුරකථනය</span>
         <span class="pd-row-value">${esc(c.phone || '—')}</span>
       </div>
       <div class="pd-row">
         <span class="pd-row-label">🚗 වාහනය</span>
         <span class="pd-row-value">${esc(c.vehicle || '—')}</span>
       </div>
     </div>
     
     <div class="pd-section" style="border-top:1px solid var(--line);padding-top:12px">
       <div class="pd-row">
         <span class="pd-row-label">⭐ ලකුණු</span>
         <span class="pd-row-value">${c.points || 0}</span>
       </div>
       <div class="pd-row">
         <span class="pd-row-label">💰 මුළු මිලදී ගැනීම්</span>
         <span class="pd-row-value">${money(spent)}</span>
       </div>
       <div class="pd-row">
         <span class="pd-row-label">🧾 බිල්පත් ගණන</span>
         <span class="pd-row-value">${sales.length}</span>
       </div>
       <div class="pd-row">
         <span class="pd-row-label">📝 ණය ශේෂය</span>
         <span class="pd-row-value" style="color:${balance > 0 ? 'var(--red)' : 'var(--green)'};font-weight:700">
           ${money(balance)}
         </span>
       </div>
       <div class="pd-row">
         <span class="pd-row-label">🔒 ණය සීමාව</span>
         <span class="pd-row-value">${money(c.creditLimit || 0)}</span>
       </div>
     </div>
   </div>`,
  `<button class="btn" onclick="closeModal()">වසන්න</button>
   ${balance > 0 && typeof hasPermission === 'function' && hasPermission('credit') ? `
     <button class="btn btn-green" onclick="closeModal();openCreditPayment('${c.id}')">
       💵 ණය ගෙවන්න
     </button>
   ` : ''}`,
  false);
}

function editCustomer(id){
  if(!canEditCustomers()){
    toast('පාරිභෝගිකයන් සංස්කරණය කිරීමට අවසර නැත', 'err');
    return;
  }

  const db = window.DB || {};
  const c = id ? (db.customers || []).find(x => x.id === id) : { name:'', phone:'', vehicle:'', points:0, creditLimit:50000 };
  openModal(id ? '✏️ පාරිභෝගිකයා සංස්කරණය' : '➕ නව පාරිභෝගිකයා', 'Customer Profile',
  `<div>
     <label style="font-size:11.5px;color:var(--muted);font-weight:600">නම / Full Name *</label>
     <input id="cName" value="${esc(c.name)}" style="margin-top:4px">
   </div>
   <div class="grid2" style="margin-top:12px">
     <div>
       <label style="font-size:11.5px;color:var(--muted);font-weight:600">දුරකථනය / Phone</label>
       <input id="cPhone" value="${esc(c.phone)}" style="margin-top:4px">
     </div>
     <div>
       <label style="font-size:11.5px;color:var(--muted);font-weight:600">වාහන අංකය / Vehicle Reg No</label>
       <input id="cVeh" value="${esc(c.vehicle)}" placeholder="උදා: CAB-1234" style="margin-top:4px">
     </div>
   </div>
   <div class="grid2" style="margin-top:12px">
     <div>
       <label style="font-size:11.5px;color:var(--muted);font-weight:600">ණය සීමාව / Credit Limit (රු.)</label>
       <input id="cLimit" type="number" value="${c.creditLimit || 50000}" style="margin-top:4px">
     </div>
     <div>
       <label style="font-size:11.5px;color:var(--muted);font-weight:600">ලකුණු / Loyalty Points</label>
       <input id="cPoints" type="number" value="${c.points || 0}" style="margin-top:4px">
     </div>
   </div>`,
  `<button class="btn" onclick="closeModal()">අවලංගු</button>
   <button class="btn btn-primary" onclick="saveCustomer('${id||''}')">💾 සුරකින්න</button>`);
}

async function saveCustomer(id){
  if(!canEditCustomers()){
    toast('අවසර නැත', 'err');
    return;
  }

  const name = $('#cName')?.value.trim();
  if(!name){ toast('නම අවශ්‍යයි','err'); return; }

  const phone = $('#cPhone')?.value.trim() || '';
  const vehicle = $('#cVeh')?.value.trim().toUpperCase() || '';
  const creditLimit = Math.max(0, parseFloat($('#cLimit')?.value) || 0);
  const points = Math.max(0, parseInt($('#cPoints')?.value) || 0);

  const db = window.DB || {};
  if(!db.customers) db.customers = [];

  const data = { name, phone, vehicle, creditLimit, points };

  if(id){
    const c = db.customers.find(x => x.id === id);
    if(c){
      Object.assign(c, data);
      if(window.FB && window.FB.fbSet) await window.FB.fbSet(window.FB.COL.customers, id, c);
    }
  } else {
    const newId = uid('C');
    const newCust = { id: newId, ...data, creditBalance: 0 };
    db.customers.push(newCust);
    if(window.FB && window.FB.fbSet) await window.FB.fbSet(window.FB.COL.customers, newId, newCust);
  }

  if(typeof saveDB === 'function') saveDB();
  closeModal();
  render();
  toast('පාරිභෝගික තොරතුරු සුරකින ලදී ✅');
}

async function delCustomer(id){
  if(!canDeleteCustomers()){
    toast('පාරිභෝගිකයන් මකා දැමීමට අවසර නැත', 'err');
    return;
  }

  if(!confirm('මෙම පාරිභෝගිකයා මකා දැමීමට අවශ්‍ය බව සහතිකද?')) return;
  const db = window.DB || {};
  db.customers = (db.customers || []).filter(c => c.id !== id);

  if(window.FB && window.FB.fbDelete){
    await window.FB.fbDelete(window.FB.COL.customers, id);
  }
  if(typeof saveDB === 'function') saveDB();

  render();
  toast('පාරිභෝගිකයා මකා දමන ලදී');
}

window.pgCustomers = pgCustomers;
window.viewCustomer = viewCustomer;
window.editCustomer = editCustomer;
window.saveCustomer = saveCustomer;
window.delCustomer = delCustomer;

