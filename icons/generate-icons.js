/* =========================================================
   icons/generate-icons.js - Standalone PWA Icon Generator
   Creates all standard PWA PNG icons and favicon without external deps
   ========================================================= */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 implementation for PNG chunks
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(12 + len);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const typeAndData = buf.subarray(4, 8 + len);
  const crc = crc32(typeAndData);
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

function createPng(width, height, rgbaBuffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // RGBA color type
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // IDAT
  const rowLen = 1 + width * 4;
  const rawScanlines = Buffer.alloc(rowLen * height);
  for (let y = 0; y < height; y++) {
    rawScanlines[y * rowLen] = 0; // None filter
    rgbaBuffer.copy(rawScanlines, y * rowLen + 1, y * width * 4, (y + 1) * width * 4);
  }
  const compressed = zlib.deflateSync(rawScanlines, { level: 9 });
  const idatChunk = makeChunk('IDAT', compressed);

  // IEND
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Draw professional app icon buffer
function renderAppIcon(size, variant = 'app') {
  const buf = Buffer.alloc(size * size * 4);

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.20; // 20% squircle corner radius

  function isInsideRoundedRect(x, y, w, h, r) {
    if (x < r && y < r) return Math.hypot(x - r, y - r) <= r;
    if (x > w - r && y < r) return Math.hypot(x - (w - r), y - r) <= r;
    if (x < r && y > h - r) return Math.hypot(x - r, y - (h - r)) <= r;
    if (x > w - r && y > h - r) return Math.hypot(x - (w - r), y - (h - r)) <= r;
    return x >= 0 && x <= w && y >= 0 && y <= h;
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      if (!isInsideRoundedRect(x, y, size, size, radius)) {
        buf[idx] = 0;
        buf[idx + 1] = 0;
        buf[idx + 2] = 0;
        buf[idx + 3] = 0; // transparent
        continue;
      }

      // Background diagonal gradient: #f59e0b (245, 158, 11) to #92400e (146, 64, 14)
      const t = (x + y) / (size * 2);
      let r = Math.round(245 * (1 - t) + 146 * t);
      let g = Math.round(158 * (1 - t) + 64 * t);
      let b = Math.round(11 * (1 - t) + 14 * t);

      if (variant === 'billing') {
        // Emerald to teal gradient for billing
        r = Math.round(16 * (1 - t) + 5 * t);
        g = Math.round(185 * (1 - t) + 150 * t);
        b = Math.round(129 * (1 - t) + 105 * t);
      } else if (variant === 'inventory') {
        // Blue to indigo gradient for inventory
        r = Math.round(59 * (1 - t) + 30 * t);
        g = Math.round(130 * (1 - t) + 64 * t);
        b = Math.round(246 * (1 - t) + 175 * t);
      }

      // Border highlight (2px inset)
      const borderDist = Math.min(x, y, size - 1 - x, size - 1 - y);
      if (borderDist <= 2) {
        r = Math.min(255, r + 40);
        g = Math.min(255, g + 40);
        b = Math.min(255, b + 40);
      }

      // Center symbol rendering
      const dx = (x - cx) / (size / 2);
      const dy = (y - cy) / (size / 2);
      const dist = Math.hypot(dx, dy);

      let isFg = false;
      let isAccent = false;

      if (variant === 'app') {
        // Draw diagonal wrench shape:
        // Handle: rot -45 deg
        const rx = dx * Math.cos(Math.PI / 4) - dy * Math.sin(Math.PI / 4);
        const ry = dx * Math.sin(Math.PI / 4) + dy * Math.cos(Math.PI / 4);

        // Shaft
        if (Math.abs(rx) <= 0.12 && ry >= -0.55 && ry <= 0.55) {
          isFg = true;
          if (Math.abs(rx) <= 0.05 && ry >= -0.4 && ry <= 0.4) isAccent = true;
        }

        // Top open wrench head
        const topD = Math.hypot(rx, ry - 0.55);
        if (topD <= 0.28 && !(topD <= 0.14 && ry > 0.58)) {
          isFg = true;
        }

        // Bottom ring wrench head
        const botD = Math.hypot(rx, ry + 0.55);
        if (botD <= 0.26 && botD >= 0.12) {
          isFg = true;
        }

        // Decorative subtle central ring
        if (dist >= 0.65 && dist <= 0.72) {
          r = Math.min(255, r + 25);
          g = Math.min(255, g + 25);
          b = Math.min(255, b + 25);
        }
      } else if (variant === 'billing') {
        // POS receipt / coin symbol
        if (Math.abs(dx) <= 0.35 && Math.abs(dy) <= 0.5) isFg = true;
        if (Math.abs(dx) <= 0.25 && (Math.abs(dy - 0.1) <= 0.03 || Math.abs(dy + 0.1) <= 0.03)) isAccent = true;
      } else if (variant === 'inventory') {
        // Box / package cube symbol
        if (Math.abs(dx) <= 0.4 && Math.abs(dy) <= 0.4) isFg = true;
        if (Math.abs(dx) <= 0.08 || Math.abs(dy) <= 0.08) isAccent = true;
      }

      if (isFg) {
        if (isAccent) {
          buf[idx] = 203; // Slate light accent
          buf[idx + 1] = 213;
          buf[idx + 2] = 225;
          buf[idx + 3] = 255;
        } else {
          buf[idx] = 255; // White foreground
          buf[idx + 1] = 255;
          buf[idx + 2] = 255;
          buf[idx + 3] = 255;
        }
      } else {
        buf[idx] = r;
        buf[idx + 1] = g;
        buf[idx + 2] = b;
        buf[idx + 3] = 255;
      }
    }
  }

  return buf;
}

// Generate all required sizes
const SIZES = [16, 32, 72, 96, 128, 144, 152, 180, 192, 384, 512];
const outDir = path.join(__dirname);

console.log('🚀 Generating PWA PNG icons...');

SIZES.forEach(sz => {
  const rgba = renderAppIcon(sz, 'app');
  const png = createPng(sz, sz, rgba);
  const outPath = path.join(outDir, `icon-${sz}x${sz}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`✅ Generated ${path.basename(outPath)} (${sz}x${sz})`);
});

// Shortcuts
const billRgba = renderAppIcon(96, 'billing');
fs.writeFileSync(path.join(outDir, 'shortcut-billing.png'), createPng(96, 96, billRgba));
console.log('✅ Generated shortcut-billing.png (96x96)');

const invRgba = renderAppIcon(96, 'inventory');
fs.writeFileSync(path.join(outDir, 'shortcut-inventory.png'), createPng(96, 96, invRgba));
console.log('✅ Generated shortcut-inventory.png (96x96)');

// Generate standard favicon.ico containing 32x32 PNG
const favPng = fs.readFileSync(path.join(outDir, 'icon-32x32.png'));
const rootDir = path.join(__dirname, '..');
const icoHeader = Buffer.alloc(22);
icoHeader.writeUInt16LE(0, 0); // reserved
icoHeader.writeUInt16LE(1, 2); // type: 1 = ICO
icoHeader.writeUInt16LE(1, 4); // 1 image
// Directory entry
icoHeader.writeUInt8(32, 6);   // width 32
icoHeader.writeUInt8(32, 7);   // height 32
icoHeader.writeUInt8(0, 8);    // color count
icoHeader.writeUInt8(0, 9);    // reserved
icoHeader.writeUInt16LE(1, 10); // color planes
icoHeader.writeUInt16LE(32, 12); // bits per pixel
icoHeader.writeUInt32LE(favPng.length, 14); // image size
icoHeader.writeUInt32LE(22, 18); // offset where PNG data begins

const icoBuf = Buffer.concat([icoHeader, favPng]);
fs.writeFileSync(path.join(rootDir, 'favicon.ico'), icoBuf);
fs.writeFileSync(path.join(outDir, 'favicon.ico'), icoBuf);
console.log('✅ Generated favicon.ico');

console.log('🎉 All icons successfully generated!');
