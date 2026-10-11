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

  async open(){
    await this.init();

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
          <h3>📷 Barcode ස්කෑන් කරන්න (Camera Scanner)</h3>
          <button type="button" class="bsm-close" title="වසන්න (Close)">✕</button>
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
            return;
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
    this.isScanning = false;

    // 1. Haptic Feedback (Vibrate 50ms)
    if(typeof navigator !== 'undefined' && navigator.vibrate){
      navigator.vibrate(50);
    }

    // 2. Audio Feedback Beep
    this.beep();

    // 3. UI Status Update
    const status = document.getElementById('bsmStatus');
    if(status){
      status.style.color = '#34d399';
      status.textContent = '✅ හඳුනාගත්තා: ' + code;
    }

    // 4. Close and dispatch after brief visual confirmation
    setTimeout(() => {
      this.close();
      const event = new CustomEvent('barcodeScanned', { detail: { code: String(code).trim() } });
      window.dispatchEvent(event);
    }, 280);
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
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch(_){}
  },

  close(){
    this.isScanning = false;

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

    if(this.stream){
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }

    const modal = document.getElementById('barcodeScannerModal');
    if(modal) modal.remove();
  }
};

window.BarcodeScanner = BarcodeScanner;
