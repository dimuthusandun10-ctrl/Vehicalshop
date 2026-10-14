/* =====================================================
   js/db-service.js - Central Data & Real-time Synchronization
   ===================================================== */

var LOCAL_KEY = 'autoparts_pos_db';

function getLocalDB(){
  try {
    const shopId = (typeof currentShopId === 'function') ? currentShopId() : null;
    if(shopId){
      const raw = localStorage.getItem('pos.localDB.' + shopId);
      if(raw){
        const data = JSON.parse(raw);
        if(!data.savedAt || (Date.now() - data.savedAt <= 48 * 3600 * 1000)){
          return data;
        }
      }
      // Pristine tenant structure when shop cache is not yet created (never leak other shops)
      return {
        products: [],
        customers: [],
        suppliers: [],
        sales: [],
        grns: [],
        returns: [],
        shifts: [],
        cashMoves: [],
        payments: [],
        supplierPayments: [],
        interchanges: [],
        scrapInventory: [],
        users: [],
        counters: { invoice: 1, grn: 1, ret: 1, shift: 1, payment: 1, shop: 1 },
        savedAt: Date.now(),
        shopId: shopId
      };
    }
    const s = localStorage.getItem(LOCAL_KEY);
    if(s) return JSON.parse(s);
  } catch(e){}
  return null;
}

var DB = window.DB = window.DB || {};

Object.assign(DB, {
  shop: {
    name: 'Auto Parts Lanka',
    addr: 'No. 25, Main Street, Colombo 11',
    phone: '011-234 5678',
    tax: 0,
    footer: 'ස්තූතියි! නැවත එන්න.'
  },

  shops: window.INITIAL_SHOPS || [],
  users: window.INITIAL_USERS || [
    {id:'U1', name:'සුපිරි පරිපාලක', username:'superadmin', password:'$2a$10$c2b5qGhR4T0syGShhjaAzurwj8IuUUHPw5Mo2Kn/N.qRYN7./7Eh.', role:'superadmin', active:true, locked:false},
    {id:'U2', name:'පරිපාලක',        username:'admin',      password:'$2a$10$c2b5qGhR4T0syGShhjaAzurwj8IuUUHPw5Mo2Kn/N.qRYN7./7Eh.', role:'admin',      active:true, locked:false, shopId:'SHOP-001'},
    {id:'U3', name:'කැෂියර්',         username:'cashier',    password:'$2a$10$c2b5qGhR4T0syGShhjaAzurwj8IuUUHPw5Mo2Kn/N.qRYN7./7Eh.', role:'cashier',    active:true, locked:false, shopId:'SHOP-001'}
  ],
  products: [],
  customers: [],
  suppliers: [],
  sales: [],
  grns: [],
  returns: [],
  shifts: [],
  cashMoves: [],
  payments: [],
  supplierPayments: [],
  interchanges: [],
  scrapInventory: [],
  counters: { invoice: 1, grn: 1, ret: 1, shift: 1, payment: 1, shop: 1 },

  isFirebaseConnected: false,

  /* ---------- initial load ---------- */
  /* ---------- initial load with strict multi-tenant isolation ---------- */
  async loadAll(background = false){
    const shopId = (typeof currentShopId === 'function') 
      ? currentShopId() 
      : (window.state?.user?.role === 'superadmin' ? (window.state?.activeShopId || window.state?.activeShop?.id) : window.state?.user?.shopId);

    // First load from localStorage for instant, offline display
    const cached = getLocalDB();
    if(cached){
      if(cached.shop) this.shop = cached.shop;
      if(cached.shops?.length) this.shops = cached.shops;

      // Strict user filtering (BUG 2 FIX)
      if(cached.users?.length){
        const rawUsers = cached.users.map(u => {
          if(!u.permissions || !Array.isArray(u.permissions)){
            u.permissions = (typeof getDefaultPermissionsForRole === 'function')
              ? getDefaultPermissionsForRole(u.role)
              : ['billing','dashboard','customers','lowstock','profile'];
          }
          return u;
        });

        if(window.state?.user?.role === 'superadmin'){
          this.users = rawUsers;
        } else if(shopId){
          this.users = rawUsers.filter(u => u.shopId === shopId || u.role === 'superadmin');
        } else {
          this.users = rawUsers; // before login, need users for auth lookup
        }
      } else if(window.INITIAL_USERS){
        this.users = window.INITIAL_USERS;
      }

      // Strict shop filtering (BUG 1 FIX: no orphan leakage)
      const filterByShop = list => (list || []).filter(item => item.shopId === shopId);

      if(shopId){
        if(cached.products?.length){
          this.products = filterByShop(cached.products).map(p => {
            const init = (window.INITIAL_PRODUCTS || []).find(ip => ip.id === p.id);
            return {
              chassis: [],
              engine: [],
              altNos: [],
              rack: '',
              bin: '',
              warehouse: 'Main',
              warranty: 0,
              hasSerial: false,
              coreDeposit: 0,
              crossSell: [],
              ...(init || {}),
              ...p,
              chassis: p.chassis || init?.chassis || [],
              engine: p.engine || init?.engine || [],
              altNos: p.altNos || init?.altNos || [],
              crossSell: (p.crossSell && p.crossSell.length) ? p.crossSell : (init?.crossSell || []),
              warehouse: p.warehouse || init?.warehouse || 'Main',
              hasSerial: p.hasSerial !== undefined ? p.hasSerial : (init?.hasSerial || false),
              coreDeposit: p.coreDeposit !== undefined ? p.coreDeposit : (init?.coreDeposit || 0),
              warranty: p.warranty !== undefined ? p.warranty : (init?.warranty || 0)
            };
          });
          this.sanitizeProductsCoreDeposit();
        } else {
          this.products = [];
        }

        this.customers = filterByShop(cached.customers);
        this.suppliers = filterByShop(cached.suppliers);
        this.sales     = filterByShop(cached.sales);
        this.grns      = filterByShop(cached.grns);
        this.returns   = filterByShop(cached.returns);
        this.shifts    = filterByShop(cached.shifts);
        this.cashMoves = filterByShop(cached.cashMoves);
        this.payments  = filterByShop(cached.payments);
        this.supplierPayments = filterByShop(cached.supplierPayments);
        this.interchanges = filterByShop(cached.interchanges);
        this.scrapInventory = filterByShop(cached.scrapInventory);
      } else {
        // No active shop → empty arrays (strict isolation)
        this.products  = [];
        this.customers = [];
        this.suppliers = [];
        this.sales     = [];
        this.grns      = [];
        this.returns   = [];
        this.shifts    = [];
        this.cashMoves = [];
        this.payments  = [];
        this.supplierPayments = [];
        this.interchanges = [];
        this.scrapInventory = [];
      }

      if(cached.counters) this.counters = { ...this.counters, ...cached.counters };
      console.log('⚡ Loaded from cache:', this.products.length, 'products');
      if(typeof rerenderIfActive === 'function') rerenderIfActive();
    } else {
      // If completely fresh localStorage, seed with our default initial data
      if(window.INITIAL_SHOPS && (!this.shops || !this.shops.length)) this.shops = window.INITIAL_SHOPS;
      if(window.INITIAL_USERS && !this.users.length) this.users = window.INITIAL_USERS;
      this.persistLocal();
    }

    // ⭐ STEP 2: Try Firestore (Non-blocking background sync)
    if(!window.state?.user){
      // Do not probe protected collections before authentication
      return;
    }
    if(background){
      setTimeout(() => this.syncRemote(shopId), 100);
      return;
    }

    await this.syncRemote(shopId);
  },

  async syncRemote(shopId){
    if(typeof navigator !== 'undefined' && !navigator.onLine){
      console.log('🟡 Offline — skipping Firestore load, local cache is active');
      return;
    }

    // Try fetching live data from Firebase (strictly filtered by shopId)
    if(window.FB && (!window.FB.isPermissionDenied || !window.FB.isPermissionDenied())){
      try {
        const mods = window.FB._getModules ? window.FB._getModules() : null;
        const fsDb = window.FB._getDb ? window.FB._getDb() : null;
        const hasFs = Boolean(mods?.fsMod && fsDb);
        const { collection, getDocs, query, where } = hasFs ? mods.fsMod : {};

        // Shops collection — always full (Super admin needs list)
        const shops = await window.FB.fbGetAll(window.FB.COL.shops);
        if(shops && shops.length) this.shops = shops;

        // Users — superadmin loads all users; others load their own shop
        if(window.state?.user && window.state.user.role === 'superadmin'){
          const users = await window.FB.fbGetAll(window.FB.COL.users);
          if(users && users.length){
            this.users = users.map(u => {
              if(!u.permissions || !Array.isArray(u.permissions)){
                u.permissions = (typeof getDefaultPermissionsForRole === 'function')
                  ? getDefaultPermissionsForRole(u.role)
                  : ['billing','dashboard','customers','lowstock','profile'];
              }
              return u;
            });
          }
        } else if(hasFs && shopId){
          const uSnap = await getDocs(query(collection(fsDb, 'users'), where('shopId', '==', shopId)));
          const uDocs = uSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          if(uDocs.length){
            this.users = uDocs.map(u => {
              if(!u.permissions || !Array.isArray(u.permissions)){
                u.permissions = (typeof getDefaultPermissionsForRole === 'function')
                  ? getDefaultPermissionsForRole(u.role)
                  : ['billing','dashboard','customers','lowstock','profile'];
              }
              return u;
            });
          }
        }
        console.log('📥 Loaded users:', this.users.length);
        this.persistLocal();

        // All other collections — strictly filtered by shopId
        if(hasFs && shopId){
          const cols = [
            { key: 'products',  name: 'products' },
            { key: 'customers', name: 'customers' },
            { key: 'suppliers', name: 'suppliers' },
            { key: 'sales',     name: 'sales' },
            { key: 'grns',      name: 'grns' },
            { key: 'returns',   name: 'returns' },
            { key: 'shifts',    name: 'shifts' },
            { key: 'cashMoves', name: 'cashMovements' },
            { key: 'payments',  name: 'creditPayments' },
            { key: 'supplierPayments', name: 'supplierPayments' },
            { key: 'interchanges', name: 'interchanges' },
            { key: 'scrapInventory', name: 'scrapInventory' }
          ];

          const results = await Promise.all(
            cols.map(c => 
              getDocs(query(collection(fsDb, c.name), where('shopId', '==', shopId)))
                .then(s => s.docs.map(d => ({ ...d.data(), id: d.id, _docId: d.id })))
                .catch(() => [])
            )
          );

          cols.forEach((c, idx) => {
            const fetched = results[idx] || [];
            // Direct assignment: if empty in Firestore, empty for this shop!
            this[c.key] = fetched;
          });

          this.sanitizeProductsCoreDeposit();
        } else if(!shopId){
          this.products  = [];
          this.customers = [];
          this.suppliers = [];
          this.sales     = [];
          this.grns      = [];
          this.returns   = [];
          this.shifts    = [];
          this.cashMoves = [];
          this.payments  = [];
          this.supplierPayments = [];
          this.interchanges = [];
          this.scrapInventory = [];
        }

        if(shopId){
          const myShop = (this.shops || []).find(s => s.id === shopId);
          if(myShop) this.shop = myShop;
        } else if(window.FB && typeof window.FB.fbGetDirect === 'function'){
          try {
            const shopDoc = await window.FB.fbGetDirect(window.FB.COL.settings, 'shop');
            if(shopDoc) this.shop = shopDoc;
          } catch(_){}
        }

        this.recalculateCounters();
        this.isFirebaseConnected = true;
        this.persistLocal();

        if(window.state && window.state.user){
          const targetShopId = window.state.user.role === 'superadmin'
            ? (window.state.activeShopId || (window.state.activeShop && window.state.activeShop.id))
            : window.state.user.shopId;
          const myShop = (this.shops || []).find(s => s.id === targetShopId) || (window.state.user.role === 'superadmin' ? (this.shops && this.shops[0]) : null);
          if(myShop){
            window.state.activeShop = myShop;
            window.state.activeShopId = myShop.id;
            this.shop = myShop;
            if(typeof updateBrandName === 'function') updateBrandName();
          }
          if(typeof updateTopBarShopSwitcher === 'function') updateTopBarShopSwitcher();
        }

        // Sync dynamic technical support & contact settings from Firestore
        if(typeof window.syncContactSettingsFromFirebase === 'function'){
          window.syncContactSettingsFromFirebase().catch(() => {});
        }
      } catch(err) {
        this.isFirebaseConnected = false;
        console.warn('Operating in local offline storage mode.');
      }
    }

    // Auto-migrate any unhashed legacy passwords
    if(window.Security && typeof window.Security.migratePasswords === 'function'){
      setTimeout(() => {
        window.Security.migratePasswords().catch(() => {});
      }, 500);
    }
  },

  recalculateCounters(){
    if(this.sales?.length){
      const maxInv = Math.max(0, ...this.sales.map(s => parseInt((s.no || '').replace(/\D/g,'')) || 0));
      this.counters.invoice = Math.max(this.counters.invoice, maxInv + 1);
    }
    if(this.grns?.length){
      const maxGrn = Math.max(0, ...this.grns.map(g => parseInt((g.no || '').replace(/\D/g,'')) || 0));
      this.counters.grn = Math.max(this.counters.grn, maxGrn + 1);
    }
    if(this.returns?.length){
      const maxRet = Math.max(0, ...this.returns.map(r => parseInt((r.no || '').replace(/\D/g,'')) || 0));
      this.counters.ret = Math.max(this.counters.ret, maxRet + 1);
    }
    if(this.shifts?.length){
      const maxShift = Math.max(0, ...this.shifts.map(s => parseInt((s.id || '').replace(/\D/g,'')) || 0));
      this.counters.shift = Math.max(this.counters.shift, maxShift + 1);
    }
    if(this.payments?.length){
      const maxPay = Math.max(0, ...this.payments.map(p => parseInt((p.no || '').replace(/\D/g,'')) || 0));
      this.counters.payment = Math.max(this.counters.payment || 1, maxPay + 1);
    }
    if(this.shops?.length){
      const maxShop = Math.max(0, ...this.shops.map(s => parseInt((s.id || '').replace(/\D/g,'')) || 0));
      this.counters.shop = Math.max(this.counters.shop || 1, maxShop + 1);
    }
  },

  /* ---------- real-time listeners for multi-terminal sync (shop-scoped) ---------- */
  watch(){
    if(!window.FB || !this.isFirebaseConnected) return;
    if(window.FB.isPermissionDenied && window.FB.isPermissionDenied()) return;
    startPageListeners(window.state?.page || 'billing');
  },

  /* ---------- synchronous cache-only load (instant 0.1s login & boot) ---------- */
  loadAllSync(){
    const shopId = (typeof currentShopId === 'function') 
                    ? currentShopId() 
                    : (window.state?.user?.shopId || window.state?.activeShopId || (window.state?.activeShop && window.state?.activeShop.id));

    const cached = this.getLocalDB();
    if(!cached){
      console.log('⚠️ No local cache — starting fresh');
      if(window.INITIAL_SHOPS && (!this.shops || !this.shops.length)) this.shops = window.INITIAL_SHOPS;
      if(window.INITIAL_USERS && !this.users.length) this.users = window.INITIAL_USERS;
      return;
    }

    const filterByShop = (list) => (list || []).filter(item => item.shopId === shopId);

    if(cached.shop) this.shop = cached.shop;
    if(cached.shops?.length) this.shops = cached.shops;

    if(window.state?.user?.role === 'superadmin'){
      this.users = cached.users || [];
    } else {
      this.users = (cached.users || []).filter(u => 
        u.shopId === shopId || u.role === 'superadmin'
      );
    }

    if(shopId){
      this.products  = filterByShop(cached.products);
      this.customers = filterByShop(cached.customers);
      this.suppliers = filterByShop(cached.suppliers);
      this.sales     = filterByShop(cached.sales);
      this.grns      = filterByShop(cached.grns);
      this.returns   = filterByShop(cached.returns);
      this.shifts    = filterByShop(cached.shifts);
      this.cashMoves = filterByShop(cached.cashMoves);
      this.payments  = filterByShop(cached.payments);
      this.supplierPayments = filterByShop(cached.supplierPayments);
      this.interchanges = filterByShop(cached.interchanges);
      this.scrapInventory = filterByShop(cached.scrapInventory);
    } else {
      this.products  = [];
      this.customers = [];
      this.suppliers = [];
      this.sales     = [];
      this.grns      = [];
      this.returns   = [];
      this.shifts    = [];
      this.cashMoves = [];
      this.payments  = [];
      this.supplierPayments = [];
      this.interchanges = [];
      this.scrapInventory = [];
    }

    if(cached.counters) this.counters = { ...this.counters, ...cached.counters };
    this.recalculateCounters();
    console.log(`⚡ Instant load from cache: ${this.products.length} products, ${this.sales.length} sales`);
  },

  _persistTimer: null,

  _persistLocalNow(){
    try {
      const shopId = (typeof currentShopId === 'function') ? currentShopId() : null;
      const data = {
        products:  this.products,
        customers: this.customers,
        sales:     this.sales,
        grns:      this.grns,
        returns:   this.returns,
        shifts:    this.shifts,
        cashMoves: this.cashMoves,
        payments:  this.payments,
        supplierPayments: this.supplierPayments,
        interchanges: this.interchanges,
        scrapInventory: this.scrapInventory,
        suppliers: this.suppliers,
        users:     this.users,
        shops:     this.shops,
        counters:  this.counters,
        shop:      this.shop,
        savedAt:   Date.now(),
        shopId:    shopId
      };

      if(shopId){
        localStorage.setItem('pos.localDB.' + shopId, JSON.stringify(data));
      }

      const existing = getLocalDB() || {};

      const mergeCol = (key, currentList) => {
        if(!shopId) return currentList || [];
        const others = (existing[key] || []).filter(item => item.shopId && item.shopId !== shopId);
        return [...others, ...(currentList || [])];
      };

      const mergeUsers = (currentUsers) => {
        if(window.state?.user?.role === 'superadmin' || !shopId) return currentUsers || [];
        const others = (existing.users || []).filter(u => u.shopId && u.shopId !== shopId);
        return [...others, ...(currentUsers || [])];
      };

      localStorage.setItem(LOCAL_KEY, JSON.stringify({
        shop: this.shop,
        shops: this.shops,
        users: mergeUsers(this.users),
        products: mergeCol('products', this.products),
        customers: mergeCol('customers', this.customers),
        suppliers: mergeCol('suppliers', this.suppliers),
        sales: mergeCol('sales', this.sales),
        grns: mergeCol('grns', this.grns),
        returns: mergeCol('returns', this.returns),
        shifts: mergeCol('shifts', this.shifts),
        cashMoves: mergeCol('cashMoves', this.cashMoves),
        payments: mergeCol('payments', this.payments),
        supplierPayments: mergeCol('supplierPayments', this.supplierPayments),
        interchanges: mergeCol('interchanges', this.interchanges),
        scrapInventory: mergeCol('scrapInventory', this.scrapInventory),
        counters: this.counters,
        savedAt: Date.now()
      }));
      if(typeof _posSyncChannel !== 'undefined' && _posSyncChannel){
        try {
          _posSyncChannel.postMessage({ type: 'db_updated', timestamp: Date.now() });
        } catch(e){}
      }
    } catch(e){
      console.warn('Cache save failed:', e);
    }
  },

  persistLocal(){
    if(this._persistTimer) clearTimeout(this._persistTimer);
    this._persistTimer = setTimeout(() => {
      this._persistLocalNow();
      this._persistTimer = null;
    }, 2000);
  },

  getLocalDB(){
    return getLocalDB();
  },

  sanitizeProductsCoreDeposit(){
    if(!this.products || !this.products.length) return;
    this.products.forEach(p => {
      // Only Car Battery (BT-8009) should have coreDeposit = 2000; all other products should have 0
      if(p.code !== 'BT-8009' && p.id !== 'P07'){
        if(Number(p.coreDeposit) > 0){
          p.coreDeposit = 0;
          if(window.FB && window.FB.fbUpdate && p.id){
            window.FB.fbUpdate(window.FB.COL.products, p.id, { coreDeposit: 0 });
          }
        }
      }
      // If HL-6007 mistakenly had battery OEM/rack data
      if((p.code === 'HL-6007' || p.id === 'P08') && p.oemNo === '28800-YZZ01'){
        p.oemNo = '90981-13058';
        p.rack = 'D-02';
        p.bin = 'B1';
        p.coreDeposit = 0;
        if(window.FB && window.FB.fbUpdate && p.id){
          window.FB.fbUpdate(window.FB.COL.products, p.id, {
            oemNo: '90981-13058',
            rack: 'D-02',
            bin: 'B1',
            coreDeposit: 0
          });
        }
      }
    });
  },

  getShop(id){ return (this.shops || []).find(s => s.id === id); },
  getProd(id){ return (this.products || []).find(p => p.id === id); },
  getCustomer(id){ return (this.customers || []).find(c => c.id === id); },
  getSupplier(id){ return (this.suppliers || []).find(s => s.id === id); }
});

function rerenderIfActive(){
  if(typeof window !== 'undefined' && window.state && window.state.user){
    if(window.state.page === 'billing'){
      if(typeof window.renderGrid === 'function') window.renderGrid();
    } else {
      if(typeof window.render === 'function') window.render();
    }
    if(typeof window.renderNav === 'function') window.renderNav();
  }
}

/* =====================================================
   REAL-TIME CROSS-TAB & CROSS-DEVICE MULTI-TERMINAL SYNC
   ===================================================== */
const _posSyncChannel = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('pos_realtime_sync') : null;
if(_posSyncChannel){
  _posSyncChannel.onmessage = (evt) => {
    if(evt.data?.type === 'db_updated' && window.state?.user){
      if(window.DB && typeof window.DB.loadAllSync === 'function'){
        window.DB.loadAllSync();
      }
      rerenderIfActive();
    }
  };
}

if(typeof window !== 'undefined'){
  window.addEventListener('storage', (evt) => {
    if(evt.key && evt.key.startsWith('pos.localDB.') && window.state?.user){
      if(window.DB && typeof window.DB.loadAllSync === 'function'){
        window.DB.loadAllSync();
      }
      rerenderIfActive();
    }
  });
}

function saveDB(immediate = false){
  if(immediate && typeof DB._persistLocalNow === 'function'){
    DB._persistLocalNow();
  } else {
    DB.persistLocal();
  }
  if(_posSyncChannel){
    try {
      _posSyncChannel.postMessage({ type: 'db_updated', timestamp: Date.now() });
    } catch(e){}
  }
}

window.DB = DB;
window.saveDB = saveDB;

/* =====================================================
   REAL-TIME SHOP-SCOPED LISTENERS & CLEANUP
   ===================================================== */
var _unsubscribers = {};

function stopAllListeners(){
  Object.values(_unsubscribers).forEach(fn => {
    if(typeof fn === 'function') fn();
  });
  _unsubscribers = {};
}

function startPageListeners(page){
  stopAllListeners();

  const shopId = (typeof currentShopId === 'function') ? currentShopId() : null;
  if(!shopId || !window.FB || (window.FB.isPermissionDenied && window.FB.isPermissionDenied())) return;

  const mods = window.FB._getModules ? window.FB._getModules() : null;
  const fsDb = window.FB._getDb ? window.FB._getDb() : null;
  if(!mods?.fsMod || !fsDb) return;
  const { collection, query, where, onSnapshot } = mods.fsMod;

  const watch = (colName, dbKey = colName, processFn = null) => {
    try {
      const q = query(collection(fsDb, colName), where('shopId', '==', shopId));
      _unsubscribers[colName] = onSnapshot(q, snap => {
        const list = snap.docs.map(d => ({ ...d.data(), id: d.id, _docId: d.id }));
        DB[dbKey] = list;
        if(typeof processFn === 'function') processFn(list);
        DB.persistLocal();
        rerenderIfActive();
      }, err => {
        if(err && (err.code === 'permission-denied' || err.message?.includes('permission'))){
          console.warn(`ℹ️ Firestore rules sync pending on ${colName}. Using local cache.`);
        } else {
          console.warn(`Shop listener error on ${colName}:`, err);
        }
        if(colName === 'interchanges' && (!DB.interchanges || !Array.isArray(DB.interchanges))){
          DB.interchanges = [];
        } else if(colName === 'scrapInventory' && (!DB.scrapInventory || !Array.isArray(DB.scrapInventory))){
          DB.scrapInventory = [];
        }
      });
    } catch(e){}
  };

  // Always sync shops
  try {
    _unsubscribers['shops'] = onSnapshot(collection(fsDb, 'shops'), snap => {
      DB.shops = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      DB.persistLocal();
      rerenderIfActive();
    });
  } catch(e){}

  switch(page){
    case 'billing':
    case 'pos':
      watch('products');
      watch('sales');
      watch('customers');
      watch('interchanges');
      break;
    case 'inventory':
    case 'lowstock':
      watch('products');
      break;
    case 'grn':
      watch('products');
      watch('suppliers');
      watch('grns');
      break;
    case 'payables':
      watch('suppliers');
      watch('grns');
      watch('supplierPayments');
      break;
    case 'interchange':
      watch('interchanges');
      watch('products');
      break;
    case 'scrap':
      watch('scrapInventory');
      watch('products');
      break;
    case 'returns':
      watch('returns', 'returns', (list) => {
        list.forEach(ret => {
          if(ret.status === 'approved' && ret.notified === false && (ret.cashierId === state.user?.id || ret.requestedById === state.user?.id) && state.user?.role === 'cashier'){
            if(typeof showReturnNotification === 'function') showReturnNotification(ret);
            ret.notified = true;
            if(window.FB && window.FB.fbUpdate) window.FB.fbUpdate(window.FB.COL.returns, ret.id, { notified: true });
          }
        });
      });
      watch('sales');
      break;
    case 'shifts':
      watch('shifts');
      watch('cashMovements', 'cashMoves');
      break;
    case 'reports':
    case 'dashboard':
      watch('sales');
      watch('products');
      break;
    default:
      watch('products');
      watch('sales');
      break;
  }
}

/* =====================================================
   BOOT MIGRATION: BACKFILL MISSING shopId
   ===================================================== */
async function bootMigration(){
  const migrated = localStorage.getItem('pos.migration.shopId.done');
  if(migrated === 'v1') return;

  // 1. Backfill LocalStorage cache
  try {
    const s = localStorage.getItem(LOCAL_KEY);
    if(s){
      const cached = JSON.parse(s);
      let changed = false;
      const collections = ['products', 'customers', 'suppliers', 'sales', 'grns', 'returns', 'shifts', 'cashMoves', 'payments'];
      collections.forEach(col => {
        if(Array.isArray(cached[col])){
          cached[col].forEach(item => {
            if(!item.shopId){
              item.shopId = 'SHOP-001';
              changed = true;
            }
          });
        }
      });
      if(changed){
        localStorage.setItem(LOCAL_KEY, JSON.stringify(cached));
      }
    }
  } catch(e){}

  // 2. Backfill Firestore documents
  if(typeof migrateOrphanDocumentsToShop === 'function'){
    try {
      await migrateOrphanDocumentsToShop('SHOP-001');
    } catch(e){}
  }

  localStorage.setItem('pos.migration.shopId.done', 'v1');
}

/* =====================================================
   CORE / SCRAP BATTERY INVENTORY HELPER
   ===================================================== */
async function addScrapInventory(item){
  if(!item) return;
  const db = window.DB || {};
  const shopId = (typeof currentShopId === 'function' && currentShopId()) ? currentShopId() : (window.state?.user?.shopId || 'SHOP-001');
  db.scrapInventory = db.scrapInventory || [];

  const existing = db.scrapInventory.find(s => 
    (s.productId === item.productId || (item.productName && s.productName === item.productName)) &&
    (!s.shopId || s.shopId === shopId)
  );

  const qty = Number(item.quantity || 1);
  const dateStr = item.date || (typeof today === 'function' ? today() : new Date().toISOString().slice(0, 10));

  const acquisitionEntry = {
    date: dateStr,
    qty: qty,
    sourceSaleId: item.sourceSaleId || 'MANUAL',
    customerName: item.customerName || 'පාරිභෝගික හුවමාරුව',
    depositPaid: Number(item.depositPaid || 0),
    recordedBy: item.recordedBy || (window.state?.user?.name || 'Staff')
  };

  if(existing){
    existing.quantity = (Number(existing.quantity) || 0) + qty;
    existing.unitScrapValue = Number(existing.unitScrapValue) || 800;
    existing.totalValue = existing.quantity * existing.unitScrapValue;
    existing.acquisitions = existing.acquisitions || [];
    existing.acquisitions.push(acquisitionEntry);
    existing.updatedAt = new Date().toISOString();

    if(window.shopUpdate){
      try {
        await window.shopUpdate('scrapInventory', existing.id, {
          quantity: existing.quantity,
          totalValue: existing.totalValue,
          acquisitions: existing.acquisitions,
          updatedAt: existing.updatedAt
        });
      } catch(e){ console.warn('shopUpdate scrapInventory warning:', e); }
    } else if(window.FB && window.FB.fbUpdate){
      try {
        await window.FB.fbUpdate('scrapInventory', existing.id, {
          quantity: existing.quantity,
          totalValue: existing.totalValue,
          acquisitions: existing.acquisitions,
          updatedAt: existing.updatedAt
        });
      } catch(e){ console.warn('fbUpdate scrapInventory warning:', e); }
    }
  } else {
    const prod = db.getProd ? db.getProd(item.productId) : (db.products || []).find(p => p.id === item.productId);
    const unitRate = Number(item.unitScrapValue || 800);
    const newScrap = {
      id: 'SCR-' + Date.now(),
      shopId: shopId,
      productId: item.productId || 'P-CORE',
      productName: item.productName || prod?.name || 'වාහන බැටරි (Core Battery)',
      category: item.category || 'battery',
      source: item.source || 'customer_exchange',
      quantity: qty,
      unitScrapValue: unitRate,
      totalValue: qty * unitRate,
      acquisitions: [acquisitionEntry],
      disposals: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.scrapInventory.push(newScrap);

    if(window.shopAdd){
      try { await window.shopAdd('scrapInventory', newScrap); } catch(e){ console.warn('shopAdd scrapInventory warning:', e); }
    } else if(window.FB && window.FB.fbAdd){
      try { await window.FB.fbAdd('scrapInventory', newScrap); } catch(e){ console.warn('fbAdd scrapInventory warning:', e); }
    }
  }

  if(typeof db.persistLocal === 'function') db.persistLocal();
}

window.stopAllListeners = stopAllListeners;
window.startPageListeners = startPageListeners;
window.bootMigration = bootMigration;
window.addScrapInventory = addScrapInventory;
if(window.DB) window.DB.addScrapInventory = addScrapInventory;

