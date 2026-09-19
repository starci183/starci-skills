// v7-9: print, for every work/ui-screen record in the todo tree, exactly what it declares must render.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../../../core/yaml.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const workRoot = path.resolve(here, '../../../..', 'examples/todo-app-backend/.starciwork');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);

const uiDirs = [...new Set(walk(path.join(workRoot, 'features'))
  .filter(f => /index\.yaml$/.test(f))
  .map(f => path.dirname(f))
  .filter(d => d.replaceAll('\\', '/').includes('/ui/')))];

for (const dir of uiDirs.sort()) {
  const rec = parseYaml(fs.readFileSync(path.join(dir, 'index.yaml'), 'utf8'));
  const ui = rec.ui ?? {};
  const rel = path.relative(workRoot, dir).replaceAll('\\', '/');
  console.log(`\n### ${rel}  id=${rec.id} state=${rec.state} rev=${rec.change?.rev ?? '-'}`);
  console.log(`  ui keys: ${Object.keys(ui).join(', ')}`);
  console.log(`  states: ${(ui.states ?? []).map(s => `${s.name}${s.viewports ? `[${(s.viewports ?? []).map(v => typeof v === 'string' ? v : JSON.stringify(v)).join(', ')}]` : ''}`).join(' | ') || '(none)'}`);
  console.log(`  surfaces: ${(ui.surfaces ?? []).map(s => s.name ?? JSON.stringify(s)).join(' | ') || '(none)'}`);
  console.log(`  coverage.map: ${(ui.coverage?.map ?? []).map(m => JSON.stringify(m)).join('\n                  ') || '(none)'}`);
  console.log(`  coverage keys: ${Object.keys(ui.coverage ?? {}).join(', ')}`);
  console.log(`  viewports(root): ${JSON.stringify(ui.viewports ?? null)}`);
  console.log(`  assets: ${(ui.assets ?? []).map(a => `${a.path}${a.generation ? ` [gen:${a.generation.tool}]` : ''}`).join(' | ') || '(none)'}`);
  console.log(`  artworkSlots: ${(ui.artworkSlots ?? []).map(s => `${s.id}/${s.purpose}`).join(' | ') || '(none)'}`);
  const top = Object.keys(rec).filter(k => !['ui', 'assets'].includes(k));
  console.log(`  top-level keys: ${top.join(', ')}`);
  console.log(`  record assets[]: ${(rec.assets ?? []).map(a => `${a.path} role=${a.role}${a.generation ? ` gen=${a.generation.tool}` : ''}`).join(' | ') || '(none)'}`);
}
