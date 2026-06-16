import fs from "node:fs";
import path from "node:path";

import sharp from "sharp";

const input = process.argv[2];
const output = process.argv[3];

if (!input || !output) {
  console.error("Usage: node scripts/make-transparent-png.mjs <input> <output>");
  process.exit(1);
}

function samplePixel(data, width, x, y) {
  const i = (y * width + x) * 4;
  return [data[i], data[i + 1], data[i + 2]];
}

function matchesBg(r, g, b, bgColors, tolerance) {
  for (const [cr, cg, cb] of bgColors) {
    if (
      Math.abs(r - cr) <= tolerance &&
      Math.abs(g - cg) <= tolerance &&
      Math.abs(b - cb) <= tolerance
    ) {
      return true;
    }
  }
  return false;
}

const image = sharp(input);
const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height } = info;

const bgSamples = [
  samplePixel(data, width, 0, 0),
  samplePixel(data, width, 1, 0),
  samplePixel(data, width, 0, 1),
  samplePixel(data, width, 1, 1),
  samplePixel(data, width, width - 1, 0),
  samplePixel(data, width, width - 2, 0),
  samplePixel(data, width, 0, height - 1),
  samplePixel(data, width, 1, height - 1),
  samplePixel(data, width, width - 1, height - 1),
  samplePixel(data, width, width - 2, height - 1),
];

const bgColors = [];
for (const sample of bgSamples) {
  const exists = bgColors.some(
    (c) =>
      Math.abs(c[0] - sample[0]) < 8 &&
      Math.abs(c[1] - sample[1]) < 8 &&
      Math.abs(c[2] - sample[2]) < 8,
  );
  if (!exists) bgColors.push(sample);
}

for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const i = (y * width + x) * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (matchesBg(r, g, b, bgColors, 28)) {
      data[i + 3] = 0;
    }
  }
}

fs.mkdirSync(path.dirname(output), { recursive: true });
await sharp(data, { raw: { width, height, channels: 4 } }).png().toFile(output);
console.log(`Wrote ${output} (${width}x${height})`);
