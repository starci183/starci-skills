/** v7-14 report inputs: the ecom provenance dead-path table (with the candidate current file) and the schema census. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parseYaml} from '../../../../core/yaml.mjs';

const HOST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const EC = 'examples/ecommerce-app-be/.starciwork';

console.log('### ecom ui provenance paths: current state (retarget would need a false identity claim)');
const seen = new Set();
for (const f of fs.readdirSync(path.join(HOST, EC, 'features'), {recursive: true})) {
  const rel = `${EC}/features/${String(f).replaceAll('\\', '/')}`;
  if (!/\/ui\/[^/]+\/index\.yaml$/.test(rel)) continue;
  const data = parseYaml(fs.readFileSync(path.join(HOST, rel), 'utf8'));
  const list = data?.ui?.provenance?.frontendContext ?? [];
  list.forEach((e, i) => {
    if (typeof e?.path !== 'string') return;
    const abs = path.join(HOST, e.path);
    if (fs.existsSync(abs)) return;
    const lang = e.path.replace(/\/app\//, '/app/[lang]/');
    const langAbs = path.join(HOST, lang);
    const langExists = fs.existsSync(langAbs);
    const pinMatchesLang = langExists && sha(langAbs) === e.sha256;
    seen.add(e.path);
    console.log(`  ${data.id.padEnd(34)} [${i}] ${e.path}`);
    console.log(`  ${''.padEnd(34)}     pin ${String(e.sha256).slice(0, 12)}… matches no file in this checkout; ${langExists ? `[lang] candidate ${lang} EXISTS, bytes ${pinMatchesLang ? 'MATCH (pure move)' : 'DIFFER'}` : 'no [lang] candidate either — component removed'}`);
  });
}
console.log(`  distinct dead paths: ${seen.size}`);

console.log('\n### schema coverage: which declared schemas have a file');
const found = new Map();
const walk = d => fs.readdirSync(d, {withFileTypes: true}).flatMap(e => e.isDirectory() ? (['_derived', '_local'].includes(e.name) ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)]);
for (const root of ['examples/todo-app-backend/.starciwork', 'examples/ecommerce-app-be/.starciwork']) {
  for (const f of walk(path.join(HOST, root))) {
    if (!f.endsWith('.yaml') || f.includes('_derived') || f.endsWith('evidence.yaml') || /\/(runs|assets)\//.test(f.replaceAll('\\', '/'))) continue;
    let d;
    try { d = parseYaml(fs.readFileSync(f, 'utf8')); } catch { continue; }
    if (!d?.schema) continue;
    found.set(d.schema, (found.get(d.schema) ?? 0) + 1);
  }
}
const schemaFiles = new Map();
for (const f of fs.readdirSync(path.join(HOST, 'schemas'))) {
  if (!/^work-.*\.schema\.yaml$/.test(f)) continue;
  try {
    const doc = parseYaml(fs.readFileSync(path.join(HOST, 'schemas', f), 'utf8'));
    if (doc?.properties?.schema?.const) schemaFiles.set(doc.properties.schema.const, f);
  } catch { /* unreadable */ }
}
for (const [schema, n] of [...found.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${schema.padEnd(36)} ${schemaFiles.get(schema) ?? 'NO SCHEMA FILE'}`);
}

console.log('\n### machine paths left inside evidence payloads (replay commands)');
for (const root of ['examples/todo-app-backend/.starciwork', 'examples/ecommerce-app-be/.starciwork']) {
  for (const f of walk(path.join(HOST, root))) {
    if (!f.endsWith('.yaml')) continue;
    const rel = path.relative(HOST, f).replaceAll('\\', '/');
    const hits = (fs.readFileSync(f, 'utf8').match(/[A-Za-z]:[\\/](?:Users|Program Files|PROGRA~1)[^\s"',\]]*/g) ?? []);
    if (hits.length) console.log(`  ${rel}: ${hits.length} (${[...new Set(hits.map(h => h.slice(0, 34)))].join(' | ')})`);
  }
}
