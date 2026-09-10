/**
 * Unified StarCi runtime build → `.dist`.
 *
 * Mapping (authored → public `.dist` path):
 * - workflows|profiles|schemas|specifications|examples|docs catalogs `*.yaml` → `…/*.json`
 *   (no authored JSON fallback or duplicate YAML/JSON authority)
 * - knowledge/** via scripts/compile-knowledge.mjs → knowledge JSON under .dist (no JSON fallback)
 * - ops authored: secondary.yaml → ops/<id>/secondary.json; common.yaml → policy/common.json
 * - ops generated (ops/generate.mjs outputs()): catalog/basic-ops/consolidation/authority
 *   → ops/** and basic-ops.json (compact); operator/specification JSON projected from contracts
 * - Executable modules listed in scripts/runtime-modules.txt → same relative path under `.dist`
 *
 * Emit is always compact `JSON.stringify(value) + '\\n'`. Publish uses staging then rename.
 * Safe YAML load uses bundled core/yaml.mjs (not install-time node_modules/yaml).
 */
import { validateFlashPolicy } from '../workflows/flash.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../core/yaml.mjs';
import { validateCatalog } from '../ops/validate.mjs';
import { generate, outputs as generatedOpsOutputs } from '../ops/generate.mjs';
import { validateJobMatrices } from '../workflows/matrix.mjs';
import { validateWorkflowCatalog } from '../workflows/catalog-validate.mjs';
import { compileKnowledge } from './compile-knowledge.mjs';
import { compileDeclarative } from './compile-declarative.mjs';
import { loadDeclarative } from './runtime-compile/declarative.mjs';
import { compactJson, compactJsonBuffer, recompactJsonBytes } from './runtime-compile/emit.mjs';
import { collectRuntimeModules } from './runtime-compile/runtime-modules.mjs';
import { publishDist } from './runtime-compile/stage.mjs';
import { readRealFile } from './runtime-compile/paths.mjs';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function setFile(files, relative, bytes) {
  if (files.has(relative)) throw Error(`Output collision for ${relative}`);
  files.set(relative, Buffer.from(bytes));
}

function readCommonRules(skillRoot) {
  const yamlPath = path.join(skillRoot, 'ops/common.yaml');
  const jsonPath = path.join(skillRoot, 'ops/common.json');
  if (fs.existsSync(yamlPath)) {
    const { bytes } = readRealFile(yamlPath, skillRoot);
    return parseYaml(bytes.toString('utf8'));
  }
  throw Error('ops/common.yaml is required');
}

export function buildFiles(skillRoot = root) {
  // Generated operator bytes exist only in memory until the complete dist is published.

  const flash = validateFlashPolicy(loadDeclarative(skillRoot, 'workflows/flash.json'));
  if (!flash.ok) throw Error('Invalid flash policy: ' + flash.errors.join('; '));

  const files = new Map();
  const declarative = compileDeclarative({ root: skillRoot });
  for (const [rel, bytes] of declarative) setFile(files, rel, bytes);

  const generated = generatedOpsOutputs();
  const catalogue = JSON.parse(generated.get('catalog.json'));
  const checked = validateCatalog(catalogue, { root: path.join(skillRoot, 'ops'), repositoryRoot: skillRoot, documents: generated });
  if (!checked.ok) throw Error('Invalid operator catalog: ' + JSON.stringify(checked.errors));

  const jobs = loadDeclarative(skillRoot, 'workflows/jobs.json');
  const matrices = validateJobMatrices(jobs, catalogue);
  if (!matrices.ok) throw Error('Invalid job matrices: ' + JSON.stringify(matrices.errors));

  const discoverySource = loadDeclarative(skillRoot, 'workflows/catalog.json');
  const discovery = validateWorkflowCatalog(
    discoverySource,
    jobs,
    loadDeclarative(skillRoot, 'workflows/frontend.json')
  );
  if (!discovery.ok) throw Error('Invalid workflow catalog: ' + JSON.stringify(discovery.errors));

  // Stable public catalog with skill path rewritten for `.dist/workflows/`.
  const compiledDiscovery = structuredClone(discoverySource);
  compiledDiscovery.skill = '../../SKILL.md';
  files.set('workflows/catalog.json', compactJsonBuffer(compiledDiscovery));

  const entries = [];
  for (const op of catalogue.ops) {
    files.set(`ops/${op.id}/operator.json`, compactJsonBuffer(op.contract));
    const authorityRel = `${op.id}/authority.json`;
    if (!generated.has(authorityRel)) throw Error(`Missing generated authority for ${op.id}`);
    files.set(`ops/${op.id}/authority.json`, recompactJsonBytes(Buffer.from(generated.get(authorityRel))));
    if (op.contract.specificationPolicy) {
      files.set(`ops/${op.id}/specification.json`, compactJsonBuffer(op.contract.specificationPolicy));
    }
    const authority = JSON.parse(generated.get(authorityRel));
    for (const ref of new Set(authority.primary.calls.map(c => c.authority))) {
      if (ref !== 'secondary.json') throw Error('Unsupported caller-owned secondary path');
      const secondaryDist = `ops/${op.id}/${ref}`;
      if (!files.has(secondaryDist)) {
        const yamlPath = path.join(skillRoot, 'ops', op.id, 'secondary.yaml');
        const jsonPath = path.join(skillRoot, 'ops', op.id, 'secondary.json');
        if (fs.existsSync(yamlPath)) {
          files.set(secondaryDist, compactJsonBuffer(parseYaml(readRealFile(yamlPath, skillRoot).bytes.toString('utf8'))));
        } else {
          throw Error(`Missing secondary authority for ${op.id}`);
        }
      }
    }
    entries.push({
      id: op.id,
      goal: op.goal,
      knowledge: op.supportingReferences,
      operator: `${op.id}/operator.json`,
      authority: `${op.id}/authority.json`
    });
  }

  files.set('ops/catalog.json', compactJsonBuffer({ schema: 'starci/built-ops@1', ops: entries }));
  files.set('basic-ops.json', recompactJsonBytes(Buffer.from(generated.get('basic-ops.json'))));
  files.set('ops/consolidation.json', recompactJsonBytes(Buffer.from(generated.get('consolidation.json'))));

  const common = readCommonRules(skillRoot);
  const rewritten = JSON.parse(JSON.stringify(common).replaceAll('../SKILL.md', '../../SKILL.md'));
  files.set('policy/common.json', compactJsonBuffer({ schema: 'starci/policy@1', rules: rewritten }));

  // Authored knowledge must compile successfully; never publish a partial fallback bundle.
  const knowledge = {};
  const compiledKnowledge = compileKnowledge({ root: skillRoot, check: false, write: false });
  if (!compiledKnowledge.ok) throw Error('Knowledge compilation failed');
  for (const [relative, bytes] of [...compiledKnowledge.files].sort((a, b) => a[0].localeCompare(b[0]))) {
    files.set(relative, bytes);
    const doc = JSON.parse(bytes.toString());
    knowledge[relative] = { sha256: hash(compactJson(doc)), title: doc.title };
  }
  files.set('knowledge/catalog.json', compactJsonBuffer({ schema: 'starci/knowledge-bundle@1', documents: knowledge }));

  collectRuntimeModules(skillRoot, files);
  const readBuilt=relative=>JSON.parse(files.get(relative));
  const packageFile=path.join(skillRoot,'package.json');
  if(fs.existsSync(packageFile)){
    const docs={schema:'starci/docs@3',version:JSON.parse(fs.readFileSync(packageFile,'utf8')).version,
      entry:'starci',layout:readBuilt('schemas/work-layout.json'),gates:readBuilt('workflows/gates.json'),limits:compiledDiscovery.limits,
      workflows:compiledDiscovery.workflows.map(w=>({...w,definition:w.id==='implement-frontend'?readBuilt('workflows/matrix.json'):jobs.workflows.find(j=>j.id===w.id)})),
      operators:entries.map(o=>({id:o.id,goal:o.goal,contract:readBuilt('ops/'+o.operator),authority:readBuilt('ops/'+o.authority),secondary:files.has('ops/'+o.id+'/secondary.json')?readBuilt('ops/'+o.id+'/secondary.json'):null})),
      profiles:readBuilt('profiles/registry.json')};
    files.set('docs/catalog.json',compactJsonBuffer(docs));
    files.set('docs/site-catalog.json',compactJsonBuffer({...docs,
      operators:docs.operators.map(o=>({id:o.id,goal:o.goal,contract:{steps:o.contract.steps}})),
      workflows:docs.workflows.map(w=>({id:w.id,when:w.when,execution:w.execution,definition:{id:w.id}}))}));
  }
  // Prose and synthetic examples are runtime references too. Keep their native
  // format, but resolve them from the generated tree just like JSON contracts.
  for (const folder of ['docs', 'examples']) {
    const visit = (directory) => {
      if (!fs.existsSync(directory)) return;
      for (const entry of fs.readdirSync(directory, {withFileTypes:true})) {
        const absolute=path.join(directory,entry.name);
        if(entry.isSymbolicLink())throw Error('Runtime reference cannot be a symlink: '+absolute);
        if(entry.isDirectory())visit(absolute);
        else if(entry.isFile() && /\.(md|yaml|yml|ts|tsx|png|svg)$/.test(entry.name)) {
          const relative=path.relative(skillRoot,absolute).replaceAll('\\','/');
          if(folder==='examples' && path.dirname(relative)==='examples' && /\.ya?ml$/.test(entry.name))continue;
          files.set(relative,readRealFile(absolute,skillRoot).bytes);
        }
      }
    };
    visit(path.join(skillRoot,folder));
  }

  // Final pass: ensure every .json value is compact one-line; leave .mjs untouched.
  for (const [name, bytes] of [...files]) {
    if (!name.endsWith('.json')) continue;
    files.set(name, recompactJsonBytes(bytes));
  }

  const manifestFiles = [...files].map(([file, bytes]) => ({ path: file, sha256: hash(bytes) }));
  files.set('manifest.json', compactJsonBuffer({
    schema: 'starci/dist@1',
    workflow: 'frontend',
    matrix: 'workflows/matrix.json',
    contracts: 'workflows/contracts.json',
    limits: { steps: 3, parallel: 3, primary: 9, secondaryPerPrimary: 3 },
    files: manifestFiles
  }));

  return files;
}

export function build({ check = false, root: skillRoot = root } = {}) {
  const files = buildFiles(skillRoot);
  return publishDist(skillRoot, files, { check });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = build({ check: process.argv.includes('--check') });
    process.stdout.write(compactJson(result));
    if (!result.ok) process.exitCode = 1;
  } catch (e) {
    process.stderr.write(e.message + '\n');
    process.exitCode = 1;
  }
}
