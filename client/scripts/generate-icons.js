const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(type, data) {
  let c = zlib.crc32(Buffer.from(type, 'ascii'));
  if (data.length) c = zlib.crc32(data, c);
  return c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(type, data), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgb) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // color type RGB
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 3);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x++) {
      const px = rgb[y * width + x];
      const off = rowStart + 1 + x * 3;
      raw[off] = px[0];
      raw[off + 1] = px[1];
      raw[off + 2] = px[2];
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function makeIcon(size) {
  const px = new Array(size * size);
  const bg = [37, 99, 235];        // blue-600 #2563eb
  const white = [255, 255, 255];
  const S = size / 24;             // scale factor from 24-space

  function set(x, y, c) {
    const ix = Math.round(x * S), iy = Math.round(y * S);
    if (ix < 0 || iy < 0 || ix >= size || iy >= size) return;
    px[iy * size + ix] = c;
  }

  function fillCircle(x, y, r) {
    const ir = Math.round(r * S);
    const cx = Math.round(x * S), cy = Math.round(y * S);
    for (let dy = -ir; dy <= ir; dy++) {
      for (let dx = -ir; dx <= ir; dx++) {
        const ix = cx + dx, iy = cy + dy;
        if (ix < 0 || iy < 0 || ix >= size || iy >= size) continue;
        if (dx * dx + dy * dy <= ir * ir) px[iy * size + ix] = white;
      }
    }
  }

  function line(x1, y1, x2, y2, thickness) {
    const steps = Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) * S);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      fillCircle(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, thickness / 2);
    }
  }

  for (let i = 0; i < size * size; i++) px[i] = bg.slice();

  const t = 1.15; // stroke thickness (24-space)

  // left pan (V shape)
  line(2, 16, 5, 8, t);
  line(5, 8, 8, 16, t);
  // right pan (V shape)
  line(16, 16, 19, 8, t);
  line(19, 8, 22, 16, t);
  // base
  line(7, 21, 17, 21, t);
  // center stand
  line(12, 3, 12, 21, t);
  // top beam (gentle arc approximated)
  line(3, 7, 12, 5, t);
  line(12, 5, 21, 7, t);

  return encodePng(size, size, px);
}

const outDir = process.argv[2] || path.join(__dirname);
fs.writeFileSync(path.join(outDir, 'logo192.png'), makeIcon(192));
fs.writeFileSync(path.join(outDir, 'logo512.png'), makeIcon(512));
console.log('Generated logo192.png and logo512.png in', outDir);