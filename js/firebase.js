/* =====================================================
   js/firebase.js - Firebase Backend with Permission & Offline Handling
   ===================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyAI9BAssO9U7mIzVZ2YKqBBSJ8lb00y_mo",
  authDomain: "vehicles-7ad89.firebaseapp.com",
  projectId: "vehicles-7ad89",
  storageBucket: "vehicles-7ad89.firebasestorage.app",
  messagingSenderId: "399551434839",
  appId: "1:399551434839:web:d1327680bcd973ffd6d312"
};

const COL = {
  shops:     'shops',
  users:     'users',
  products:  'products',
  customers: 'customers',
  suppliers: 'suppliers',
  sales:     'sales',
  grns:      'grns',
  returns:   'returns',
  shifts:    'shifts',
  cashMoves: 'cashMovements',   /* Petty Cash */
  payments:  'creditPayments',  /* Store Credit settle */
  supplierPayments: 'supplierPayments', /* Supplier Payables */
  settings:  'settings',
  counters:  'counters'
};

let _fbApp = null;
let _fbDb = null;
let _fbAuth = null;
let _fbReady = false;
let _fbModules = null;
let _fbPermissionDenied = false;

function checkPermissionError(err, operationName){
  if(err && (err.code === 'permission-denied' || (err.message && err.message.toLowerCase().includes('permission')))){
    console.warn(`⚠️ Firestore permission denied on ${operationName}:`, err.message);
    return true;
  }
  return false;
}

async function initFirebase(){
  if(_fbReady) return true;
  try {
    const [appMod, fsMod, authMod] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js"),
      import("https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js")
    ]);
    _fbApp = appMod.initializeApp(firebaseConfig);
    _fbDb = fsMod.getFirestore(_fbApp);
    _fbAuth = authMod.getAuth(_fbApp);
    _fbModules = { appMod, fsMod, authMod };
    _fbReady = true;
    _fbPermissionDenied = false;
    return true;
  } catch(e) {
    console.warn('Firebase network / CORS restriction detected (local mode active).', e);
    return false;
  }
}

/* =====================================================
   FIREBASE AUTH HELPERS
   ===================================================== */
async function fbSignIn(email, password){
  if(!_fbReady) await initFirebase();
  if(!_fbAuth || !_fbModules?.authMod) throw new Error('Firebase Auth unavailable');
  const res = await _fbModules.authMod.signInWithEmailAndPassword(_fbAuth, email, password);
  _fbPermissionDenied = false;
  return res;
}

async function fbSignOut(){
  if(!_fbReady) await initFirebase();
  if(!_fbAuth || !_fbModules?.authMod) return;
  return await _fbModules.authMod.signOut(_fbAuth);
}

async function fbUpdateUserPassword(newPassword){
  if(!_fbReady) await initFirebase();
  if(!_fbAuth || !_fbModules?.authMod || !_fbAuth.currentUser) throw new Error('No authenticated user session');
  return await _fbModules.authMod.updatePassword(_fbAuth.currentUser, newPassword);
}

async function createUserWithoutLogout(email, password, userDoc){
  if(!_fbReady) await initFirebase();
  if(!_fbReady || !_fbModules?.appMod || !_fbModules?.authMod || !_fbModules?.fsMod){
    return { ok: false, error: new Error('Firebase services are not available.') };
  }

  const { initializeApp, deleteApp } = _fbModules.appMod;
  const { getAuth, createUserWithEmailAndPassword, signOut } = _fbModules.authMod;
  const { doc, setDoc } = _fbModules.fsMod;

  // Secondary Firebase App instance ensures primary Superadmin/Admin session remains untouched
  const secondaryAppName = 'creator-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  let cleanEmail = (email || '').trim().toLowerCase();
  if(!cleanEmail.includes('@')){
    cleanEmail = `${cleanEmail}@autoparts.local`;
  }

  try {
    secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);

    // 1. Create Firebase Auth user in secondary app
    const credential = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, password);
    const uid = credential.user.uid;

    // 2. Prepare user document data
    const db = window.DB || {};
    const createdBy = (window.state && window.state.user) ? (window.state.user.authUid || window.state.user.id) : 'system';
    const userData = {
      ...userDoc,
      id: uid,
      authUid: uid,
      email: cleanEmail,
      active: true,
      locked: false,
      needsPasswordChange: true,
      createdAt: new Date().toISOString(),
      createdBy
    };

    // 3. Write Firestore document via primary Firestore instance (authenticated as Superadmin/Admin)
    await setDoc(doc(_fbDb, 'users', uid), userData);

    // 4. Sign out secondary auth
    try {
      await signOut(secondaryAuth);
    } catch(_){}

    // 5. Delete secondary app instance
    try {
      await deleteApp(secondaryApp);
      secondaryApp = null;
    } catch(_){}

    // 6. Update local in-memory DB and cache
    if(!db.users) db.users = [];
    const idx = db.users.findIndex(x => x.id === uid || x.authUid === uid);
    if(idx >= 0){
      db.users[idx] = { ...db.users[idx], ...userData };
    } else {
      db.users.push(userData);
    }
    if(window.DB && typeof window.DB.persistLocal === 'function'){
      window.DB.persistLocal();
    } else if(typeof saveDB === 'function'){
      saveDB();
    }

    return { ok: true, uid, user: userData };
  } catch(err){
    if(secondaryApp){
      try {
        const { deleteApp } = _fbModules.appMod;
        await deleteApp(secondaryApp);
      } catch(_){}
    }
    console.error('Error in createUserWithoutLogout:', err);
    return { ok: false, error: err };
  }
}

async function fbCreateUser(email, password, userDoc){
  return await createUserWithoutLogout(email, password, userDoc);
}

/* =====================================================
   ATOMIC MULTI-DEVICE TRANSACTION: INVOICE COUNTER + STOCK DECREMENT
   Phase 5: Concurrency Control (Zero Collisions + Zero Overselling)
   ===================================================== */
async function executeSaleTransaction(saleData, cartItems, customerUpdate = null){
  if(!_fbReady) await initFirebase();

  const isOnline = typeof navigator !== 'undefined' && navigator.onLine && _fbReady && _fbDb && _fbModules?.fsMod;
  if(!isOnline){
    return executeSaleOffline(saleData, cartItems, customerUpdate);
  }

  const { runTransaction, doc } = _fbModules.fsMod;
  const shopId = saleData.shopId || (window.state?.user?.shopId || 'SHOP-001');

  // Aggregate quantities by product ID in case cart contains duplicate line items
  const itemMap = new Map();
  for(const it of (cartItems || [])){
    const pid = it.pid || it.id;
    if(!pid) continue;
    const prev = itemMap.get(pid);
    if(prev){
      prev.qty += Number(it.qty || 1);
    } else {
      itemMap.set(pid, { ...it, pid, qty: Number(it.qty || 1) });
    }
  }
  const uniqueItems = Array.from(itemMap.values());

  try {
    const txResult = await runTransaction(_fbDb, async (transaction) => {
      // ───────────────────────────────────────────────
      // 1. ATOMIC READS (Firestore requires ALL reads first!)
      // ───────────────────────────────────────────────

      // 1.1 Read Atomic Invoice Counter for this shop
      const counterRef = doc(_fbDb, 'counters', `invoices_${shopId}`);
      const counterDoc = await transaction.get(counterRef);

      let nextNum = 1;
      if(counterDoc.exists()){
        nextNum = (Number(counterDoc.data().current) || 0) + 1;
      } else {
        // Bootstrap counter from existing sales in local DB or highest invoice number
        const localMax = (window.DB?.sales || [])
          .filter(s => (s.shopId === shopId || !s.shopId) && s.no)
          .map(s => {
            const m = String(s.no).match(/\d+/);
            return m ? parseInt(m[0], 10) : 0;
          })
          .reduce((m, n) => Math.max(m, n), 0);
        const seedVal = Math.max(localMax, Number(window.DB?.counters?.invoice || 0));
        nextNum = (seedVal || 0) + 1;
      }

      const invoiceNo = 'INV-' + String(nextNum).padStart(4, '0');

      // 1.2 Read & Atomically Validate Product Stocks in Cloud
      const productUpdates = [];
      for(const it of uniqueItems){
        const prodRef = doc(_fbDb, 'products', it.pid);
        const prodSnap = await transaction.get(prodRef);
        if(!prodSnap.exists()){
          const err = new Error(`භාණ්ඩය Cloud Database තුළ හමු නොවීය (Product not found): ${it.name || it.pid}`);
          err.code = 'PRODUCT_NOT_FOUND';
          throw err;
        }

        const prodData = prodSnap.data();
        const availableQty = Number(prodData.qty != null ? prodData.qty : 0);
        const requestedQty = Number(it.qty || 1);

        if(availableQty < requestedQty){
          const err = new Error(
            `තොග ප්‍රමාණවත් නොවේ (Insufficient stock)! "${prodData.name || it.name}" සඳහා Cloud හි ඉතිරිව ඇත්තේ ${availableQty}ක් පමණි (ඉල්ලූ ප්‍රමාණය: ${requestedQty}).`
          );
          err.code = 'OUT_OF_STOCK';
          err.productId = it.pid;
          err.productName = prodData.name || it.name;
          err.availableQty = availableQty;
          err.requestedQty = requestedQty;
          throw err;
        }

        productUpdates.push({
          ref: prodRef,
          id: it.pid,
          name: prodData.name || it.name,
          currentQty: availableQty,
          newQty: availableQty - requestedQty,
          item: it
        });
      }

      // 1.3 Read Customer Document if customer update required
      let custSnap = null;
      let custRef = null;
      if(customerUpdate && customerUpdate.id){
        custRef = doc(_fbDb, 'customers', customerUpdate.id);
        custSnap = await transaction.get(custRef);
      }

      // ───────────────────────────────────────────────
      // 2. ATOMIC WRITES (Execute writes after all reads)
      // ───────────────────────────────────────────────

      // 2.1 Update Counter in Firestore
      transaction.set(counterRef, {
        shopId: shopId,
        current: nextNum,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // 2.2 Decrement Product Stock Atomically
      for(const p of productUpdates){
        transaction.update(p.ref, {
          qty: p.newQty,
          updatedAt: new Date().toISOString()
        });
      }

      // 2.3 Write Sale Record
      const finalSale = {
        ...saleData,
        id: saleData.id || ('S' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)),
        no: invoiceNo,
        shopId,
        createdAt: new Date().toISOString()
      };
      const saleRef = doc(_fbDb, 'sales', finalSale.id);
      transaction.set(saleRef, finalSale);

      // 2.4 Update Customer Loyalty & Credit if applicable
      if(custRef && custSnap && custSnap.exists()){
        const cData = custSnap.data();
        const newPoints = (cData.points || 0) + (customerUpdate.pointsEarned || 0);
        const newCredit = (cData.creditBalance || 0) + (customerUpdate.creditAdded || 0);
        transaction.update(custRef, {
          points: newPoints,
          creditBalance: newCredit,
          updatedAt: new Date().toISOString()
        });
      }

      return {
        ok: true,
        invoiceNo,
        nextNum,
        sale: finalSale,
        updatedProducts: productUpdates.map(p => ({ id: p.id, newQty: p.newQty })),
        offline: false
      };
    });

    return txResult;
  } catch(err){
    console.warn('❌ Sale Transaction failed / aborted:', err);
    return {
      ok: false,
      code: err.code || 'TRANSACTION_FAILED',
      message: err.message || 'ගනුදෙනුව අසාර්ථක විය',
      productId: err.productId,
      productName: err.productName,
      availableQty: err.availableQty,
      requestedQty: err.requestedQty
    };
  }
}

// Offline fallback for sales
function executeSaleOffline(saleData, cartItems, customerUpdate = null){
  const db = window.DB || {};
  const shopId = saleData.shopId || (window.state?.user?.shopId || 'SHOP-001');

  // Verify local stock
  for(const it of (cartItems || [])){
    const pid = it.pid || it.id;
    const p = db.getProd ? db.getProd(pid) : (db.products || []).find(x => x.id === pid);
    if(p && (p.qty || 0) < (it.qty || 1)){
      return {
        ok: false,
        code: 'OUT_OF_STOCK',
        message: `ලෝකල් තොග ප්‍රමාණවත් නොවේ: "${p.name || it.name}" ඉතිරිව ඇත්තේ ${p.qty || 0} පමණි.`,
        productId: pid,
        productName: p.name || it.name,
        availableQty: p.qty || 0,
        requestedQty: it.qty || 1
      };
    }
  }

  // Generate guaranteed unique offline invoice number
  const randTag = Math.random().toString(36).substring(2, 6).toUpperCase();
  const offlineNo = `INV-OFF-${shopId.replace('SHOP-','S')}-${Date.now().toString(36).toUpperCase()}-${randTag}`;

  const finalSale = {
    ...saleData,
    id: saleData.id || ('S' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)),
    no: offlineNo,
    shopId,
    _offline: true,
    createdAt: new Date().toISOString()
  };

  const updatedProducts = [];
  // Decrement local stock
  for(const it of (cartItems || [])){
    const pid = it.pid || it.id;
    const p = db.getProd ? db.getProd(pid) : (db.products || []).find(x => x.id === pid);
    if(p){
      p.qty = Math.max(0, (p.qty || 0) - (it.qty || 1));
      updatedProducts.push({ id: p.id, newQty: p.qty });
      if(window.Offline && typeof window.Offline.enqueue === 'function'){
        window.Offline.enqueue('products', 'update', { qty: p.qty }, p.id);
      }
    }
  }

  // Enqueue sale
  if(window.Offline && typeof window.Offline.enqueue === 'function'){
    window.Offline.enqueue('sales', 'add', finalSale, finalSale.id);
  }

  return {
    ok: true,
    invoiceNo: offlineNo,
    nextNum: (db.counters?.invoice || 0) + 1,
    sale: finalSale,
    updatedProducts,
    offline: true
  };
}

/* =====================================================
   GENERIC CRUD HELPERS
   ===================================================== */
async function fbGetAll(colName){
  if(!_fbReady){
    const ok = await initFirebase();
    if(!ok || !_fbDb) return [];
  }
  try {
    const { collection, getDocs } = _fbModules.fsMod;
    const snap = await getDocs(collection(_fbDb, colName));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) {
    checkPermissionError(e, `fbGetAll(${colName})`);
    return [];
  }
}

async function fbGet(colName, id){
  if(!_fbReady){
    const ok = await initFirebase();
    if(!ok || !_fbDb) return null;
  }
  try {
    const { doc, getDoc } = _fbModules.fsMod;
    const s = await getDoc(doc(_fbDb, colName, id));
    return s.exists() ? { id: s.id, ...s.data() } : null;
  } catch(e) {
    checkPermissionError(e, `fbGet(${colName}, ${id})`);
    return null;
  }
}

async function fbGetDirect(colName, id){
  if(!_fbReady) await initFirebase();
  if(!_fbReady || !_fbDb || !_fbModules?.fsMod) return null;
  try {
    const { doc, getDoc } = _fbModules.fsMod;
    const s = await getDoc(doc(_fbDb, colName, id));
    return s.exists() ? { id: s.id, ...s.data() } : null;
  } catch(e){
    return null;
  }
}

/* =====================================================
   DIRECT FIRESTORE CRUD HELPERS (Used for live writes & sync)
   ===================================================== */
async function fbAddDirect(colName, data){
  if(!_fbReady) await initFirebase();
  if(!_fbReady || !_fbDb || !_fbModules?.fsMod) throw new Error('Firebase not connected');
  const { collection, addDoc, doc, setDoc, serverTimestamp } = _fbModules.fsMod;
  const clean = { ...data };
  delete clean._offline;
  if(clean.id && typeof clean.id === 'string' && clean.id.startsWith('local_')){
    await setDoc(doc(_fbDb, colName, clean.id), {
      ...clean,
      createdAt: serverTimestamp()
    }, { merge: true });
    return clean.id;
  }
  const ref = await addDoc(collection(_fbDb, colName), {
    ...clean,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

async function fbSetDirect(colName, id, data){
  if(!_fbReady) await initFirebase();
  if(!_fbReady || !_fbDb || !_fbModules?.fsMod) throw new Error('Firebase not connected');
  const { doc, setDoc } = _fbModules.fsMod;
  const clean = { ...data };
  delete clean._offline;
  await setDoc(doc(_fbDb, colName, id), clean, { merge: true });
  return true;
}

async function fbUpdateDirect(colName, id, data){
  if(!_fbReady) await initFirebase();
  if(!_fbReady || !_fbDb || !_fbModules?.fsMod) throw new Error('Firebase not connected');
  const { doc, updateDoc, setDoc } = _fbModules.fsMod;
  const clean = { ...data };
  delete clean._offline;
  try {
    await updateDoc(doc(_fbDb, colName, id), clean);
  } catch(e) {
    await setDoc(doc(_fbDb, colName, id), clean, { merge: true });
  }
  return true;
}

async function fbDeleteDirect(colName, id){
  if(!_fbReady) await initFirebase();
  if(!_fbReady || !_fbDb || !_fbModules?.fsMod) throw new Error('Firebase not connected');
  const { doc, deleteDoc } = _fbModules.fsMod;
  await deleteDoc(doc(_fbDb, colName, id));
  return true;
}

/* =====================================================
   OFFLINE-SAFE WRAPPERS (Try online first, fallback to queue)
   ===================================================== */
async function fbAdd(colName, data){
  // 1. Try online first if connected
  if(typeof navigator !== 'undefined' && navigator.onLine){
    try {
      return await fbAddDirect(colName, data);
    } catch(e) {
      console.warn(`fbAdd(${colName}) online failed, queueing offline:`, e.message);
      checkPermissionError(e, `fbAdd(${colName})`);
    }
  }

  // 2. Offline: generate local ID and enqueue
  const localId = data.id || ('local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
  const docData = { ...data, id: localId, _offline: true };

  if(window.Offline && typeof window.Offline.enqueue === 'function'){
    window.Offline.enqueue(colName, 'add', docData, localId);
  }

  // Reflect in local in-memory DB immediately
  if(window.DB && window.DB[colName] && Array.isArray(window.DB[colName])){
    const exists = window.DB[colName].find(x => x.id === localId);
    if(!exists){
      window.DB[colName].push(docData);
    }
  }
  if(window.DB && typeof window.DB.persistLocal === 'function'){
    window.DB.persistLocal();
  }

  return localId;
}

async function fbSet(colName, id, data){
  if(typeof navigator !== 'undefined' && navigator.onLine){
    try {
      return await fbSetDirect(colName, id, data);
    } catch(e) {
      console.warn(`fbSet(${colName}) online failed, queueing offline:`, e.message);
      checkPermissionError(e, `fbSet(${colName}, ${id})`);
    }
  }

  if(window.Offline && typeof window.Offline.enqueue === 'function'){
    window.Offline.enqueue(colName, 'set', data, id);
  }

  if(window.DB && window.DB[colName] && Array.isArray(window.DB[colName])){
    const item = window.DB[colName].find(x => x.id === id);
    if(item) Object.assign(item, data);
    else window.DB[colName].push({ ...data, id });
  }
  if(window.DB && typeof window.DB.persistLocal === 'function'){
    window.DB.persistLocal();
  }

  return true;
}

async function fbUpdate(colName, id, data){
  if(typeof navigator !== 'undefined' && navigator.onLine){
    try {
      return await fbUpdateDirect(colName, id, data);
    } catch(e) {
      console.warn(`fbUpdate(${colName}) online failed, queueing offline:`, e.message);
      checkPermissionError(e, `fbUpdate(${colName}, ${id})`);
    }
  }

  if(window.Offline && typeof window.Offline.enqueue === 'function'){
    window.Offline.enqueue(colName, 'update', data, id);
  }

  if(window.DB && window.DB[colName] && Array.isArray(window.DB[colName])){
    const item = window.DB[colName].find(x => x.id === id);
    if(item) Object.assign(item, data);
  }
  if(window.DB && typeof window.DB.persistLocal === 'function'){
    window.DB.persistLocal();
  }

  return true;
}

async function fbDelete(colName, id){
  if(typeof navigator !== 'undefined' && navigator.onLine){
    try {
      return await fbDeleteDirect(colName, id);
    } catch(e) {
      console.warn(`fbDelete(${colName}) online failed, queueing offline:`, e.message);
      checkPermissionError(e, `fbDelete(${colName}, ${id})`);
    }
  }

  if(window.Offline && typeof window.Offline.enqueue === 'function'){
    window.Offline.enqueue(colName, 'delete', null, id);
  }

  if(window.DB && window.DB[colName] && Array.isArray(window.DB[colName])){
    window.DB[colName] = window.DB[colName].filter(x => x.id !== id);
  }
  if(window.DB && typeof window.DB.persistLocal === 'function'){
    window.DB.persistLocal();
  }

  return true;
}

function fbWatch(colName, callback){
  if(_fbPermissionDenied || !_fbReady || !_fbDb) return () => {};
  try {
    const { collection, onSnapshot } = _fbModules.fsMod;
    return onSnapshot(collection(_fbDb, colName), snap => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => {
      checkPermissionError(err, `fbWatch(${colName})`);
    });
  } catch(e) {
    return () => {};
  }
}

function isPermissionDenied(){
  return _fbPermissionDenied;
}

/* =====================================================
   MULTI-TENANT STRICT SHOP ISOLATION HELPERS
   ===================================================== */
function currentShopId(){
  if(!window.state || !window.state.user) return null;
  if(window.state.user.role === 'superadmin'){
    return window.state.activeShopId 
        || (window.state.activeShop && window.state.activeShop.id) 
        || null;
  }
  return window.state.user.shopId || null;
}

function shopQuery(colName){
  const shopId = currentShopId();
  if(!shopId) throw new Error('No active shop');
  if(!_fbReady || !_fbDb || !_fbModules?.fsMod) return null;
  const { collection, query, where } = _fbModules.fsMod;
  return query(
    collection(_fbDb, colName),
    where('shopId', '==', shopId)
  );
}

async function shopAdd(colName, data){
  const shopId = currentShopId();
  if(!shopId) throw new Error('No active shop');
  return await fbAdd(colName, {
    ...data,
    shopId
  });
}

async function shopUpdate(colName, id, data){
  const shopId = currentShopId();
  return await fbUpdate(colName, id, {
    ...data,
    ...(shopId ? { shopId } : {})
  });
}

async function migrateOrphanDocumentsToShop(defaultShopId = 'SHOP-001'){
  if(_fbPermissionDenied) return;
  if(!_fbReady){
    const ok = await initFirebase();
    if(!ok || !_fbDb) return;
  }
  try {
    const { collection, getDocs, updateDoc, doc } = _fbModules.fsMod;
    const collections = [
      'products', 'customers', 'suppliers', 'sales',
      'grns', 'returns', 'shifts', 'cashMovements', 'creditPayments'
    ];
    let updatedCount = 0;
    for(const colName of collections){
      try {
        const snap = await getDocs(collection(_fbDb, colName));
        for(const d of snap.docs){
          const data = d.data();
          if(!data.shopId){
            await updateDoc(doc(_fbDb, colName, d.id), { shopId: defaultShopId });
            updatedCount++;
          }
        }
      } catch(err){
        checkPermissionError(err, `migration(${colName})`);
      }
    }
    if(updatedCount > 0){
      console.log(`✅ shopId migration complete: ${updatedCount} documents updated.`);
    }
  } catch(e){}
}

window.currentShopId = currentShopId;
window.shopQuery = shopQuery;
window.shopAdd = shopAdd;
window.shopUpdate = shopUpdate;
window.migrateOrphanDocumentsToShop = migrateOrphanDocumentsToShop;

window.fbGetDirect = fbGetDirect;
window.fbAddDirect = fbAddDirect;
window.fbSetDirect = fbSetDirect;
window.fbUpdateDirect = fbUpdateDirect;
window.fbDeleteDirect = fbDeleteDirect;
window.fbSignIn = fbSignIn;
window.fbSignOut = fbSignOut;
window.fbCreateUser = fbCreateUser;
window.createUserWithoutLogout = createUserWithoutLogout;

window.FB = {
  COL,
  initFirebase,
  fbGetAll,
  fbGet,
  fbGetDirect,
  fbAdd,
  fbSet,
  fbUpdate,
  fbDelete,
  fbAddDirect,
  fbSetDirect,
  fbUpdateDirect,
  fbDeleteDirect,
  fbWatch,
  isPermissionDenied,
  resetPermissionDenied: () => { _fbPermissionDenied = false; },
  currentShopId,
  shopQuery,
  shopAdd,
  shopUpdate,
  getAuth: () => _fbAuth,
  getAuthModule: () => _fbModules?.authMod,
  auth: () => _fbAuth,
  signIn: fbSignIn,
  signOut: fbSignOut,
  updatePassword: fbUpdateUserPassword,
  createUser: createUserWithoutLogout,
  createUserWithoutLogout: createUserWithoutLogout,
  executeSaleTransaction,
  executeSaleOffline,
  _getModules: () => _fbModules,
  _getDb: () => _fbDb
};

window.executeSaleTransaction = executeSaleTransaction;
