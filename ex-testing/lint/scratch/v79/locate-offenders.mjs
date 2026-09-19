// v7-9 diagnostic: where in the capture does each off-brand bucket actually sit?
// Re-buckets the offender colours and reports their bounding box + sample coordinates so the
// report can name the element instead of guessing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, brandColours, dominantColours } from '../../../../checks/render.mjs';
import { parseColor, rgbToOklab, deltaEOk } from '../../../../checks/brand.mjs';
import { parseYaml } from '../../../../core/yaml.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(here, '../../../..');
const target = process.argv[2];
const brandFile = process.argv[3] ?? path.join(skillRoot, 'examples/todo-app-backend/.starciwork/brand/index.yaml');

const brand = parseYaml(fs.readFileSync(brandFile, 'utf8')).brand;
const palette = brandColours(brand);
const png = decodePng(fs.readFileSync(target));
const buckets = dominantColours(png);

console.log(`${path.basename(target)} ${png.width}x${png.height} channels=${png.channels} saturated=${buckets.saturated} considered=${buckets.considered} buckets=${buckets.length}`);
for (const bucket of buckets.filter(b => b.share >= 0.02)) {
  const nearest = palette.reduce((best, entry) => {
    const d = deltaEOk({ oklab: bucket.oklab }, entry.color);
    return !best || d < best.distance ? { label: entry.label, hex: entry.hex, distance: d } : best;
  }, null);
  if (nearest.distance <= 6) continue; // on-brand, not interesting here
  // Find pixels within deltaE 2 of this bucket mean, and describe where they are.
  let count = 0, minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
  const rows = new Map();
  for (let at = 0, index = 0; at < png.pixels.length; at += png.channels, index += 1) {
    const x = index % png.width, y = Math.floor(index / png.width);
    const oklab = rgbToOklab([png.pixels[at], png.pixels[at + 1], png.pixels[at + 2]]);
    if (deltaEOk({ oklab }, { oklab: bucket.oklab }) > 2) continue;
    count += 1;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    const band = Math.floor(y / 50) * 50;
    rows.set(band, (rows.get(band) ?? 0) + 1);
  }
  const bands = [...rows.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([band, n]) => `y≈${band}:${n}`).join(' ');
  console.log(`OFF ${bucket.hex} share=${(bucket.share * 100).toFixed(0)}% nearest=${nearest.label}(${nearest.hex}) dE=${nearest.distance.toFixed(1)} | exact-match pixels=${count} box=x[${minX}..${maxX}] y[${minY}..${maxY}] | ${bands}`);
}

console.log('--- top buckets (count, share, nearest token, dE) ---');
for (const bucket of buckets.slice(0, 14)) {
  const nearest = palette.reduce((best, entry) => {
    const d = deltaEOk({ oklab: bucket.oklab }, entry.color);
    return !best || d < best.distance ? { label: entry.label, hex: entry.hex, distance: d } : best;
  }, null);
  console.log(`${bucket.hex} count=${bucket.count} share=${(bucket.share * 100).toFixed(1)}% ${nearest.label}(${nearest.hex}) dE=${nearest.distance.toFixed(1)} ${nearest.distance > 6 ? 'OFF-BRAND' : 'ok'}`);
}
