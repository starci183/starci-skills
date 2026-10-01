#!/usr/bin/env node
// canon-scan.mjs — the measured canon debt of one product repository, and its conformance cut.
//
//   node scripts/gates/canon-scan.mjs --root <repo> [--profile next|nest] [--families <csv>]
//       [--paths <csv>] [--exclude <csv>] [--machines eslint,architecture]
//       [--fix] [--json]
//
// The repository's own eslint.config runs with its own ESLint, but its import of the canon package
// (modules/models/code-patterns.yaml profiles.<profile>.canon.package) resolves to this runtime's
// packages/eslint/<fe|be> source, so an unpublished canon rule is measured before any publish. The
// architecture check (scripts/hfs/architecture.mjs) runs beside it. Every finding carries its
// family: the canon law that owns the rule (the canon index's ruleOwners), `architecture`, the
// plugin prefix of a non-canon rule, or `parse`.
//
// `slices` is the conformance cut: findings grouped into units (modules/models/canon-conformance.yaml
// roots), units packed into pairwise-disjoint path slices of at most
// floor(allocation.slicing.targetMinutes[1] / weights.file) files, ordered by wave. The foundation
// wave also owns the shared seams it may have to create. --paths bounds the scan to one slice; --exclude removes
// paths another workflow owns (their findings are counted under `deferred`, never sliced).
// --fix applies the fixers ESLint reports for the selected families inside --paths, and nothing else.
//
// --machines defaults to the machines the selected families need (architecture only when named).
// Prints one starci/canon-findings@1 record. Exit 0: every selected machine ran and no selected
// finding remains. Exit 1: findings. Exit 2: bad arguments. Exit 3: a selected machine could not run.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire, register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startWorker } from '../api/node/start-worker.mjs';
import { workerContext } from '../api/node/worker-context.mjs';
import { readModuleJson } from '../../engine/runtime-root.mjs';
import { allocationSettings } from '../../engine/config.mjs';
import { checkArchitecture } from '../hfs/architecture/index.mjs';
import { posixPath, sameOrUnder } from '../lib/path-key.mjs';
import { WORKTREES_IGNORE_GLOBS } from '../lib/worktree-exclude.mjs';
import { emitCheckOutput } from './output.mjs';
import { isMain } from '../lib/is-main.mjs';

export const CANON_FINDINGS = 'starci/canon-findings@1';
const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MACHINES = ['eslint', 'architecture'];
const USAGE = 'usage: canon-scan.mjs --root <repo> [--profile next|nest] [--families <csv>] [--paths <csv>] [--exclude <csv>] [--machines eslint,architecture] [--fix] [--json] [--out <scratch-file> | --blob]';

const csv = (value) => String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
const prefixOf = (value) => posixPath(value).replace(/\/+$/, '');
const under = sameOrUnder;
const count = (map, key) => { map[key] = (map[key] ?? 0) + 1; };

export function parseCanonScanArgs(argv) {
  const out = { families: [], paths: [], exclude: [], fix: false, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const take = () => { const value = argv[++index]; if (value === undefined) throw Error(`${key} needs a value; ${USAGE}`); return value; };
    if (key === '--root') out.root = take();
    else if (key === '--profile') out.profile = take();
    else if (key === '--families') out.families = csv(take()).filter((family) => family !== 'all');
    else if (key === '--paths') out.paths = csv(take()).map(prefixOf);
    else if (key === '--exclude') out.exclude = csv(take()).map(prefixOf);
    else if (key === '--machines') out.machines = csv(take());
    else if (key === '--fix') out.fix = true;
    else if (key === '--json') out.json = true;
    else if (key === '--out') out.out = take();
    else if (key === '--blob') out.blob = true;
    else throw Error(`unexpected argument ${key}; ${USAGE}`);
  }
  if (!out.root) throw Error(USAGE);
  out.machines ??= out.families.length
    ? MACHINES.filter((machine) => (machine === 'architecture' ? out.families.includes('architecture') : out.families.some((family) => family !== 'architecture')))
    : [...MACHINES];
  if (out.profile && !['next', 'nest'].includes(out.profile)) throw Error(`--profile must be next or nest; ${USAGE}`);
  const unknown = out.machines.filter((machine) => !MACHINES.includes(machine));
  if (unknown.length || !out.machines.length) throw Error(`--machines takes ${MACHINES.join(', ')}; ${USAGE}`);
  if (out.fix && !out.paths.length) throw Error('--fix needs --paths: a codemod runs inside one slice only');
  if (out.out && out.blob) throw Error('--out and --blob are mutually exclusive');
  return out;
}

export function loadConformance() {
  const doc = readModuleJson('modules', 'models', 'canon-conformance.yaml');
  const waves = Array.isArray(doc?.waves) ? doc.waves : [];
  if (!waves.length || waves.some((wave) => !wave?.id || !Array.isArray(wave.roots) || !wave.roots.length)) {
    throw Error('modules/models/canon-conformance.yaml must declare waves[{id, roots[]}]');
  }
  const rootWave = new Map();
  waves.forEach((wave, index) => { for (const root of wave.roots) rootWave.set(String(root), index); });
  return { waves: waves.map((wave) => String(wave.id)), rootWave, seams: doc.seams ?? {}, unitSkip: new RegExp(doc.unitSkip ?? '^$') };
}

/** The unit a repository-relative file belongs to, and its wave. A unit is the declared root plus
 *  `depth` children that are not route segments; a file with no root is its own unit in the last wave. */
export function unitOf(file, conformance, depth = 1) {
  const segments = posixPath(file).split('/');
  const src = segments.lastIndexOf('src', segments.length - 2);
  for (let index = src + 1; index < segments.length - 1; index += 1) {
    const wave = conformance.rootWave.get(segments[index]);
    if (wave === undefined) continue;
    let end = index;
    for (let taken = 0; taken < depth && end < segments.length - 1; taken += 1) {
      end += 1;
      while (end < segments.length - 1 && conformance.unitSkip.test(segments[end])) end += 1;
    }
    return { unit: segments.slice(0, end + 1).join('/'), wave };
  }
  return { unit: segments.join('/'), wave: conformance.waves.length - 1 };
}

/** The shared seams the foundation wave owns: every declared seam path under each source root that
 *  holds a finding of the seam family, whether the seam exists yet or the slice creates it. */
export function seamPaths(root, findings, spec) {
  if (!spec?.family || !Array.isArray(spec.paths)) return [];
  const roots = new Set();
  for (const finding of findings) {
    if (finding.family !== spec.family) continue;
    const segments = finding.file.split('/');
    const src = segments.lastIndexOf('src', segments.length - 2);
    if (src >= 0) roots.add(segments.slice(0, src + 1).join('/'));
  }
  return [...roots].sort().flatMap((source) => spec.paths.map((seam) => {
    const relative = `${source}/${seam}`;
    return { path: relative, exists: fs.existsSync(path.join(root, relative)) };
  }));
}

/** The source root a unit lives in (the path up to its last `src`), so a slice never spans two packages. */
const homeOf = (unit) => { const segments = unit.split('/'); const src = segments.lastIndexOf('src'); return src < 0 ? '' : segments.slice(0, src + 1).join('/'); };

/** Pack the findings' units into pairwise-disjoint slices, wave by wave and source root by source root. A unit over the file bound
 *  splits one level deeper until it fits or reaches single files. */
export function planSlices(findings, { conformance, maxFiles, seams = [] }) {
  const byUnit = new Map();
  const place = (list, depth) => {
    const groups = new Map();
    for (const finding of list) {
      const { unit, wave } = unitOf(finding.file, conformance, depth);
      if (!groups.has(unit)) groups.set(unit, { wave, findings: [] });
      groups.get(unit).findings.push(finding);
    }
    for (const [unit, group] of groups) {
      const files = new Set(group.findings.map((finding) => finding.file));
      const deeper = files.size > maxFiles && [...files].some((file) => unitOf(file, conformance, depth + 1).unit !== unit);
      if (deeper) place(group.findings, depth + 1);
      else byUnit.set(unit, { unit, wave: group.wave, files, findings: group.findings.length, byFamily: group.findings.reduce((acc, finding) => (count(acc, finding.family), acc), {}) });
    }
  };
  place(findings, 1);
  for (const seam of seams) {
    const holder = [...byUnit.keys()].find((key) => under(seam.path, key));
    if (holder) { byUnit.get(holder).wave = 0; continue; }
    const merged = { unit: seam.path, wave: 0, files: new Set(), findings: 0, byFamily: {} };
    for (const [key, inner] of [...byUnit]) {
      if (!under(key, seam.path)) continue;
      for (const file of inner.files) merged.files.add(file);
      merged.findings += inner.findings;
      for (const [family, n] of Object.entries(inner.byFamily)) merged.byFamily[family] = (merged.byFamily[family] ?? 0) + n;
      byUnit.delete(key);
    }
    byUnit.set(seam.path, merged);
  }
  // A finding that names a second file (an import edge the fix must move) binds both units into one
  // group that no slice boundary splits; a group takes its lowest wave.
  for (const finding of findings) {
    if (!finding.related || [...byUnit.keys()].some((key) => under(finding.related, key))) continue;
    const { unit, wave } = unitOf(finding.related, conformance);
    if (![...byUnit.keys()].some((key) => under(key, unit))) byUnit.set(unit, { unit, wave, files: new Set([finding.related]), findings: 0, byFamily: {} });
  }
  const parent = new Map([...byUnit.keys()].map((key) => [key, key]));
  const find = (key) => { while (parent.get(key) !== key) key = parent.get(key); return key; };
  const holderOf = (file) => [...byUnit.keys()].find((key) => under(file, key));
  for (const finding of findings) {
    if (!finding.related) continue;
    const a = holderOf(finding.file), b = holderOf(finding.related);
    if (a && b && find(a) !== find(b)) parent.set(find(b), find(a));
  }
  const groups = new Map();
  for (const unit of byUnit.values()) {
    const key = find(unit.unit);
    if (!groups.has(key)) groups.set(key, { wave: unit.wave, home: homeOf(key), units: [] });
    const group = groups.get(key);
    group.wave = Math.min(group.wave, unit.wave);
    group.units.push(unit);
  }
  const ordered = [...groups.values()].sort((a, b) => a.wave - b.wave || a.home.localeCompare(b.home) || a.units[0].unit.localeCompare(b.units[0].unit));
  const slices = [];
  let open = null;
  for (const group of ordered) {
    const size = group.units.reduce((sum, unit) => sum + Math.max(unit.files.size, 1), 0);
    if (!open || open.wave !== group.wave || open.home !== group.home || open.files + size > maxFiles) {
      open = { wave: group.wave, home: group.home, paths: [], files: 0, findings: 0, byFamily: {} };
      slices.push(open);
    }
    for (const unit of group.units.sort((a, b) => a.unit.localeCompare(b.unit))) {
      open.paths.push(unit.unit);
      open.findings += unit.findings;
      for (const [family, n] of Object.entries(unit.byFamily)) open.byFamily[family] = (open.byFamily[family] ?? 0) + n;
    }
    open.files += size;
  }
  return slices.map((slice, index) => ({
    ...slice, ordinal: index + 1, wave: conformance.waves[slice.wave], overTarget: slice.files > maxFiles,
  }));
}

/** The runtime's canon package source for a published canon package name. */
function runtimeCanon(name) {
  const base = path.join(skillRoot, 'packages', 'eslint');
  for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifest = path.join(base, entry.name, 'package.json');
    if (!fs.existsSync(manifest)) continue;
    const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    if (pkg.name === name) return { dir: path.join(base, entry.name), version: pkg.version, entry: path.join(base, entry.name, pkg.main ?? 'index.mjs') };
  }
  throw Object.assign(Error(`no runtime package under packages/eslint publishes ${name}`), { code: 'CANON_SOURCE_UNAVAILABLE' });
}

let redirected = null;
/** Resolve every import of the canon package to the runtime source, once per process. A bare import the
 *  redirected source makes (the package's declared dependencies and peers, e.g. @typescript-eslint/parser)
 *  resolves the way the installed package's would: from the scanned repository's node_modules when it
 *  carries the dependency, else from the runtime's tree. Resolution is settled here, not in the hook -
 *  a failed next() poisons the specifier for every later parent. */
function redirectCanon(name, entry, dir, root) {
  const url = pathToFileURL(entry).href;
  if (redirected) {
    if (redirected.map[name] !== url) throw Object.assign(Error(`canon import already redirected to ${redirected.map[name] ?? 'another package'}`), { code: 'CANON_SOURCE_UNAVAILABLE' });
    return;
  }
  const deps = {};
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const bases = [createRequire(path.join(root, 'package.json')), createRequire(entry)];
  for (const dep of Object.keys({ ...manifest.peerDependencies, ...manifest.optionalDependencies, ...manifest.dependencies })) {
    for (const require of bases) {
      try { deps[dep] = pathToFileURL(require.resolve(dep)).href; break; } catch { /* the next base */ }
    }
  }
  const canonPrefix = `${pathToFileURL(dir).href}/`;
  const hooks = 'let map={},deps={},canonPrefix="";'
    + 'export async function initialize(data){map=data.map;deps=data.deps;canonPrefix=data.canonPrefix;}'
    + 'export async function resolve(specifier,context,next){'
    + 'if(Object.hasOwn(map,specifier))return{url:map[specifier],shortCircuit:true};'
    + 'if(context.parentURL&&context.parentURL.startsWith(canonPrefix)&&Object.hasOwn(deps,specifier))return{url:deps[specifier],shortCircuit:true};'
    + 'return next(specifier,context);}';
  redirected = { map: { [name]: url } };
  register(`data:text/javascript,${encodeURIComponent(hooks)}`, { data: { map: redirected.map, deps, canonPrefix } });
}

function detectProfile(root) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (deps['@nestjs/core']) return 'nest';
  if (deps.next) return 'next';
  const declaration = path.join(root, 'hfs.json');
  if (fs.existsSync(declaration)) {
    const profile = JSON.parse(fs.readFileSync(declaration, 'utf8')).profile;
    if (profile === 'be') return 'nest';
    if (profile === 'fe') return 'next';
  }
  throw Object.assign(Error('cannot tell next from nest; pass --profile'), { code: 'PROFILE_UNKNOWN' });
}

function familyOf(ruleId, canonPrefix, ruleOwners) {
  if (!ruleId) return 'parse';
  if (ruleId.startsWith(canonPrefix)) return ruleOwners[ruleId.slice(canonPrefix.length)] ?? 'canon-unowned';
  const slash = ruleId.lastIndexOf('/');
  return slash < 0 ? 'eslint-core' : ruleId.slice(0, slash);
}

async function lintRepository(root, options, canon, relative) {
  const require = createRequire(path.join(root, 'package.json'));
  const { ESLint } = require(require.resolve('eslint'));
  redirectCanon(canon.name, canon.entry, canon.dir, root);
  const loaded = await import(pathToFileURL(canon.entry).href);
  const selected = (ruleId) => !options.families.length || options.families.includes(familyOf(ruleId, canon.prefix, loaded.ruleOwners ?? {}));
  // Sibling product worktrees (<repo>/.starciwork/worktrees/**, DESIGN §16.7) are never linted as this checkout's files.
  const eslint = new ESLint({ cwd: root, ignorePatterns: [...WORKTREES_IGNORE_GLOBS], errorOnUnmatchedPattern: false, fix: options.fix ? (message) => selected(message.ruleId) : false });
  const targets = options.paths.length ? options.paths.filter((item) => fs.existsSync(path.join(root, item))) : ['.'];
  const results = targets.length ? await eslint.lintFiles(targets) : [];
  if (options.fix) await ESLint.outputFixes(results);
  const findings = [];
  for (const result of results) {
    const file = relative(result.filePath);
    for (const message of result.messages) {
      if (message.severity < 1) continue;
      findings.push({ machine: 'eslint', ruleId: message.ruleId ?? 'parse', family: familyOf(message.ruleId, canon.prefix, loaded.ruleOwners ?? {}), file, line: message.line ?? 0, fixable: Boolean(message.fix) });
    }
  }
  return { files: results.length, findings };
}

function architectureInWorker(input) {
  return new Promise((resolve, reject) => {
    const worker = startWorker(new URL(import.meta.url), { workerData: { architecture: input } });
    let settled = false;
    worker.once('message', result => { settled = true; resolve(result); });
    worker.once('error', reject);
    worker.once('exit', code => { if (!settled) reject(Error(`architecture worker exited ${code}`)); });
  });
}

export async function scanCanon(options) {
  const root = path.resolve(options.root);
  const relative = (file) => posixPath(path.relative(root, file));
  const profile = options.profile ?? detectProfile(root);
  const conformance = loadConformance();
  const catalog = readModuleJson('modules', 'models', 'code-patterns.yaml');
  const packageName = catalog?.profiles?.[profile]?.canon?.package;
  if (!packageName) throw Object.assign(Error(`code-patterns.yaml declares no canon package for ${profile}`), { code: 'CANON_SOURCE_UNAVAILABLE' });
  const source = runtimeCanon(packageName);
  const canon = { name: packageName, entry: source.entry, dir: source.dir, prefix: profile === 'nest' ? 'starci-be/' : 'starci-fe/' };
  const report = {
    schema: CANON_FINDINGS, repository: root, profile,
    canon: { package: packageName, version: source.version, source: posixPath(path.relative(skillRoot, source.dir)) },
    scope: { families: options.families, paths: options.paths, exclude: options.exclude, machines: options.machines, fix: options.fix },
    machines: {}, issues: [],
  };
  const all = [];
  const architectureTask = options.machines.includes('architecture')
    ? architectureInWorker({ repositoryRoot: root, paths: options.paths })
      .then(result => ({ result }), error => ({ error })) : null;
  const eslintTask = options.machines.includes('eslint') ? lintRepository(root, options, canon, relative)
    .then(lint => ({ lint }), error => ({ error })) : null;
  if (eslintTask) {
    try {
      const { lint, error } = await eslintTask;
      if (error) throw error;
      report.machines.eslint = { status: 'ran', files: lint.files };
      all.push(...lint.findings);
    } catch (error) {
      report.machines.eslint = { status: 'unavailable' };
      report.issues.push({ machine: 'eslint', code: error.code ?? 'ESLINT_UNAVAILABLE', message: String(error.message ?? error) });
    }
  }
  if (options.machines.includes('architecture')) {
    let result;
    try {
      const outcome = await architectureTask;
      if (outcome.error) throw outcome.error;
      result = outcome.result;
    }
    catch (error) { result = { errors: [{ ruleId: 'ARCH_EXECUTION_UNAVAILABLE', message: String(error.message ?? error) }], violations: [] }; }
    // An unresolved internal import located on a file is that file's finding (the slice holding it repoints it),
    // never the machine's unavailability (@/i18n/navigation residue left by a moved
    // seam once made every slice's canon-scan exit 3). Anything else the machine could not do stays unavailable.
    const importGaps = (result.errors ?? []).filter((error) => error.ruleId === 'ARCH_INTERNAL_IMPORT_UNRESOLVED' && error.path);
    const machineErrors = (result.errors ?? []).filter((error) => !importGaps.includes(error));
    for (const error of importGaps) all.push({ machine: 'architecture', ruleId: error.ruleId, family: 'architecture', file: posixPath(error.path), line: error.line ?? 0, fixable: false, ...(error.specifier ? { specifier: error.specifier } : {}) });
    if (machineErrors.length) {
      report.machines.architecture = { status: 'unavailable', files: result.files ?? 0 };
      for (const error of machineErrors) report.issues.push({ machine: 'architecture', code: error.ruleId, message: error.message, ...(error.path ? { path: posixPath(error.path) } : {}) });
    } else report.machines.architecture = { status: 'ran', files: result.files ?? 0, ...(importGaps.length ? { importGaps: importGaps.length } : {}) };
    for (const violation of result.violations ?? []) {
      all.push({ machine: 'architecture', ruleId: violation.ruleId, family: 'architecture', file: posixPath(violation.path ?? violation.file ?? ''), line: violation.line ?? 0, fixable: false, ...(violation.resolvedPath ? { related: posixPath(violation.resolvedPath) } : {}) });
    }
  }
  const inScope = (finding) => (!options.paths.length || options.paths.some((prefix) => under(finding.file, prefix)))
    && (!options.families.length || options.families.includes(finding.family));
  const deferredOf = (finding) => options.exclude.some((prefix) => under(finding.file, prefix));
  const selected = all.filter(inScope);
  const findings = selected.filter((finding) => !deferredOf(finding));
  const deferred = selected.filter(deferredOf);
  const totals = { findings: findings.length, fixable: 0, files: new Set(findings.map((finding) => finding.file)).size, byFamily: {}, byRule: {}, byFolder: {} };
  for (const finding of findings) {
    if (finding.fixable) totals.fixable += 1;
    count(totals.byFamily, finding.family);
    count(totals.byRule, finding.ruleId);
    count(totals.byFolder, unitOf(finding.file, conformance).unit);
  }
  const slicing = allocationSettings().slicing ?? {};
  const maxFiles = Math.floor(Number(slicing.targetMinutes?.[1]) / Number(slicing.weights?.file));
  if (!Number.isInteger(maxFiles) || maxFiles < 1) throw Object.assign(Error('modules/models/runtimes.yaml allocation.slicing must declare targetMinutes and weights.file'), { code: 'slicing-undeclared' });
  const seams = options.paths.length ? [] : seamPaths(root, findings, conformance.seams[profile]).filter((seam) => !options.exclude.some((prefix) => under(seam.path, prefix) || under(prefix, seam.path)));
  report.totals = totals;
  report.deferred = { findings: deferred.length, paths: options.exclude };
  report.seams = seams;
  report.slices = planSlices(findings, { conformance, maxFiles, seams });
  report.sliceBound = { maxFiles, source: 'modules/models/runtimes.yaml allocation.slicing targetMinutes[1] / weights.file' };
  report.findings = findings;
  const unavailable = options.machines.some((machine) => report.machines[machine]?.status !== 'ran');
  report.status = unavailable ? 'unavailable' : findings.length ? 'findings' : 'ok';
  return report;
}

function human(report) {
  const lines = [`canon-scan ${report.repository} (${report.profile}, ${report.canon.package}@${report.canon.version} from ${report.canon.source}): ${report.status}`];
  for (const [machine, state] of Object.entries(report.machines)) lines.push(`  ${machine}: ${state.status}, ${state.files} files`);
  for (const issue of report.issues) lines.push(`  ! ${issue.machine} ${issue.code}: ${issue.message}`);
  lines.push(`  findings ${report.totals.findings} in ${report.totals.files} files (${report.totals.fixable} fixable), deferred ${report.deferred.findings}`);
  for (const [family, n] of Object.entries(report.totals.byFamily).sort((a, b) => b[1] - a[1])) lines.push(`    ${family}: ${n}`);
  lines.push(`  slices ${report.slices.length} (<= ${report.sliceBound.maxFiles} files each)`);
  for (const slice of report.slices) lines.push(`    #${slice.ordinal} ${slice.wave} ${slice.files}f ${slice.findings} findings${slice.overTarget ? ' OVER' : ''}: ${slice.paths.join(', ')}`);
  return lines.join('\n');
}

export async function canonScanMain(argv, { write = (text) => process.stdout.write(text), fail = (text) => process.stderr.write(text) } = {}) {
  let options;
  try { options = parseCanonScanArgs(argv); } catch (error) { fail(`${error.message}\n`); return 2; }
  let report;
  try { report = await scanCanon(options); } catch (error) {
    report = { schema: CANON_FINDINGS, repository: options.root, status: 'unavailable', issues: [{ code: error.code ?? 'CANON_SCAN_UNAVAILABLE', message: String(error.message ?? error) }] };
    await emitCheckOutput(`${JSON.stringify(report, null, 2)}\n`, {...options, write});
    return 3;
  }
  await emitCheckOutput(options.json ? `${JSON.stringify(report, null, 2)}\n` : `${human(report)}\n`,
    {...options, mediaType: options.json ? 'application/json' : 'text/plain', write});
  return report.status === 'ok' ? 0 : report.status === 'findings' ? 1 : 3;
}

const thread = workerContext();
if (!thread.isMainThread && thread.workerData?.architecture) thread.parentPort.postMessage(checkArchitecture(thread.workerData.architecture));
else if (thread.isMainThread && isMain(import.meta.url)) process.exitCode = await canonScanMain(process.argv.slice(2));
