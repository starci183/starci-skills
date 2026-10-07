// Consumer installation integrity and local capabilities; no service or database lifecycle runs.
import fs from 'node:fs';
import path from 'node:path';
import {sha256} from '../../engine/digest.mjs';
import {installedPayloadDigest} from '../lib/install-custody.mjs';
import {isLinkLike} from '../api/fs/is-link-like.mjs'; import {byCodeUnit} from '../lib/list.mjs';
import {runNode} from '../api/node/run-node.mjs';

const SOURCE_ENTRIES = ['scripts/cli/main.mjs', 'scripts/kernel/cli.mjs'];
const CAPABILITY_PROBE = `
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const root = process.argv[1];
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const require = createRequire(pathToFileURL(path.join(root, 'package.json')));
const {isLinkLike} = await import(pathToFileURL(path.join(root, 'scripts/api/fs/is-link-like.mjs')));
const dependencies = [];
for (const [name, version] of Object.entries(manifest.dependencies ?? {})) {
  const own = path.join(root, 'node_modules', ...name.split('/'));
  let cursor = root;
  for (const part of ['node_modules', ...name.split('/')]) {
    cursor = path.join(cursor, part);
    if (isLinkLike(cursor)) throw new Error('dependency path redirects outside the install: ' + name);
  }
  const stat = fs.lstatSync(own);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('dependency is not a physical installed package: ' + name);
  const dependency = JSON.parse(fs.readFileSync(path.join(own, 'package.json'), 'utf8'));
  if (dependency.name !== name || dependency.version !== version) throw new Error('installed dependency identity differs: ' + name);
  const entry = fs.realpathSync(require.resolve(name));
  const relative = path.relative(fs.realpathSync(own), entry);
  if (path.isAbsolute(relative) || relative === '..' || relative.startsWith('..' + path.sep)) throw new Error('dependency resolved outside its installed package: ' + name);
  await import(pathToFileURL(entry));
  dependencies.push({name, version});
}
const cli = await import(pathToFileURL(path.join(root, 'scripts/cli/main.mjs')));
if (typeof cli.main !== 'function') throw new Error('installed dispatcher has no main export');
const startup = await import(pathToFileURL(path.join(root, 'scripts/reconciler/start.mjs')));
if (typeof startup.sqliteItem !== 'function') throw new Error('installed startup has no SQLite capability check');
const sqlite = startup.sqliteItem();
console.log(JSON.stringify({ok: sqlite.status === 'green', dependencies, sqlite}));
`;

function ownedFile(root, relative) {
  if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.includes('\\') || relative.includes(':')
    || relative.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('invalid installation custody path');
  let file = root;
  for (const part of relative.split('/')) {
    file = path.join(file, part);
    const stat = fs.lstatSync(file, {throwIfNoEntry: false});
    if (!stat || isLinkLike(file, {stat})) throw new Error(`missing or redirected installation file: ${relative}`);
  }
  if (!fs.lstatSync(file).isFile()) throw new Error(`installation custody is not a regular file: ${relative}`);
  return file;
}

function childReport(args, target, node) {
  const environment = {...process.env};
  delete environment.NODE_TEST_CONTEXT;
  delete environment.NODE_OPTIONS;
  delete environment.NODE_PATH;
  const result = node(args, {cwd: target, env: environment, timeout: 30_000});
  if (result.error || result.signal || result.status !== 0) {
    throw new Error(`installed check failed (${result.status ?? result.signal ?? result.error?.code ?? 'unknown'}): ${(result.stderr ?? '').trim()}`);
  }
  try { return JSON.parse(result.stdout); }
  catch { throw new Error('installed check did not return a complete JSON result'); }
}

/**
 * Check installer-owned bytes and discovery custody, then the installed runtime's local capabilities.
 * Quick mode performs integrity checks only; neither mode opens a store, starts a service or verifies a provider.
 * @param {object} input Installer-owned package, manifest, digest inventory and read-only entry planner.
 * @param {Function} log Diagnostic sink; credential contents are never included.
 * @param {object} deps Native Node runner seam for focused fixture checks.
 * @returns {number} Failed local checks; zero describes only the selected diagnostic scope.
 */
export function doctorInstallation(input, log = console.log, deps = {}) {
  const {target, repo, manifest, packageManifest, expectedFiles, checkProtocol, planEntries, excluded, quick = false} = input;
  let failed = 0;
  const check = (name, fn) => {
    try { const detail = fn(); log(`ok   ${name}${detail ? ': ' + detail : ''}`); return true; }
    catch (error) { failed++; log(`FAIL ${name}: ${error.message}`); return false; }
  };
  const integrity = check('installed payload and entry custody', () => integrityDetail({ target, repo, manifest, packageManifest, expectedFiles, checkProtocol, planEntries, excluded }));
  if (integrity && !quick) {
    const node = deps.runNode ?? runNode;
    check('installed YAML contracts', () => {
      const file = ownedFile(target, 'scripts/checks/check-module-yaml.mjs');
      const report = childReport([file, '--json'], target, node);
      if (report.ok !== true || !Number.isInteger(report.files) || report.files <= 0 || !Array.isArray(report.bad) || report.bad.length) throw new Error('installed YAML contract result is empty or red');
      return `${report.files} parsed contracts`;
    });
    check('installed dependencies, dispatcher and SQLite capability', () => {
      const report = childReport(['--input-type=module', '--eval', CAPABILITY_PROBE, target], target, node);
      if (report.ok !== true || report.sqlite?.status !== 'green' || report.sqlite.id !== 'node-sqlite'
        || typeof report.sqlite.detail !== 'string' || !report.sqlite.detail || !Array.isArray(report.dependencies)) throw new Error('installed runtime capability is unavailable or red');
      const expected = Object.entries(packageManifest.dependencies ?? {}).sort(byCodeUnit);
      const actual = report.dependencies.map(row => [row.name, row.version]).sort(byCodeUnit);
      if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('installed dependency result is incomplete');
      return report.sqlite.detail;
    });
  }
  let message;
  if (failed) message = `doctor: ${failed} local check(s) failed`;
  else if (quick) message = 'doctor: install integrity passed; local runtime capabilities were not checked (--quick)';
  else message = 'doctor: installed source and local runtime capabilities passed; host, provider and product readiness require their owning checks';
  log(message);
  return failed;
}

function integrityDetail({ target, repo, manifest, packageManifest, expectedFiles, checkProtocol, planEntries, excluded }) {
  if (isLinkLike(target) || !fs.lstatSync(target, {throwIfNoEntry: false})?.isDirectory()) throw new Error('installed runtime must be a physical directory');
  if (!manifest || manifest.name !== packageManifest.name || manifest.version !== packageManifest.version) throw new Error('install manifest is missing or does not match the invoking package identity');
  checkProtocol(manifest);
  if (!manifest.files || Array.isArray(manifest.files) || typeof manifest.files !== 'object' || !Object.keys(manifest.files).length) throw new Error('install manifest has no payload custody');
  const installed = JSON.parse(fs.readFileSync(ownedFile(target, 'package.json'), 'utf8'));
  if (installed.name !== manifest.name || installed.version !== manifest.version) throw new Error('installed package identity differs from its manifest');
  for (const relative of SOURCE_ENTRIES) ownedFile(target, relative);
  for (const [relative, digest] of Object.entries(manifest.files)) {
    if (excluded(relative) || excluded(relative.toLowerCase())) throw new Error(`manifest claims excluded local custody: ${relative}`);
    if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error(`invalid payload digest: ${relative}`);
    const actual = installedPayloadDigest(fs.readFileSync(ownedFile(target, relative)), relative);
    if (actual !== digest) throw new Error(`payload changed since install: ${relative}`);
  }
  if (!Object.keys(expectedFiles).length) throw new Error('invoking package has no payload inventory');
  for (const [relative, digest] of Object.entries(expectedFiles)) {
    if (manifest.files[relative] !== digest) throw new Error(`payload is absent or differs from the invoking package: ${relative}`);
  }
  const entries = planEntries(repo, manifest);
  const custody = manifest.hostSkills;
  if (!Object.keys(entries.files).length || entries.write.length || custody?.hashMode !== 'sha256-bytes'
    || !custody?.files || Array.isArray(custody.files) || typeof custody.files !== 'object') throw new Error('public entry discovery is missing, changed or has no exact-byte custody');
  for (const [relative, digest] of Object.entries(custody.files)) {
    if (!/^[a-f0-9]{64}$/.test(digest) || sha256(fs.readFileSync(ownedFile(repo, relative))) !== digest) throw new Error(`recorded public entry custody differs: ${relative}`);
  }
  for (const [relative, digest] of Object.entries(entries.files)) {
    if (custody.files?.[relative] !== digest || sha256(fs.readFileSync(ownedFile(repo, relative))) !== digest) throw new Error(`public entry custody differs: ${relative}`);
  }
  return `${manifest.name}@${manifest.version}; ${Object.keys(manifest.files).length} payload files`;
}
