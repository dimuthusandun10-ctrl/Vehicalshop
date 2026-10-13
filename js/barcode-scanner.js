/* =========================================================
   js/barcode-scanner.js - Phone Camera Barcode Scanner
   Phase 6: Hardware Integration (Web BarcodeDetector API)
   Enhanced: Strict Active Shop Validation, Torch & Dual Feedback
   ========================================================= */

const BarcodeScanner = {
  stream: null,
  detector: null,
  isScanning: false,
  rafId: null,
  useZXing: false,
  zxingReader: null,
  continuous: localStorage.getItem('pos.scanner.continuous') !== 'false',
  lastCode: null,
  lastScanTime: 0,
  scannedCount: 0,
  torchSupported: false,
  isTorchOn: false,
  requireShopProduct: true,
  callback: null,

  toggleContinuous(val){
    this.continuous = Boolean(val);
    localStorage.setItem('pos.scanner.continuous', this.continuous ? 'true' : 'false');
  },

  /* ---------- Strict Active Shop Product Lookup ---------- */
  findActiveShopProduct(code){
    if(!code) return null;
    const q = String(code).trim().toLowerCase();
    if(!q) return null;

    const db = (typeof DB !== 'undefined' && DB) ? DB : (window.DB || {});
    const activeShop = (typeof currentShopId === 'function') 
      ? currentShopId() 
      : (window.state?.user?.shopId || window.state?.activeShopId || 'SHOP-001');

    const shopProducts = (db.products || []).filter(p => 
      !activeShop || activeShop === 'all' || p.shopId === activeShop || (!p.shopId && activeShop === 'SHOP-001')
    );

    return shopProducts.find(p =>
      (p.code || '').toLowerCase() === q ||
      (p.oemNo || '').toLowerCase() === q ||
      (p.barcode || '').toLowerCase() === q ||
      (Array.isArray(p.altNos) && p.altNos.some(a => String(a).toLowerCase() === q))
    ) || null;
  },

  async init(){
    // 1. Check Native Web BarcodeDetector API
    if('BarcodeDetector' in window){
      try {
        this.detector = new BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code']
        });
        return true;
      } catch(e){
        console.warn('BarcodeDetector init error, attempting fallback:', e);
      }
    }

    // 2. Fallback to ZXing library if available
    if(window.ZXing){
      this.useZXing = true;
      return true;
    }

    return false;
  },

  async open(callback, options = {}){
    this.callback = typeof callback === 'function' ? callback : null;
    // In POS/Cart mode (no custom callback), strictly require active shop product
    this.requireShopProduct = (options && options.requireShopProduct !== undefined) 
      ? Boolean(options.requireShopProduct) 
      : (!this.callback);

    await this.init();

    // Reset counters and cooldowns
    this.lastCode = null;
    this.lastScanTime = 0;
    this.scannedCount = 0;
    this.isTorchOn = false;
    this.torchSupported = false;

    // Remove existing modal if any
    const existing = document.getElementById('barcodeScannerModal');
    if(existing) existing.remove();

    // Create modal DOM
    const modal = document.createElement('div');
    modal.className = 'barcode-scanner-modal';
    modal.id = 'barcodeScannerModal';
    modal.innerHTML = `
      <div class="bsm-backdrop"></div>
      <div class="bsm-content">
        <div class="bsm-header">
          <h3>📷 Barcode ස්කෑනරය</h3>
          <div style="display:flex;align-items:center;gap:6px">
            <button type="button" id="bsmTorchBtn" class="bsm-torch-btn" style="display:none" onclick="BarcodeScanner.toggleTorch()" title="Flashlight On/Off">
              🔦 <span>Torch</span>
            </button>
            <label style="display:flex;align-items:center;gap:5px;font-size:11.5px;color:#cbd5e1;cursor:pointer;background:rgba(255,255,255,0.08);padding:3px 9px;border-radius:14px;border:1px solid rgba(255,255,255,0.12);user-select:none" title="එක දිගට භාණ්ඩ කිහිපයක් ස්කෑන් කිරීමට මෙය සක්‍රීය කරන්න">
              <input type="checkbox" id="bsmContinuousToggle" ${this.continuous ? 'checked' : ''} onchange="BarcodeScanner.toggleContinuous(this.checked)" style="width:14px;height:14px;accent-color:#10b981;cursor:pointer">
              <span>🔁 Multi-Scan</span>
            </label>
            <button type="button" class="bsm-close" title="වසන්න (Close)">✕</button>
          </div>
        </div>
        <div class="bsm-video-wrap">
          <video id="bsmVideo" autoplay playsinline muted></video>
          <div class="bsm-overlay">
            <div class="bsm-frame"></div>
            <div class="bsm-laser"></div>
          </div>
        </div>
        <div class="bsm-status" id="bsmStatus">
          📷 Camera එකට Barcode එක හෝ QR එක යොමු කරන්න...
        </div>
        <div class="bsm-footer" style="padding:10px 16px;display:flex;justify-content:space-between;align-items:center;background:var(--panel,#0f172a);border-top:1px solid var(--line,#334155)">
          <small id="bsmCount" style="color:var(--muted,#94a3b8);font-size:12px;font-weight:600">ස්කෑන් කළ භාණ්ඩ: 0</small>
          <button type="button" class="btn btn-primary btn-sm" onclick="BarcodeScanner.close()" style="font-weight:700;padding:6px 14px">✅ අවසන් (Done)</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.bsm-close').onclick = () => this.close();
    modal.querySelector('.bsm-backdrop').onclick = () => this.close();

    try {
      // Request camera stream (prefer environment / rear camera)
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      const video = document.getElementById('bsmVideo');
      if(!video) return;
      video.srcObject = this.stream;

      await video.play();

      // Check torch / flashlight hardware support
      this.checkTorchSupport();

      if(this.detector){
        this.startNativeDetection();
      } else if(this.useZXing && window.ZXing){
        this.startFallbackDetection();
      } else {
        const status = document.getElementById('bsmStatus');
        if(status) status.innerHTML = '⚠️ මෙම Browser එකෙහි Native BarcodeDetector නැත. ZXing fallback සක්‍රීය නොවේ.';
      }

    } catch(err){
      console.error('Camera access error:', err);
      if(err.name === 'NotAllowedError'){
        if(typeof toast === 'function') toast('❌ Camera භාවිතයට අවසර ලබා දී නොමැත (Permission denied)', 'err');
      } else if(err.name === 'NotFoundError'){
        if(typeof toast === 'function') toast('❌ Camera උපකරණයක් හමු නොවීය', 'err');
      } else {
        if(typeof toast === 'function') toast('❌ Camera දෝෂය: ' + err.message, 'err');
      }
      this.close();
    }
  },

  checkTorchSupport(){
    if(!this.stream) return;
    try {
      const track = this.stream.getVideoTracks()[0];
      if(track && typeof track.getCapabilities === 'function'){
        const caps = track.getCapabilities();
        this.torchSupported = Boolean(caps && caps.torch);
        const torchBtn = document.getElementById('bsmTorchBtn');
        if(torchBtn && this.torchSupported){
          torchBtn.style.display = 'inline-flex';
        }
      }
    } catch(e){}
  },

  async toggleTorch(){
    if(!this.stream || !this.torchSupported) return;
    try {
      const track = this.stream.getVideoTracks()[0];
      if(!track) return;
      this.isTorchOn = !this.isTorchOn;
      await track.applyConstraints({
        advanced: [{ torch: this.isTorchOn }]
      });
      const btn = document.getElementById('bsmTorchBtn');
      if(btn){
        btn.classList.toggle('active', this.isTorchOn);
        btn.innerHTML = this.isTorchOn ? '🔦 On' : '🔦 Torch';
      }
    } catch(e){
      console.warn('Torch toggle error:', e);
    }
  },

  async startNativeDetection(){
    const video = document.getElementById('bsmVideo');
    this.isScanning = true;

    const detectFrame = async () => {
      if(!this.isScanning || !this.stream || !video) return;

      try {
        if(video.readyState >= 2){
          const barcodes = await this.detector.detect(video);
          if(barcodes && barcodes.length > 0){
            const code = barcodes[0].rawValue;
            this.onDetected(code);
          }
        }
      } catch(err){
        console.warn('Frame detection error:', err);
      }

      if(this.isScanning){
        this.rafId = requestAnimationFrame(detectFrame);
      }
    };

    detectFrame();
  },

  startFallbackDetection(){
    if(!window.ZXing) return;
    const video = document.getElementById('bsmVideo');
    this.isScanning = true;

    try {
      this.zxingReader = new ZXing.BrowserMultiFormatReader();
      this.zxingReader.decodeFromVideoDevice(null, video, (result, err) => {
        if(!this.isScanning) return;
        if(result && result.text){
          this.onDetected(result.text);
        }
      });
    } catch(e){
      console.warn('ZXing initialization failed:', e);
    }
  },

  onDetected(code){
    if(!code) return;
    const cleanCode = String(code).trim();
    if(!cleanCode) return;

    // Cooldown check: prevent scanning the exact same code repeatedly within 1.5s
    const now = Date.now();
    const isSameCode = (this.lastCode === cleanCode);
    if(isSameCode && (now - this.lastScanTime < 1500)){
      return;
    }
    // For different codes, allow quick 400ms transition
    if(!isSameCode && (now - this.lastScanTime < 400)){
      return;
    }

    this.lastCode = cleanCode;
    this.lastScanTime = now;

    const frame = document.querySelector('.bsm-frame');
    const status = document.getElementById('bsmStatus');
    const countEl = document.getElementById('bsmCount');

    /* -------------------------------------------------------------
       STRICT SHOP PRODUCT VALIDATION (For POS / Cart Mode)
       ------------------------------------------------------------- */
    if(this.requireShopProduct){
      const product = this.findActiveShopProduct(cleanCode);

      if(!product){
        // ❌ Barcode does NOT belong to this active shop!
        // 1. Dual-tone Error Buzzer Audio
        this.beep('error');

        // 2. Error Vibration (double pulse)
        if(typeof navigator !== 'undefined' && navigator.vibrate){
          navigator.vibrate([100, 60, 100]);
        }

        // 3. Visual Red Shake Flash
        if(frame){
          frame.classList.remove('success', 'warn');
          frame.classList.add('error');
          setTimeout(() => frame.classList.remove('error'), 500);
        }

        // 4. Scanner Warning Status
        if(status){
          status.style.color = '#f87171';
          status.innerHTML = `❌ <b>මෙම සාප්පුවට අයත් නොවන Barcode එකකි!</b><br><small style="color:#fca5a5;font-size:11px">"${esc(cleanCode)}" හමු නොවීය. වලංගු භාණ්ඩයක් යොමු කරන්න...</small>`;
        }

        if(typeof toast === 'function'){
          toast(`❌ Barcode "${cleanCode}" මෙම සාප්පුවට අයත් නොවේ`, 'err');
        }

        // Reset prompt after 1.5s in continuous mode
        if(this.continuous){
          setTimeout(() => {
            if(this.isScanning && status){
              status.style.color = 'var(--muted, #94a3b8)';
              status.innerHTML = '📷 Camera එකට Barcode එක හෝ QR එක යොමු කරන්න...';
            }
          }, 1500);
        }
        return; // BLOCK! Do not add to cart, do not count!
      }

      // ✅ Valid product found in active shop!
      this.scannedCount = (this.scannedCount || 0) + 1;
      if(countEl) countEl.textContent = `ස්කෑන් කළ භාණ්ඩ: ${this.scannedCount}`;

      const isOutOfStock = (product.qty <= 0);

      // 1. Audio & Haptic Feedback
      if(isOutOfStock){
        this.beep('warn');
      } else {
        this.beep('success');
      }
      if(typeof navigator !== 'undefined' && navigator.vibrate){
        navigator.vibrate(50);
      }

      // 2. Visual Feedback
      if(frame){
        frame.classList.remove('error');
        frame.classList.add(isOutOfStock ? 'warn' : 'success');
        setTimeout(() => frame.classList.remove('success', 'warn'), 450);
      }

      // 3. Status text with product name & price
      const priceFormatted = (typeof money === 'function') ? money(product.price) : ('රු. ' + (product.price||0));
      if(status){
        status.style.color = isOutOfStock ? '#fbbf24' : '#34d399';
        status.innerHTML = (isOutOfStock 
          ? `⚠️ <b>${esc(product.name)}</b> <span style="font-size:11px">(තොග අවසන්: 0)</span>`
          : `✅ <b>${esc(product.name)}</b> <span style="color:#6ee7b7">(${priceFormatted})</span>`) +
          (this.continuous ? `<br><small style="color:var(--muted);font-size:11px">Cart එකට එක්විය! ඊළඟ භාණ්ඩය යොමු කරන්න...</small>` : '');
      }

      // 4. Dispatch to POS cart handler
      if(typeof this.callback === 'function'){
        this.callback(cleanCode, product);
      } else {
        const event = new CustomEvent('barcodeScanned', { detail: { code: cleanCode, product } });
        window.dispatchEvent(event);
      }

      // 5. Exit vs Continuous
      if(!this.continuous){
        this.isScanning = false;
        setTimeout(() => this.close(), 350);
      } else {
        setTimeout(() => {
          if(this.isScanning && status){
            status.style.color = 'var(--muted, #94a3b8)';
            status.innerHTML = '📷 Camera එකට Barcode එක හෝ QR එක යොමු කරන්න...';
          }
        }, 1400);
      }
      return;
    }

    /* -------------------------------------------------------------
       CUSTOM CALLBACK MODE (e.g. Field auto-fill in Inventory / GRN)
       ------------------------------------------------------------- */
    this.scannedCount = (this.scannedCount || 0) + 1;
    if(countEl) countEl.textContent = `ස්කෑන් කළ භාණ්ඩ: ${this.scannedCount}`;

    this.beep('success');
    if(typeof navigator !== 'undefined' && navigator.vibrate){
      navigator.vibrate(50);
    }
    if(frame){
      frame.classList.remove('error', 'warn');
      frame.classList.add('success');
      setTimeout(() => frame.classList.remove('success'), 450);
    }
    if(status){
      status.style.color = '#34d399';
      status.innerHTML = `✅ හඳුනාගත්තා: <b>${esc(cleanCode)}</b>`;
    }

    if(typeof this.callback === 'function'){
      this.callback(cleanCode);
    } else {
      const event = new CustomEvent('barcodeScanned', { detail: { code: cleanCode } });
      window.dispatchEvent(event);
    }

    if(!this.continuous){
      this.isScanning = false;
      setTimeout(() => this.close(), 350);
    } else {
      setTimeout(() => {
        if(this.isScanning && status){
          status.style.color = 'var(--muted, #94a3b8)';
          status.innerHTML = '📷 Camera එකට Barcode එක හෝ QR එක යොමු කරන්න...';
        }
      }, 1400);
    }
  },

  /* ---------- Smart Web Audio Synthesizer (Success, Warn, Error) ---------- */
  beep(type = 'success'){
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if(!AudioCtx) return;
      const ctx = new AudioCtx();

      if(type === 'success'){
        // High crisp bell beep (880Hz A5)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.16, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else if(type === 'warn'){
        // Warning triangle chime (440Hz A4)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } else {
        // ❌ Error buzzer: low dual-pulse (220Hz + 165Hz)
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.type = 'sawtooth';
        osc2.type = 'square';
        osc1.frequency.setValueAtTime(220, ctx.currentTime);
        osc2.frequency.setValueAtTime(165, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 0.28);
        osc2.stop(ctx.currentTime + 0.28);
      }
    } catch(_){}
  },

  close(){
    this.isScanning = false;
    this.lastCode = null;
    this.lastScanTime = 0;
    this.scannedCount = 0;
    this.isTorchOn = false;
    this.torchSupported = false;

    if(this.rafId){
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if(this.zxingReader){
      try {
        this.zxingReader.reset();
      } catch(_){}
      this.zxingReader = null;
    }

    // 1. Explicitly pause and detach video stream
    const video = document.getElementById('bsmVideo');
    if(video){
      try {
        video.pause();
        video.srcObject = null;
      } catch(_){}
    }

    // 2. Stop all camera media tracks completely so hardware indicator turns off
    if(this.stream){
      try {
        this.stream.getTracks().forEach(t => {
          t.stop();
          t.enabled = false;
        });
      } catch(_){}
      this.stream = null;
    }

    // 3. Remove modal DOM
    const modal = document.getElementById('barcodeScannerModal');
    if(modal) modal.remove();
    this.callback = null;
  }
};

window.BarcodeScanner = BarcodeScanner;

function scanBarcodeForField(selector, autoSearch = false){
  if(typeof BarcodeScanner !== 'undefined' && BarcodeScanner.open){
    // In field auto-fill mode, do not restrict to existing products (allow new barcode registration)
    BarcodeScanner.open((code) => {
      const el = document.querySelector(selector);
      if(el){
        el.value = code;
        el.focus();
        if(autoSearch && typeof debouncedInvSearch === 'function'){
          debouncedInvSearch(code);
        }
        if(typeof toast === 'function') toast('Barcode එක ඇතුළත් විය: ' + code, 'ok');
      }
    }, { requireShopProduct: false });
  } else {
    if(typeof toast === 'function') toast('Camera Scanner සක්‍රීය නැත', 'warn');
  }
}

window.scanBarcodeForField = scanBarcodeForField;
