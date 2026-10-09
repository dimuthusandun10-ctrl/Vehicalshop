/* =========================================================
   js/database-audit.js - Database & Firestore Diagnostic Tool
   (Development & Pre-production verification only)
   ========================================================= */

async function runDatabaseAudit(){
  const report = {
    timestamp: new Date().toISOString(),
    config: {},
    connection: {},
    collections: {},
    issues: [],
    recommendations: []
  };

  console.log('%c🔍 DATABASE AUDIT STARTING...', 
              'color: #f59e0b; font-size: 16px; font-weight: bold');

  // ─── 1. CONFIG CHECK ───
  console.log('\n%c1. Firebase Config', 
              'color: #3b82f6; font-weight: bold');
  
  const requiredKeys = [
    'apiKey', 'authDomain', 'projectId', 'storageBucket',
    'messagingSenderId', 'appId'
  ];
  
  try {
    // Try to access firebase config across possible stores
    let config = window.FB?.config || window._fbConfig || {};
    if(!config || Object.keys(config).length === 0){
      try {
        const app = window.FB?._getDb?.()?.app;
        if(app && app.options) config = app.options;
      } catch(_) {}
    }
    
    // Fallback: check if firebaseConfig object exists in global scope
    if((!config || Object.keys(config).length === 0) && typeof firebaseConfig !== 'undefined'){
      config = firebaseConfig;
    }
    
    requiredKeys.forEach(key => {
      const val = config[key];
      const ok = !!(val && String(val).length > 0);
      report.config[key] = ok ? '✅' : '❌ MISSING';
      console.log(`  ${key}: ${ok ? '✅' : '❌ ' + (val || 'MISSING')}`);
      if(!ok) report.issues.push(`Config missing: ${key}`);
    });
    
    console.log(`  projectId: ${config.projectId || 'NOT SET'}`);
    if(config.projectId && config.projectId !== 'vehicles-7ad89'){
      report.issues.push(`projectId mismatch: expected 'vehicles-7ad89', found '${config.projectId}'`);
    } else if(!config.projectId){
      report.issues.push('projectId is missing');
    }
  } catch(e) {
    console.error('  ❌ Cannot read config:', e.message);
    report.issues.push('Cannot read Firebase config: ' + e.message);
  }

  // ─── 2. CONNECTION CHECK ───
  console.log('\n%c2. Connection Status', 
              'color: #3b82f6; font-weight: bold');
  
  report.connection.online = navigator.onLine;
  console.log(`  Browser online: ${navigator.onLine ? '✅' : '❌'}`);
  
  const isFbReady = !!(window.FB?._fbReady || (window.FB?._getDb && window.FB._getDb()));
  report.connection.firebaseInitialized = isFbReady;
  console.log(`  Firebase ready: ${isFbReady ? '✅' : '❌'}`);
  
  const isFsConnected = !!window.DB?.isFirebaseConnected;
  report.connection.firestoreConnected = isFsConnected;
  console.log(`  Firestore connected: ${isFsConnected ? '✅' : '❌'}`);
  
  const isPermDenied = typeof window.FB?.isPermissionDenied === 'function' ? window.FB.isPermissionDenied() : false;
  report.connection.permissionDenied = isPermDenied;
  console.log(`  Permission denied: ${isPermDenied ? '❌ YES (Firestore rules locked)' : '✅ NO'}`);
  if(isPermDenied){
    report.issues.push('Firestore permission denied: security rules may be locked or user unauthenticated');
  }

  // Live remote read check if initialized
  if(isFbReady && typeof window.FB?.fbGetAll === 'function'){
    try {
      const testShops = await window.FB.fbGetAll('shops');
      report.connection.remoteShopsFound = testShops.length;
      console.log(`  Remote Firestore read test: ✅ SUCCESS (${testShops.length} shops in cloud)`);
    } catch(err){
      report.connection.remoteReadError = err.message;
      console.log(`  Remote Firestore read test: ❌ FAILED (${err.message})`);
      report.issues.push(`Remote Firestore read failed: ${err.message}`);
    }
  }

  // ─── 3. COLLECTIONS CHECK ───
  console.log('\n%c3. Collections', 
              'color: #3b82f6; font-weight: bold');
  
  const collections = [
    'shops', 'users', 'products', 'customers', 'suppliers',
    'sales', 'grns', 'returns', 'shifts', 'cashMovements',
    'creditPayments', 'dailySummary'
  ];
  
  for(const col of collections){
    try {
      const data = window.DB?.[getDbKey(col)] || [];
      report.collections[col] = Array.isArray(data) ? data.length : (data ? 1 : 0);
      console.log(`  ${col}: ${report.collections[col]} docs`);
    } catch(e) {
      report.collections[col] = 'error';
      console.log(`  ${col}: ❌ ${e.message}`);
      report.issues.push(`Collection access error for ${col}: ${e.message}`);
    }
  }

  // ─── 4. CRITICAL DATA CHECK ───
  console.log('\n%c4. Critical Data', 
              'color: #3b82f6; font-weight: bold');
  
  // Superadmin check
  const superadmins = (window.DB?.users || []).filter(u => u.role === 'superadmin');
  console.log(`  Superadmins: ${superadmins.length}`);
  if(superadmins.length === 0){
    report.issues.push('CRITICAL: No superadmin found!');
  } else if(superadmins.length > 1){
    report.issues.push(`WARNING: ${superadmins.length} superadmins found`);
  }
  
  // Shops check
  const shops = window.DB?.shops || [];
  console.log(`  Shops: ${shops.length}`);
  if(shops.length === 0){
    report.recommendations.push('No shops yet — create one after login');
  }
  
  // Orphan check — docs without shopId
  let orphanCount = 0;
  const orphanBreakdown = {};
  const checkCols = ['products', 'sales', 'customers', 'grns'];
  checkCols.forEach(col => {
    const items = window.DB?.[getDbKey(col)] || [];
    let colOrphans = 0;
    if(Array.isArray(items)){
      items.forEach(item => {
        if(col !== 'shops' && !item.shopId){
          orphanCount++;
          colOrphans++;
        }
      });
    }
    if(colOrphans > 0) orphanBreakdown[col] = colOrphans;
  });
  console.log(`  Orphan documents (no shopId): ${orphanCount}`);
  if(orphanCount > 0){
    report.issues.push(`${orphanCount} orphan docs without shopId (${JSON.stringify(orphanBreakdown)})`);
    report.recommendations.push('Run migrateOrphanDocumentsToShop(activeShopId) or reset database before production');
  }
  
  // Demo data detection
  const demoIndicators = {
    'BP-1001': (window.DB?.products || []).find(p => p.code === 'BP-1001'),
    'කමල් පෙරේරා': (window.DB?.customers || []).find(c => c.name === 'කමල් පෙරේරා')
  };
  
  console.log('\n%c5. Demo Data Detection', 
              'color: #3b82f6; font-weight: bold');
  Object.entries(demoIndicators).forEach(([key, found]) => {
    console.log(`  ${key}: ${found ? '⚠️ FOUND (demo seed)' : '✅ Not found'}`);
    if(found){
      report.recommendations.push(`Demo seed detected (${key}) — clear or reset before live production sales`);
    }
  });

  // ─── SUMMARY ───
  console.log('\n%c═══════════════════════════════════════', 
              'color: #f59e0b; font-weight: bold');
  console.log('%cAUDIT SUMMARY', 
              'color: #f59e0b; font-size: 14px; font-weight: bold');
  console.log('%c═══════════════════════════════════════', 
              'color: #f59e0b; font-weight: bold');
  console.log(`  Issues: ${report.issues.length}`);
  console.log(`  Recommendations: ${report.recommendations.length}`);
  
  if(report.issues.length > 0){
    console.log('\n%c⚠️ ISSUES:', 'color: #ef4444; font-weight: bold');
    report.issues.forEach((issue, i) => {
      console.log(`  ${i + 1}. ${issue}`);
    });
  }
  
  if(report.recommendations.length > 0){
    console.log('\n%c💡 RECOMMENDATIONS:', 'color: #3b82f6; font-weight: bold');
    report.recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec}`);
    });
  }

  // Save report to window for later retrieval
  window._auditReport = report;
  
  console.log('\n%c✅ Audit complete. Run window._auditReport to get full JSON object.',
              'color: #10b981; font-weight: bold');
  
  return report;
}

function getDbKey(colName){
  const map = {
    'cashMovements': 'cashMoves',
    'creditPayments': 'payments'
  };
  return map[colName] || colName;
}

window.runDatabaseAudit = runDatabaseAudit;
