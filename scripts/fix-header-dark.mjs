/**
 * Makes near-white fills transparent so letter counters don't glow on dark UI.
 * Run: node scripts/fix-header-dark.mjs
 */
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "public", "peaksees-header-transparent.png");
const out = path.join(root, "public", "peaksees-header-dark.png");

const WHITE = 248;

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

for (let i = 0; i < data.length; i += 4) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const a = data[i + 3];
  if (a < 8) continue;
  if (r >= WHITE && g >= WHITE && b >= WHITE) {
    data[i + 3] = 0;
  }
}

await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
  .png()
  .toFile(out);

console.log(`Wrote ${out} (${info.width}x${info.height})`);
