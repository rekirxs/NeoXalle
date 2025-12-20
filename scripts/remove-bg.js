#!/usr/bin/env node
/**
 * Simple background remover: makes near-white pixels transparent.
 * Usage: node scripts/remove-bg.js <input> [output] [tolerance]
 * - input: source image path (PNG/JPG)
 * - output: destination path (defaults to <input>-transparent.png)
 * - tolerance: 0-100 (% distance from pure white), default 10
 */
const path = require('path');
const fs = require('fs');
// Jimp is ESM-only; use dynamic import to get the default export
async function getJimp() {
  const mod = await import('jimp');
  return mod.Jimp || mod.default || mod;
}

async function main() {
  const [input, outputArg, tolArg] = process.argv.slice(2);
  if (!input) {
    console.error('Usage: node scripts/remove-bg.js <input> [output] [tolerance]');
    process.exit(1);
  }
  const tolerance = Math.max(0, Math.min(100, Number(tolArg ?? 10)));
  const out = outputArg || defaultOutPath(input);

  const Jimp = await getJimp();
  const img = await Jimp.read(input);
  const { data, width, height } = img.bitmap;

  // For each pixel, compute normalized distance to white and zero alpha if within tolerance
  const maxDist = Math.sqrt(3 * 255 * 255);
  img.scan(0, 0, width, height, function (x, y, idx) {
    const r = data[idx + 0];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];

    // Skip already transparent
    if (a === 0) return;

    // Euclidean distance to pure white (255,255,255), normalized to 0..100
    const dist = Math.sqrt((255 - r) ** 2 + (255 - g) ** 2 + (255 - b) ** 2);
    const pct = (dist / maxDist) * 100;

    if (pct <= tolerance) {
      // within tolerance → make transparent
      data[idx + 3] = 0;
    }
  });

  await ensureDir(path.dirname(out));
  if (typeof img.writeAsync === 'function') {
    await img.writeAsync(out);
  } else {
    await img.write(out);
  }
  console.log(`Saved: ${out} (tolerance=${tolerance}%)`);
}

function defaultOutPath(input) {
  const { dir, name } = path.parse(input);
  return path.join(dir, `${name}-transparent.png`);
}

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

main().catch((err) => {
  console.error('remove-bg failed:', err);
  process.exit(1);
});
