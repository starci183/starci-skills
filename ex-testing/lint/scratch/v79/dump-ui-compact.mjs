// v7-9: compact view of what each ui record declares must be captured.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../../../core/yaml.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const workRoot = path.resolve(here, '../../../..', 'examples/todo-app-backend/.starciwork');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);

const uiDirs = [...new Set(walk(path.join(workRoot, 'features'))
  .filter(f => /index\.yaml$/.test(f)).map(f => path.dirname(f))
  .filter(d => d.replaceAll('\\', '/').includes('/ui/')))];

for (const dir of uiDirs.sort()) {
  const rec = parseYaml(fs.readFileSync(path.join(dir, 'index.yaml'), 'utf8'));
  const ui = rec.ui ?? {};
  const rel = path.relative(workRoot, dir).replaceAll('\\', '/');
  const states = (ui.states ?? []).map(s => s.name);
  const cov = (ui.coverage?.map ?? []);
  const viewports = [...new Set(cov.map(c => c.viewport))];
  console.log(`\n${rel}  id=${rec.id} state=${rec.state}`);
  console.log(`  states(${states.length}): ${states.join(', ')}`);
  console.log(`  coverage(${cov.length}) viewports: ${viewports.join(', ')}`);
  for (const v of viewports) {
    const at = cov.filter(c => c.viewport === v).map(c => c.state);
    console.log(`    ${v}: ${at.join(', ')}`);
    const missing = states.filter(s => !at.includes(s));
    const extra = at.filter(s => !states.includes(s));
    if (missing.length) console.log(`      MISSING from coverage: ${missing.join(', ')}`);
    if (extra.length) console.log(`      coverage names a state not in ui.states: ${extra.join(', ')}`);
  }
  const vpDefs = [...new Set(cov.flatMap(c => JSON.stringify(c.viewportDefinition ?? null) === 'null' ? [] : [JSON.stringify(c)]))];
  const dims = ui.responsive ?? null;
  console.log(`  responsive: ${JSON.stringify(dims)}`);
  const captures = cov.filter(c => c.capture).map(c => `${c.state}/${c.viewport} -> ${c.capture}`);
  if (captures.length) console.log(`  capture fields: ${captures.join(' | ')}`);
  console.log(`  assets(png): ${(rec.assets ?? []).filter(a => /\.png$/i.test(a.path)).map(a => `${a.path}${a.generation ? '[gen]' : ''}`).join(', ')}`);
}
