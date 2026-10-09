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
  settings:  'settings'
};

let _fbApp = null;
let _fbDb = null;
let _fbReady = false;
let _fbModules = null;
let _fbPermissionDenied = false;

function checkPermissionError(err, operationName){
  if(err && (err.code === 'permission-denied' || (err.message && err.message.toLowerCase().includes('permission')))){
    if(!_fbPermissionDenied){
      _fbPermissionDenied = true;
      console.warn('⚠️ Firebase Firestore Security Rules are locked. Operating smoothly in local database mode.');
    }
    return true;
  }
  return false;
}

async function initFirebase(){
  if(_fbReady) return true;
  if(_fbPermissionDenied) return false;
  try {
    const [appMod, fsMod] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js")
    ]);
    _fbApp = appMod.initializeApp(firebaseConfig);
    _fbDb = fsMod.getFirestore(_fbApp);
    _fbModules = { appMod, fsMod };
    _fbReady = true;
    return true;
  } catch(e) {
    _fbPermissionDenied = true;
    console.warn('Firebase network / CORS restriction detected (local mode active).');
    return false;
  }
}

/* =====================================================
   GENERIC CRUD HELPERS
   ===================================================== */
async function fbGetAll(colName){
  if(_fbPermissionDenied) return [];
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
  if(_fbPermissionDenied) return null;
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
  if(typeof navigator !== 'undefined' && navigator.onLine && !_fbPermissionDenied){
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
  if(typeof navigator !== 'undefined' && navigator.onLine && !_fbPermissionDenied){
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
  if(typeof navigator !== 'undefined' && navigator.onLine && !_fbPermissionDenied){
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
  if(typeof navigator !== 'undefined' && navigator.onLine && !_fbPermissionDenied){
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

window.fbAddDirect = fbAddDirect;
window.fbSetDirect = fbSetDirect;
window.fbUpdateDirect = fbUpdateDirect;
window.fbDeleteDirect = fbDeleteDirect;

window.FB = {
  COL,
  initFirebase,
  fbGetAll,
  fbGet,
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
  currentShopId,
  shopQuery,
  shopAdd,
  shopUpdate,
  _getModules: () => _fbModules,
  _getDb: () => _fbDb
};
