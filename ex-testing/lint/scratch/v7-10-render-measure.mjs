/**
 * Lane v7-10 measurement: can checks/render.mjs + checks/brand.mjs actually run a render proof against
 * the ecommerce Work tree, and what do they say about the captures that exist on disk today?
 *
 * Nothing here writes to a record. It imports the same functions scripts/example-render-proof.mjs
 * composes and reports their raw outcomes.
 */
import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../../../core/yaml.mjs';
import {decodePng, checkPalette, checkEntityListInCard, cardClassesOf} from '../../../checks/render.mjs';
import {defaultGrammarRoot} from '../../../checks/brand.mjs';

const host = path.resolve(import.meta.dirname, '../../..');
const workRoot = path.join(host, 'examples', 'ecommerce-app-be', '.starciwork');
const brandFile = path.join(workRoot, 'brand', 'index.yaml');
const brandDoc = parseYaml(fs.readFileSync(brandFile, 'utf8'));

console.log(`grammarRoot resolves to: ${defaultGrammarRoot()}`);
console.log(`brand/index.yaml top-level keys: ${Object.keys(brandDoc).join(', ')}`);
console.log(`brand.brand present? ${brandDoc.brand ? 'yes' : 'NO — the record has no `brand:` specification block'}`);
const brandSpec = brandDoc.brand ?? brandDoc;
console.log(`brand.identity present? ${brandSpec.identity ? JSON.stringify(brandSpec.identity) : 'NO — no identity.family'}`);
console.log(`brand.color present (the shape brandColours reads)? ${brandSpec.color ? 'yes' : 'NO — the record authors `colour:` instead'}`);
console.log(`brand.colour = ${JSON.stringify(brandSpec.colour ?? null)}`);

const CORE = new Set(['palette-off-brand', 'primary-absent', 'entity-list-in-card']);
const report = (label, results) => {
  for (const r of results) {
    const flag = r.outcome === 'skip' && CORE.has(r.id) ? '  <- skip on a core check = RENDER_PROOF_INCOMPLETE' : '';
    console.log(`  ${label} ${r.id}: ${r.outcome}${flag}`);
    console.log(`      ${String(r.detail).slice(0, 220)}`);
  }
};

for (const family of ['common', null]) {
  const cards = cardClassesOf({family, grammarRoot: defaultGrammarRoot()});
  console.log(`\ncardClassesOf({family: ${JSON.stringify(family)}}): source=${cards.source} classes=${JSON.stringify(cards.classes)} error=${cards.error}`);
}

const pngs = [
  ['existing fe capture', path.join(host, 'examples', 'ecommerce-app-fe', 'captures', 'landing-desktop.png')],
  ['existing fe markup pair', path.join(host, 'examples', 'ecommerce-app-fe', 'captures', 'browse-desktop.png')],
  ['ui direction asset', path.join(workRoot, 'features', 'checkout', 'ui', 'landing-home', 'assets', 'landing-home.png')],
];
for (const [label, file] of pngs) {
  console.log(`\n=== ${label}: ${path.relative(host, file).replaceAll('\\', '/')} ===`);
  if (!fs.existsSync(file)) { console.log('  absent on disk'); continue; }
  let png = null;
  try { png = decodePng(fs.readFileSync(file)); } catch (e) { console.log(`  decodePng threw: ${e.message}`); continue; }
  console.log(`  decoded ${png.width}x${png.height} channels=${png.channels} colourType=${png.colourType}`);
  report('palette', checkPalette({png, brand: brandSpec}));
  const markup = file.replace(/\.png$/i, '.html');
  if (fs.existsSync(markup)) {
    report('markup', [checkEntityListInCard(fs.readFileSync(markup, 'utf8'), {family: null, cards: null})]);
  } else {
    console.log(`  no ${path.basename(markup)} beside it`);
  }
}
