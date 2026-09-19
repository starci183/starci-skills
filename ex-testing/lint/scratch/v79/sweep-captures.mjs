// v7-9 sweep: run the canon palette + entity-list checks over every running-page capture the todo
// tree keeps, so the report can say which captures pass and which cannot, and why.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { decodePng, checkPalette, checkEntityListInCard, cardClassesOf, brandColours } from '../../../../checks/render.mjs';
import { parseColor, rgbToOklab, deltaEOk } from '../../../../checks/brand.mjs';
import { parseYaml } from '../../../../core/yaml.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(here, '../../../..');
const workRoot = path.join(skillRoot, 'examples/todo-app-backend/.starciwork');
const brand = parseYaml(fs.readFileSync(path.join(workRoot, 'brand/index.yaml'), 'utf8')).brand;
const family = brand.identity?.family;
const cards = cardClassesOf({ family });
const palette = brandColours(brand);

const walk = dir => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);

const filter = process.argv[2] ?? '';
const nodes = walk(path.join(workRoot, 'features'))
  .filter(f => /index\.yaml$/.test(f))
  .map(f => path.dirname(f))
  .filter(d => /[\\/](impl|ui)[\\/]/.test(d))
  .filter(d => fs.existsSync(path.join(d, 'assets')))
  .filter(d => d.includes(filter))
  .sort();

for (const dir of nodes) {
  const pngs = walk(path.join(dir, 'assets')).filter(f => /\.png$/i.test(f)).sort();
  if (!pngs.length) continue;
  const rel = path.relative(workRoot, dir).replaceAll('\\', '/');
  console.log(`\n=== ${rel} (${pngs.length} png) cardClasses=${JSON.stringify(cards.classes)} source=${cards.source}`);
  for (const pngFile of pngs) {
    const name = path.basename(pngFile);
    let buckets;
    try {
      const png = decodePng(fs.readFileSync(pngFile));
      const results = checkPalette({ png, brand });
      const offenders = results.find(r => r.id === 'palette-off-brand');
      const primary = results.find(r => r.id === 'primary-absent');
      buckets = (offenders.evidence?.offenders ?? []).map(o => `${o.hex}(${Math.round(o.share * 100)}% dE${o.deltaE})`).join(' ');
      const markup = pngFile.replace(/\.png$/i, '.html');
      let entity = 'no-markup';
      if (fs.existsSync(markup)) {
        const e = checkEntityListInCard(fs.readFileSync(markup, 'utf8'), { family, cards: cards.classes.length ? cards.classes : null });
        entity = `${e.outcome}${e.outcome === 'fail' ? ` ${e.evidence.inCards.map(c => `${c.items}x${c.item} in ${c.list}<${c.card}>`).join(',')}` : ''}`;
      }
      console.log(`  ${name}: palette=${offenders.outcome} primary=${primary.outcome} entity-list=${entity}${buckets ? ` | ${buckets}` : ''}`);
    } catch (error) {
      console.log(`  ${name}: ERROR ${error.message}`);
    }
  }
}
