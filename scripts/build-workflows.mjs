import {validateFlashPolicy} from '../workflows/flash.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validateCatalog } from '../ops/validate.mjs';
import { generate } from '../ops/generate.mjs';
import { validateJobMatrices } from '../workflows/matrix.mjs';
import { validateWorkflowCatalog } from '../workflows/select.mjs';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const json = x => JSON.stringify(x) + '\n';
export function buildFiles() {
  const stale = generate({ check: true }); if (stale.length) throw Error('Regenerate operator outputs before build: ' + stale.join(', '));
  const flash=validateFlashPolicy(JSON.parse(fs.readFileSync(path.join(root,'workflows/flash.json'))));
  if(!flash.ok)throw Error('Invalid flash policy: '+flash.errors.join('; '));
  const files = new Map();
  files.set('config.example.json', fs.readFileSync(path.join(root,'config.example.json')));
  files.set('basic-ops.json', fs.readFileSync(path.join(root, 'ops/basic-ops.json')));
  files.set('ops/consolidation.json', fs.readFileSync(path.join(root, 'ops/consolidation.json')));
  for (const name of fs.readdirSync(path.join(root, 'workflows')).sort()) if (name.endsWith('.json')) files.set('workflows/' + name, fs.readFileSync(path.join(root, 'workflows', name)));
  for(const name of fs.readdirSync(path.join(root,'profiles')).filter(n=>n.endsWith('.json')).sort()) files.set('profiles/'+name,fs.readFileSync(path.join(root,'profiles',name)));
  const catalogue = JSON.parse(fs.readFileSync(path.join(root, 'ops/catalog.json'), 'utf8'));
  const checked=validateCatalog(catalogue,{root:path.join(root,'ops'),repositoryRoot:root});
  if(!checked.ok)throw Error('Invalid operator catalog: '+JSON.stringify(checked.errors));
  const matrices=validateJobMatrices(JSON.parse(fs.readFileSync(path.join(root,'workflows/jobs.json'),'utf8')),catalogue);
  if(!matrices.ok) throw Error('Invalid job matrices: '+JSON.stringify(matrices.errors));
  const discovery=validateWorkflowCatalog(JSON.parse(fs.readFileSync(path.join(root,'workflows/catalog.json'),'utf8')),JSON.parse(fs.readFileSync(path.join(root,'workflows/jobs.json'),'utf8')),JSON.parse(fs.readFileSync(path.join(root,'workflows/frontend.json'),'utf8')));
  if(!discovery.ok)throw Error('Invalid workflow catalog: '+JSON.stringify(discovery.errors));
  const compiledDiscovery=JSON.parse(files.get('workflows/catalog.json'));compiledDiscovery.skill='../../SKILL.md';files.set('workflows/catalog.json',json(compiledDiscovery));
  files.set('core/README.json',fs.readFileSync(path.join(root,'core/README.json')));
  for(const name of fs.readdirSync(path.join(root,'schemas')).filter(n=>n.endsWith('.json')))files.set('schemas/'+name,fs.readFileSync(path.join(root,'schemas',name)));
  const entries = [];
  for (const op of catalogue.ops) {
    files.set('ops/' + op.id + '/operator.json', json(op.contract));
    files.set('ops/' + op.id + '/authority.json', fs.readFileSync(path.join(root, 'ops', op.authority)));
    if (op.contract.specificationPolicy) files.set('ops/' + op.id + '/specification.json', json(op.contract.specificationPolicy));
    const authority = JSON.parse(fs.readFileSync(path.join(root, 'ops', op.authority), 'utf8'));
    for (const ref of new Set(authority.primary.calls.map(c => c.authority))) {
      if (ref !== 'secondary.json') throw Error('Unsupported caller-owned secondary path');
      files.set('ops/' + op.id + '/' + ref, fs.readFileSync(path.join(root, 'ops', op.id, ref)));
    }
    entries.push({ id: op.id, goal: op.goal, knowledge: op.supportingReferences, operator: op.id + '/operator.json', authority: op.id + '/authority.json' });
  }
  for (const name of ['contract.json']) files.set('specifications/' + name, fs.readFileSync(path.join(root, 'specifications', name)));
  for (const name of fs.readdirSync(path.join(root, 'examples')).filter(x => x.endsWith('.json'))) files.set('examples/' + name, fs.readFileSync(path.join(root, 'examples', name)));
  files.set('ops/catalog.json', json({ schema: 'starci/built-ops@1', ops: entries }));
  files.set('policy/common.json', json({ schema: 'starci/policy@1', rules: JSON.parse(fs.readFileSync(path.join(root, 'ops/common.json'), 'utf8').replaceAll('../SKILL.md','../../SKILL.md')) }));
  const knowledge = {};
  function walk(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(dir, entry.name); if (entry.isSymbolicLink()) throw Error('Knowledge symlinks cannot be bundled');
    if (entry.isDirectory()) walk(file); else if (entry.name.endsWith('.json')) { const bytes = fs.readFileSync(file); const relative=path.relative(root,file).replaceAll('\\','/'); files.set(relative,bytes); knowledge[relative]={sha256:hash(json(JSON.parse(bytes))),title:JSON.parse(bytes).title}; }
  } }
  walk(path.join(root, 'knowledge'));
  files.set('knowledge/catalog.json', json({ schema: 'starci/knowledge-bundle@1', documents: knowledge }));
  for (const [name, bytes] of files) files.set(name, json(JSON.parse(bytes.toString())));
  files.set('manifest.json', json({ schema: 'starci/dist@1', workflow: 'frontend', matrix: 'workflows/matrix.json', contracts: 'workflows/contracts.json',
    limits: { steps: 3, parallel: 3, primary: 9, secondaryPerPrimary: 3 },
    files: [...files].map(([file, bytes]) => ({ path: file, sha256: hash(bytes) })) }));
  return files;
}
export function build({ check = false } = {}) {
  const destination = path.join(root, '.dist'), files = buildFiles(), stale = [];
  if (!check) fs.mkdirSync(destination, { recursive: true });
  if (fs.existsSync(destination) && fs.lstatSync(destination).isSymbolicLink()) throw Error('dist cannot be a symlink');
  if(fs.existsSync(destination)){
    const visit=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isSymbolicLink())throw Error('Build target cannot be a symlink');if(entry.isDirectory())visit(file);else{const relative=path.relative(destination,file).replaceAll('\\','/');if(!files.has(relative)){if(check)stale.push(relative);else fs.unlinkSync(file);}}}};visit(destination);
  }
  for (const [relative, bytes] of files) {
    const file = path.join(destination, relative); let cursor = destination;
    for (const segment of relative.split('/')) { cursor = path.join(cursor, segment); if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) throw Error('Build target cannot be a symlink'); }
    if (check) { if (!fs.existsSync(file) || !fs.readFileSync(file).equals(Buffer.from(bytes))) stale.push(relative); }
    else { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes); }
  }
  return { ok: stale.length === 0, files: files.size, stale };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const result = build({ check: process.argv.includes('--check') }); process.stdout.write(json(result)); if (!result.ok) process.exitCode = 1; }
  catch (e) { process.stderr.write(e.message + '\n'); process.exitCode = 1; }
}
