#!/usr/bin/env node
// Canonical `starci validate <work-root-or-record-dir>` entry.
// Composes the runtime's structural, consistency, and artifact machines into
// one read-only verdict so operation contracts never depend on a prose alias.
// `--strict` (validateWork(target, {strict: true})) also compiles every record
// against the JSON schema its `schema:` const names (check-work-schemas.mjs);
// the default stays lenient because live trees still carry records written
// before that enforcement, and ops scope the strict run to what they write.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkFamiliesDrift, checkWorkTree, walk } from './check-example-work.mjs';
import { checkWorkConsistencyTree } from './check-work-consistency.mjs';
import { checkWorkArtifacts } from './check-work-artifacts.mjs';
import { checkWorkSchemas } from './check-work-schemas.mjs';
import { shellBindingFindings } from './shell-conformance.mjs';
import { checkStarciStacks } from './check-starcistacks.mjs';
import { parseYaml } from '../../engine/yaml.mjs';

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const uniqueSorted = (items) => [...new Set(items.map((item) => String(item)))].sort();

export function validateWork(target, { strict = false } = {}) {
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

  // Record-scoped validation still resolves refs against the enclosing work
  // tree: a uat-flow's `environment:` names a _resources record above the
  // record dir, and resolving it against the dir alone refuses every such ref.
  const enclosingWorkRoot = (() => {
    if (mode === 'tree') return root;
    let dir = root;
    while (true) {
      if (path.basename(dir) === '.starciwork' || fs.existsSync(path.join(dir, 'workspace.yaml'))) return dir;
      const parent = path.dirname(dir);
      if (parent === dir) return root;
      dir = parent;
    }
  })();

  let counts = { records: 0, refs: 0, evidence: 0, payloads: 0 };
  try {
    checkFamiliesDrift(refused, path.join(runtimeRoot, 'modules', 'schemas', 'work-layout.yaml'));
    counts = checkWorkTree(root, refused, suspect, info, enclosingWorkRoot);
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

  // A ui record's shell binding (scripts/checks/shell-conformance.mjs): one drawn before the shell record
  // existed, or bound to an older shell rev, stays valid and is listed as a suspect for a redraw; a binding
  // that resolves to nothing is refused. Prompts and captures are the op proof's, not the validator's.
  try {
    for (const item of shellBindingFindings(root, enclosingWorkRoot)) {
      (item.level === 'refuse' ? refused : item.level === 'suspect' ? suspect : info).push(`${item.file}: ${item.message} [${item.code}]`);
    }
  } catch (error) {
    refused.push(`${root}: shell binding validation crashed closed (${String(error?.message ?? error)}) [VALIDATOR_ERROR]`);
  }

  // The owning repository's stack declaration services block (scripts/checks/check-starcistacks.mjs, contract
  // change starcistacks-services): the validator reports what it finds as suspects so no running leg is held
  // by it - refusals belong to the dedicated starci-starcistacks-check an op proof runs - except a tracked
  // plaintext custody member, which is a leak already.
  if (mode === 'tree' && path.basename(root) === '.starciwork') {
    try {
      for (const item of checkStarciStacks(path.dirname(root)).findings) {
        (item.code === 'STACKS_PLAINTEXT_TRACKED' && item.level === 'refuse' ? refused : suspect).push(`${item.file}: ${item.message} [${item.code}]`);
      }
    } catch (error) {
      suspect.push(`${root}: the starcistacks services check could not run (${String(error?.message ?? error)}) [VALIDATOR_ERROR]`);
    }
  }

  let schemaCounts = null;
  if (strict) {
    try {
      schemaCounts = checkWorkSchemas(root, refused, info, { workRoot: enclosingWorkRoot });
    } catch (error) {
      refused.push(`${root}: strict schema validation crashed closed (${String(error?.message ?? error)}) [VALIDATOR_ERROR]`);
    }
  }

  const result = {
    schema: 'starci/work-validate-report@1',
    ok: refused.length === 0,
    target: root,
    mode,
    strict,
    refused: uniqueSorted(refused),
    suspect: uniqueSorted(suspect),
    info: uniqueSorted(info),
    counts: { ...counts, yamlFiles: yamlFiles.length, ...(schemaCounts ?? {}) },
  };
  return result;
}

function usage(code = 0) {
  const stream = code === 0 ? process.stdout : process.stderr;
  stream.write('Usage: starci validate <work-root-or-record-dir> [--strict] [--json]\n');
  process.exit(code);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const strict = process.argv.slice(2).includes('--strict');
  const args = process.argv.slice(2).filter((arg) => arg !== '--json' && arg !== '--strict');
  if (!args.length || args.includes('--help') || args.includes('-h')) usage(args.length ? 0 : 2);
  if (args.length !== 1) usage(2);
  const result = validateWork(args[0], { strict });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.ok ? 0 : 1;
}
