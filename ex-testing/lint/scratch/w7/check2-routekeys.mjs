// w7/tinkle-13 check 2: route: keys used in ops yaml vs keys read by route-op.mjs
import {readFileSync, readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {parseYaml} from '../../../../core/yaml.mjs';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const modDir = root + 'modules/ops/ops/';
const RESOLVER_KEYS = new Set(['nodeKinds','nodeKind','phase','intent','intents','prerequisites','riskHints']);
const keyUse = new Map();
const noRoute = [];
for (const f of readdirSync(modDir).filter(f => f.endsWith('.yaml'))) {
  const m = parseYaml(readFileSync(modDir + f, 'utf8'));
  if (!m.route) { noRoute.push(f); continue; }
  for (const k of Object.keys(m.route)) {
    if (!keyUse.has(k)) keyUse.set(k, []);
    keyUse.get(k).push(f);
  }
}
console.log('route keys used across modules/ops/ops/*.yaml:');
for (const [k, files] of [...keyUse.entries()].sort()) {
  const read = RESOLVER_KEYS.has(k) ? 'READ' : 'NOT-READ-BY-RESOLVER';
  console.log(`  ${k} (${read}) — ${files.length} files${files.length < 30 ? ': ' + files.join(', ') : ''}`);
}
console.log('files missing route: block:', noRoute.length ? noRoute.join(', ') : 'none');
