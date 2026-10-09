/* =========================================================
   js/config.js - Configuration, Constants & State
   ========================================================= */

var ROLE_SI = {superadmin:'සුපිරි පරිපාලක', admin:'පරිපාලක', cashier:'කැෂියර්'};
var ROLE_EN = {superadmin:'Super Admin',    admin:'Admin',   cashier:'Cashier'};

var NAV = [
  {id:'billing',       icon:'💰', si:'POS බිල්පත්',         en:'POS Billing',         perm:'billing',       roles:['superadmin','admin','cashier'], star:true},
  {id:'dashboard',     icon:'🏠', si:'උපකරණ පුවරුව',        en:'Dashboard',           perm:'dashboard',     roles:['superadmin','admin','cashier']},
  {id:'pos',           icon:'📋', si:'POS පද්ධතිය',         en:'POS Terminal',        perm:'pos',           roles:['superadmin','admin','cashier']},
  {id:'inventory',     icon:'📦', si:'තොග කළමනාකරණය',       en:'Inventory',           perm:'inventory',     roles:['superadmin','admin']},
  {id:'customers',     icon:'👥', si:'පාරිභෝගිකයන් & ණය',   en:'Customers & Credit',  perm:'customers',     roles:['superadmin','admin','cashier']},
  {id:'lowstock',      icon:'⚠️', si:'අඩු තොග',             en:'Low Stock',           perm:'lowstock',      roles:['superadmin','admin','cashier']},
  {id:'grn',           icon:'📥', si:'භාණ්ඩ ලැබීම (GRN)',   en:'Goods Received',      perm:'grn',           roles:['superadmin','admin']},
  {id:'returns',       icon:'↩️', si:'ආපසු භාරදීම',         en:'Returns',             perm:'returns',       roles:['superadmin','admin','cashier']},
  {id:'serial-search', icon:'🛡️', si:'Serial සෙවීම',      en:'Serial Search',       perm:'serial-search', roles:['superadmin','admin','cashier']},
  {id:'shifts',        icon:'🕐', si:'Shift ඉතිහාසය',       en:'Shift History',       perm:'shifts',        roles:['superadmin','admin']},
  {id:'reports',       icon:'📊', si:'වාර්තා',               en:'Reports',             perm:'reports',       roles:['superadmin','admin']},
  {id:'shops',         icon:'🏪', si:'සාප්පු කළමනාකරණය',     en:'Shop Management',     perm:'shops',         roles:['superadmin']},
  {id:'profile',       icon:'👤', si:'මගේ ගිණුම',           en:'My Profile',          perm:'profile',       roles:['superadmin','admin','cashier']},
  {id:'settings',      icon:'🛠️', si:'සැකසුම්',              en:'Settings',            perm:'settings',      roles:['superadmin','admin']},
];

window.state = window.state || {
  user: null,
  page: 'billing',
  cart: [],
  held: [],
  search: '',
  catFilter: 'all',
  cartCustomer: '',
  repFrom: new Date().toISOString().slice(0,10),
  repTo: new Date().toISOString().slice(0,10),
  settingsTab: 'shop',
  posFilters: {
    range: 'today',
    method: 'all',
    search: '',
    sort: 'newest'
  },
  invSearch: '',
  invCategory: 'all',
  invSort: 'default',
  invStatus: 'all',
  invPage: 1
};
var state = window.state;

window.checkoutState = window.checkoutState || {
  theme: localStorage.getItem('co_modal_theme') || 'light',
  method: 'cash',
  custId: '',
  received: 0,
  selectedDenom: null,
  cardRef: '',
  orderNo: ''
};
var checkoutState = window.checkoutState;

var DB = window.DB || {};
