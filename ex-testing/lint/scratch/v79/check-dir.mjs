// v7-9: run the three canon render checks over every PNG in an arbitrary capture directory.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, checkPalette, checkEntityListInCard, cardClassesOf } from '../../../../checks/render.mjs';
import { parseYaml } from '../../../../core/yaml.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(here, '../../../..');
const workRoot = path.join(skillRoot, 'examples/todo-app-backend/.starciwork');
const brand = parseYaml(fs.readFileSync(path.join(workRoot, 'brand/index.yaml'), 'utf8')).brand;
const family = brand.identity?.family;
const cards = cardClassesOf({ family });

const dir = path.resolve(process.argv[2]);
const only = process.argv[3];
let fails = 0;
for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort()) {
  if (only && !file.includes(only)) continue;
  const pngFile = path.join(dir, file);
  const png = decodePng(fs.readFileSync(pngFile));
  const results = checkPalette({ png, brand });
  const markup = pngFile.replace(/\.png$/i, '.html');
  const entity = fs.existsSync(markup)
    ? checkEntityListInCard(fs.readFileSync(markup, 'utf8'), { family, cards: cards.classes })
    : { outcome: 'skip', detail: 'no markup beside the capture' };
  const off = results.find(r => r.id === 'palette-off-brand');
  const prim = results.find(r => r.id === 'primary-absent');
  const offenders = (off.evidence.offenders ?? []).map(o => `${o.hex}(${Math.round(o.share * 100)}% dE${o.deltaE})`).join(' ');
  const bad = off.outcome !== 'pass' || prim.outcome !== 'pass' || entity.outcome !== 'pass';
  if (bad) fails += 1;
  console.log(`${bad ? 'FAIL' : 'ok  '} ${file}: palette=${off.outcome} primary=${prim.outcome} entity=${entity.outcome}${offenders ? ` | ${offenders}` : ''}${entity.outcome === 'fail' ? ` | ${entity.detail}` : ''}`);
}
console.log(`--- ${fails} failing capture(s) in ${path.basename(dir)}`);
