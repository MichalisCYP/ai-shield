// Quick script to generate placeholder icon PNGs for AI Shield
// Run with: node generate-icons.js

const fs = require("fs");
const path = require("path");

// Minimal valid PNG generator (solid color icons)
// Creates a simple colored square PNG

function createPNG(size, r, g, b) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0); // width
  ihdrData.writeUInt32BE(size, 4); // height
  ihdrData.writeUInt8(8, 8); // bit depth
  ihdrData.writeUInt8(2, 9); // color type (RGB)
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace

  const ihdr = createChunk("IHDR", ihdrData);

  // IDAT chunk - raw image data
  // Each row: filter byte (0) + RGB pixels
  const rowSize = 1 + size * 3;
  const rawData = Buffer.alloc(rowSize * size);

  for (let y = 0; y < size; y++) {
    const offset = y * rowSize;
    rawData[offset] = 0; // filter: none

    for (let x = 0; x < size; x++) {
      const px = offset + 1 + x * 3;
      // Create a shield-like pattern
      const cx = size / 2;
      const cy = size / 2;
      const dx = Math.abs(x - cx) / cx;
      const dy = (y - cy) / cy;

      // Shield shape: wider at top, narrower at bottom
      const shieldWidth = dy < 0 ? 0.7 : 0.7 - dy * 0.5;
      const inShield = dx < shieldWidth && dy > -0.7 && dy < 0.7;

      // Circle background
      const dist = Math.sqrt(dx * dx + dy * dy);
      const inCircle = dist < 0.9;

      if (inShield) {
        rawData[px] = r; // Shield color (blue)
        rawData[px + 1] = g;
        rawData[px + 2] = b;
      } else if (inCircle) {
        rawData[px] = 26; // Dark background
        rawData[px + 1] = 26;
        rawData[px + 2] = 46;
      } else {
        rawData[px] = 240; // Light background
        rawData[px + 1] = 242;
        rawData[px + 2] = 245;
      }
    }
  }

  // Compress with zlib
  const zlib = require("zlib");
  const compressed = zlib.deflateSync(rawData);
  const idat = createChunk("IDAT", compressed);

  // IEND chunk
  const iend = createChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);

  const typeBuffer = Buffer.from(type);
  const crcData = Buffer.concat([typeBuffer, data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData));

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(data) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const imagesDir = path.join(__dirname, "images");
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir);
}

const sizes = [16, 32, 48, 128];
sizes.forEach((size) => {
  const png = createPNG(size, 26, 115, 232); // Blue shield
  fs.writeFileSync(path.join(imagesDir, `icon-${size}.png`), png);
  console.log(`Created icon-${size}.png`);
});

console.log("Done! Icons generated in images/");
