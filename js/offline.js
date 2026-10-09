/* =========================================================
   js/offline.js - Offline-First Manager & Sync Queue
   ========================================================= */

const Offline = {
  status: typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline',
  queue: [],
  isSyncing: false,

  init(){
    // 1. Load pending sync queue from localStorage
    try {
      this.queue = JSON.parse(localStorage.getItem('pos.syncQueue') || '[]');
      if(!Array.isArray(this.queue)) this.queue = [];
    } catch(e) {
      this.queue = [];
    }

    // 2. Listen to browser network state transitions
    if(typeof window !== 'undefined'){
      window.addEventListener('online', () => this.onOnline());
      window.addEventListener('offline', () => this.onOffline());
    }

    // 3. Initial UI rendering
    this.updateUI();
    this.updateQueueBadge();

    // 4. Periodic background sync attempt (every 30 seconds if online)
    if(typeof setInterval !== 'undefined'){
      setInterval(() => {
        if(typeof navigator !== 'undefined' && navigator.onLine && this.queue.length && !this.isSyncing){
          this.sync();
        }
      }, 30000);
    }

    // 5. If already online and queue has pending writes, trigger sync shortly after boot
    if(this.status === 'online' && this.queue.length){
      setTimeout(() => this.sync(), 2500);
    }
  },

  onOnline(){
    this.status = 'online';
    this.updateUI();
    if(typeof toast === 'function'){
      toast('🟢 නැවත Online — දත්ත sync කරමින්...', 'ok');
    }
    setTimeout(() => this.sync(), 1000);
  },

  onOffline(){
    this.status = 'offline';
    this.updateUI();
    if(typeof toast === 'function'){
      toast('🟡 Offline — ලෝකල්ව සුරකියි', 'warn');
    }
  },

  updateUI(){
    const status = document.getElementById('networkStatus');
    const banner = document.getElementById('offlineBanner');

    if(status){
      status.className = 'network-status ' + (this.isSyncing ? 'syncing' : this.status);
      status.title = this.isSyncing 
        ? 'Syncing data...' 
        : (this.status === 'online' ? 'Online' : 'Offline');
    }

    if(banner){
      if(this.status === 'offline'){
        banner.innerHTML = '🟡 ඔබ දැන් Offline — දත්ත ලෝකල්ව සුරකියි (Offline Mode Active)';
        banner.classList.remove('hidden');
      } else if(this.queue.length){
        banner.innerHTML = '🔄 දත්ත sync වෙමින්... (' + this.queue.length + ' pending items)';
        banner.classList.remove('hidden');
      } else {
        banner.classList.add('hidden');
      }
    }
  },

  // Called when a Firestore write cannot complete online
  enqueue(collection, operation, data, docId){
    const item = {
      id: 'Q' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      collection,
      operation,       // 'add' | 'update' | 'delete' | 'set'
      data,
      docId: docId || (data ? data.id : null),
      timestamp: Date.now(),
      attempts: 0
    };

    this.queue.push(item);
    this.persist();
    this.updateUI();
    this.updateQueueBadge();

    console.log(`📥 Queued ${operation} on ${collection} (Queue size: ${this.queue.length})`);
    return item;
  },

  persist(){
    try {
      localStorage.setItem('pos.syncQueue', JSON.stringify(this.queue));
    } catch(e) {
      // If localStorage is near capacity, retain only the newest 500 items
      if(this.queue.length > 500){
        this.queue = this.queue.slice(-500);
        try {
          localStorage.setItem('pos.syncQueue', JSON.stringify(this.queue));
        } catch(err){}
      }
    }
  },

  async sync(){
    if(this.isSyncing || (typeof navigator !== 'undefined' && !navigator.onLine) || !this.queue.length) return;

    this.isSyncing = true;
    this.updateUI();

    let succeeded = 0;
    let failed = [];

    // Make a snapshot of the current queue to process
    const toProcess = [...this.queue];

    for(const item of toProcess){
      try {
        let ok = false;

        if(item.operation === 'add'){
          if(window.FB && typeof window.FB.fbAddDirect === 'function'){
            await window.FB.fbAddDirect(item.collection, item.data);
            ok = true;
          } else if(typeof fbAddDirect === 'function'){
            await fbAddDirect(item.collection, item.data);
            ok = true;
          }
        } else if(item.operation === 'update'){
          if(window.FB && typeof window.FB.fbUpdateDirect === 'function'){
            await window.FB.fbUpdateDirect(item.collection, item.docId, item.data);
            ok = true;
          } else if(typeof fbUpdateDirect === 'function'){
            await fbUpdateDirect(item.collection, item.docId, item.data);
            ok = true;
          }
        } else if(item.operation === 'delete'){
          if(window.FB && typeof window.FB.fbDeleteDirect === 'function'){
            await window.FB.fbDeleteDirect(item.collection, item.docId);
            ok = true;
          } else if(typeof fbDeleteDirect === 'function'){
            await fbDeleteDirect(item.collection, item.docId);
            ok = true;
          }
        } else if(item.operation === 'set'){
          if(window.FB && typeof window.FB.fbSetDirect === 'function'){
            await window.FB.fbSetDirect(item.collection, item.docId, item.data);
            ok = true;
          } else if(typeof fbSetDirect === 'function'){
            await fbSetDirect(item.collection, item.docId, item.data);
            ok = true;
          }
        }

        if(ok){
          succeeded++;
          this.queue = this.queue.filter(q => q.id !== item.id);
        }
      } catch(e) {
        item.attempts = (item.attempts || 0) + 1;
        console.warn(`Sync attempt ${item.attempts} failed for ${item.collection}:`, e.message);
        if(item.attempts >= 5){
          console.error('❌ Max attempts reached for queue item:', item);
          failed.push(item);
        }
      }
    }

    this.persist();
    this.isSyncing = false;
    this.updateUI();
    this.updateQueueBadge();

    if(succeeded > 0 && typeof toast === 'function'){
      toast(`✅ දත්ත ${succeeded}ක් Cloud සමඟ sync විය`, 'ok');
    }
    if(failed.length > 0 && typeof toast === 'function'){
      toast(`⚠️ දත්ත ${failed.length}ක් sync කිරීමට නොහැකි විය`, 'err');
    }
  },

  updateQueueBadge(){
    const badge = document.getElementById('queueBadge');
    if(!badge) return;
    if(this.queue.length > 0){
      badge.textContent = this.queue.length;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
};

window.Offline = Offline;

// Auto-initialize when script loads if in browser
if(typeof window !== 'undefined'){
  Offline.init();
}
