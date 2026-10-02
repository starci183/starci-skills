#!/usr/bin/env node
// package-clean-test.mjs - every published @starci package passes its own tests from a CLEAN install.
//
//   node scripts/gates/package-clean-test.mjs                      every package of the publish set
//   node scripts/gates/package-clean-test.mjs --changed <file>...  only the packages those files belong to
//   node scripts/gates/package-clean-test.mjs --base <rev>          only the packages the files changed in <rev>..HEAD belong to
//
// The publish set is read, never listed by hand: every `group: starci` pin of knowledge/hfs/canon-pins.yaml with a
// `source` is a published package, and the folder of that source is the package. For each one the proof:
//   1. copies the package to a fresh temp directory with no node_modules above it, at its runtime-relative path, with the
//      SOURCES of every other published package beside it at theirs (a parity test may read a sibling's source, as the
//      stylelint vocabulary reads the grammar CSS); only TRACKED files are copied (copyTracked), so nothing installed,
//      hoisted, junctioned or built in this checkout can satisfy it, while committed fixture stubs come along;
//   2. installs it from its own manifest: `npm ci` on its own lockfile, or `npm install` when it carries none (the
//      report says `npm install (no lockfile)`, so a package that ships without a lock is visible);
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
import { runNpm } from '../api/npm/run-npm.mjs';
import { fileURLToPath } from 'node:url';
import { isMain } from '../lib/is-main.mjs';
import { loadPins } from './canon-pins.mjs';
import { safeRemove } from '../api/fs/safe-remove.mjs';
import { artifactHoldReason } from '../machine/artifact-hold.mjs';
import { posixPath } from '../lib/path-key.mjs';
import { diff } from '../api/git/diff.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { tailLines } from '../lib/clip.mjs';

export const PROOF_EXIT = Object.freeze({ green: 0, red: 1, unrun: 2 });
export const PROOF_CODES = Object.freeze({ install: 'PACKAGE_INSTALL_RED', test: 'PACKAGE_TEST_RED', noTest: 'PACKAGE_NO_TEST', unrun: 'PACKAGE_PROOF_UNRUN' });
const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LOCKFILES = ['package-lock.json', 'npm-shrinkwrap.json'];
const INSTALL_TIMEOUT_MS = 1_200_000;
const TEST_TIMEOUT_MS = 1_800_000;
/** npm's own words for a registry it could not reach: the proof did not run, the package is not judged. */
const NETWORK = /\b(ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENETUNREACH|ENOTCACHED)\b/;
const USAGE = 'usage: package-clean-test.mjs [--changed <file>... | --base <rev>]';

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const tail = (text, n = 30) => tailLines(text, n);

/** The published packages: [{name, dir}] with `dir` runtime-relative (posix), from the starci pins that name a source. */
export function publishSet(root = runtimeRoot) {
  return Object.entries(loadPins(root)?.pins ?? {})
    .filter(([, pin]) => pin?.group === 'starci' && pin.source)
    .map(([name, pin]) => ({ name, dir: posixPath(path.dirname(pin.source)) }));
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

/**
 * Prove one install unit in a fresh temp directory. Returns one result per published package:
 * {name, dir, status: 'green'|'red'|'unrun', code, install, ms, output}.
 */
function proveUnit(unit, { root = runtimeRoot, env = process.env, npm = npmRun, sources = [] } = {}) {
  const started = Date.now();
  const result = (pkg, status, code, extra = {}) => ({ name: pkg.name, dir: pkg.dir, status, code, ms: Date.now() - started, ...extra });
  const every = (status, code, extra) => unit.packages.map((pkg) => result(pkg, status, code, extra));
  let temp;
  try { temp = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-pkg-proof-'))); } catch (error) { return every('unrun', PROOF_CODES.unrun, { output: `no temp directory: ${error.message}` }); }
  try {
    const above = nodeModulesAbove(temp);
    if (above) return every('unrun', PROOF_CODES.unrun, { output: `${above} holds a node_modules above the temp directory ${temp}: an install there would not be clean` });
    const at = (abs) => path.join(temp, 'r', path.relative(root, abs));
    const installRoot = at(unit.dir);
    const own = unit.kind === 'workspace' ? unit.members : [unit.dir];
    if (unit.kind === 'workspace') {
      fs.mkdirSync(installRoot, { recursive: true });
      for (const name of ['package.json', ...LOCKFILES, '.npmrc']) if (fs.existsSync(path.join(unit.dir, name))) fs.copyFileSync(path.join(unit.dir, name), path.join(installRoot, name));
    }
    for (const dir of own) copyTracked(dir, at(dir));
    // the other published packages' sources, never inside a folder copied above
    const inside = (dir, parent) => { const rel = path.relative(parent, dir); return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)); };
    for (const dir of sources.map((d) => path.resolve(root, d))) if (!own.some((o) => inside(dir, o) || inside(o, dir))) copyTracked(dir, at(dir));
    const placed = new Map(unit.packages.map((pkg) => [pkg.name, at(path.resolve(root, pkg.dir))]));
    const locked = LOCKFILES.some((name) => fs.existsSync(path.join(installRoot, name)));
    const install = locked ? 'npm ci' : 'npm install (no lockfile)';
    const childEnv = { ...cleanEnv(env), npm_config_update_notifier: 'false' };
    const installed = npm([locked ? 'ci' : 'install', '--no-audit', '--no-fund'], { cwd: installRoot, env: childEnv, timeout: INSTALL_TIMEOUT_MS });
    if (installed.error && !installed.timedOut) return every('unrun', PROOF_CODES.unrun, { install, output: `npm could not start: ${installed.error.message}` });
    if (installed.status !== 0) {
      const unrun = installed.timedOut || NETWORK.test(installed.output);
      return every(unrun ? 'unrun' : 'red', unrun ? PROOF_CODES.unrun : PROOF_CODES.install, { install, output: tail(installed.output) });
    }
    return unit.packages.map((pkg) => {
      const dir = placed.get(pkg.name);
      const manifest = readJson(path.join(dir, 'package.json'));
      if (typeof manifest.scripts?.test !== 'string' || !manifest.scripts.test.trim()) return result(pkg, 'red', PROOF_CODES.noTest, { install, output: `${pkg.dir}/package.json declares no test script: a published package proves itself` });
      const tested = npm(['test'], { cwd: dir, env: childEnv, timeout: TEST_TIMEOUT_MS });
      if (tested.error && !tested.timedOut) return result(pkg, 'unrun', PROOF_CODES.unrun, { install, output: `npm could not start: ${tested.error.message}` });
      if (tested.status !== 0) return result(pkg, 'red', PROOF_CODES.test, { install, output: tail(tested.output.split(/\r?\n/).filter((l) => !/^\s+at /.test(l)).join('\n'), 60) });
      return result(pkg, 'green', null, { install });
    });
  } catch (error) {
    return every('unrun', PROOF_CODES.unrun, { output: String(error?.stack ?? error) });
  } finally {
    safeRemove(temp, { hold: artifactHoldReason });
  }
}

/** Prove `packages` ([{name, dir}]); `sources` are the package folders (root-relative) copied beside each one. {exit, results} */
export function provePackages(packages, { root = runtimeRoot, env = process.env, npm = npmRun, log = () => {}, sources = packages.map((p) => p.dir) } = {}) {
  const results = [];
  for (const unit of installUnits(packages, root)) {
    log(`package-clean-test: installing ${unit.packages.map((p) => p.name).join(', ')} (${unit.kind}) from ${posixPath(path.relative(root, unit.dir)) || '.'}`);
    for (const r of proveUnit(unit, { root, env, npm, sources })) { results.push(r); log(line(r)); }
  }
  const exit = results.some((r) => r.status === 'unrun') ? PROOF_EXIT.unrun : results.some((r) => r.status === 'red') ? PROOF_EXIT.red : PROOF_EXIT.green;
  return { exit, results };
}

const line = (r) => `package-clean-test: ${r.name} ${r.status.toUpperCase()}${r.code ? ` ${r.code}` : ''} (${r.install ?? 'not installed'}, ${Math.round(r.ms / 1000)}s)${r.status === 'green' ? '' : `\n${String(r.output ?? '').split(/\r?\n/).map((l) => `    ${l}`).join('\n')}`}`;

function packageCleanTestMain(argv = [], { root = runtimeRoot, out = (s) => process.stdout.write(s) } = {}) {
  let changed = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--changed') { changed = [...(changed ?? [])]; while (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) changed.push(argv[(i += 1)]); }
    else if (argv[i] === '--base' && argv[i + 1]) {
      const range = `${argv[(i += 1)]}..HEAD`;
      const names = diff(['--name-only', '--no-renames', range], { cwd: root, encoding: 'utf8' });
      if (names.status !== 0) { out(`package-clean-test: git diff ${range} failed: ${String(names.stderr || names.error?.message || '').trim()}\n`); return PROOF_EXIT.unrun; }
      changed = [...(changed ?? []), ...String(names.stdout).split(/\r?\n/).filter(Boolean)];
    } else { out(`${USAGE}\n`); return PROOF_EXIT.unrun; }
  }
  const set = publishSet(root);
  const packages = changed ? packagesChanged(changed, set, root) : set;
  if (!packages.length) { out(`package-clean-test: no published package changed (${set.length} in the publish set)\n`); return PROOF_EXIT.green; }
  const { exit, results } = provePackages(packages, { root, log: (s) => out(`${s}\n`), sources: set.map((p) => p.dir) });
  out(`package-clean-test: ${results.filter((r) => r.status === 'green').length} green, ${results.filter((r) => r.status === 'red').length} red, ${results.filter((r) => r.status === 'unrun').length} not run, of ${results.length}\n`);
  return exit;
}

if (isMain(import.meta.url)) process.exitCode = packageCleanTestMain(process.argv.slice(2));
