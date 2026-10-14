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
  interchanges: 'interchanges',         /* Part Interchange */
  scrapInventory: 'scrapInventory',     /* Core Scrap Batteries */
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
    try {
      if(authMod.setPersistence && authMod.browserSessionPersistence){
        await authMod.setPersistence(_fbAuth, authMod.browserSessionPersistence);
      }
    } catch(persErr){}
    _fbModules = { appMod, fsMod, authMod };
    _fbReady = true;
    _fbPermissionDenied = false;
    return true;
  } catch(e) {
    console.warn('Firebase network / CORS restriction detected (local mode active).', e);
    return false;
  }
}

async function ensureFirebaseAuth(){
  if(!_fbReady) await initFirebase();
  if(!_fbAuth) return null;
  if(_fbAuth.currentUser) return _fbAuth.currentUser;
  if(!_fbModules?.authMod?.onAuthStateChanged) return null;
  return new Promise(resolve => {
    try {
      const unsub = _fbModules.authMod.onAuthStateChanged(_fbAuth, user => {
        try { unsub(); } catch(_){}
        resolve(user);
      });
      setTimeout(() => resolve(_fbAuth?.currentUser || null), 2500);
    } catch(e){
      resolve(null);
    }
  });
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
  // If clean.id is provided, always use setDoc so doc ID in Firestore matches clean.id 1:1!
  if(clean.id && typeof clean.id === 'string'){
    await setDoc(doc(_fbDb, colName, clean.id), {
      ...clean,
      createdAt: clean.createdAt || serverTimestamp()
    }, { merge: true });
    return clean.id;
  }
  const ref = await addDoc(collection(_fbDb, colName), {
    ...clean,
    createdAt: serverTimestamp()
  });
  clean.id = ref.id;
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
  const { doc, updateDoc, setDoc, collection, query, where, getDocs } = _fbModules.fsMod;
  const clean = { ...data };
  delete clean._offline;
  try {
    await updateDoc(doc(_fbDb, colName, id), clean);
    return true;
  } catch(e) {
    // If doc not found by id, check if doc exists with field id == id
    try {
      const snap = await getDocs(query(collection(_fbDb, colName), where('id', '==', id)));
      if(!snap.empty){
        for(const d of snap.docs){
          await updateDoc(doc(_fbDb, colName, d.id), clean);
        }
        return true;
      }
    } catch(_){}
    await setDoc(doc(_fbDb, colName, id), clean, { merge: true });
  }
  return true;
}

async function fbDeleteDirect(colName, id){
  if(!_fbReady) await initFirebase();
  if(!_fbReady || !_fbDb || !_fbModules?.fsMod) throw new Error('Firebase not connected');
  const { doc, deleteDoc, collection, query, where, getDocs } = _fbModules.fsMod;
  if(!id) return true;

  let permErr = null;

  // 1. Direct delete by ID
  try {
    await deleteDoc(doc(_fbDb, colName, id));
  } catch(e){
    if(e && (e.code === 'permission-denied' || e.message?.includes('permission'))){
      permErr = e;
    }
  }

  // 2. Query delete if document was created with an auto-gen Firestore doc ID
  try {
    const q1 = query(collection(_fbDb, colName), where('id', '==', id));
    const s1 = await getDocs(q1);
    for(const d of s1.docs){
      if(d.id !== id){
        try {
          await deleteDoc(doc(_fbDb, colName, d.id));
        } catch(e2){
          if(e2 && (e2.code === 'permission-denied' || e2.message?.includes('permission'))){
            permErr = e2;
          }
        }
      }
    }
  } catch(e){
    if(e && (e.code === 'permission-denied' || e.message?.includes('permission'))){
      permErr = e;
    }
  }

  // 3. For returns, also delete by 'no' (e.g. RET-0002)
  if(colName === 'returns' || colName === COL.returns){
    try {
      const q2 = query(collection(_fbDb, colName), where('no', '==', id));
      const s2 = await getDocs(q2);
      for(const d of s2.docs){
        try {
          await deleteDoc(doc(_fbDb, colName, d.id));
        } catch(e3){
          if(e3 && (e3.code === 'permission-denied' || e3.message?.includes('permission'))){
            permErr = e3;
          }
        }
      }
    } catch(e){
      if(e && (e.code === 'permission-denied' || e.message?.includes('permission'))){
        permErr = e;
      }
    }
  }

  // 4. For products, also check by 'code' (e.g. BT-80010)
  if(colName === 'products' || colName === COL.products){
    try {
      const q3 = query(collection(_fbDb, colName), where('code', '==', id));
      const s3 = await getDocs(q3);
      for(const d of s3.docs){
        try {
          await deleteDoc(doc(_fbDb, colName, d.id));
        } catch(e4){
          if(e4 && (e4.code === 'permission-denied' || e4.message?.includes('permission'))){
            permErr = e4;
          }
        }
      }
    } catch(e){
      if(e && (e.code === 'permission-denied' || e.message?.includes('permission'))){
        permErr = e;
      }
    }
  }

  if(permErr) throw permErr;
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
      const isPerm = checkPermissionError(e, `fbSet(${colName}, ${id})`);
      if(isPerm){
        console.warn(`fbSet(${colName}) permission denied, saving locally without offline queue:`, e.message);
        if(window.DB && window.DB[colName] && Array.isArray(window.DB[colName])){
          const item = window.DB[colName].find(x => x.id === id);
          if(item) Object.assign(item, data);
          else window.DB[colName].push({ ...data, id });
        }
        if(window.DB && typeof window.DB.persistLocal === 'function') window.DB.persistLocal();
        return false;
      }
      console.warn(`fbSet(${colName}) online failed, queueing offline:`, e.message);
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
      const isPerm = checkPermissionError(e, `fbUpdate(${colName}, ${id})`);
      if(isPerm){
        console.warn(`fbUpdate(${colName}) permission denied, saving locally without offline queue:`, e.message);
        if(window.DB && window.DB[colName] && Array.isArray(window.DB[colName])){
          const item = window.DB[colName].find(x => x.id === id);
          if(item) Object.assign(item, data);
        }
        if(window.DB && typeof window.DB.persistLocal === 'function') window.DB.persistLocal();
        return false;
      }
      console.warn(`fbUpdate(${colName}) online failed, queueing offline:`, e.message);
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
  if(!id) return true;

  // 1. Purge any pending sync queue entries for this item so offline sync never re-adds it!
  try {
    if(window.Offline && Array.isArray(window.Offline.queue)){
      window.Offline.queue = window.Offline.queue.filter(q => 
        !(q.collection === colName && (q.docId === id || (q.data && (q.data.id === id || q.data.no === id || q.data.code === id))))
      );
      window.Offline.persist();
    }
    const rawQ = localStorage.getItem('pos.syncQueue');
    if(rawQ){
      const parsedQ = JSON.parse(rawQ);
      if(Array.isArray(parsedQ)){
        const filteredQ = parsedQ.filter(q => 
          !(q.collection === colName && (q.docId === id || (q.data && (q.data.id === id || q.data.no === id || q.data.code === id))))
        );
        localStorage.setItem('pos.syncQueue', JSON.stringify(filteredQ));
      }
    }
  } catch(_){}

  if(typeof navigator !== 'undefined' && navigator.onLine){
    try {
      return await fbDeleteDirect(colName, id);
    } catch(e) {
      const isPerm = checkPermissionError(e, `fbDelete(${colName}, ${id})`);
      if(isPerm){
        console.warn(`fbDelete(${colName}) permission denied:`, e.message);
        if(window.DB && window.DB[colName] && Array.isArray(window.DB[colName])){
          window.DB[colName] = window.DB[colName].filter(x => x.id !== id && x._docId !== id && x.no !== id && x.code !== id);
        }
        if(window.DB && typeof window.DB.persistLocal === 'function') window.DB.persistLocal();
        return false;
      }
      console.warn(`fbDelete(${colName}) online failed, queueing offline:`, e.message);
    }
  }

  if(window.Offline && typeof window.Offline.enqueue === 'function'){
    window.Offline.enqueue(colName, 'delete', null, id);
  }

  if(window.DB && window.DB[colName] && Array.isArray(window.DB[colName])){
    window.DB[colName] = window.DB[colName].filter(x => x.id !== id && x._docId !== id && x.no !== id && x.code !== id);
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
        || localStorage.getItem('pos.activeShopId')
        || 'SHOP-001';
  }
  return window.state.user.shopId || localStorage.getItem('pos.activeShopId') || 'SHOP-001';
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
window.ensureFirebaseAuth = ensureFirebaseAuth;

window.FB = {
  COL,
  initFirebase,
  ensureFirebaseAuth,
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
