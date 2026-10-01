// The canon content digest (scripts/lib/canon-digest.mjs, contract change canon-content-digest): one helper hashes a canon by
// the policy modules/models/code-patterns.yaml binds; `npm run check` (check-canon-pins.mjs) holds every profile to the canon
// this runtime publishes, and gate.mjs holds an app to the canon it installed. Nothing is installed: the published set is the
// `npm pack --dry-run` list, copied by hand.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseYaml } from '../engine/yaml.mjs';
import { assertDigestPolicy, canonContentDigest, installedFiles, packedFiles, selectedByPolicy } from '../scripts/lib/canon-digest.mjs';
import { checkCanonBindings, PINS_FILE, PROFILES_FILE, SCHEMA_FILE } from '../scripts/checks/check-canon-pins.mjs';
import { GATE_EXIT, installedCanonFindings, runGate } from '../scripts/checks/gate.mjs';
import { installCanons, publishedCanons } from './_canon-install-fixture.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const profiles = () => parseYaml(fs.readFileSync(path.join(ROOT, PROFILES_FILE), 'utf8')).profiles;
const tmp = (t, prefix) => { const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix))); t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 })); return dir; };
const put = (root, rel, body) => { const abs = path.join(root, rel); fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, body); };
const append = (file, text) => fs.writeFileSync(file, `${fs.readFileSync(file, 'utf8')}${text}`);
const POLICY = () => structuredClone(profiles().nest.canon.contentDigest);
const codeOf = (fn) => { try { fn(); } catch (error) { return error.code; } return null; };

test('the helper reproduces every bound canon digest from the npm pack list of its source (packages/eslint/{be,fe})', () => {
  const bound = Object.fromEntries(Object.values(profiles()).map(({ canon }) => [canon.package, canon]));
  assert.deepEqual(Object.keys(bound).sort(), ['@starci/eslint-canon-be', '@starci/eslint-canon-fe']);
  for (const canon of publishedCanons()) {
    const digest = canonContentDigest(canon.source, bound[canon.package].contentDigest, packedFiles(canon.source));
    assert.deepEqual(digest, { value: bound[canon.package].contentDigest.value, files: bound[canon.package].contentDigest.files }, canon.package);
  }
});

test('an installed copy of the published files digests to the same value: one framing for the check and the gate', (t) => {
  const installed = installCanons(tmp(t, 'starci-canon-copy-'));
  for (const { canon } of Object.values(profiles())) {
    const dir = installed[canon.package];
    assert.deepEqual(canonContentDigest(dir, canon.contentDigest, installedFiles(dir)), { value: canon.contentDigest.value, files: canon.contentDigest.files });
  }
});

test('an unknown algorithm, an unknown framing and a malformed policy are refused with a typed code', () => {
  assert.equal(codeOf(() => assertDigestPolicy({ ...POLICY(), algorithm: 'md5' })), 'CANON_DIGEST_ALGORITHM_UNKNOWN');
  assert.equal(codeOf(() => assertDigestPolicy({ ...POLICY(), framing: 'sorted-path-raw-bytes' })), 'CANON_DIGEST_FRAMING_UNKNOWN');
  assert.equal(codeOf(() => assertDigestPolicy({ ...POLICY(), include: [] })), 'CANON_DIGEST_POLICY_INVALID');
  assert.equal(codeOf(() => assertDigestPolicy(null)), 'CANON_DIGEST_POLICY_INVALID');
  assert.equal(codeOf(() => canonContentDigest(ROOT, { ...POLICY(), algorithm: 'sha1' }, [])), 'CANON_DIGEST_ALGORITHM_UNKNOWN');
  assert.equal(assertDigestPolicy(POLICY()).algorithm, 'sha256', 'the bound policy itself is accepted');
});

test('a symlink in the canon is refused, never followed', (t) => {
  const dir = tmp(t, 'starci-canon-link-');
  put(dir, 'package.json', '{"name":"x","version":"1.0.0"}');
  put(dir, 'outside/a.mjs', 'export default 1;\n');
  fs.symlinkSync(path.join(dir, 'outside'), path.join(dir, 'lib'), 'junction');
  assert.equal(codeOf(() => installedFiles(dir)), 'CANON_PACKAGE_SYMLINK');
  assert.equal(codeOf(() => canonContentDigest(dir, POLICY(), ['package.json', 'lib/a.mjs'])), 'CANON_PACKAGE_SYMLINK', 'a listed file under a linked directory');
  fs.mkdirSync(path.join(dir, 'dir.mjs'));
  assert.equal(codeOf(() => canonContentDigest(dir, POLICY(), ['dir.mjs'])), 'CANON_PACKAGE_UNREADABLE', 'a listed directory is not a file');
  assert.equal(codeOf(() => canonContentDigest(dir, POLICY(), ['gone.mjs'])), 'CANON_PACKAGE_UNREADABLE', 'a listed file that is missing');
});

test('the shipped profiles are bound to the canons this runtime publishes', () => {
  assert.deepEqual(checkCanonBindings({ root: ROOT }), { ok: true, errors: [], profiles: Object.keys(profiles()).length });
});

/** A runtime tree with the pins, the profiles and every canon's published files (plus its package.json), to break one. */
function runtimeCopy(t) {
  const dir = tmp(t, 'starci-canon-runtime-');
  for (const rel of [PINS_FILE, SCHEMA_FILE, PROFILES_FILE]) put(dir, rel, fs.readFileSync(path.join(ROOT, rel)));
  for (const canon of publishedCanons()) {
    const target = path.join(dir, path.relative(ROOT, canon.source));
    for (const file of canon.files) put(target, file, fs.readFileSync(path.join(canon.source, file)));
  }
  return dir;
}

test('an edited canon file without a version bump and a rebinding fails the check', (t) => {
  const dir = runtimeCopy(t);
  assert.deepEqual(checkCanonBindings({ root: dir }).errors, [], 'the untouched copy is bound');
  append(path.join(dir, 'packages', 'eslint', 'be', 'index.mjs'), '// drift\n');
  const result = checkCanonBindings({ root: dir });
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1);
  const bound = profiles().nest.canon.contentDigest;
  assert.ok(result.errors[0].startsWith(`CANON_BINDING_DIGEST nest: @starci/eslint-canon-be publishes ${bound.files} files digesting `));
  assert.ok(!result.errors[0].includes(`digesting ${bound.value}`), 'the drifted digest is reported');
  assert.match(result.errors[0], /needs a version bump of @starci\/eslint-canon-be and its pin, a republish, and a rebinding of profiles\.nest\.canon/);
});

test('an edit to a copy bundled into the canon runtime/ folder is published content: it too demands a bump and a rebinding', (t) => {
  const dir = runtimeCopy(t);
  const policy = profiles().next.canon.contentDigest;
  const bundled = publishedCanons().find((c) => c.package === '@starci/eslint-canon-fe').files.find((file) => file.startsWith('runtime/') && selectedByPolicy(file, policy));
  assert.ok(bundled, 'the fe canon publishes a runtime/ file the policy selects');
  append(path.join(dir, 'packages', 'eslint', 'fe', bundled), '\n');
  const [error, ...rest] = checkCanonBindings({ root: dir }).errors;
  assert.deepEqual(rest, []);
  assert.match(error, /^CANON_BINDING_DIGEST next: .*runtime\/ folder \(canon-pins, failure codes, slots\) included, so this change needs a version bump/);
});

test('a canon.version that differs from the package or its pin fails the check', (t) => {
  const dir = runtimeCopy(t);
  const file = path.join(dir, PROFILES_FILE);
  const version = profiles().next.canon.version;
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(`package: '@starci/eslint-canon-fe'\n      version: ${version}`, "package: '@starci/eslint-canon-fe'\n      version: 99.0.0"));
  const result = checkCanonBindings({ root: dir });
  assert.deepEqual(result.errors.map((line) => line.split(':')[0]), ['CANON_BINDING_VERSION next']);
  assert.ok(result.errors[0].includes(`canon.version 99.0.0, packages/eslint/fe/package.json is ${version}, pinned ${version}`));
});

test('a policy the helper refuses is a typed CANON_BINDING_INVALID, never a pass', (t) => {
  const dir = runtimeCopy(t);
  const file = path.join(dir, PROFILES_FILE);
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('algorithm: sha256', 'algorithm: sha512'));
  assert.match(checkCanonBindings({ root: dir }).errors.join('\n'), /CANON_BINDING_INVALID nest: CANON_DIGEST_ALGORITHM_UNKNOWN/);
});

/* ------------------------------------------------------------------------------------------ the product gate */

/** A fixture app (one root package.json, be/ and fe/ sides) committed on main with a lane branch, no source change. */
function app(t) {
  const root = tmp(t, 'starci-canon-app-');
  const git = (...args) => { const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
  git('init', '-q', '-b', 'main');
  for (const [k, v] of [['user.email', 'spec@starci.test'], ['user.name', 'spec'], ['core.autocrlf', 'false'], ['commit.gpgsign', 'false']]) git('config', k, v);
  put(root, '.gitignore', 'node_modules/\n');
  put(root, 'package.json', JSON.stringify({ name: 'app', private: true, workspaces: ['be', 'fe/apps/*'] }));
  put(root, 'hfs.json', JSON.stringify({ kind: 'app' }));
  put(root, 'be/package.json', JSON.stringify({ name: '@app/be', private: true }));
  put(root, 'fe/apps/web/package.json', JSON.stringify({ name: '@app/web', private: true }));
  git('add', '-A'); git('commit', '-q', '-m', 'scaffold');
  const base = git('rev-parse', 'HEAD');
  git('checkout', '-q', '-b', 'lane');
  return { root, base };
}

test('the gate passes an app whose installed canons are the bound ones', async (t) => {
  const { root, base } = app(t);
  installCanons(root);
  const report = await runGate({ root, base, changed: [] });
  assert.deepEqual(report.errors, []);
  assert.equal(report.exit, GATE_EXIT.clean);
  assert.deepEqual(report.steps.canon.map((c) => [c.package, c.side, c.path]), [
    ['@starci/eslint-canon-be', 'be', 'node_modules/@starci/eslint-canon-be'], ['@starci/eslint-canon-fe', 'fe', 'node_modules/@starci/eslint-canon-fe']]);
});

test('an installed canon that differs from its binding is a blocking finding (exit 1)', async (t) => {
  const { root, base } = app(t);
  const installed = installCanons(root);
  append(path.join(installed['@starci/eslint-canon-fe'], 'index.mjs'), '// patched in place\n');
  const report = await runGate({ root, base, changed: [] });
  assert.equal(report.exit, GATE_EXIT.findings);
  assert.deepEqual(report.findings.map((f) => [f.engine, f.rule, f.path]), [['canon', 'installed-canon-mismatch', 'node_modules/@starci/eslint-canon-fe']]);
  assert.match(report.findings[0].message, /CANON_INSTALL_MISMATCH/);
});

test('an installed canon of another version is a finding even when its files are unchanged', (t) => {
  const { root } = app(t);
  const installed = installCanons(root);
  const manifest = path.join(installed['@starci/eslint-canon-be'], 'package.json');
  const version = profiles().nest.canon.version;
  fs.writeFileSync(manifest, fs.readFileSync(manifest, 'utf8').replace(`"version": "${version}"`, '"version": "0.0.1"'));
  const judged = installedCanonFindings(root);
  assert.deepEqual(judged.errors, []);
  assert.deepEqual(judged.findings.map((f) => f.path), ['node_modules/@starci/eslint-canon-be']);
  assert.ok(judged.findings[0].message.includes('is 0.0.1 with') && judged.findings[0].message.includes(`binds ${version} with`));
});

test('a canon that is not installed is a tool that could not run (exit 2), never a pass', async (t) => {
  const { root, base } = app(t);
  const report = await runGate({ root, base, changed: [] });
  assert.equal(report.exit, GATE_EXIT.toolFailed);
  assert.equal(report.ok, false);
  assert.deepEqual(report.errors.map((e) => e.split(' ').slice(0, 3).join(' ')), ['CANON_INSTALL_MISSING profile nest:', 'CANON_INSTALL_MISSING profile next:']);
});
