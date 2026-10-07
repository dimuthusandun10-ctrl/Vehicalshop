/* =========================================================
   js/helpers.js - Utility Functions & DOM Helpers
   ========================================================= */

const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const uid = p => p + Math.random().toString(36).slice(2,7).toUpperCase();
const money = n => 'රු. ' + Number(n||0).toLocaleString('en-LK',{minimumFractionDigits:2,maximumFractionDigits:2});
const num = n => Number(n||0).toLocaleString('en-LK');
const today = () => new Date().toISOString().slice(0,10);
const esc = s => String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad = (n,l=4) => String(n).padStart(l,'0');
const getProd = id => DB.products.find(p=>p.id===id);

function toast(msg, type='ok'){
  const root = $('#toastRoot');
  if(!root) return;
  const d = document.createElement('div');
  d.className = 'toast ' + (type==='err'?'err':type==='warn'?'warn':'');
  d.textContent = msg;
  root.appendChild(d);
  setTimeout(()=>{
    d.style.opacity='0';
    d.style.transform='translateX(30px)';
    d.style.transition='.3s';
    setTimeout(()=>d.remove(), 300);
  }, 2600);
}

function openModal(title, sub, body, footer, wide){
  const root = $('#modalRoot');
  if(!root) return;
  root.innerHTML = `
    <div class="modal-bg" onclick="if(event.target===this)closeModal()">
      <div class="modal ${wide?'wide':''}">
        <div class="modal-h">
          <h3>${title}<small>${sub||''}</small></h3>
          <button class="close-x" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-b">${body}</div>
        ${footer?`<div class="modal-f">${footer}</div>`:''}
      </div>
    </div>`;
}

function closeModal(){
  const root = $('#modalRoot');
  if(root) root.innerHTML = '';
}

function updateClock(){
  const el = $('#clock');
  if(!el) return;
  const now = new Date();
  el.textContent = now.toLocaleDateString('en-GB') + ' ' + now.toLocaleTimeString('en-GB');
}

function focusSearch(){
  const inp = $('#posSearch');
  if(inp){
    inp.focus();
    inp.select();
  }
}

function formatRelativeTime(input){
  if(!input) return '—';
  let d;
  if(input && typeof input.toDate === 'function') d = input.toDate();              // Firestore Timestamp instance
  else if(input && input.seconds !== undefined) d = new Date(input.seconds * 1000); // Firestore timestamp plain object { seconds, nanoseconds }
  else if(typeof input === 'string') d = new Date(input);
  else if(input instanceof Date) d = input;
  else if(typeof input === 'number') d = new Date(input);
  else return '—';
  
  if(isNaN(d.getTime())) return '—';
  
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);  // seconds
  
  if(diff < 60) return 'දැන්';
  if(diff < 3600) return Math.floor(diff/60) + ' මිනිත්තු කට පෙර';
  if(diff < 86400) return Math.floor(diff/3600) + ' පැය කට පෙර';
  if(diff < 604800) return Math.floor(diff/86400) + ' දින කට පෙර';
  
  return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short' });
}
window.formatRelativeTime = formatRelativeTime;

function canEditCustomers(){
  const role = state.user?.role;
  return role === 'admin' || role === 'superadmin';
}

function canDeleteCustomers(){
  const role = state.user?.role;
  return role === 'superadmin' || role === 'admin';
}
window.canEditCustomers = canEditCustomers;
window.canDeleteCustomers = canDeleteCustomers;

/* =========================================================
   GRANULAR PERMISSION SYSTEM DEFINITIONS & HELPERS
   ========================================================= */
const PERMISSION_GROUPS = [
  { id: 'pos_sales', name: 'POS & Sales', si: 'විකුණුම් හා බිල්පත්', icon: '💰' },
  { id: 'inventory_stock', name: 'Inventory & Stock', si: 'බඩු තොග හා ගබඩාව', icon: '📦' },
  { id: 'financial_actions', name: 'Financial & Special Actions', si: 'මුදල් හා විශේෂ ක්‍රියාකාරකම්', icon: '💳' },
  { id: 'reports_shifts', name: 'Reports & Shifts', si: 'වාර්තා හා වැඩ මුර', icon: '📊' },
  { id: 'administration', name: 'System Administration', si: 'පද්ධති පරිපාලනය', icon: '⚙️' }
];

const PERMISSIONS = [
  // 1. POS & Sales
  { id: 'billing', group: 'pos_sales', name: 'POS Billing', si: 'POS බිල්පත් නිකුත් කිරීම', desc: 'නව බිල්පත් නිකුත් කිරීම හා Checkout කිරීම' },
  { id: 'dashboard', group: 'pos_sales', name: 'Dashboard', si: 'ප්‍රධාන උපකරණ පුවරුව', desc: 'විකුණුම් දළ විශ්ලේෂණය හා ඉක්මන් සංඛ්‍යාලේඛන' },
  { id: 'pos', group: 'pos_sales', name: 'POS Terminal', si: 'POS පර්යන්තය', desc: 'පූර්ණ POS විකුණුම් අතුරුමුහුණත භාවිතා කිරීම' },
  { id: 'customers', group: 'pos_sales', name: 'Customers', si: 'පාරිභෝගික කළමනාකරණය', desc: 'පාරිභෝගික තොරතුරු බැලීම හා එක් කිරීම' },
  { id: 'lowstock', group: 'pos_sales', name: 'Low Stock', si: 'අඩු තොග අනතුරු ඇඟවීම්', desc: 'තොග අවසන් වීමට ආසන්න භාණ්ඩ නිරීක්ෂණය' },

  // 2. Inventory & Stock
  { id: 'inventory', group: 'inventory_stock', name: 'Inventory', si: 'බඩු තොග කළමනාකරණය', desc: 'භාණ්ඩ නාමාවලිය හා තොග තොරතුරු බැලීම' },
  { id: 'grn', group: 'inventory_stock', name: 'GRN', si: 'GRN (භාණ්ඩ ලැබීම් සටහන්)', desc: 'නව තොග ඇතුළත් කිරීම හා සැපයුම්කරුවන්ගේ බිල්පත්' },
  { id: 'serial-search', group: 'inventory_stock', name: 'Serial Search', si: 'සීරියල් අංක සෙවීම', desc: 'බැටරි/ටයර් සීරියල් අංක ලුහුබැඳීම' },
  { id: 'delete-product', group: 'inventory_stock', name: 'Delete Products', si: 'භාණ්ඩ ඉවත් කිරීම', desc: 'තොග නාමාවලියෙන් භාණ්ඩ සම්පූර්ණයෙන්ම මකා දැමීම' },

  // 3. Financial & Special Actions
  { id: 'returns', group: 'financial_actions', name: 'Returns', si: 'ආපසු භාරගැනීම් (Returns)', desc: 'භාණ්ඩ ආපසු භාරගැනීම් ඉල්ලීම් හා අනුමත කිරීම්' },
  { id: 'credit', group: 'financial_actions', name: 'Credit Payments', si: 'ණය පියවීම්', desc: 'පාරිභෝගික ණය මුදල් එකතු කිරීම හා පියවීම' },
  { id: 'discounts', group: 'financial_actions', name: 'Give Discounts', si: 'වට්ටම් ලබාදීම', desc: 'බිල්පතට අමතර වට්ටම් යෙදීම' },
  { id: 'price-override', group: 'financial_actions', name: 'Price Override', si: 'මිල වෙනස් කිරීම', desc: 'Checkout හිදී භාණ්ඩ විකුණුම් මිල තාවකාලිකව වෙනස් කිරීම' },
  { id: 'void-sale', group: 'financial_actions', name: 'Void Completed Sale', si: 'බිල්පත් අවලංගු කිරීම', desc: 'නිකුත් කළ බිල්පත් අවලංගු කිරීම' },

  // 4. Reports & Shifts
  { id: 'reports', group: 'reports_shifts', name: 'Reports', si: 'ව්‍යාපාරික වාර්තා', desc: 'විකුණුම්, ලාභ හා මූල්‍ය වාර්තා බැලීම' },
  { id: 'shifts', group: 'reports_shifts', name: 'Shift History', si: 'Shift ඉතිහාසය', desc: 'කැෂියර් වැඩමුර හා මුදල් ලාච්චු විස්තර බැලීම' },

  // 5. System Administration
  { id: 'staff', group: 'administration', name: 'Staff Control', si: 'කාර්ය මණ්ඩල පාලනය', desc: 'සේවක ගිණුම් සෑදීම, සංස්කරණය හා අගුළු දැමීම' },
  { id: 'shops', group: 'administration', name: 'Shop Management', si: 'ශාඛා කළමනාකරණය', desc: 'නව ශාඛා ලියාපදිංචි කිරීම (Super Admin)' },
  { id: 'settings', group: 'administration', name: 'Settings', si: 'පද්ධති සැකසුම්', desc: 'සාප්පු විස්තර හා මූලික සැකසුම් වෙනස් කිරීම' },
  { id: 'profile', group: 'administration', name: 'My Profile', si: 'මගේ ගිණුම', desc: 'තමන්ගේ තොරතුරු හා මුරපදය වෙනස් කිරීම' }
];

const PERMISSION_PRESETS = {
  cashier: {
    name: 'Cashier Standard',
    si: 'කැෂියර් සම්මතය',
    icon: '💵',
    perms: ['billing', 'dashboard', 'customers', 'lowstock', 'profile']
  },
  supervisor: {
    name: 'Supervisor',
    si: 'සුපරීක්ෂක',
    icon: '🛡️',
    perms: ['billing', 'dashboard', 'pos', 'customers', 'lowstock', 'returns', 'shifts', 'serial-search', 'profile', 'credit', 'discounts', 'void-sale']
  },
  inventory_mgr: {
    name: 'Inventory Manager',
    si: 'තොග කළමනාකරු',
    icon: '📦',
    perms: ['dashboard', 'inventory', 'lowstock', 'grn', 'serial-search', 'delete-product', 'profile']
  },
  sales_mgr: {
    name: 'Sales Manager',
    si: 'විකුණුම් කළමනාකරු',
    icon: '📈',
    perms: ['billing', 'dashboard', 'pos', 'customers', 'reports', 'shifts', 'profile', 'credit', 'discounts', 'price-override']
  },
  full: {
    name: 'Full Access',
    si: 'සම්පූර්ණ ප්‍රවේශය',
    icon: '⚡',
    perms: ['billing', 'dashboard', 'pos', 'inventory', 'customers', 'lowstock', 'grn', 'returns', 'serial-search', 'shifts', 'reports', 'settings', 'staff', 'profile', 'credit', 'discounts', 'price-override', 'void-sale', 'delete-product']
  }
};

function getDefaultPermissionsForRole(role){
  if(role === 'superadmin'){
    return PERMISSIONS.map(p => p.id);
  }
  if(role === 'admin'){
    return [...PERMISSION_PRESETS.full.perms];
  }
  return [...PERMISSION_PRESETS.cashier.perms];
}

function hasPermission(perm, user){
  const u = user || (window.state && window.state.user);
  if(!u) return false;
  if(u.role === 'superadmin') return true; // Super Admin has unrestricted access to all actions
  if(!u.permissions || !Array.isArray(u.permissions)) return false;
  return u.permissions.includes(perm);
}

function can(page, user){
  const u = user || (window.state && window.state.user);
  if(!u) return false;
  if(u.role === 'superadmin') return true;
  const navItem = (typeof NAV !== 'undefined' && Array.isArray(NAV)) ? NAV.find(n => n.id === page) : null;
  const permKey = (navItem && navItem.perm) ? navItem.perm : page;
  return hasPermission(permKey, u);
}

window.$ = $;
window.$$ = $$;
window.uid = uid;
window.money = money;
window.num = num;
window.today = today;
window.esc = esc;
window.pad = pad;
window.getProd = getProd;
window.toast = toast;
window.openModal = openModal;
window.closeModal = closeModal;
window.updateClock = updateClock;
window.focusSearch = focusSearch;
window.PERMISSION_GROUPS = PERMISSION_GROUPS;
window.PERMISSIONS = PERMISSIONS;
window.PERMISSION_PRESETS = PERMISSION_PRESETS;
window.getDefaultPermissionsForRole = getDefaultPermissionsForRole;
window.hasPermission = hasPermission;
window.can = can;
