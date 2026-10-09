/* =========================================================
   js/router.js - Page Navigation & View Dispatcher
   ========================================================= */

function renderNav(){
  const list = $('#navList');
  if(!list || !state.user) return;
  const db = (typeof DB !== 'undefined' && DB) ? DB : (window.DB || {});
  const lowCount = (db.products || []).filter(p => p.qty <= p.reorder).length;

  let retPendingCount = 0;
  if(db.returns && db.returns.length){
    if(state.user.role === 'cashier'){
      retPendingCount = db.returns.filter(r => r.status === 'pending' && (r.requestedBy === state.user.name || r.requestedById === state.user.id)).length;
    } else {
      retPendingCount = db.returns.filter(r => r.status === 'pending').length;
    }
  }

  list.innerHTML = NAV.filter(n => hasPermission(n.perm || n.id)).map(n => {
    let badge = '';
    if(n.id === 'lowstock' && lowCount > 0){
      badge = `<span class="ni-badge">${lowCount}</span>`;
    } else if(n.id === 'returns' && retPendingCount > 0){
      badge = `<span class="ni-badge warn">${retPendingCount}</span>`;
    }
    const star = n.star ? '<span class="star">⭐</span>' : '';
    return `
      <button class="nav-item ${state.page===n.id?'active':''}" onclick="go('${n.id}')">
        <span class="ni">${n.icon}</span>
        <span class="nt"><b>${n.si}</b><small>${n.en}</small></span>
        ${badge}${star}
      </button>`;
  }).join('');
}

function go(page){
  if(!can(page)){
    toast('ඔබට මෙම අංශයට අවසර නැත', 'err');
    return;
  }
  state.page = page;

  // Close mobile sidebar when navigating
  if(typeof closeMobileSidebar === 'function'){
    closeMobileSidebar();
  }

  // Fallback: direct class removal
  const sb = document.getElementById('sidebarSlot') || document.getElementById('sidebar') || document.querySelector('.sidebar');
  if(sb) sb.classList.remove('open');
  const backdrop = document.getElementById('sidebarBackdrop');
  if(backdrop) backdrop.classList.remove('open');
  document.body.classList.remove('sidebar-open');

  if(typeof startPageListeners === 'function') startPageListeners(page);
  renderNav();
  render();
}

function render(){
  if(!can(state.page)){
    toast('ඔබට මෙම අංශයට අවසර නැත', 'err');
    const c = $('#content');
    if(c) c.innerHTML = '<div class="card"><div class="empty" style="padding:40px;text-align:center"><div style="font-size:36px;margin-bottom:10px">🔒</div><b>ඔබට මෙම අංශයට අවසර නැත</b><p style="color:var(--muted);font-size:12px;margin-top:4px">Access Denied · Granular permission required</p></div></div>';
    return;
  }
  const n = NAV.find(x => x.id === state.page);
  if(!n) return;
  const titleEl = $('#pgTitle');
  if(titleEl) titleEl.innerHTML = `${n.icon} ${n.si}<small>${n.en}</small>`;
  const c = $('#content');
  if(!c) return;
  const map = {
    dashboard: pgDashboard,
    billing: pgBilling,
    pos: pgPos,
    inventory: pgInventory,
    customers: pgCustomers,
    lowstock: pgLowStock,
    grn: pgGRN,
    returns: pgReturns,
    'serial-search': pgSerialSearch,
    shifts: pgShifts,
    reports: pgReports,
    shops: pgShops,
    profile: pgProfile,
    settings: pgSettings
  };
  c.innerHTML = (map[state.page] || (() => '<div class="empty">සොයාගත නොහැක</div>'))();
  if(state.page === 'billing'){
    renderGrid();
    renderCart();
  }
  c.scrollTop = 0;
}

window.renderNav = renderNav;
window.go = go;
window.render = render;
