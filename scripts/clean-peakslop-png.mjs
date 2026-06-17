import fs from "node:fs";
import path from "node:path";

import sharp from "sharp";

const input = process.argv[2];
const output = process.argv[3];

if (!input || !output) {
  console.error("Usage: node scripts/clean-peakslop-png.mjs <input> <output>");
  process.exit(1);
}

function samplePixel(data, width, x, y) {
  const i = (y * width + x) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

function colorDist(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
}

function isCheckerboardPixel(r, g, b, bgColors, tolerance = 34) {
  return bgColors.some(
    (c) =>
      Math.abs(r - c[0]) <= tolerance &&
      Math.abs(g - c[1]) <= tolerance &&
      Math.abs(b - c[2]) <= tolerance,
  );
}

function isChartPixel(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max - min;

  // Neon green trendline / candle wicks
  if (g > 120 && g > r + 28 && g > b + 18) return true;
  // Amber / orange trendline
  if (r > 130 && g > 85 && b < 130 && r >= g - 10 && sat > 35) return true;
  // Green candle bodies
  if (g > 65 && g > r + 12 && r < 110 && b < 95 && sat > 20) return true;
  // Brown / red candle bodies
  if (r > 85 && g < 75 && b < 70 && r > g + 18) return true;
  // Yellow-green glow halos from chart
  if (g > 100 && r > 70 && b < 70 && g > b + 35) return true;

  return false;
}

function isLogoPixel(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max - min;

  // Snow / highlights
  if (r > 205 && g > 205 && b > 205) return true;
  // Cyan / blue logo fills
  if (b > 95 && b >= r - 8 && sat > 18) return true;
  // Light aqua fills used in letter bodies
  if (r > 85 && g > 115 && b > 125 && g >= r - 15) return true;
  // Purple logo fills
  if (b > 90 && r > 70 && b >= g - 10 && sat > 20) return true;
  // Dark outlines and pupil
  if (max < 72 && sat < 28) return true;

  return false;
}

function isFringePixel(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max - min;

  // Gray checkerboard residue and clipping halos
  if (sat < 22 && max > 35 && max < 210) return true;
  // Desaturated green/orange dust from chart removal
  if (sat < 45 && g > r && g > 55 && g < 170) return true;
  if (sat < 50 && r > g && r > 70 && r < 190 && b < 120) return true;

  return false;
}

function neighbors4(x, y, width, height) {
  const out = [];
  if (x > 0) out.push([x - 1, y]);
  if (x < width - 1) out.push([x + 1, y]);
  if (y > 0) out.push([x, y - 1]);
  if (y < height - 1) out.push([x, y + 1]);
  return out;
}

function isStraySpeck(r, g, b) {
  if (r > 185 && g > 145 && b < 125) return true;
  if (r > 210 && g > 190 && b < 95) return true;
  return false;
}

function removeStraySpecks(data, width, height) {
  for (let p = 0; p < width * height; p += 1) {
    const i = p * 4;
    if (data[i + 3] === 0) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (!isStraySpeck(r, g, b)) continue;

    let opaqueNeighbors = 0;
    const x = p % width;
    const y = Math.floor(p / width);
    for (const [nx, ny] of neighbors4(x, y, width, height)) {
      const ni = (ny * width + nx) * 4;
      if (data[ni + 3] > 0) opaqueNeighbors += 1;
    }
    if (opaqueNeighbors <= 3) data[i + 3] = 0;
  }
}

function fillInteriorHoles(data, width, height) {
  const transparent = new Uint8Array(width * height);
  const external = new Uint8Array(width * height);
  const queue = [];

  for (let p = 0; p < width * height; p += 1) {
    if (data[p * 4 + 3] === 0) transparent[p] = 1;
  }

  for (let x = 0; x < width; x += 1) {
    for (const y of [0, height - 1]) {
      const p = y * width + x;
      if (transparent[p] && !external[p]) {
        external[p] = 1;
        queue.push(p);
      }
    }
  }
  for (let y = 0; y < height; y += 1) {
    for (const x of [0, width - 1]) {
      const p = y * width + x;
      if (transparent[p] && !external[p]) {
        external[p] = 1;
        queue.push(p);
      }
    }
  }

  while (queue.length > 0) {
    const p = queue.pop();
    const x = p % width;
    const y = Math.floor(p / width);
    for (const [nx, ny] of neighbors4(x, y, width, height)) {
      const np = ny * width + nx;
      if (transparent[np] && !external[np]) {
        external[np] = 1;
        queue.push(np);
      }
    }
  }

  for (let p = 0; p < width * height; p += 1) {
    if (!transparent[p] || external[p]) continue;
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let count = 0;
    const x = p % width;
    const y = Math.floor(p / width);
    for (const [nx, ny] of neighbors4(x, y, width, height)) {
      const ni = (ny * width + nx) * 4;
      if (data[ni + 3] === 0) continue;
      rSum += data[ni];
      gSum += data[ni + 1];
      bSum += data[ni + 2];
      count += 1;
    }
    const i = p * 4;
    if (count > 0) {
      data[i] = Math.round(rSum / count);
      data[i + 1] = Math.round(gSum / count);
      data[i + 2] = Math.round(bSum / count);
      data[i + 3] = 255;
    }
  }
}

function isAntiAliasPixel(r, g, b, data, width, height, p) {
  let logoNeighbors = 0;
  const x = p % width;
  const y = Math.floor(p / width);
  for (const [nx, ny] of neighbors4(x, y, width, height)) {
    const ni = (ny * width + nx) * 4;
    if (data[ni + 3] === 0) continue;
    if (isLogoPixel(data[ni], data[ni + 1], data[ni + 2])) logoNeighbors += 1;
  }
  if (logoNeighbors < 2) return false;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min < 80;
}

function repairEnclosedArtifacts(data, width, height, bgColors) {
  for (let pass = 0; pass < 3; pass += 1) {
    for (let p = 0; p < width * height; p += 1) {
      const i = p * 4;
      if (data[i + 3] === 0) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const artifact =
        isFringePixel(r, g, b) ||
        isChartPixel(r, g, b) ||
        isCheckerboardPixel(r, g, b, bgColors, 42) ||
        isStraySpeck(r, g, b);

      if (!artifact && isLogoPixel(r, g, b)) continue;
      if (!artifact && isAntiAliasPixel(r, g, b, data, width, height, p)) continue;
      if (!artifact) continue;

      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let count = 0;
      const x = p % width;
      const y = Math.floor(p / width);
      for (const [nx, ny] of neighbors4(x, y, width, height)) {
        const ni = (ny * width + nx) * 4;
        if (data[ni + 3] === 0) continue;
        if (!isLogoPixel(data[ni], data[ni + 1], data[ni + 2])) continue;
        rSum += data[ni];
        gSum += data[ni + 1];
        bSum += data[ni + 2];
        count += 1;
      }

      if (count >= 2) {
        data[i] = Math.round(rSum / count);
        data[i + 1] = Math.round(gSum / count);
        data[i + 2] = Math.round(bSum / count);
        data[i + 3] = 255;
      } else {
        data[i + 3] = 0;
      }
    }
  }
}

function stripNonLogoPixels(data, width, height) {
  for (let p = 0; p < width * height; p += 1) {
    const i = p * 4;
    if (data[i + 3] === 0) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (isLogoPixel(r, g, b)) continue;
    if (isAntiAliasPixel(r, g, b, data, width, height, p)) continue;

    data[i + 3] = 0;
  }
}

function removeLineArtifacts(data, width, height) {
  const opaque = new Uint8Array(width * height);
  for (let p = 0; p < width * height; p += 1) {
    if (data[p * 4 + 3] > 0) opaque[p] = 1;
  }

  const seen = new Uint8Array(width * height);
  for (let p = 0; p < width * height; p += 1) {
    if (!opaque[p] || seen[p]) continue;
    const stack = [p];
    const component = [];
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    seen[p] = 1;
    while (stack.length > 0) {
      const cp = stack.pop();
      component.push(cp);
      const x = cp % width;
      const y = Math.floor(cp / width);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      for (const [nx, ny] of neighbors4(x, y, width, height)) {
        const np = ny * width + nx;
        if (!opaque[np] || seen[np]) continue;
        seen[np] = 1;
        stack.push(np);
      }
    }

    const boxW = maxX - minX + 1;
    const boxH = maxY - minY + 1;
    const thinLine =
      (boxW > 36 && boxH < 10) ||
      (boxH > 24 && boxW < 8) ||
      (component.length < 220 && (boxW > boxH * 5 || boxH > boxW * 5));

    if (thinLine) {
      for (const cp of component) data[cp * 4 + 3] = 0;
    }
  }
}

function cropAlphaToBBox(data, width, height, pad = 2) {
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;

  for (let p = 0; p < width * height; p += 1) {
    if (data[p * 4 + 3] === 0) continue;
    const x = p % width;
    const y = Math.floor(p / width);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  if (maxX < minX || maxY < minY) return;

  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);

  for (let p = 0; p < width * height; p += 1) {
    if (data[p * 4 + 3] === 0) continue;
    const x = p % width;
    const y = Math.floor(p / width);
    if (x < minX || x > maxX || y < minY || y > maxY) data[p * 4 + 3] = 0;
  }
}

function keepDenseHorizontalBand(data, width, height, pad = 3) {
  const rowCounts = new Array(height).fill(0);
  for (let p = 0; p < width * height; p += 1) {
    if (data[p * 4 + 3] === 0) continue;
    rowCounts[Math.floor(p / width)] += 1;
  }

  const maxCount = Math.max(...rowCounts);
  if (maxCount <= 0) return;

  const threshold = Math.max(12, maxCount * 0.11);
  let top = 0;
  let bottom = height - 1;
  for (let y = 0; y < height; y += 1) {
    if (rowCounts[y] >= threshold) {
      top = y;
      break;
    }
  }
  for (let y = height - 1; y >= 0; y -= 1) {
    if (rowCounts[y] >= threshold) {
      bottom = y;
      break;
    }
  }

  top = Math.max(0, top - pad);
  bottom = Math.min(height - 1, bottom + pad);

  for (let p = 0; p < width * height; p += 1) {
    if (data[p * 4 + 3] === 0) continue;
    const y = Math.floor(p / width);
    if (y < top || y > bottom) data[p * 4 + 3] = 0;
  }
}

function isNoiseSpeck(r, g, b) {
  if (r > 188 && g > 175 && b > 130) return true;
  if (r > 165 && g > 145 && b < 120) return true;
  return false;
}

function removeIsolatedBrightNoise(data, width, height) {
  const textLeft = Math.floor(width * 0.24);
  for (let p = 0; p < width * height; p += 1) {
    const i = p * 4;
    if (data[i + 3] === 0) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (!isNoiseSpeck(r, g, b) && !isStraySpeck(r, g, b) && !isChartPixel(r, g, b)) continue;

    const x = p % width;
    const y = Math.floor(p / width);
    let opaqueNeighbors = 0;
    for (const [nx, ny] of neighbors4(x, y, width, height)) {
      const ni = (ny * width + nx) * 4;
      if (data[ni + 3] > 0) opaqueNeighbors += 1;
    }

    if (x >= textLeft || opaqueNeighbors <= 3) {
      data[i + 3] = 0;
      continue;
    }

    if (y > Math.floor(height * 0.8) && opaqueNeighbors <= 5) data[i + 3] = 0;
  }
}

function keepOnlyMountainAndTextZones(data, width, height, bgColors) {
  const mountainRight = Math.floor(width * 0.34);
  const textLeft = Math.floor(width * 0.24);

  for (let p = 0; p < width * height; p += 1) {
    const i = p * 4;
    if (data[i + 3] === 0) continue;
    const x = p % width;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const inMountainZone = x <= mountainRight;
    const inTextZone = x >= textLeft;
    if (!inMountainZone && !inTextZone) {
      data[i + 3] = 0;
      continue;
    }

    const artifact =
      isFringePixel(r, g, b) ||
      isChartPixel(r, g, b) ||
      isCheckerboardPixel(r, g, b, bgColors, 42) ||
      isStraySpeck(r, g, b);

    if (artifact && !isLogoPixel(r, g, b) && !isAntiAliasPixel(r, g, b, data, width, height, p)) {
      data[i + 3] = 0;
    }
  }
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
  const exists = bgColors.some((c) => colorDist(c, sample) < 24);
  if (!exists) bgColors.push(sample);
}

const bgMask = new Uint8Array(width * height);
const queue = [];

function pushBg(x, y) {
  const p = y * width + x;
  if (bgMask[p]) return;
  const i = p * 4;
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];

  const onBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
  const isBg =
    isCheckerboardPixel(r, g, b, bgColors) ||
    (onBorder && Math.max(r, g, b) < 48) ||
    isChartPixel(r, g, b);

  if (!isBg) return;

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
  const i = p * 4;
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];

  for (const [nx, ny] of neighbors4(x, y, width, height)) {
    const np = ny * width + nx;
    if (bgMask[np]) continue;
    const ni = np * 4;
    const nr = data[ni];
    const ng = data[ni + 1];
    const nb = data[ni + 2];

    const similarBg =
      isCheckerboardPixel(nr, ng, nb, bgColors, 40) ||
      isChartPixel(nr, ng, nb) ||
      (isFringePixel(nr, ng, nb) && !isLogoPixel(nr, ng, nb));

    if (similarBg) {
      bgMask[np] = 1;
      queue.push(np);
    }
  }

  // Also peel low-saturation halos connected to background
  for (const [nx, ny] of neighbors4(x, y, width, height)) {
    const np = ny * width + nx;
    if (bgMask[np]) continue;
    const ni = np * 4;
    const nr = data[ni];
    const ng = data[ni + 1];
    const nb = data[ni + 2];
    if (isFringePixel(nr, ng, nb) && !isLogoPixel(nr, ng, nb)) {
      bgMask[np] = 1;
      queue.push(np);
    }
  }
}

for (let p = 0; p < width * height; p += 1) {
  const i = p * 4;
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];

  if (
    bgMask[p] ||
    isChartPixel(r, g, b) ||
    (isFringePixel(r, g, b) && !isLogoPixel(r, g, b))
  ) {
    data[i + 3] = 0;
    continue;
  }

  // Soften leftover clipping pixels on logo boundary
  if (!isLogoPixel(r, g, b)) {
    let transparentNeighbors = 0;
    const x = p % width;
    const y = Math.floor(p / width);
    for (const [nx, ny] of neighbors4(x, y, width, height)) {
      const ni = (ny * width + nx) * 4;
      if (data[ni + 3] === 0 || bgMask[ny * width + nx]) transparentNeighbors += 1;
    }
    if (transparentNeighbors >= 2) {
      data[i + 3] = 0;
    }
  }
}

// Second pass: remove isolated chart dust not caught by flood fill
for (let p = 0; p < width * height; p += 1) {
  const i = p * 4;
  if (data[i + 3] === 0) continue;
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  if (isChartPixel(r, g, b) || (isFringePixel(r, g, b) && !isLogoPixel(r, g, b))) {
    data[i + 3] = 0;
  }
}

keepOnlyMountainAndTextZones(data, width, height, bgColors);
fillInteriorHoles(data, width, height);
removeStraySpecks(data, width, height);
repairEnclosedArtifacts(data, width, height, bgColors);
stripNonLogoPixels(data, width, height);
fillInteriorHoles(data, width, height);
removeLineArtifacts(data, width, height);
keepOnlyMountainAndTextZones(data, width, height, bgColors);
repairEnclosedArtifacts(data, width, height, bgColors);
keepDenseHorizontalBand(data, width, height, 2);
removeIsolatedBrightNoise(data, width, height);
repairEnclosedArtifacts(data, width, height, bgColors);
fillInteriorHoles(data, width, height);
cropAlphaToBBox(data, width, height, 2);
fillInteriorHoles(data, width, height);

fs.mkdirSync(path.dirname(output), { recursive: true });
await sharp(data, { raw: { width, height, channels: 4 } })
  .trim({ threshold: 8 })
  .png()
  .toFile(output);

console.log(`Wrote ${output}`);
