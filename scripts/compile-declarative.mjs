/**
 * Compile authored declarative YAML into a Map of `.dist` paths.
 * Knowledge is excluded — use compile-knowledge.mjs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {parseYaml} from '../core/yaml.mjs';
import { collectDeclarativeTree, loadDeclarative } from './runtime-compile/declarative.mjs';
import { compactJsonBuffer } from './runtime-compile/emit.mjs';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Paths under ops/ that must not be emitted by declarative collect (generate/build owns them). */
function skipOpsDeclarative(outRel) {
  const rel = outRel.replace(/^ops\//, '');
  if (rel === 'catalog.json' || rel === 'basic-ops.json' || rel === 'consolidation.json') return true;
  if (rel === 'common.json' || rel === 'registry.json') return true; // common → policy/common.json; registry is authoring-only
  if (/^[a-z]+(?:\.[a-z]+)+\/authority\.json$/.test(rel)) return true;
  if (/^[a-z]+(?:\.[a-z]+)+\/operator\.json$/.test(rel)) return true; // projected from contracts into .dist
  if (/^[a-z]+(?:\.[a-z]+)+\/specification\.json$/.test(rel)) return true;
  return false;
}

/**
 * @param {{ root?: string }} [options]
 * @returns {Map<string, Buffer>}
 */
export function compileDeclarative({ root: skillRoot = root } = {}) {
  const files = new Map();
  for(const name of ['INDEX','README','UPDATE']){
    const file=path.join(skillRoot,name+'.yaml');
    if(fs.existsSync(file))files.set(name+'.json',compactJsonBuffer(parseYaml(fs.readFileSync(file,'utf8'))));
  }
  const merge = (part, label) => {
    for (const [rel, bytes] of part) {
      if (files.has(rel)) throw Error(`Output collision (${label}): ${rel}`);
      files.set(rel, bytes);
    }
  };

  merge(collectDeclarativeTree(skillRoot, {
    dir: 'workflows',
    outPrefix: 'workflows/',
    recursive: false
  }), 'workflows');

  merge(collectDeclarativeTree(skillRoot, {
    dir: 'profiles',
    outPrefix: 'profiles/',
    recursive: false
  }), 'profiles');

  merge(collectDeclarativeTree(skillRoot, {
    dir: 'providers',
    outPrefix: 'providers/',
    recursive: true
  }), 'providers');

  merge(collectDeclarativeTree(skillRoot, {
    dir: 'approvals',
    outPrefix: 'approvals/',
    recursive: false
  }), 'approvals');

  merge(collectDeclarativeTree(skillRoot, {
    dir: 'schemas',
    outPrefix: 'schemas/',
    recursive: false,
    excludeRelative: new Set(['json-exceptions.yaml'])
  }), 'schemas');

  merge(collectDeclarativeTree(skillRoot, {
    dir: 'specifications',
    outPrefix: 'specifications/',
    recursive: false
  }), 'specifications');

  if (fs.existsSync(path.join(skillRoot, 'contracts'))) {
    merge(collectDeclarativeTree(skillRoot, {
      dir: 'contracts',
      outPrefix: 'contracts/',
      recursive: true
    }), 'contracts');
  }

  merge(collectDeclarativeTree(skillRoot, {
    dir: 'examples',
    outPrefix: 'examples/',
    recursive: false
  }), 'examples');

  // docs catalogs only (prose .md ignored by extension filter)
  merge(collectDeclarativeTree(skillRoot, {
    dir: 'docs',
    outPrefix: 'docs/',
    excludeRelative: new Set(['catalog.json']),
    recursive: false
  }), 'docs');

  // core README only (yaml-license.json stays source-side license metadata)
  merge(collectDeclarativeTree(skillRoot, {
    dir: 'core',
    outPrefix: 'core/',
    recursive: false,
    excludeRelative: new Set(['yaml-license.json'])
  }), 'core');

  // Ops authored caller-owned docs (e.g. secondary.yaml). Operators/specs/common/registry handled elsewhere.
  const opsAuthored = collectDeclarativeTree(skillRoot, {
    dir: 'ops',
    outPrefix: 'ops/',
    recursive: true
  });
  for (const [rel, bytes] of opsAuthored) {
    if (skipOpsDeclarative(rel)) continue;
    if (files.has(rel)) throw Error(`Output collision (ops authored): ${rel}`);
    files.set(rel, bytes);
  }

  // Root config example (prefer YAML stem when present).
  const configExample = path.join(skillRoot, 'config.example.yaml');
  const configExampleYml = path.join(skillRoot, 'config.example.yml');
  const configExampleJson = path.join(skillRoot, 'config.example.json');
  if (fs.existsSync(configExample) || fs.existsSync(configExampleYml) || fs.existsSync(configExampleJson)) {
    files.set('config.example.json', compactJsonBuffer(loadDeclarative(skillRoot, 'config.example.json')));
  }

  return files;
}

export function compileDeclarativeToDist({ root: skillRoot = root, check = false, write = !check } = {}) {
  const files = compileDeclarative({ root: skillRoot });
  if (!check && !write) return { ok: true, files, stale: [] };
  if (check) {
    // Subset check only — full bundle freshness is scripts/build-workflows.mjs --check.
    const stale = [];
    for (const [relative, bytes] of files) {
      const file = path.join(skillRoot, '.dist', relative);
      if (!fs.existsSync(file) || !fs.readFileSync(file).equals(bytes)) stale.push(relative);
    }
    return { ok: stale.length === 0, files, stale: [...new Set(stale)].sort((a, b) => a.localeCompare(b)) };
  }
  throw Error('Declarative-only write into .dist is disabled; use scripts/build-workflows.mjs');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const check = process.argv.includes('--check');
    if (check) {
      const result = compileDeclarativeToDist({ check: true, write: false });
      process.stdout.write(`${JSON.stringify({ ok: result.ok, files: result.files.size, stale: result.stale ?? [] })}\n`);
      if (!result.ok) process.exitCode = 1;
    } else {
      const files = compileDeclarative();
      process.stdout.write(`${JSON.stringify({ ok: true, files: files.size, note: 'map-only; run npm run build to publish .dist' })}\n`);
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
