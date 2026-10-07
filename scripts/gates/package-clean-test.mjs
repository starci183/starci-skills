#!/usr/bin/env node
// package-clean-test.mjs - every published @starci package passes its own tests from a CLEAN install.
//
//   starci release clean-test                      every package of the publish set
//   starci release clean-test --changed <file>...  only the packages those files belong to
//   starci release clean-test --base <rev>         only the packages the files changed in <rev>..HEAD belong to
//
// The publish set is read, never listed by hand: every `group: starci` pin of knowledge/hfs/canon-pins.yaml with a
// `source` is a published package, and the folder of that source is the package. For each one the proof:
//   1. copies the package to a fresh temp directory with no node_modules above it, at its runtime-relative path, with the
//      SOURCES of every other published package beside it at theirs (a parity test may read a sibling's source, as the
//      stylelint vocabulary reads the grammar CSS); only TRACKED files are copied (copyTracked), so nothing installed,
//      hoisted, junctioned or built in this checkout can satisfy it, while committed fixture stubs come along. The one
//      exception is the generated runtime copies (ruleParams.runtime.generated): untracked, but shipped content the
//      packages' own tests read - the proof regenerates them first (the runtime copy generator) and carries what
//      the fresh sync wrote;
//   2. installs it from its own manifest: `npm ci` on its own lockfile, or `npm install` when it carries none (the
//      report says `npm install (no lockfile)`, so a package that ships without a lock is visible). Exact declared local
//      dependencies use their candidate tarballs in the scratch manifest; installed regular files must match the pack.
//      A locked unit needing that substitution refuses instead of altering its lockfile;
//   3. runs its declared `test` script there. A package that declares none is red (PACKAGE_NO_TEST): a published
//      package proves itself.
// A workspace member (a folder some ancestor package.json lists in `workspaces`, the eslint canons of
// packages/package.json) is installed the way its workspace is: the workspace root's manifest and lockfile plus every
// member folder are copied, `npm ci` runs at that root, and the member's own test script runs in its folder. A
// change to the workspace root's manifest or lockfile proves every published member.
// Why (2026-10-01): @starci/test-world 1.0.0 shipped while its tests failed on a clean `npm ci` - @nestjs/platform-express
// was undeclared and only a hoisted local node_modules (and Nest's dynamic loadPackage) hid it.
//
// Codes per package: PACKAGE_INSTALL_RED (the clean install failed), PACKAGE_TEST_RED (its tests failed),
// PACKAGE_NO_TEST (no test script), PACKAGE_PROOF_UNRUN (the proof itself could not run: npm missing, the network,
// a temp directory under a node_modules). Exit 0 every package green, 1 a red package, 2 a proof that could not run
// (never a pass). The land gate runs it for the packages a land changes (scripts/supervisor/land.mjs), CI and the
// release checklist (packages/README.md) for every package.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { byCodeUnit } from '../lib/list.mjs';
import { runNpm } from '../api/npm/run-npm.mjs';
import { pack as packNpm } from '../api/npm/pack.mjs';
import { fileURLToPath } from 'node:url';
import { isMain } from '../lib/is-main.mjs';
import { loadPins } from './canon-pins.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { runScript } from '../api/node/run-script.mjs';
import { safeRemove } from '../api/fs/safe-remove.mjs';
import { isLinkLike } from '../api/fs/is-link-like.mjs';
import { artifactHoldReason } from '../machine/artifact-hold.mjs';
import { insidePath, normPath, posixPath } from '../lib/path-key.mjs';
import { diff } from '../api/git/diff.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { tailLines } from '../lib/clip.mjs';
import { tarFiles } from '../lib/tar-files.mjs';

export const PROOF_EXIT = Object.freeze({ green: 0, red: 1, unrun: 2 });
export const PROOF_CODES = Object.freeze({ install: 'PACKAGE_INSTALL_RED', test: 'PACKAGE_TEST_RED', noTest: 'PACKAGE_NO_TEST', unrun: 'PACKAGE_PROOF_UNRUN' });
const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LOCKFILES = ['package-lock.json', 'npm-shrinkwrap.json'];
const INSTALL_TIMEOUT_MS = 1_200_000;
const TEST_TIMEOUT_MS = 1_800_000;
/** npm's own words for a registry it could not reach: the proof did not run, the package is not judged. */
const NETWORK = /\b(ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENETUNREACH|ENOTCACHED)\b/;
const USAGE = 'usage: starci release clean-test [--changed <file>... | --base <rev>]';

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const tail = (text, n = 30) => tailLines(text, n);

/** The published packages: [{name, dir}] with `dir` runtime-relative (posix), from the starci pins that name a source. */
export function publishSet(root = runtimeRoot) {
  return Object.entries(loadPins(root)?.pins ?? {})
    .filter(([, pin]) => pin?.group === 'starci' && pin.source)
    .map(([name, pin]) => ({ name, dir: posixPath(path.dirname(pin.source)) }));
}

/** The generated roots of the runtime manifest under `root` (ruleParams.runtime.generated), runtime-relative posix; [] when the runtime has no manifest. */
function generatedRoots(root = runtimeRoot) {
  const file = path.join(root, 'knowledge', 'hfs', 'runtime-slots.yaml');
  if (!fs.existsSync(file)) return [];
  return (parseYaml(fs.readFileSync(file, 'utf8'))?.ruleParams?.runtime?.generated ?? [])
    .map((g) => normPath(g.root ?? ''))
    .filter(Boolean);
}

/** The member folders (absolute) a workspace root's `workspaces` names: `x/*` is every child holding a package.json, else the folder itself. */
function workspaceMembers(wsRoot) {
  const patterns = [readJson(path.join(wsRoot, 'package.json')).workspaces ?? []].flat().flatMap((w) => (typeof w === 'string' ? [w] : w?.packages ?? []));
  const out = [];
  for (const pattern of patterns) {
    if (pattern.endsWith('/*')) {
      const parent = path.join(wsRoot, pattern.slice(0, -2));
      let names = [];
      try { names = fs.readdirSync(parent, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { /* no such folder */ }
      for (const name of names.sort()) if (fs.existsSync(path.join(parent, name, 'package.json'))) out.push(path.join(parent, name));
    } else if (fs.existsSync(path.join(wsRoot, pattern, 'package.json'))) out.push(path.join(wsRoot, pattern));
  }
  return out;
}

/** The workspace root (absolute) whose `workspaces` lists `dir`, searching the folders above it up to `root`; null for a standalone package. */
function workspaceRootOf(dir, root) {
  const target = path.resolve(dir);
  for (let up = path.dirname(target); up.length >= path.resolve(root).length; up = path.dirname(up)) {
    if (fs.existsSync(path.join(up, 'package.json')) && workspaceMembers(up).some((m) => path.resolve(m) === target)) return up;
    if (path.dirname(up) === up) break;
  }
  return null;
}

/**
 * The install units of `packages` ([{name, dir}], dir relative to `root`): one per standalone package, one per workspace
 * root holding the published members. [{kind: 'standalone'|'workspace', dir, members: [abs], packages: [{name, dir}]}]
 */
export function installUnits(packages, root = runtimeRoot) {
  const units = new Map();
  for (const pkg of packages) {
    const abs = path.resolve(root, pkg.dir);
    const ws = workspaceRootOf(abs, root);
    const key = ws ?? abs;
    if (!units.has(key)) units.set(key, ws ? { kind: 'workspace', dir: ws, members: workspaceMembers(ws), packages: [] } : { kind: 'standalone', dir: abs, members: [], packages: [] });
    units.get(key).packages.push(pkg);
  }
  return [...units.values()];
}

/** The packages of the publish set that `changed` (runtime-relative files) touches: a file inside a package, or a workspace root's manifest or lockfile. */
export function packagesChanged(changed, packages, root = runtimeRoot) {
  const files = changed.map((f) => posixPath(path.isAbsolute(f) ? path.relative(root, f) : f));
  return packages.filter((pkg) => {
    if (files.some((f) => f.startsWith(`${pkg.dir}/`))) return true;
    const ws = workspaceRootOf(path.resolve(root, pkg.dir), root);
    if (!ws) return false;
    const wsRel = posixPath(path.relative(root, ws));
    return files.some((f) => ['package.json', ...LOCKFILES].some((name) => f === (wsRel ? `${wsRel}/${name}` : name)));
  });
}

/** A folder above `dir` (or `dir` itself) that holds a node_modules: Node would resolve a missing dependency from it. */
function nodeModulesAbove(dir) {
  for (let up = path.resolve(dir); ; up = path.dirname(up)) {
    if (fs.existsSync(path.join(up, 'node_modules'))) return up;
    if (path.dirname(up) === up) return null;
  }
}

/** The files git tracks under `dir`, relative to it; null when `dir` is not inside a git work tree. */
export function gitTrackedUnder(dir) {
  const r = lsFiles(['-z', '--', '.'], { cwd: dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return r.status === 0 ? String(r.stdout).split('\0').filter(Boolean) : null;
}

/**
 * Copy the TRACKED files of one folder (their working-tree content). What git does not track never comes along: an
 * installed node_modules or a junction to a hoisted install, a build's dist, a local .env. What it tracks always does,
 * a lint fixture's committed type stubs under fixtures/typed/node_modules included. A tracked link is not copied.
 */
function copyTracked(from, to) {
  const files = gitTrackedUnder(from);
  if (!files) throw new Error(`${from} is not inside a git work tree: the proof copies tracked files only`);
  for (const rel of files) {
    const src = path.join(from, rel);
    let stat;
    try { stat = fs.lstatSync(src); } catch { continue; }
    if (!stat.isFile()) continue;
    fs.mkdirSync(path.dirname(path.join(to, rel)), { recursive: true });
    fs.copyFileSync(src, path.join(to, rel));
  }
}

/** The environment of the clean install: the caller's, minus what an enclosing `npm run`, NODE_PATH or a running node --test would leak. */
export function cleanEnv(env = process.env) {
  const out = {};
  for (const [key, value] of Object.entries(env)) {
    if (key === 'NODE_PATH' || key === 'INIT_CWD' || key === 'NODE_TEST_CONTEXT' ||/^npm_(lifecycle|package|command|config_(prefix|local_prefix|workspace|workspaces|include_workspace_root))/i.test(key)) continue;
    out[key] = value;
  }
  return out;
}

const npmRun = (args, { cwd, env, timeout }) => {
  const r = runNpm(args, { cwd, env, timeout, maxBuffer: 256 * 1024 * 1024 });
  return { status: r.status, error: r.error ?? null, timedOut: r.error?.code === 'ETIMEDOUT' || (r.signal && r.status === null), output: `${r.stdout ?? ''}${r.stderr ?? ''}` };
};

/** The candidate-tarball substitutions the unit's manifests request: {requested, changes}, or a {status, output} refusal. */
const recordPackageRequest = ({ manifest, dir, section, name, version, candidates, own, locked, requested, changes }) => {
  const candidate = candidates.get(name);
  if (!name.startsWith('@starci/') || !candidate || own.includes(candidate.dir)) return null;
  if (version !== candidate.manifest.version) return { status: 'red', output: `${manifest.name} declares ${name}@${version}, but the candidate is ${candidate.manifest.version}: no tarball substitution` };
  if (locked || section === 'peerDependencies') return { status: 'unrun', output: `${manifest.name} needs local ${name}@${version}, but ${locked ? 'a locked install' : 'a peer dependency'} cannot substitute a candidate tarball without changing its dependency contract` };
  requested.set(name, candidate);
  changes.push({ dir, section, name });
  return null;
};

const collectRequests = ({ own, candidates, locked }) => {
  const requested = new Map();
  const changes = [];
  const sections = ['dependencies', 'devDependencies', 'optionalDependencies'];
  for (const dir of own) {
    const manifest = readJson(path.join(dir, 'package.json'));
    for (const section of [...sections, 'peerDependencies']) for (const [name, version] of Object.entries(manifest[section] ?? {})) {
      const outcome = recordPackageRequest({ manifest, dir, section, name, version, candidates, own, locked, requested, changes });
      if (outcome !== null) return outcome;
    }
  }
  return { requested, changes };
};

/** Pack one candidate and prove its payload is safe and identical: {name, version, archive, files}, or a {status, output} refusal. */
const packCandidate = ({ name, candidate, candidates, destination, env, pack }) => {
  for (const [nested, version] of Object.entries({ ...candidate.manifest.dependencies, ...candidate.manifest.optionalDependencies, ...candidate.manifest.peerDependencies })) {
    if (nested.startsWith('@starci/') && candidates.has(nested)) return { status: 'unrun', output: `${name} declares transitive local ${nested}@${version}: a direct tarball substitution cannot prove that install` };
  }
  const packed = pack(candidate.dir, destination, { cwd: candidate.dir, run: (args, options) => runNpm(args, { ...options, env }) });
  if (!packed.ok) return { status: NETWORK.test(packed.detail ?? '') ? 'unrun' : 'red', output: `candidate pack ${name} failed: ${packed.detail}` };
  if (!packed.file || path.basename(packed.file) !== packed.file) return { status: 'red', output: `candidate pack ${name} returned an unsafe tarball path` };
  const archive = path.join(destination, packed.file);
  if (!fs.lstatSync(archive).isFile()) return { status: 'red', output: `candidate pack ${name} is not a regular tarball file` };
  const files = tarFiles(fs.readFileSync(archive));
  if ([...files.keys()].some((file) => !file.startsWith('package/') || file.includes('\\') || file.split('/').some((part) => !part || part === '.' || part === '..'))) return { status: 'red', output: `candidate pack ${name} contains an unsafe payload path` };
  const identity = JSON.parse(files.get('package/package.json')?.toString('utf8') ?? 'null');
  if (identity?.name !== name || identity?.version !== candidate.manifest.version) return { status: 'red', output: `candidate pack ${name} has a different package name or version` };
  return { name, version: identity.version, archive, files };
};

function preparePackedDependencies({ dirs, own, temp, locked, env, pack }) {
  const candidates = new Map();
  for (const dir of dirs) {
    const manifest = readJson(path.join(dir, 'package.json'));
    if (candidates.has(manifest.name)) return { status: 'unrun', output: `duplicate local package ${manifest.name}` };
    candidates.set(manifest.name, { dir, manifest });
  }
  const found = collectRequests({ own, candidates, locked });
  if (found.status) return found;
  const { requested, changes } = found;
  const payloads = [];
  if (!requested.size) return { payloads };
  const destination = path.join(temp, 'packed-dependencies');
  fs.mkdirSync(destination);
  for (const [name, candidate] of requested) {
    const packed = packCandidate({ name, candidate, candidates, destination, env, pack });
    if (packed.status) return packed;
    payloads.push(packed);
  }
  for (const { dir, section, name } of changes) {
    const file = path.join(dir, 'package.json');
    const manifest = readJson(file);
    manifest[section][name] = `file:${posixPath(payloads.find((payload) => payload.name === name).archive)}`;
    fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  return { payloads };
}

/** The installed payload must equal the packed file: a failure string, or null when it does. */
const checkPayloadFile = ({ name, version, file, expected, packageRoot, installRoot }) => {
  if (!file.startsWith('package/') || file.includes('\\') || file.includes(':') || file.split('/').some((part) => !part || part === '.' || part === '..')) return `${name}@${version}: invalid packed path ${file}`;
  let target = packageRoot ?? installRoot;
  const parts = [...(packageRoot ? [] : ['node_modules', ...name.split('/')]), ...file.slice('package/'.length).split('/')];
  for (const [index, part] of parts.entries()) {
    target = path.join(target, part);
    const stat = fs.lstatSync(target, { throwIfNoEntry: false });
    if (!stat || isLinkLike(target, { stat }) || (index === parts.length - 1 ? !stat.isFile() : !stat.isDirectory())) return `${name}@${version}: installed payload ${file} is missing or linked`;
  }
  if (!fs.readFileSync(target).equals(expected)) return `${name}@${version}: installed payload differs from the candidate tarball at ${file}`;
  return null;
};

const checkPayload = ({ name, version, files, packageRoots, installRoot }) => {
  const packageRoot = packageRoots.get(name);
  if (packageRoot) {
    const stat = fs.lstatSync(packageRoot, { throwIfNoEntry: false });
    if (!stat?.isDirectory() || isLinkLike(packageRoot, { stat })) return `${name}@${version}: installed package root is missing or linked`;
  }
  for (const [file, expected] of files) {
    const failure = checkPayloadFile({ name, version, file, expected, packageRoot, installRoot });
    if (failure) return failure;
  }
  return null;
};

export function verifyPackedDependencies(payloads, installRoot, { packageRoots = new Map() } = {}) {
  for (const payload of payloads) {
    const failure = checkPayload({ ...payload, packageRoots, installRoot });
    if (failure) return failure;
  }
  return null;
}

/** Stage the unit into the temp tree: {at, installRoot, own, copied}. Comments mark the source vs generated copies. */
const stageUnit = (unit, { root, temp, sources }) => {
  const at = (abs) => path.join(temp, 'r', path.relative(root, abs));
  const installRoot = at(unit.dir);
  const own = unit.kind === 'workspace' ? unit.members : [unit.dir];
  if (unit.kind === 'workspace') {
    fs.mkdirSync(installRoot, { recursive: true });
    for (const name of ['package.json', ...LOCKFILES, '.npmrc']) if (fs.existsSync(path.join(unit.dir, name))) fs.copyFileSync(path.join(unit.dir, name), path.join(installRoot, name));
  }
  for (const dir of own) copyTracked(dir, at(dir));
  // the other published packages' sources, never inside a folder copied above
  const sourcesCopied = sources.map((d) => path.resolve(root, d)).filter((d) => !own.some((o) => insidePath(o, d, { includeSelf: true }) || insidePath(d, o, { includeSelf: true })));
  for (const dir of sourcesCopied) copyTracked(dir, at(dir));
  // The generated runtime copies are untracked but shipped content the packages' own tests read; the fresh sync's
  // output is carried like the tracked files (a copied dir's generated root inside it, or a generated root holding it).
  const copied = [...own, ...sourcesCopied];
  for (const g of generatedRoots(root)) {
    const abs = path.resolve(root, g);
    if (copied.some((d) => insidePath(d, abs, { includeSelf: true }) || insidePath(abs, d, { includeSelf: true })) && fs.existsSync(abs)) fs.cpSync(abs, at(abs), { recursive: true });
  }
  return { at, installRoot, own, copied };
};

/** One package's test result inside an installed unit. */
const testPackage = (pkg, { placed, install, localDependencies, childEnv, npm, result }) => {
  const dir = placed.get(pkg.name);
  const manifest = readJson(path.join(dir, 'package.json'));
  if (typeof manifest.scripts?.test !== 'string' || !manifest.scripts.test.trim()) return result(pkg, 'red', PROOF_CODES.noTest, { install, output: `${pkg.dir}/package.json declares no test script: a published package proves itself` });
  const tested = npm(['test'], { cwd: dir, env: childEnv, timeout: TEST_TIMEOUT_MS });
  if (tested.error && !tested.timedOut) return result(pkg, 'unrun', PROOF_CODES.unrun, { install, output: `npm could not start: ${tested.error.message}` });
  if (tested.status !== 0) return result(pkg, 'red', PROOF_CODES.test, { install, output: tail(tested.output.split(/\r?\n/).filter((l) => !/^\s+at /.test(l)).join('\n'), 60) });
  return result(pkg, 'green', null, { install, ...(localDependencies.length ? { localDependencies } : {}) });
};

const installationResults = (installed, install, every) => {
  if (installed.error && !installed.timedOut) return every('unrun', PROOF_CODES.unrun, { install, output: `npm could not start: ${installed.error.message}` });
  if (installed.status !== 0) {
    const unrun = installed.timedOut || NETWORK.test(installed.output);
    return every(unrun ? 'unrun' : 'red', unrun ? PROOF_CODES.unrun : PROOF_CODES.install, { install, output: tail(installed.output) });
  }
  return null;
};

/**
 * Prove one install unit in a fresh temp directory. Returns one result per published package:
 * {name, dir, status: 'green'|'red'|'unrun', code, install, ms, output}.
 */
function proveUnit(unit, { root = runtimeRoot, env = process.env, npm = npmRun, pack = packNpm, sources = [] } = {}) {
  const started = Date.now();
  const result = (pkg, status, code, extra = {}) => ({ name: pkg.name, dir: pkg.dir, status, code, ms: Date.now() - started, ...extra });
  const every = (status, code, extra) => unit.packages.map((pkg) => result(pkg, status, code, extra));
  let temp;
  try { temp = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-pkg-proof-'))); } catch (error) { return every('unrun', PROOF_CODES.unrun, { output: `no temp directory: ${error.message}` }); }
  try {
    const above = nodeModulesAbove(temp);
    if (above) return every('unrun', PROOF_CODES.unrun, { output: `${above} holds a node_modules above the temp directory ${temp}: an install there would not be clean` });
    const { at, installRoot, own, copied } = stageUnit(unit, { root, temp, sources });
    const placed = new Map(unit.packages.map((pkg) => [pkg.name, at(path.resolve(root, pkg.dir))]));
    const locked = LOCKFILES.some((name) => fs.existsSync(path.join(installRoot, name)));
    const install = locked ? 'npm ci' : 'npm install (no lockfile)';
    const childEnv = { ...cleanEnv(env), npm_config_update_notifier: 'false' };
    const prepared = preparePackedDependencies({ dirs: copied.map(at), own: [...new Set([installRoot, ...own.map(at)])], temp, locked, env: childEnv, pack });
    if (prepared.status) return every(prepared.status, prepared.status === 'red' ? PROOF_CODES.install : PROOF_CODES.unrun, { install, output: prepared.output });
    const localDependencies = prepared.payloads.map(({ name, version, files }) => ({ name, version, packedFiles: [...files.keys()].sort(byCodeUnit) }));
    const installed = npm([locked ? 'ci' : 'install', '--no-audit', '--no-fund'], { cwd: installRoot, env: childEnv, timeout: INSTALL_TIMEOUT_MS });
    const installResults = installationResults(installed, install, every);
    if (installResults !== null) return installResults;
    const dependencyFailure = verifyPackedDependencies(prepared.payloads, installRoot);
    if (dependencyFailure) return every('red', PROOF_CODES.install, { install, localDependencies, output: dependencyFailure });
    return unit.packages.map((pkg) => testPackage(pkg, { placed, install, localDependencies, childEnv, npm, result }));
  } catch (error) {
    return every('unrun', PROOF_CODES.unrun, { output: String(error?.stack ?? error) });
  } finally {
    safeRemove(temp, { hold: artifactHoldReason });
  }
}

/** Prove `packages` ([{name, dir}]); `sources` are the package folders (root-relative) copied beside each one. {exit, results} */
export function provePackages(packages, { root = runtimeRoot, env = process.env, npm = npmRun, pack = packNpm, log = () => {}, sources = packages.map((p) => p.dir) } = {}) {
  const results = [];
  for (const unit of installUnits(packages, root)) {
    log(`package-clean-test: installing ${unit.packages.map((p) => p.name).join(', ')} (${unit.kind}) from ${posixPath(path.relative(root, unit.dir)) || '.'}`);
    for (const r of proveUnit(unit, { root, env, npm, pack, sources })) { results.push(r); log(line(r)); }
  }
  let exit = PROOF_EXIT.green;
  if (results.some((r) => r.status === 'unrun')) exit = PROOF_EXIT.unrun;
  else if (results.some((r) => r.status === 'red')) exit = PROOF_EXIT.red;
  return { exit, results };
}

const line = (r) => {
  const code = r.code ? ` ${r.code}` : '';
  const detail = String(r.output ?? '').split(/\r?\n/).map((l) => `    ${l}`).join('\n');
  const tail = r.status === 'green' ? '' : `\n${detail}`;
  return `package-clean-test: ${r.name} ${r.status.toUpperCase()}${code} (${r.install ?? 'not installed'}, ${Math.round(r.ms / 1000)}s)${tail}`;
};

/** The --changed/--base file list the proof is limited to: {changed}, or {code} when a flag failed. */
const readChanges = (argv, root, out) => {
  let changed = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--changed') {
      changed = [...(changed ?? [])];
      while (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) { i += 1; changed.push(argv[i]); }
    } else if (argv[i] === '--base' && argv[i + 1]) {
      i += 1;
      const range = `${argv[i]}..HEAD`;
      const names = diff(['--name-only', '--no-renames', range], { cwd: root, encoding: 'utf8' });
      if (names.status !== 0) { out(`package-clean-test: git diff ${range} failed: ${String(names.stderr || names.error?.message || '').trim()}\n`); return { code: PROOF_EXIT.unrun }; }
      changed = [...(changed ?? []), ...String(names.stdout).split(/\r?\n/).filter(Boolean)];
    } else { out(`${USAGE}\n`); return { code: PROOF_EXIT.unrun }; }
  }
  return { changed };
};

/** The generated copies are refreshed first so what the temp install reads is what a pack would ship. */
const refreshGenerated = (root, out) => {
  const syncScript = path.join(root, 'scripts', 'hfs', 'sync-runtime.mjs');
  if (fs.existsSync(syncScript) && generatedRoots(root).length) {
    const status = runScript(syncScript, [], { cwd: root });
    if (status !== 0) { out(`package-clean-test: the runtime sync failed (exit ${status}); the generated copies cannot be trusted\n`); return false; }
  }
  return true;
};

function packageCleanTestMain(argv = [], { root = runtimeRoot, out = (s) => process.stdout.write(s) } = {}) {
  const parsed = readChanges(argv, root, out);
  if (parsed.code !== undefined) return parsed.code;
  const changed = parsed.changed;
  // The proof copies tracked files plus the generated runtime copies; the copies are refreshed first so what the temp
  // install reads is what a pack would ship.
  if (!refreshGenerated(root, out)) return PROOF_EXIT.unrun;
  const set = publishSet(root);
  const packages = changed ? packagesChanged(changed, set, root) : set;
  if (!packages.length) { out(`package-clean-test: no published package changed (${set.length} in the publish set)\n`); return PROOF_EXIT.green; }
  const { exit, results } = provePackages(packages, { root, log: (s) => out(`${s}\n`), sources: set.map((p) => p.dir) });
  out(`package-clean-test: ${results.filter((r) => r.status === 'green').length} green, ${results.filter((r) => r.status === 'red').length} red, ${results.filter((r) => r.status === 'unrun').length} not run, of ${results.length}\n`);
  return exit;
}

if (isMain(import.meta.url)) process.exitCode = packageCleanTestMain(process.argv.slice(2));
