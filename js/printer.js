/* =========================================================
   js/printer.js - Bluetooth Thermal Printer (ESC/POS)
   Phase 6: Hardware Integration (Web Bluetooth API)
   ========================================================= */

const Printer = {
  device: null,
  characteristic: null,
  isConnected: false,
  printerName: '',

  get autoPrint(){
    return localStorage.getItem('pos.printer.autoprint') !== 'false';
  },
  get autoDrawer(){
    return localStorage.getItem('pos.printer.autodrawer') !== 'false';
  },
  get paperWidth(){
    return localStorage.getItem('pos.printerWidth') || '58';
  },

  // ESC/POS Command Constants
  ESC: 0x1B,
  GS:  0x1D,
  LF:  0x0A,

  async connect(){
    if(typeof navigator === 'undefined' || !navigator.bluetooth){
      if(typeof toast === 'function') toast('❌ මෙම Browser එකෙහි Web Bluetooth පහසුකම නොමැත (Use Chrome or Edge)', 'err');
      return false;
    }

    try {
      // Prompt user to select Bluetooth printer
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          0xFF00,
          0x18F0,
          0xFFE0,
          0x1101,
          '000018f0-0000-1000-8000-00805f9b34fb',
          '0000ffe0-0000-1000-8000-00805f9b34fb',
          '49535343-fe7d-4ae5-8fa9-9fafd205e455',
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
          'battery_service'
        ]
      });

      if(!device || !device.gatt){
        if(typeof toast === 'function') toast('❌ Printer උපකරණය තෝරා නොගන්නා ලදී', 'warn');
        return false;
      }

      const server = await device.gatt.connect();

      // Locate writable characteristic
      let characteristic = null;
      try {
        const services = await server.getPrimaryServices();
        for(const service of services){
          try {
            const chars = await service.getCharacteristics();
            for(const c of chars){
              if(c.properties.write || c.properties.writeWithoutResponse){
                characteristic = c;
                break;
              }
            }
          } catch(_){}
          if(characteristic) break;
        }
      } catch(srvErr){
        console.warn('Direct service enumeration failed, attempting standard service UUIDs:', srvErr);
        const standardServices = [0xFF00, 0x18F0, 0xFFE0, '000018f0-0000-1000-8000-00805f9b34fb'];
        for(const sId of standardServices){
          try {
            const s = await server.getPrimaryService(sId);
            const chars = await s.getCharacteristics();
            for(const c of chars){
              if(c.properties.write || c.properties.writeWithoutResponse){
                characteristic = c;
                break;
              }
            }
          } catch(_){}
          if(characteristic) break;
        }
      }

      if(!characteristic){
        if(typeof toast === 'function') toast('❌ මුද්‍රණ යන්ත්‍රයේ Writable Characteristic හමු නොවීය', 'err');
        return false;
      }

      this.device = device;
      this.characteristic = characteristic;
      this.isConnected = true;
      this.printerName = device.name || 'Bluetooth Printer';

      localStorage.setItem('pos.printer.connected', 'true');
      localStorage.setItem('pos.printer.name', this.printerName);

      device.addEventListener('gattserverdisconnected', () => {
        this.isConnected = false;
        this.characteristic = null;
        if(typeof toast === 'function') toast('⚠️ Printer සම්බන්ධතාවය විසන්ධි විය (Disconnected)', 'warn');
        if(typeof render === 'function' && window.state?.page === 'settings') render();
      });

      if(typeof toast === 'function') toast(`✅ ${this.printerName} සාර්ථකව සම්බන්ධ විය!`, 'ok');
      if(typeof render === 'function' && window.state?.page === 'settings') render();
      return true;

    } catch(err) {
      if(err.name === 'NotFoundError') return false; // User cancelled prompt
      console.error('Bluetooth connection error:', err);
      if(typeof toast === 'function') toast('❌ Bluetooth දෝෂය: ' + err.message, 'err');
      return false;
    }
  },

  async disconnect(){
    if(this.device && this.device.gatt && this.device.gatt.connected){
      this.device.gatt.disconnect();
    }
    this.device = null;
    this.characteristic = null;
    this.isConnected = false;
    localStorage.removeItem('pos.printer.connected');
    if(typeof toast === 'function') toast('🔌 Printer විසන්ධි කරන ලදී', 'ok');
    if(typeof render === 'function' && window.state?.page === 'settings') render();
    return true;
  },

  async print(data){
    if(!this.isConnected || !this.characteristic){
      if(typeof toast === 'function') toast('⚠️ Printer එකක් සම්බන්ධ කර නොමැත', 'warn');
      return false;
    }

    try {
      // Chunk payload into ~100 bytes to respect BLE GATT MTU constraints
      const chunkSize = 100;
      const bytes = (data instanceof Uint8Array) ? data : new Uint8Array(data);

      for(let i = 0; i < bytes.length; i += chunkSize){
        const chunk = bytes.slice(i, i + chunkSize);
        if(this.characteristic.properties.writeWithoutResponse){
          await this.characteristic.writeValueWithoutResponse(chunk);
        } else {
          await this.characteristic.writeValue(chunk);
        }
        await new Promise(r => setTimeout(r, 25));
      }

      return true;
    } catch(err){
      console.error('Print transmission error:', err);
      if(typeof toast === 'function') toast('❌ මුද්‍රණ දෝෂය: ' + err.message, 'err');
      return false;
    }
  },

  // ESC/POS Byte Helpers
  text(str){
    const encoder = new TextEncoder();
    return encoder.encode(str);
  },

  line(){
    return new Uint8Array([this.LF]);
  },

  init(){
    return new Uint8Array([this.ESC, 0x40]);
  },

  alignLeft(){
    return new Uint8Array([this.ESC, 0x61, 0x00]);
  },

  alignCenter(){
    return new Uint8Array([this.ESC, 0x61, 0x01]);
  },

  alignRight(){
    return new Uint8Array([this.ESC, 0x61, 0x02]);
  },

  bold(on = true){
    return new Uint8Array([this.ESC, 0x45, on ? 1 : 0]);
  },

  doubleHeight(on = true){
    return new Uint8Array([this.ESC, 0x21, on ? 0x10 : 0x00]);
  },

  feed(lines = 3){
    return new Uint8Array([this.ESC, 0x64, lines]);
  },

  cut(){
    return new Uint8Array([this.GS, 0x56, 0x00]); // Full cut
  },

  openDrawer(){
    // ESC p m t1 t2 - pulse pin 2 (cash drawer kickout)
    return new Uint8Array([this.ESC, 0x70, 0x00, 0x19, 0xFA]);
  },

  async openCashDrawer(){
    if(!this.isConnected) return false;
    const cmd = this.openDrawer();
    return await this.print(cmd);
  },

  // Build and print complete ESC/POS receipt
  async printReceipt(sale){
    if(!sale) return false;
    const db = window.DB || {};
    const shop = db.shop || { name: 'Auto Parts Lanka', addr: '', phone: '', footer: '' };
    const paperWidth = localStorage.getItem('pos.printerWidth') || '58'; // '58' or '80'
    const maxChars = paperWidth === '80' ? 48 : 32;

    const parts = [];

    // 1. Initialize
    parts.push(this.init());

    // 2. Header
    parts.push(this.alignCenter());
    parts.push(this.bold(true));
    parts.push(this.doubleHeight(true));
    parts.push(this.text(shop.name || 'AUTO PARTS LANKA'));
    parts.push(this.line());
    parts.push(this.doubleHeight(false));
    parts.push(this.bold(false));

    if(shop.address || shop.addr){
      parts.push(this.text(shop.address || shop.addr));
      parts.push(this.line());
    }
    if(shop.phone){
      parts.push(this.text('Tel: ' + shop.phone));
      parts.push(this.line());
    }
    parts.push(this.line());

    // 3. Invoice Metadata
    parts.push(this.alignLeft());
    parts.push(this.text('Invoice: ' + (sale.no || 'N/A')));
    parts.push(this.line());
    const dateStr = sale.date ? new Date(sale.date).toLocaleString('en-GB') : new Date().toLocaleString('en-GB');
    parts.push(this.text('Date:    ' + dateStr));
    parts.push(this.line());
    parts.push(this.text('Cashier: ' + (sale.cashier || 'Cashier')));
    parts.push(this.line());
    if(sale.customer && sale.customer !== 'වෝක්-ඉන්'){
      parts.push(this.text('Cust:    ' + sale.customer));
      parts.push(this.line());
    }
    if(sale.vehicle){
      parts.push(this.text('Vehicle: ' + sale.vehicle));
      parts.push(this.line());
    }

    // Divider
    parts.push(this.text('-'.repeat(maxChars)));
    parts.push(this.line());

    // 4. Line Items Table
    if(paperWidth === '80'){
      // 80mm layout (48 chars): Item (26) Qty (6) Price (7) Amount (9)
      parts.push(this.text('Item                      Qty   Price    Amount'));
      parts.push(this.line());
      parts.push(this.text('-'.repeat(maxChars)));
      parts.push(this.line());

      for(const item of (sale.items || [])){
        const name = (item.nameEn || item.name || '').slice(0, 24).padEnd(25);
        const qty = String(item.qty).padStart(4) + ' ';
        const price = Number(item.price || 0).toFixed(2).padStart(8) + ' ';
        const amt = (Number(item.price || 0) * Number(item.qty || 1)).toFixed(2).padStart(9);
        parts.push(this.text(name + qty + price + amt));
        parts.push(this.line());
      }
    } else {
      // 58mm layout (32 chars): Item (18) Qty (4) Amount (10)
      parts.push(this.text('Item               Qty    Amount'));
      parts.push(this.line());
      parts.push(this.text('-'.repeat(maxChars)));
      parts.push(this.line());

      for(const item of (sale.items || [])){
        const name = (item.nameEn || item.name || '').slice(0, 17).padEnd(18);
        const qty = String(item.qty).padStart(4) + ' ';
        const amt = (Number(item.price || 0) * Number(item.qty || 1)).toFixed(2).padStart(9);
        parts.push(this.text(name + qty + amt));
        parts.push(this.line());
      }
    }

    // Divider
    parts.push(this.text('-'.repeat(maxChars)));
    parts.push(this.line());

    // 5. Totals (Right Aligned)
    parts.push(this.alignRight());
    const subVal = Number(sale.sub != null ? sale.sub : sale.total).toFixed(2);
    parts.push(this.text('Subtotal: ' + subVal));
    parts.push(this.line());

    if(sale.disc && Number(sale.disc) > 0){
      parts.push(this.text('Discount: -' + Number(sale.disc).toFixed(2)));
      parts.push(this.line());
    }

    if(sale.roundOff && Number(sale.roundOff) !== 0){
      parts.push(this.text('Round-off: ' + (sale.roundOff > 0 ? '+' : '') + Number(sale.roundOff).toFixed(2)));
      parts.push(this.line());
    }

    parts.push(this.bold(true));
    parts.push(this.doubleHeight(true));
    parts.push(this.text('TOTAL: Rs. ' + Number(sale.total || 0).toFixed(2)));
    parts.push(this.line());
    parts.push(this.doubleHeight(false));
    parts.push(this.bold(false));

    // 6. Payment Information
    const methodStr = (sale.method || 'cash').toUpperCase();
    parts.push(this.text('Payment: ' + methodStr));
    parts.push(this.line());

    if(sale.method === 'cash'){
      parts.push(this.text('Cash Paid: ' + Number(sale.paid || sale.total).toFixed(2)));
      parts.push(this.line());
      parts.push(this.text('Change:    ' + Number(sale.change || 0).toFixed(2)));
      parts.push(this.line());
    } else if(sale.cardRef){
      parts.push(this.text('Ref: ' + sale.cardRef));
      parts.push(this.line());
    }

    // 7. Footer
    parts.push(this.alignCenter());
    parts.push(this.line());
    parts.push(this.text(shop.footer || shop.footerEn || 'Thank you! Come again.'));
    parts.push(this.line());
    parts.push(this.text('*** Software by AutoParts POS ***'));
    parts.push(this.line());

    // 8. Feed & Paper Cut
    parts.push(this.feed(4));
    parts.push(this.cut());

    // Merge byte arrays
    let totalLength = 0;
    parts.forEach(p => totalLength += p.length);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    parts.forEach(p => {
      combined.set(p, offset);
      offset += p.length;
    });

    return await this.print(combined);
  },

  async testPrint(){
    const testSale = {
      no: 'TEST-0001',
      date: new Date().toISOString(),
      cashier: window.state?.user?.name || 'Admin',
      customer: 'Test Customer',
      items: [
        { name: 'Brake Pad Set', nameEn: 'Brake Pad Set', qty: 1, price: 4500 },
        { name: 'Oil Filter C-110', nameEn: 'Oil Filter C-110', qty: 2, price: 1250 }
      ],
      sub: 7000,
      disc: 0,
      total: 7000,
      method: 'cash',
      paid: 10000,
      change: 3000
    };
    return await this.printReceipt(testSale);
  }
};

window.Printer = Printer;
