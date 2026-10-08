/* =========================================================
   js/security.js - Cryptographic Security, Rate Limiting & Migrations
   ========================================================= */

(function(){
  // Helper to resolve bcrypt from window or dcodeIO
  function getBcrypt(){
    if(typeof window !== 'undefined'){
      if(window.bcrypt) return window.bcrypt;
      if(window.dcodeIO && window.dcodeIO.bcrypt){
        window.bcrypt = window.dcodeIO.bcrypt;
        return window.bcrypt;
      }
    }
    return null;
  }

  const Security = {
    SALT_ROUNDS: 10,
    MAX_ATTEMPTS: 5,
    LOCK_TIME: 5 * 60 * 1000, // 5 minutes in ms

    /**
     * Hashes plain text password using bcrypt with 10 salt rounds.
     * @param {string} plain 
     * @returns {Promise<string>}
     */
    async hashPassword(plain){
      if(plain == null) return '';
      const b = getBcrypt();
      if(!b){
        console.error('Bcrypt library is not loaded');
        throw new Error('Bcrypt library is not loaded');
      }
      return await b.hash(String(plain), this.SALT_ROUNDS);
    },

    /**
     * Verifies plain text password against hash. Supports graceful fallback
     * for legacy plain text passwords during migration.
     * @param {string} plain 
     * @param {string} hash 
     * @returns {Promise<boolean>}
     */
    async verifyPassword(plain, hash){
      if(plain == null || hash == null) return false;
      const b = getBcrypt();
      
      // Fallback for legacy plain text passwords (< 20 chars or not starting with $2)
      if(typeof hash === 'string' && !hash.startsWith('$2') && hash.length < 20){
        return String(plain) === hash;
      }

      if(!b){
        console.error('Bcrypt library is not loaded');
        return false;
      }

      try {
        return await b.compare(String(plain), String(hash));
      } catch(e){
        console.warn('verifyPassword error:', e);
        return false;
      }
    },

    /**
     * Rate Limiting: Key generator for failed attempt records
     */
    getLockoutKey(username){
      return 'lockout_' + (username || '').trim().toLowerCase();
    },

    /**
     * Checks if a user is currently locked out from login attempts.
     * @param {string} username 
     * @returns {boolean}
     */
    checkLockout(username){
      if(!username) return false;
      const key = this.getLockoutKey(username);
      let data = {};
      try {
        data = JSON.parse(localStorage.getItem(key) || '{}');
      } catch(e){}

      if(data.count >= this.MAX_ATTEMPTS){
        const now = Date.now();
        if(data.until && now < data.until){
          const mins = Math.max(1, Math.ceil((data.until - now) / 60000));
          const msg = `ගිණුම අගුළු දමා ඇත. මිනිත්තු ${mins}කින් නැවත උත්සාහ කරන්න`;
          if(typeof toast === 'function'){
            toast(msg, 'err');
          }
          const errEl = document.getElementById('lErr');
          if(errEl){
            errEl.textContent = `🔒 ${msg} (Account locked. Try in ${mins}m)`;
          }
          return true;
        } else if(data.until && now >= data.until){
          // Lockout duration expired: reset
          this.clearAttempts(username);
          return false;
        }
      }
      return false;
    },

    /**
     * Records a failed login attempt and sets 5-minute lockout timer after 5 failures.
     * @param {string} username 
     */
    recordFailedAttempt(username){
      if(!username) return;
      const key = this.getLockoutKey(username);
      let data = {};
      try {
        data = JSON.parse(localStorage.getItem(key) || '{}');
      } catch(e){}

      data.count = (Number(data.count) || 0) + 1;
      if(data.count >= this.MAX_ATTEMPTS){
        data.until = Date.now() + this.LOCK_TIME;
      }
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch(e){}

      const remaining = Math.max(0, this.MAX_ATTEMPTS - data.count);
      return { count: data.count, remaining, isLocked: data.count >= this.MAX_ATTEMPTS };
    },

    /**
     * Clears failed attempt counter on successful login or timeout.
     * @param {string} username 
     */
    clearAttempts(username){
      if(!username) return;
      const key = this.getLockoutKey(username);
      try {
        localStorage.removeItem(key);
      } catch(e){}
    },

    /**
     * One-time migration: Finds any users with unhashed passwords (length < 20 or not starting with $2)
     * and rehashes them with bcrypt in both Firestore and local database.
     * @returns {Promise<number>} Number of migrated passwords
     */
    async migratePasswords(){
      const db = window.DB || {};
      const users = db.users || [];
      let migratedCount = 0;

      for(const u of users){
        if(u.password && (u.password.length < 20 || !u.password.startsWith('$2'))){
          try {
            const hashed = await this.hashPassword(u.password);
            u.password = hashed;
            if(window.FB && window.FB.fbUpdate){
              await window.FB.fbUpdate(window.FB.COL.users, u.id, { password: hashed });
            }
            migratedCount++;
            console.log('✅ Migrated password for user:', u.username);
          } catch(e){
            console.warn('Failed to migrate password for user:', u.username, e);
          }
        }
      }

      if(migratedCount > 0){
        if(typeof window.saveDB === 'function') window.saveDB();
        if(typeof toast === 'function'){
          toast(`🔐 පරිශීලක මුරපද ${migratedCount}ක් ආරක්ෂිතව bcrypt මඟින් hash කරන ලදී.`, 'ok');
        }
      }
      return migratedCount;
    }
  };

  // Expose globally
  window.Security = Security;
  window.checkLockout = (u) => Security.checkLockout(u);
  window.recordFailedAttempt = (u) => Security.recordFailedAttempt(u);
  window.clearAttempts = (u) => Security.clearAttempts(u);
  window.migratePasswords = () => Security.migratePasswords();
})();
