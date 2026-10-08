/* =====================================================
   js/db-service.js - Central Data & Real-time Synchronization
   ===================================================== */

var LOCAL_KEY = 'autoparts_pos_db';

function getLocalDB(){
  try {
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
  products: window.INITIAL_PRODUCTS || [],
  customers: window.INITIAL_CUSTOMERS || [],
  suppliers: window.INITIAL_SUPPLIERS || [],
  sales: [],
  grns: [],
  returns: [],
  shifts: [],
  cashMoves: [],
  payments: [],
  counters: { invoice: 1, grn: 1, ret: 1, shift: 1, payment: 1, shop: 1 },

  isFirebaseConnected: false,

  /* ---------- initial load ---------- */
  async loadAll(){
    // First load from localStorage for instant, offline display
    const cached = getLocalDB();
    if(cached){
      if(cached.shop) this.shop = cached.shop;
      if(cached.shops?.length) this.shops = cached.shops;
      if(cached.users?.length){
        this.users = cached.users.map(u => {
          if(!u.permissions || !Array.isArray(u.permissions)){
            u.permissions = (typeof getDefaultPermissionsForRole === 'function')
              ? getDefaultPermissionsForRole(u.role)
              : ['billing','dashboard','customers','lowstock','profile'];
          }
          return u;
        });
      }
      if(cached.products?.length){
        this.products = cached.products.map(p => {
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
      }
      if(cached.customers?.length) this.customers = cached.customers;
      if(cached.suppliers?.length) this.suppliers = cached.suppliers;
      if(cached.sales) this.sales = cached.sales;
      if(cached.grns) this.grns = cached.grns;
      if(cached.returns) this.returns = cached.returns;
      if(cached.shifts) this.shifts = cached.shifts;
      if(cached.cashMoves) this.cashMoves = cached.cashMoves;
      if(cached.payments) this.payments = cached.payments;
      if(cached.counters) this.counters = { ...this.counters, ...cached.counters };
    } else {
      // If completely fresh localStorage, seed with our default initial data
      if(window.INITIAL_SHOPS && (!this.shops || !this.shops.length)) this.shops = window.INITIAL_SHOPS;
      if(window.INITIAL_PRODUCTS && !this.products.length) this.products = window.INITIAL_PRODUCTS;
      if(window.INITIAL_CUSTOMERS && !this.customers.length) this.customers = window.INITIAL_CUSTOMERS;
      if(window.INITIAL_SUPPLIERS && !this.suppliers.length) this.suppliers = window.INITIAL_SUPPLIERS;
      if(window.INITIAL_USERS && !this.users.length) this.users = window.INITIAL_USERS;
      this.persistLocal();
    }

    // Try fetching live data from Firebase (if online/network allowed)
    if(window.FB && (!window.FB.isPermissionDenied || !window.FB.isPermissionDenied())){
      try {
        const [shops, users, products, customers, suppliers, sales, grns,
               returns, shifts, cashMoves, payments, shopDoc] = await Promise.all([
          window.FB.fbGetAll(window.FB.COL.shops),
          window.FB.fbGetAll(window.FB.COL.users),
          window.FB.fbGetAll(window.FB.COL.products),
          window.FB.fbGetAll(window.FB.COL.customers),
          window.FB.fbGetAll(window.FB.COL.suppliers),
          window.FB.fbGetAll(window.FB.COL.sales),
          window.FB.fbGetAll(window.FB.COL.grns),
          window.FB.fbGetAll(window.FB.COL.returns),
          window.FB.fbGetAll(window.FB.COL.shifts),
          window.FB.fbGetAll(window.FB.COL.cashMoves),
          window.FB.fbGetAll(window.FB.COL.payments),
          window.FB.fbGet(window.FB.COL.settings, 'shop')
        ]);

        if(window.FB.isPermissionDenied && window.FB.isPermissionDenied()){
          this.isFirebaseConnected = false;
          return;
        }

        if(shops && shops.length)         this.shops = shops;
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
        if(products && products.length){
          this.products = products;
          this.sanitizeProductsCoreDeposit();
        }
        if(customers && customers.length) this.customers = customers;
        if(suppliers && suppliers.length) this.suppliers = suppliers;
        if(sales && sales.length)         this.sales = sales;
        if(grns && grns.length)           this.grns = grns;
        if(returns && returns.length)     this.returns = returns;
        if(shifts && shifts.length)       this.shifts = shifts;
        if(cashMoves && cashMoves.length) this.cashMoves = cashMoves;
        if(payments && payments.length)   this.payments = payments;
        if(shopDoc)                       this.shop = shopDoc;

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

  /* ---------- real-time listeners for multi-terminal sync ---------- */
  watch(){
    if(!window.FB || !this.isFirebaseConnected) return;
    if(window.FB.isPermissionDenied && window.FB.isPermissionDenied()) return;

    window.FB.fbWatch(window.FB.COL.shops, list => {
      if(list && list.length){
        this.shops = list;
        this.recalculateCounters();
        this.persistLocal();

        // If current user's shop was updated
        if(window.state && window.state.user){
          const targetShopId = window.state.user.role === 'superadmin'
            ? (window.state.activeShopId || (window.state.activeShop && window.state.activeShop.id))
            : window.state.user.shopId;
          const myShop = list.find(s => s.id === targetShopId) || (window.state.user.role === 'superadmin' ? list[0] : null);
          if(myShop){
            window.state.activeShop = myShop;
            window.state.activeShopId = myShop.id;
            this.shop = myShop;
            if(typeof updateBrandName === 'function') updateBrandName();
          }
          if(typeof updateTopBarShopSwitcher === 'function') updateTopBarShopSwitcher();
        }

        rerenderIfActive();
      }
    });

    window.FB.fbWatch(window.FB.COL.products, list => {
      if(list && list.length){
        this.products = list;
        this.persistLocal();
        rerenderIfActive();
      }
    });

    window.FB.fbWatch(window.FB.COL.sales, list => {
      if(list && list.length){
        this.sales = list;
        this.recalculateCounters();
        this.persistLocal();
        rerenderIfActive();
      }
    });

    window.FB.fbWatch(window.FB.COL.customers, list => {
      if(list && list.length){
        this.customers = list;
        this.persistLocal();
        rerenderIfActive();
      }
    });

    window.FB.fbWatch(window.FB.COL.suppliers, list => {
      if(list && list.length){
        this.suppliers = list;
        this.persistLocal();
        rerenderIfActive();
      }
    });

    window.FB.fbWatch(window.FB.COL.shifts, list => {
      if(list && list.length){
        this.shifts = list;
        this.persistLocal();
        if(typeof updateShiftIndicator === 'function') updateShiftIndicator();
        rerenderIfActive();
      }
    });

    window.FB.fbWatch(window.FB.COL.returns, list => {
      if(list){
        this.returns = list;
        this.persistLocal();

        // Check for newly approved returns belonging to the active cashier
        list.forEach(ret => {
          if(ret.status === 'approved'
             && ret.notified === false
             && (ret.cashierId === state.user?.id || ret.requestedById === state.user?.id)
             && state.user?.role === 'cashier'){

            // Trigger real-time cashier notification
            if(typeof showReturnNotification === 'function'){
              showReturnNotification(ret);
            }

            // Mark as notified in Firestore
            ret.notified = true;
            if(window.FB && window.FB.fbUpdate){
              window.FB.fbUpdate(window.FB.COL.returns, ret.id, { notified: true });
            }
          }
        });

        rerenderIfActive();
      }
    });

    window.FB.fbWatch(window.FB.COL.cashMoves, list => {
      if(list && list.length){
        this.cashMoves = list;
        this.persistLocal();
        if(typeof updateShiftIndicator === 'function') updateShiftIndicator();
        rerenderIfActive();
      }
    });

    window.FB.fbWatch(window.FB.COL.payments, list => {
      if(list && list.length){
        this.payments = list;
        this.persistLocal();
        rerenderIfActive();
      }
    });
  },

  persistLocal(){
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify({
        shop: this.shop,
        shops: this.shops,
        users: this.users,
        products: this.products,
        customers: this.customers,
        suppliers: this.suppliers,
        sales: this.sales,
        grns: this.grns,
        returns: this.returns,
        shifts: this.shifts,
        cashMoves: this.cashMoves,
        payments: this.payments,
        counters: this.counters
      }));
    } catch(e){}
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
    if(typeof window.render === 'function') window.render();
    if(typeof window.renderNav === 'function') window.renderNav();
  }
}

function saveDB(){
  DB.persistLocal();
}

window.DB = DB;
window.saveDB = saveDB;
