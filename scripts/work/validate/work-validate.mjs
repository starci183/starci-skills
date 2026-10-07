#!/usr/bin/env node
// Canonical `starci runtime validate <work-root-or-record-dir>` entry.
// Composes the runtime's structural, consistency, and artifact machines into
// one read-only verdict so operation contracts never depend on a prose alias.
// `--strict` (validateWork(target, {strict: true})) also compiles every record
// against the JSON schema its `schema:` const names (check-work-schemas.mjs);
// the default stays lenient because live trees still carry records written
// before that enforcement, and ops scope the strict run to what they write.
// `--owned <path>[,<path>]` (repeatable) judges a slice: a refused finding whose file lies outside every
// owned path is moved to `outOfScope` (a pre-existing finding another record's owner repairs) and never
// fails the run. Since 2026-09-27 business.decide/architecture.decide/scope.define legs validated their
// whole feature and blocked on a journey actor, DATA_STATUS_DRAWN drawings or a done UI record's missing
// asset in records they could not write (seen on several product workflows).
// A finding whose file cannot be read off stays in scope.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkFamiliesDrift, checkStarciworkBoundary, checkWorkTree, walk } from './check-example-work.mjs';
import { checkWorkConsistencyTree } from './check-work-consistency.mjs';
import { checkWorkArtifacts } from './check-work-artifacts.mjs';
import { checkWorkSchemas } from './check-work-schemas.mjs';
import { shellBindingFindings } from '../ui/shell-conformance.mjs';
import { checkStarciStacks } from '../../gates/starcistacks.mjs';
import { parseYaml } from '../../../engine/yaml.mjs';
import { isMain } from '../../lib/is-main.mjs';
import { byCodeUnit } from '../../lib/list.mjs';

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const uniqueSorted = (items) => [...new Set(items.map(String))].sort(byCodeUnit);

/** The `schema:` of the root index.yaml, or null when it is missing or does not parse (structural validation owns that refusal). */
function rootSchemaOf(root) {
  const indexFile = path.join(root, 'index.yaml');
  try { if (fs.existsSync(indexFile)) return parseYaml(fs.readFileSync(indexFile, 'utf8'))?.schema ?? null; }
  catch { /* structural validation below owns the parse refusal */ }
  return null;
}

/** The work root a record directory belongs to: the nearest ancestor that is .starciwork or holds workspace.yaml, else `root`. */
function enclosingWorkRootOf(root) {
  let dir = root;
  while (true) {
    if (path.basename(dir) === '.starciwork' || fs.existsSync(path.join(dir, 'workspace.yaml'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return root;
    dir = parent;
  }
}

function workContextFor(requested) {
  const root = fs.statSync(requested).isDirectory() ? requested : path.dirname(requested);
  const yamlFiles = walk(root).filter((file) => /\.ya?ml$/i.test(file));
  const rootSchema = rootSchemaOf(root);
  const mode = fs.existsSync(path.join(root, 'workspace.yaml')) || rootSchema === 'work/catalog@1'
    ? 'tree' : 'record';
  const enclosingWorkRoot = mode === 'tree' ? root : enclosingWorkRootOf(root);
  return {root, yamlFiles, mode, enclosingWorkRoot};
}

function checkStructure(root, enclosingWorkRoot, refused, suspect, info) {
  try {
    checkFamiliesDrift(refused, path.join(runtimeRoot, 'modules', 'schemas', 'work-layout.yaml'));
    return checkWorkTree(root, refused, suspect, info, enclosingWorkRoot);
  } catch (error) {
    refused.push(`${root}: structural validation crashed closed (${String(error?.message ?? error)}) [VALIDATOR_ERROR]`);
    return {records: 0, refs: 0, evidence: 0, payloads: 0};
  }
}

function checkProductBoundary(root, refused, suspect) {
  try {
    checkStarciworkBoundary(root, refused, suspect);
  } catch (error) {
    refused.push(`${root}: product boundary validation crashed closed (${String(error?.message ?? error)}) [VALIDATOR_ERROR]`);
  }
}

function checkConsistency(root, refused, suspect, info) {
  try {
    const consistency = checkWorkConsistencyTree(root);
    refused.push(...consistency.refuse);
    suspect.push(...consistency.suspect);
    info.push(...consistency.info);
  } catch (error) {
    refused.push(`${root}: consistency validation crashed closed (${String(error?.message ?? error)}) [VALIDATOR_ERROR]`);
  }
}

function checkArtifacts(root, refused, suspect, info) {
  try {
    const artifacts = {refuse: [], suspect: [], info: []};
    checkWorkArtifacts(root, artifacts);
    refused.push(...artifacts.refuse);
    suspect.push(...artifacts.suspect);
    info.push(...artifacts.info);
  } catch (error) {
    refused.push(`${root}: artifact validation crashed closed (${String(error?.message ?? error)}) [VALIDATOR_ERROR]`);
  }
}

function checkShellBindings(root, enclosingWorkRoot, refused, suspect, info) {
  try {
    for (const item of shellBindingFindings(root, enclosingWorkRoot)) {
      let findings = info;
      if (item.level === 'refuse') findings = refused;
      else if (item.level === 'suspect') findings = suspect;
      findings.push(`${item.file}: ${item.message} [${item.code}]`);
    }
  } catch (error) {
    refused.push(`${root}: shell binding validation crashed closed (${String(error?.message ?? error)}) [VALIDATOR_ERROR]`);
  }
}

function checkStackServices(root, suspect, refused) {
  try {
    for (const item of checkStarciStacks(path.dirname(root)).findings) {
      (item.code === 'STACKS_PLAINTEXT_TRACKED' && item.level === 'refuse' ? refused : suspect).push(`${item.file}: ${item.message} [${item.code}]`);
    }
  } catch (error) {
    suspect.push(`${root}: the starcistacks services check could not run (${String(error?.message ?? error)}) [VALIDATOR_ERROR]`);
  }
}

function checkStrictSchemas(root, enclosingWorkRoot, refused, info) {
  try {
    return checkWorkSchemas(root, refused, info, {workRoot: enclosingWorkRoot});
  } catch (error) {
    refused.push(`${root}: strict schema validation crashed closed (${String(error?.message ?? error)}) [VALIDATOR_ERROR]`);
    return null;
  }
}

export function validateWork(target, { strict = false } = {}) {
  const requested = path.resolve(target ?? '.');
  if (!fs.existsSync(requested)) {
    return {
      schema: 'starci/work-validate-report@1', ok: false, target: requested,
      refused: [`${requested}: target does not exist [TARGET_MISSING]`], suspect: [], info: [],
      counts: { records: 0, refs: 0, evidence: 0, payloads: 0, yamlFiles: 0 },
    };
  }
  const {root, yamlFiles, mode, enclosingWorkRoot} = workContextFor(requested);
  const refused = [];
  const suspect = [];
  const info = [];
  if (!yamlFiles.length) refused.push(`${root}: no YAML Work record found [WORK_RECORD_MISSING]`);

  // Record-scoped validation still resolves refs against the enclosing work
  // tree: a uat-flow's `environment:` names a _resources record above the
  // record dir, and resolving it against the dir alone refuses every such ref.
  let counts = { records: 0, refs: 0, evidence: 0, payloads: 0 };
  counts = checkStructure(root, enclosingWorkRoot, refused, suspect, info);

  // A repository's .starciwork holds product records only (R07): known agent data - evidence, runs, captures, kernel
  // custody, ledgers - is refused [HFS_AGENT_DATA_TRACKED] and a path off the product list is a suspect [STARCIWORK_DRIFT].
  if (mode === 'tree' && path.basename(root) === '.starciwork') {
    checkProductBoundary(root, refused, suspect);
  }

  if (mode === 'tree') {
    checkConsistency(root, refused, suspect, info);
  }

  if (mode === 'tree') {
    checkArtifacts(root, refused, suspect, info);
  } else {
    info.push(`${root}: standalone record validation; whole-tree artifact reconciliation is deferred to the owning catalog [RECORD_MODE]`);
  }

  // A ui record's shell binding (scripts/work/ui/shell-conformance.mjs): one drawn before the shell record
  // existed, or bound to an older shell rev, stays valid and is listed as a suspect for a redraw; a binding
  // that resolves to nothing is refused. Prompts and captures are the op proof's, not the validator's.
  checkShellBindings(root, enclosingWorkRoot, refused, suspect, info);

  // The owning repository's stack declaration services block (scripts/gates/starcistacks.mjs, contract
  // change starcistacks-services): the validator reports what it finds as suspects so no running leg is held
  // by it - refusals belong to the dedicated starci-starcistacks-check an op proof runs - except a tracked
  // plaintext custody member, which is a leak already.
  if (mode === 'tree' && path.basename(root) === '.starciwork') {
    checkStackServices(root, suspect, refused);
  }

  let schemaCounts = null;
  if (strict) {
    schemaCounts = checkStrictSchemas(root, enclosingWorkRoot, refused, info);
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
    counts: { ...counts, yamlFiles: yamlFiles.length, ...schemaCounts },
  };
  return result;
}

const FINDING_FILE = new RegExp([String.raw`^`, String.raw`(.+?)`, ': '].join(''));
const UNDER_FILE = new RegExp([' under ', String.raw`(.+?)`, String.raw` \[[A-Z_]+\]$`].join(''));
/** The absolute file a finding names, or null: its "under <file>" tail, else its leading path. */
function findingFile(finding, { roots = [] } = {}) {
  const text = String(finding);
  const candidates = [UNDER_FILE.exec(text)?.[1], FINDING_FILE.exec(text)?.[1]].filter(Boolean);
  for (const candidate of candidates) {
    for (const base of [process.cwd(), ...roots]) {
      const abs = path.resolve(base, candidate);
      if (fs.existsSync(abs)) return abs;
    }
  }
  return null;
}
const keyOf = (p) => {
  let k = path.resolve(p).replaceAll('\\', '/');
  while (k.endsWith('/')) k = k.slice(0, -1);
  return process.platform === 'win32' ? k.toLowerCase() : k;
};
/** The target and every directory above it: a finding names its file relative to the .starciwork root, which is an
 * ancestor when the target is a feature or record dir (validate .starciwork/features/x --owned <file> scopes like the tree). */
function ancestorsOf(target) {
  const out = [];
  let dir = path.resolve(String(target ?? '.'));
  for (let i = 0; i < 12; i++) { out.push(dir); const up = path.dirname(dir); if (up === dir) { break; } dir = up; }
  return out;
}
/** `result` judged for the slice `owned` (paths relative to cwd, or absolute): out-of-scope refusals move to outOfScope. */
export function scopeToOwned(result, owned, { roots = [] } = {}) {
  const prefixes = owned.map((p) => keyOf(String(p).replace(/[\\/]\*\*$/, '')));
  const inside = (file) => { const k = keyOf(file); return prefixes.some((pre) => k === pre || k.startsWith(`${pre}/`)); };
  const refused = [], outOfScope = [];
  for (const finding of result.refused) {
    const file = findingFile(finding, { roots: [...ancestorsOf(result.target), ...roots] });
    (file && !inside(file) ? outOfScope : refused).push(finding);
  }
  return { ...result, ok: refused.length === 0, refused, outOfScope, scope: { owned, inScope: refused.length, outOfScope: outOfScope.length } };
}

function usage(code = 0) {
  const stream = code === 0 ? process.stdout : process.stderr;
  stream.write('Usage: starci runtime validate <work-root-or-record-dir> [--strict] [--owned <path>[,<path>]]... [--json]\n');
  process.exit(code);
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const strict = argv.includes('--strict');
  const owned = [];
  const args = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--json' || argv[i] === '--strict') continue;
    if (argv[i] === '--owned') { owned.push(...String(argv[++i] ?? '').split(',').map((p) => p.trim()).filter(Boolean)); continue; }
    args.push(argv[i]);
  }
  if (!args.length || args.includes('--help') || args.includes('-h')) usage(args.length ? 0 : 2);
  if (args.length !== 1) usage(2);
  const full = validateWork(args[0], { strict });
  const result = owned.length ? scopeToOwned(full, owned) : full;
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.ok ? 0 : 1;
}
