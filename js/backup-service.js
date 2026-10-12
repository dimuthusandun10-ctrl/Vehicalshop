/* =====================================================
   js/backup-service.js - Automated & Shop-Isolated Backup Service
   Supports:
   1. File System Access API (Direct save to Documents/POS System on PC)
   2. Daily 4:00 PM (16:00) Auto-Backup Scheduler
   3. Strict Multi-Tenant Shop Isolation (No shop data mixing)
   4. Mobile Download & In-App 30-Day Backup Vault (IndexedDB)
   ===================================================== */

(function(window){
  'use strict';

  const DB_NAME = 'autoparts_pos_backup_db';
  const DB_VERSION = 1;
  const STORE_HANDLES = 'handles';
  const STORE_VAULT = 'vault';
  const DEFAULT_SCHEDULE_TIME = '16:00'; // 4:00 PM (සවස 04:00)

  // 1. IndexedDB Helper for FileSystem handles and Backup Vault
  function openBackupDB(){
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if(!db.objectStoreNames.contains(STORE_HANDLES)){
          db.createObjectStore(STORE_HANDLES);
        }
        if(!db.objectStoreNames.contains(STORE_VAULT)){
          const vaultStore = db.createObjectStore(STORE_VAULT, { keyPath: 'id' });
          vaultStore.createIndex('shopId', 'shopId', { unique: false });
          vaultStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // 2. Directory Handle Persistence
  async function saveDirectoryHandle(handle){
    try {
      const db = await openBackupDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_HANDLES, 'readwrite');
        tx.objectStore(STORE_HANDLES).put(handle, 'backupDirHandle');
        tx.oncomplete = () => {
          localStorage.setItem('pos.backupFolderName', handle.name || 'POS System');
          localStorage.setItem('pos.backupFolderGranted', 'true');
          resolve(true);
        };
        tx.onerror = () => reject(tx.error);
      });
    } catch(e){
      console.warn('Failed to save directory handle in IndexedDB:', e);
      return false;
    }
  }

  async function getStoredDirectoryHandle(){
    try {
      const db = await openBackupDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_HANDLES, 'readonly');
        const req = tx.objectStore(STORE_HANDLES).get('backupDirHandle');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch(e){
      return null;
    }
  }

  // 3. Permission Verification for Chromium File System Access API
  async function verifyHandlePermission(dirHandle, readWrite = true){
    if(!dirHandle) return false;
    const options = {};
    if(readWrite) options.mode = 'readwrite';
    try {
      if((await dirHandle.queryPermission(options)) === 'granted'){
        return true;
      }
      if((await dirHandle.requestPermission(options)) === 'granted'){
        return true;
      }
    } catch(e){
      console.warn('Directory permission query warning:', e);
    }
    return false;
  }

  // 4. In-App Backup Vault (Stores last 30 daily backups per shop)
  async function saveToVault(record){
    try {
      const db = await openBackupDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_VAULT, 'readwrite');
        const store = tx.objectStore(STORE_VAULT);
        store.put(record);
        tx.oncomplete = async () => {
          // Prune old backups keeping max 30 for this shop
          try {
            await pruneVault(record.shopId, 30);
          } catch(_){}
          resolve(true);
        };
        tx.onerror = () => reject(tx.error);
      });
    } catch(e){
      console.warn('Vault save warning:', e);
      return false;
    }
  }

  async function pruneVault(shopId, maxCount = 30){
    const list = await getVaultBackups(shopId);
    if(list.length > maxCount){
      const toDelete = list.slice(maxCount);
      const db = await openBackupDB();
      const tx = db.transaction(STORE_VAULT, 'readwrite');
      const store = tx.objectStore(STORE_VAULT);
      toDelete.forEach(item => store.delete(item.id));
    }
  }

  async function getVaultBackups(shopId){
    try {
      const db = await openBackupDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_VAULT, 'readonly');
        const store = tx.objectStore(STORE_VAULT);
        const req = store.getAll();
        req.onsuccess = () => {
          let results = req.result || [];
          if(shopId){
            results = results.filter(r => !r.shopId || r.shopId === shopId);
          }
          // Sort newest first
          results.sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0));
          resolve(results);
        };
        req.onerror = () => resolve([]);
      });
    } catch(e){
      return [];
    }
  }

  // 5. Main Backup Service Object
  const BackupService = {
    _schedulerTimer: null,

    init(){
      this.startScheduler();
      console.log('🛡️ BackupService initialized with 4:00 PM Daily Scheduler & Shop Isolation');
    },

    // Check if File System Access API is supported (PC / Chromium)
    isFileSystemAccessSupported(){
      return typeof window.showDirectoryPicker === 'function';
    },

    // Allow user to select target folder on PC (e.g. Documents/POS System/<ShopName>)
    async selectBackupFolder(){
      if(!this.isFileSystemAccessSupported()){
        toast('ඔබගේ බ්‍රවුසරය සෘජු ෆෝල්ඩර තේරීමට සහාය නොදක්වයි (Mobile/Safari). සාමාන්‍ය බාගැනීම් (Downloads) භාවිතා වේ.', 'info');
        return false;
      }

      try {
        const handle = await window.showDirectoryPicker({
          id: 'pos_backup_folder',
          mode: 'readwrite',
          startIn: 'documents'
        });

        if(handle){
          const hasPerm = await verifyHandlePermission(handle, true);
          if(hasPerm){
            await saveDirectoryHandle(handle);
            toast(`📁 '${handle.name}' ෆෝල්ඩරය සාර්ථකව සම්බන්ධ කර අවසර ලබා දෙන ලදී! ✅`, 'ok');
            if(window.Settings && typeof window.Settings.render === 'function'){
              window.Settings.render();
            }
            return true;
          } else {
            toast('ෆෝල්ඩරයට ලිවීමේ අවසරය ප්‍රතික්ෂේප විය', 'warn');
          }
        }
      } catch(err){
        if(err.name !== 'AbortError'){
          console.error('Folder picker error:', err);
          toast('ෆෝල්ඩරය තේරීමේ දෝෂයක්: ' + (err.message || ''), 'err');
        }
      }
      return false;
    },

    // Returns configured folder info
    async getFolderStatus(){
      const isSupported = this.isFileSystemAccessSupported();
      if(!isSupported){
        return {
          supported: false,
          name: 'Downloads / POS_System',
          isMobile: true,
          granted: false
        };
      }

      const stored = await getStoredDirectoryHandle();
      if(!stored){
        return {
          supported: true,
          name: localStorage.getItem('pos.backupFolderName') || null,
          isMobile: false,
          granted: false
        };
      }

      // Check if permission is currently active
      let granted = false;
      try {
        granted = (await stored.queryPermission({ mode: 'readwrite' })) === 'granted';
      } catch(_){}

      return {
        supported: true,
        name: stored.name || localStorage.getItem('pos.backupFolderName') || 'POS System',
        isMobile: false,
        granted: granted,
        handle: stored
      };
    },

    // Generate JSON backup strictly isolated to current logged-in shop
    generateShopBackupData(customShopId){
      const db = window.DB || {};
      const shopId = customShopId || (typeof window.currentShopId === 'function' ? window.currentShopId() : null) || window.state?.user?.shopId || window.state?.activeShopId || 'SHOP-001';
      const shopName = window.state?.activeShop?.name || db.shop?.name || 'AutoParts Shop';

      // Strict Shop Filter
      const filterShop = (list) => {
        if(!Array.isArray(list)) return [];
        return list.filter(item => Boolean(item && (!item.shopId || item.shopId === shopId)));
      };

      const now = new Date();
      const backupData = {
        version: '2.6.5',
        phase: 8,
        timestamp: now.toISOString(),
        shopId: shopId,
        shopName: shopName,
        scheduledTime: localStorage.getItem('pos.autoBackupTime') || DEFAULT_SCHEDULE_TIME,
        collections: {
          shops: (db.shops || []).filter(s => s.id === shopId),
          users: (db.users || []).filter(u => u.shopId === shopId),
          products: filterShop(db.products),
          customers: filterShop(db.customers),
          suppliers: filterShop(db.suppliers),
          sales: filterShop(db.sales),
          grns: filterShop(db.grns),
          returns: filterShop(db.returns),
          shifts: filterShop(db.shifts),
          cashMoves: filterShop(db.cashMoves),
          payments: filterShop(db.payments),
          dailySummary: filterShop(db.dailySummary),
          supplierPayments: filterShop(db.supplierPayments),
          interchanges: filterShop(db.interchanges),
          scrapInventory: filterShop(db.scrapInventory),
          counters: db.counters || { invoice: 1, grn: 1, ret: 1, shift: 1, payment: 1, shop: 1 }
        },
        // Top-level mirrors for backward compatibility
        shops: (db.shops || []).filter(s => s.id === shopId),
        users: (db.users || []).filter(u => u.shopId === shopId),
        products: filterShop(db.products),
        customers: filterShop(db.customers),
        suppliers: filterShop(db.suppliers),
        sales: filterShop(db.sales),
        grns: filterShop(db.grns),
        returns: filterShop(db.returns),
        shifts: filterShop(db.shifts),
        cashMoves: filterShop(db.cashMoves),
        payments: filterShop(db.payments),
        dailySummary: filterShop(db.dailySummary),
        supplierPayments: filterShop(db.supplierPayments),
        interchanges: filterShop(db.interchanges),
        scrapInventory: filterShop(db.scrapInventory),
        counters: db.counters || {}
      };

      return { backupData, shopId, shopName };
    },

    // Save backup file: File System API (PC folder) or Fallback Download (Mobile)
    async performBackup(options = {}){
      const isAuto = Boolean(options.isAuto);
      const { backupData, shopId, shopName } = this.generateShopBackupData(options.shopId);

      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
      const shopSlug = shopName.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
      const filename = `autoparts_${shopSlug}_backup_${dateStr}_${timeStr}.json`;
      const jsonContent = JSON.stringify(backupData, null, 2);

      let savedToFileSystem = false;
      let targetPathDesc = '';

      // 1. Attempt File System Access API (Direct write to Documents/POS System on PC)
      if(this.isFileSystemAccessSupported()){
        const dirHandle = await getStoredDirectoryHandle();
        if(dirHandle){
          try {
            const hasPerm = await verifyHandlePermission(dirHandle, true);
            if(hasPerm){
              // Create or enter subfolder for this specific shop
              const shopFolderName = `${shopName} (${shopId})`.replace(/[\/\\:*?"<>|]/g, '_');
              const shopSubDir = await dirHandle.getDirectoryHandle(shopFolderName, { create: true });
              const fileHandle = await shopSubDir.getFileHandle(filename, { create: true });
              const writable = await fileHandle.createWritable();
              await writable.write(jsonContent);
              await writable.close();

              savedToFileSystem = true;
              targetPathDesc = `${dirHandle.name}/${shopFolderName}/${filename}`;
              console.log('✅ File System direct save success:', targetPathDesc);
            }
          } catch(fsErr){
            console.warn('File system direct write failed, falling back to download:', fsErr);
          }
        }
      }

      // 2. If not saved directly to filesystem, trigger browser file download
      if(!savedToFileSystem && (!isAuto || options.forceDownload || !this.isFileSystemAccessSupported())){
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        targetPathDesc = `Downloads/${filename}`;
      }

      // 3. Save copy in In-App IndexedDB Vault (Guaranteed snapshot history)
      const vaultRecord = {
        id: `backup_${shopId}_${Date.now()}`,
        shopId: shopId,
        shopName: shopName,
        filename: filename,
        timestamp: now.getTime(),
        dateStr: dateStr,
        timeStr: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        itemCount: (backupData.collections.products.length + backupData.collections.sales.length),
        sizeBytes: jsonContent.length,
        savedToFs: savedToFileSystem,
        targetPath: targetPathDesc,
        data: backupData
      };
      await saveToVault(vaultRecord);

      // 4. Update localStorage stamps
      localStorage.setItem('pos.lastBackup', now.toISOString());
      if(isAuto){
        localStorage.setItem('pos.lastAutoBackup.' + shopId, dateStr);
      }

      // 5. User feedback
      const msg = isAuto
        ? `📅 4:00 PM ස්වයංක්‍රීය Backup සාර්ථකව සුරකින ලදී! (${targetPathDesc || shopName}) ✅`
        : `සම්පූර්ණ Backup ගොනුව සාර්ථකව සුරකින ලදී! (${targetPathDesc || filename}) ✅`;
      toast(msg, 'ok');

      if(window.Settings && typeof window.Settings.render === 'function'){
        window.Settings.render();
      }

      return {
        success: true,
        filename: filename,
        targetPath: targetPathDesc,
        savedToFileSystem: savedToFileSystem
      };
    },

    // Daily 4:00 PM (16:00) Scheduler Loop
    startScheduler(){
      if(this._schedulerTimer) clearInterval(this._schedulerTimer);

      const checkSchedule = async () => {
        const autoEnabled = localStorage.getItem('pos.autoBackup') !== 'false';
        if(!autoEnabled) return;

        // Ensure user is logged in
        if(!window.state?.user) return;

        const shopId = (typeof window.currentShopId === 'function' ? window.currentShopId() : null) || window.state.user.shopId || window.state.activeShopId || 'SHOP-001';
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10);
        const lastAuto = localStorage.getItem('pos.lastAutoBackup.' + shopId);

        // Target time default: 16:00 (4:00 PM)
        const scheduledTime = localStorage.getItem('pos.autoBackupTime') || DEFAULT_SCHEDULE_TIME;
        const [schedHour, schedMin] = scheduledTime.split(':').map(Number);

        const currentHour = now.getHours();
        const currentMin = now.getMinutes();

        const isTimeDue = (currentHour > schedHour) || (currentHour === schedHour && currentMin >= schedMin);

        // If time is due and today's backup has not run yet for this shop
        if(isTimeDue && lastAuto !== dateStr){
          console.log(`⏰ [AutoBackup] Triggering 4:00 PM Daily Backup for shop: ${shopId}`);
          try {
            await this.performBackup({ isAuto: true, shopId: shopId });
          } catch(err){
            console.error('[AutoBackup] Error during scheduled backup:', err);
          }
        }
      };

      // Run check immediately after short delay
      setTimeout(checkSchedule, 5000);

      // Check every 30 seconds
      this._schedulerTimer = setInterval(checkSchedule, 30000);
    },

    // Retrieve recent vault backups
    async getRecentBackups(shopId){
      return await getVaultBackups(shopId);
    },

    // Download a backup from the vault
    downloadVaultBackup(backupId){
      openBackupDB().then(db => {
        const tx = db.transaction(STORE_VAULT, 'readonly');
        const req = tx.objectStore(STORE_VAULT).get(backupId);
        req.onsuccess = () => {
          const record = req.result;
          if(!record || !record.data){
            toast('Backup දත්ත සොයාගත නොහැක', 'err');
            return;
          }
          const blob = new Blob([JSON.stringify(record.data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = record.filename || `backup_${record.shopId}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast('Backup ගොනුව බාගත විය ✅', 'ok');
        };
      });
    }
  };

  window.BackupService = BackupService;

})(window);
