/* =========================================================
   js/barcode-scanner.js - Phone Camera Barcode Scanner
   Phase 6: Hardware Integration (Web BarcodeDetector API)
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

  toggleContinuous(val){
    this.continuous = Boolean(val);
    localStorage.setItem('pos.scanner.continuous', this.continuous ? 'true' : 'false');
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

  async open(callback){
    this.callback = typeof callback === 'function' ? callback : null;
    await this.init();

    // Reset counters and cooldowns
    this.lastCode = null;
    this.lastScanTime = 0;
    this.scannedCount = 0;

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
          <div style="display:flex;align-items:center;gap:8px">
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
            console.log('📷 Native Barcode detected:', code);
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
          console.log('📷 ZXing Barcode detected:', result.text);
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

    // Cooldown check: prevent scanning same code repeatedly within 1.4s
    const now = Date.now();
    if(this.lastCode === cleanCode && (now - this.lastScanTime < 1400)){
      return;
    }
    this.lastCode = cleanCode;
    this.lastScanTime = now;
    this.scannedCount = (this.scannedCount || 0) + 1;

    // 1. Haptic Feedback (Vibrate 50ms)
    if(typeof navigator !== 'undefined' && navigator.vibrate){
      navigator.vibrate(50);
    }

    // 2. Audio Feedback Beep
    this.beep();

    // 3. Visual feedback (Frame flash green)
    const frame = document.querySelector('.bsm-frame');
    if(frame){
      frame.classList.add('success');
      setTimeout(() => frame.classList.remove('success'), 450);
    }

    const countEl = document.getElementById('bsmCount');
    if(countEl){
      countEl.textContent = `ස්කෑන් කළ භාණ්ඩ: ${this.scannedCount}`;
    }

    const status = document.getElementById('bsmStatus');
    if(status){
      status.style.color = '#34d399';
      status.innerHTML = `✅ හඳුනාගත්තා: <b>${cleanCode}</b>` + 
        (this.continuous ? `<br><small style="color:#6ee7b7;font-size:11px">Cart එකට එක්විය! ඊළඟ භාණ්ඩය යොමු කරන්න...</small>` : '');
    }

    // 4. Dispatch to custom callback or fallback to POS cart handler
    if(typeof this.callback === 'function'){
      this.callback(cleanCode);
    } else {
      const event = new CustomEvent('barcodeScanned', { detail: { code: cleanCode } });
      window.dispatchEvent(event);
    }

    // 5. Handling exit vs continuous scanning
    if(!this.continuous){
      // Single scan mode: close immediately
      this.isScanning = false;
      setTimeout(() => {
        this.close();
      }, 350);
    } else {
      // Continuous scan mode: keep camera active & prompt for next item after 1.4s
      setTimeout(() => {
        if(this.isScanning && status){
          status.style.color = 'var(--muted, #94a3b8)';
          status.innerHTML = '📷 Camera එකට Barcode එක හෝ QR එක යොමු කරන්න...';
        }
      }, 1400);
    }
  },

  beep(){
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if(!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // 880Hz (A5)
      gain.gain.setValueAtTime(0.14, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch(_){}
  },

  close(){
    this.isScanning = false;
    this.lastCode = null;
    this.lastScanTime = 0;
    this.scannedCount = 0;

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
    });
  } else {
    if(typeof toast === 'function') toast('Camera Scanner සක්‍රීය නැත', 'warn');
  }
}

window.scanBarcodeForField = scanBarcodeForField;
