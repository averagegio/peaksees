import sharp from "sharp";

const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) {
  console.error("Usage: node make-transparent-png.mjs <input.png> <output.png>");
  process.exit(1);
}

const WHITE = 248;

const { data, info } = await sharp(input)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height } = info;
const visited = new Uint8Array(width * height);
const queue = [];

function isWhite(idx) {
  return data[idx] >= WHITE && data[idx + 1] >= WHITE && data[idx + 2] >= WHITE;
}

function pushIfWhite(x, y) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const p = y * width + x;
  if (visited[p]) return;
  const idx = p * 4;
  if (!isWhite(idx)) return;
  visited[p] = 1;
  queue.push(p);
}

for (let x = 0; x < width; x += 1) {
  pushIfWhite(x, 0);
  pushIfWhite(x, height - 1);
}
for (let y = 0; y < height; y += 1) {
  pushIfWhite(0, y);
  pushIfWhite(width - 1, y);
}

while (queue.length > 0) {
  const p = queue.pop();
  const x = p % width;
  const y = Math.floor(p / width);
  data[p * 4 + 3] = 0;
  pushIfWhite(x - 1, y);
  pushIfWhite(x + 1, y);
  pushIfWhite(x, y - 1);
  pushIfWhite(x, y + 1);
}

await sharp(data, {
  raw: { width, height, channels: 4 },
})
  .png()
  .toFile(output);

console.log(`Wrote ${output} (${width}x${height})`);
