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

async function fbAdd(colName, data){
  if(_fbPermissionDenied) return 'local_' + Date.now();
  if(!_fbReady){
    const ok = await initFirebase();
    if(!ok || !_fbDb) return 'local_' + Date.now();
  }
  try {
    const { collection, addDoc, serverTimestamp } = _fbModules.fsMod;
    const ref = await addDoc(collection(_fbDb, colName), {
      ...data, createdAt: serverTimestamp()
    });
    return ref.id;
  } catch(e) {
    checkPermissionError(e, `fbAdd(${colName})`);
    return 'local_' + Date.now();
  }
}

async function fbSet(colName, id, data){
  if(_fbPermissionDenied) return;
  if(!_fbReady){
    const ok = await initFirebase();
    if(!ok || !_fbDb) return;
  }
  try {
    const { doc, setDoc } = _fbModules.fsMod;
    await setDoc(doc(_fbDb, colName, id), data, { merge: true });
  } catch(e) {
    checkPermissionError(e, `fbSet(${colName}, ${id})`);
  }
}

async function fbUpdate(colName, id, data){
  if(_fbPermissionDenied) return;
  if(!_fbReady){
    const ok = await initFirebase();
    if(!ok || !_fbDb) return;
  }
  try {
    const { doc, updateDoc } = _fbModules.fsMod;
    await updateDoc(doc(_fbDb, colName, id), data);
  } catch(e) {
    checkPermissionError(e, `fbUpdate(${colName}, ${id})`);
  }
}

async function fbDelete(colName, id){
  if(_fbPermissionDenied) return;
  if(!_fbReady){
    const ok = await initFirebase();
    if(!ok || !_fbDb) return;
  }
  try {
    const { doc, deleteDoc } = _fbModules.fsMod;
    await deleteDoc(doc(_fbDb, colName, id));
  } catch(e) {
    checkPermissionError(e, `fbDelete(${colName}, ${id})`);
  }
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

window.FB = {
  COL,
  initFirebase,
  fbGetAll,
  fbGet,
  fbAdd,
  fbSet,
  fbUpdate,
  fbDelete,
  fbWatch,
  isPermissionDenied
};
