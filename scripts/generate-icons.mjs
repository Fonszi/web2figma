/**
 * Generate placeholder PNG icons for the Forge Chrome Extension.
 *
 * Creates minimal valid PNG files at 16x16, 48x48, and 128x128.
 * Uses a dark purple background (#5B21B6) with a white "F" rendered as pixels.
 *
 * These are development placeholders — replace with proper designed icons
 * before Chrome Web Store submission.
 *
 * Usage: node scripts/generate-icons.mjs
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { deflateSync } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(__dirname, '../extension/icons');

if (!existsSync(iconsDir)) mkdirSync(iconsDir, { recursive: true });

/**
 * Create a minimal valid PNG file with a solid background and a simple "F" letter.
 */
function createPng(size) {
  // Colors
  const bg = [0x5B, 0x21, 0xB6]; // Purple (#5B21B6)
  const fg = [0xFF, 0xFF, 0xFF]; // White

  // Create raw pixel data (RGBA, with filter byte per row)
  const rowBytes = size * 4 + 1; // 4 bytes per pixel + 1 filter byte
  const rawData = Buffer.alloc(rowBytes * size);

  // Define the "F" letter pattern relative to the size
  const margin = Math.max(Math.floor(size * 0.2), 2);
  const strokeW = Math.max(Math.floor(size * 0.15), 2);
  const barY = Math.floor(size * 0.45);

  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < size; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      let isLetter = false;

      // Vertical stroke (left side of F)
      if (x >= margin && x < margin + strokeW && y >= margin && y < size - margin) {
        isLetter = true;
      }
      // Top horizontal stroke
      if (y >= margin && y < margin + strokeW && x >= margin && x < size - margin) {
        isLetter = true;
      }
      // Middle horizontal stroke
      if (y >= barY && y < barY + strokeW && x >= margin && x < size - margin - strokeW) {
        isLetter = true;
      }

      const color = isLetter ? fg : bg;
      rawData[pixelOffset] = color[0];
      rawData[pixelOffset + 1] = color[1];
      rawData[pixelOffset + 2] = color[2];
      rawData[pixelOffset + 3] = 0xFF; // Alpha
    }
  }

  // Compress raw data
  const compressed = deflateSync(rawData);

  // Build PNG file
  const chunks = [];

  // PNG signature
  chunks.push(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);  // Width
  ihdr.writeUInt32BE(size, 4);  // Height
  ihdr[8] = 8;                  // Bit depth
  ihdr[9] = 6;                  // Color type: RGBA
  ihdr[10] = 0;                 // Compression
  ihdr[11] = 0;                 // Filter
  ihdr[12] = 0;                 // Interlace
  chunks.push(makeChunk('IHDR', ihdr));

  // IDAT chunk
  chunks.push(makeChunk('IDAT', compressed));

  // IEND chunk
  chunks.push(makeChunk('IEND', Buffer.alloc(0)));

  return Buffer.concat(chunks);
}

function makeChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const crcInput = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);

  return Buffer.concat([length, typeBytes, data, crc]);
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Generate all 3 sizes
const sizes = [16, 48, 128];

for (const size of sizes) {
  const png = createPng(size);
  const path = resolve(iconsDir, `icon-${size}.png`);
  writeFileSync(path, png);
  console.log(`Generated: ${path} (${png.length} bytes)`);
}

console.log('\nPlaceholder icons generated. Replace with designed icons before store submission.');
