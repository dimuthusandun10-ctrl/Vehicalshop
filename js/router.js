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

  // Update mobile bottom nav active tab
  const bnav = document.getElementById('mobileBottomNav');
  if(bnav){
    bnav.querySelectorAll('.bnav-item[data-page]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-page') === state.page);
    });
  }
}

async function go(page){
  if(!can(page)){
    toast('ඔබට මෙම අංශයට අවසර නැත', 'err');
    return;
  }
  state.page = page;

  // Lazy-load page module scripts if not loaded yet
  if(typeof window.loadPageModule === 'function'){
    await window.loadPageModule(page);
  }

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

  // ⭐ Page-specific classes for proper scrolling
  c.className = 'content';
  c.classList.add('page-' + state.page);
  if(state.page === 'billing' || state.page === 'grn'){
    c.classList.add('scroll-inner');   // Billing & GRN: internal scroll
  } else {
    c.classList.add('scroll-natural'); // Others: natural document scroll
  }
  document.body.classList.toggle('page-billing', state.page === 'billing');
  document.body.classList.toggle('page-grn', state.page === 'grn');
  document.body.classList.toggle('page-scroll-natural', state.page !== 'billing' && state.page !== 'grn');

  const map = {
    dashboard: typeof pgDashboard !== 'undefined' ? pgDashboard : null,
    billing: typeof pgBilling !== 'undefined' ? pgBilling : null,
    pos: typeof pgPos !== 'undefined' ? pgPos : null,
    inventory: typeof pgInventory !== 'undefined' ? pgInventory : null,
    customers: typeof pgCustomers !== 'undefined' ? pgCustomers : null,
    lowstock: typeof pgLowStock !== 'undefined' ? pgLowStock : null,
    grn: typeof pgGRN !== 'undefined' ? pgGRN : null,
    returns: typeof pgReturns !== 'undefined' ? pgReturns : null,
    'serial-search': typeof pgSerialSearch !== 'undefined' ? pgSerialSearch : null,
    shifts: typeof pgShifts !== 'undefined' ? pgShifts : null,
    reports: typeof pgReports !== 'undefined' ? pgReports : null,
    shops: typeof pgShops !== 'undefined' ? pgShops : null,
    profile: typeof pgProfile !== 'undefined' ? pgProfile : null,
    settings: typeof pgSettings !== 'undefined' ? pgSettings : null,
    credit: typeof pgCredit !== 'undefined' ? pgCredit : null
  };

  const renderFn = map[state.page];
  if(typeof renderFn === 'function'){
    c.innerHTML = renderFn();
  } else if(!map.hasOwnProperty(state.page)) {
    c.innerHTML = '<div class="empty">සොයාගත නොහැක</div>';
  } else {
    c.innerHTML = `
      <div class="card" style="margin:20px;padding:30px;text-align:center">
        <div style="font-size:36px;margin-bottom:12px">⏳</div>
        <div style="font-weight:700;font-size:16px;margin-bottom:6px">පිටුව සූදානම් වෙමින් පවතී...</div>
        <p style="color:var(--muted);font-size:13px;margin:0 0 16px 0">Loading page module (${state.page}). Please wait...</p>
        <button class="btn btn-sm" onclick="go('${state.page}')">🔄 නැවත උත්සාහ කරන්න (Retry)</button>
      </div>`;
    if(typeof window.loadPageModule === 'function'){
      window.loadPageModule(state.page).then(() => {
        if(typeof render === 'function') render();
      });
    }
  }

  if(state.page === 'billing'){
    if(typeof renderGrid === 'function') renderGrid();
    if(typeof renderCart === 'function') renderCart();
  }
  c.scrollTop = 0;
  window.scrollTo(0, 0);
}

window.renderNav = renderNav;
window.go = go;
window.render = render;
