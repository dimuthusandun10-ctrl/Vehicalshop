/* =========================================================
   js/security-test.js - Post-Deployment Security & Rules Audit
   ========================================================= */

window.runSecurityAudit = async function(){
  console.log('%c🔒 SECURITY AUDIT STARTING...', 
              'color: #10b981; font-size: 16px; font-weight: bold');
  
  const results = [];
  
  // Test 1: Backdoor password check
  console.log('\n📋 Test 1: Backdoor password check');
  try {
    const authMod = window.FB.getAuthModule();
    const auth = window.FB.getAuth();
    await authMod.signInWithEmailAndPassword(
      auth, 
      'info.dimuthudishan2002@gmail.com', 
      '1234'
    );
    results.push('❌ FAIL: Backdoor "1234" still works!');
  } catch(e) {
    if(e.code === 'auth/wrong-password' || 
       e.code === 'auth/invalid-credential'){
      results.push('✅ PASS: Backdoor blocked');
    } else {
      results.push('⚠️ UNKNOWN: ' + e.code);
    }
  }
  
  // Test 2: Unauthenticated access blocked
  console.log('\n📋 Test 2: Unauthenticated Firestore access');
  try {
    const res = await fetch(
      'https://firestore.googleapis.com/v1/projects/vehicles-7ad89' +
      '/databases/(default)/documents/products?pageSize=1'
    );
    if(res.status === 403 || res.status === 401){
      results.push('✅ PASS: Unauthenticated blocked');
    } else {
      results.push('❌ FAIL: Data accessible without auth!');
    }
  } catch(e) {
    results.push('✅ PASS: ' + e.message);
  }
  
  // Test 3: Auth token exists after login
  console.log('\n📋 Test 3: Auth token in session');
  const token = sessionStorage.getItem('pos.authToken');
  if(token && token.length > 100){
    results.push('✅ PASS: Auth token present');
  } else {
    results.push('⚠️ WARN: No auth token (login first)');
  }
  
  // Test 4: Current user role
  console.log('\n📋 Test 4: Current user context');
  if(window.state && window.state.user){
    results.push(`ℹ️ User: ${state.user.name} (${state.user.role})`);
    results.push(`ℹ️ Shop: ${state.user.shopId || 'SYSTEM'}`);
  } else {
    results.push('⚠️ Not logged in');
  }
  
  // Print summary
  console.log('\n' + '═'.repeat(50));
  console.log('%cAUDIT RESULTS', 'color: #f59e0b; font-weight: bold');
  console.log('═'.repeat(50));
  results.forEach(r => console.log('  ' + r));
  
  const passed = results.filter(r => r.startsWith('✅')).length;
  const failed = results.filter(r => r.startsWith('❌')).length;
  
  console.log(`\n  Total: ${results.length}`);
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  
  return { results, passed, failed };
};
