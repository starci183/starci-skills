#!/usr/bin/env node
// Canonical `starci validate <work-root-or-record-dir>` entry.
// Composes the runtime's structural, consistency, and artifact machines into
// one read-only verdict so operation contracts never depend on a prose alias.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkFamiliesDrift, checkWorkTree, walk } from './check-example-work.mjs';
import { checkWorkConsistencyTree } from './check-work-consistency.mjs';
import { checkWorkArtifacts } from './check-work-artifacts.mjs';
import { parseYaml } from '../../engine/yaml.mjs';

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const uniqueSorted = (items) => [...new Set(items.map((item) => String(item)))].sort();

export function validateWork(target) {
  const requested = path.resolve(target ?? '.');
  if (!fs.existsSync(requested)) {
    return {
      schema: 'starci/work-validate-report@1', ok: false, target: requested,
      refused: [`${requested}: target does not exist [TARGET_MISSING]`], suspect: [], info: [],
      counts: { records: 0, refs: 0, evidence: 0, payloads: 0, yamlFiles: 0 },
    };
  }
  const root = fs.statSync(requested).isDirectory() ? requested : path.dirname(requested);
  const yamlFiles = walk(root).filter((file) => /\.ya?ml$/i.test(file));
  const indexFile = path.join(root, 'index.yaml');
  let rootSchema = null;
  try { if (fs.existsSync(indexFile)) rootSchema = parseYaml(fs.readFileSync(indexFile, 'utf8'))?.schema ?? null; }
  catch { /* structural validation below owns the parse refusal */ }
  const mode = fs.existsSync(path.join(root, 'workspace.yaml')) || rootSchema === 'work/catalog@1'
    ? 'tree' : 'record';
  const refused = [];
  const suspect = [];
  const info = [];
  if (!yamlFiles.length) refused.push(`${root}: no YAML Work record found [WORK_RECORD_MISSING]`);

  let counts = { records: 0, refs: 0, evidence: 0, payloads: 0 };
  try {
    checkFamiliesDrift(refused, path.join(runtimeRoot, 'modules', 'schemas', 'work-layout.yaml'));
    counts = checkWorkTree(root, refused, suspect, info);
  } catch (error) {
    refused.push(`${root}: structural validation crashed closed (${String(error?.message ?? error)}) [VALIDATOR_ERROR]`);
  }

  if (mode === 'tree') {
    try {
      const consistency = checkWorkConsistencyTree(root);
      refused.push(...consistency.refuse);
      suspect.push(...consistency.suspect);
      info.push(...consistency.info);
    } catch (error) {
      refused.push(`${root}: consistency validation crashed closed (${String(error?.message ?? error)}) [VALIDATOR_ERROR]`);
    }
  }

  if (mode === 'tree') {
    try {
      const artifacts = { refuse: [], suspect: [], info: [] };
      checkWorkArtifacts(root, artifacts);
      refused.push(...artifacts.refuse);
      suspect.push(...artifacts.suspect);
      info.push(...artifacts.info);
    } catch (error) {
      refused.push(`${root}: artifact validation crashed closed (${String(error?.message ?? error)}) [VALIDATOR_ERROR]`);
    }
  } else {
    info.push(`${root}: standalone record validation; whole-tree artifact reconciliation is deferred to the owning catalog [RECORD_MODE]`);
  }

  const result = {
    schema: 'starci/work-validate-report@1',
    ok: refused.length === 0,
    target: root,
    mode,
    refused: uniqueSorted(refused),
    suspect: uniqueSorted(suspect),
    info: uniqueSorted(info),
    counts: { ...counts, yamlFiles: yamlFiles.length },
  };
  return result;
}

function usage(code = 0) {
  const stream = code === 0 ? process.stdout : process.stderr;
  stream.write('Usage: starci validate <work-root-or-record-dir> [--json]\n');
  process.exit(code);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2).filter((arg) => arg !== '--json');
  if (!args.length || args.includes('--help') || args.includes('-h')) usage(args.length ? 0 : 2);
  if (args.length !== 1) usage(2);
  const result = validateWork(args[0]);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.ok ? 0 : 1;
}
