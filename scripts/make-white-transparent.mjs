import fs from "node:fs";
import path from "node:path";

import sharp from "sharp";

const input = process.argv[2];
const output = process.argv[3];

if (!input || !output) {
  console.error("Usage: node scripts/make-white-transparent.mjs <input> <output>");
  process.exit(1);
}

function neighbors4(x, y, width, height) {
  const out = [];
  if (x > 0) out.push([x - 1, y]);
  if (x < width - 1) out.push([x + 1, y]);
  if (y > 0) out.push([x, y - 1]);
  if (y < height - 1) out.push([x, y + 1]);
  return out;
}

function isBackgroundPixel(r, g, b, tolerance = 24) {
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  const sat = max - min;
  return min >= 255 - tolerance && sat <= tolerance;
}

const image = sharp(input);
const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height } = info;

const bgMask = new Uint8Array(width * height);
const queue = [];

function pushBg(x, y) {
  const p = y * width + x;
  if (bgMask[p]) return;
  const i = p * 4;
  if (!isBackgroundPixel(data[i], data[i + 1], data[i + 2])) return;
  bgMask[p] = 1;
  queue.push(p);
}

for (let x = 0; x < width; x += 1) {
  pushBg(x, 0);
  pushBg(x, height - 1);
}
for (let y = 0; y < height; y += 1) {
  pushBg(0, y);
  pushBg(width - 1, y);
}

while (queue.length > 0) {
  const p = queue.pop();
  const x = p % width;
  const y = Math.floor(p / width);
  for (const [nx, ny] of neighbors4(x, y, width, height)) {
    const np = ny * width + nx;
    if (bgMask[np]) continue;
    const ni = np * 4;
    if (isBackgroundPixel(data[ni], data[ni + 1], data[ni + 2], 28)) {
      bgMask[np] = 1;
      queue.push(np);
    }
  }
}

for (let p = 0; p < width * height; p += 1) {
  if (bgMask[p]) data[p * 4 + 3] = 0;
}

fs.mkdirSync(path.dirname(output), { recursive: true });
await sharp(data, { raw: { width, height, channels: 4 } })
  .trim({ threshold: 10 })
  .png()
  .toFile(output);

console.log(`Wrote ${output}`);
