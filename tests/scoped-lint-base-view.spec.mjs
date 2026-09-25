import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { baseViewEnv, linksUnder, liveNodeModules, materializeBaseTree, measureBaseTree, rebaseReport, resolveSliceBase } from '../scripts/checks/scoped-lint-baseline.mjs';
import { viewPaths } from '../scripts/checks/scoped-lint-base-view.mjs';

// nivo-fe inc-c8fbf76aa499 / nivo auth inc-ee60a7c362a7: the scoped-lint base tree is plain files only - no
// node_modules, no link of any kind - and its measurement reads the LIVE repository's node_modules through the base
// view (scripts/checks/scoped-lint-base-view.mjs), read-only. This spec builds every fixture from real directories and
// never creates a link; it proves the measuring child resolves require/import/TypeScript/fs reads (nested
// node_modules first) from the live repository, cannot write into it or create a link, and leaves it unchanged.

const ROOT = path.resolve(import.meta.dirname, '..');
const run = (cwd, args) => {
  const r = spawnSync('git', ['-c', 'user.name=spec', '-c', 'user.email=spec@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args], { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const write = (root, file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
const hashTree = (dir) => {
  const hash = crypto.createHash('sha256');
  const visit = (p) => { for (const name of fs.readdirSync(p).sort()) { const child = path.join(p, name), st = fs.lstatSync(child); hash.update(`${path.relative(dir, child)}|${st.isDirectory() ? 'd' : st.isSymbolicLink() ? 'l' : st.size}\n`); if (st.isDirectory()) visit(child); else if (st.isFile()) hash.update(fs.readFileSync(child)); } };
  visit(dir); return hash.digest('hex');
};

function liveRepo(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-base-view-live-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, '.gitignore', 'node_modules/\n');
  write(root, 'package.json', '{"name":"live","private":true,"workspaces":["apps/*","packages/*"]}\n');
  write(root, 'apps/app/src/a.ts', 'import { dep } from "dep";\nexport const a = dep;\n');
  write(root, 'apps/app/src/entry.mjs', 'export { flavour } from "esm-dep";\n');
  write(root, 'packages/ui/package.json', '{"name":"@scope/ui","version":"1.0.0","main":"index.js"}\n');
  write(root, 'packages/ui/index.js', 'module.exports = "ui";\n');
  run(root, ['init', '-q', '-b', 'main']); run(root, ['add', '-A']); run(root, ['commit', '-q', '-m', 'base']);
  // Real dependency directories: a hoisted dep 1.0.0, an app-local dep 2.0.0 (nested wins), an ESM-only package.
  for (const [dir, version] of [['node_modules/dep', '1.0.0'], ['apps/app/node_modules/dep', '2.0.0']]) {
    write(root, `${dir}/package.json`, JSON.stringify({ name: 'dep', version, main: 'index.js', types: 'index.d.ts' }));
    write(root, `${dir}/index.js`, `module.exports = { dep: ${JSON.stringify(version)} };\n`);
    write(root, `${dir}/index.d.ts`, `export declare const dep: ${JSON.stringify(version)};\n`);
  }
  write(root, 'node_modules/esm-dep/package.json', JSON.stringify({ name: 'esm-dep', version: '1.0.0', type: 'module', exports: { '.': './index.js' } }));
  write(root, 'node_modules/esm-dep/index.js', 'export const flavour = "esm";\n');
  return root;
}

// The fixture measurement: what check-scoped-lint's own run leans on, asked from inside the base tree.
const ENTRY = `import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const request = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const app = path.join(request.root, 'apps', 'app');
const out = {};
const attempt = (name, fn) => { try { out[name] = fn(); } catch (error) { out[name] = { error: error.code ?? error.message }; } };
attempt('requireNested', () => createRequire(path.join(app, 'src', 'a.ts'))('dep').dep);
attempt('requireRoot', () => createRequire(path.join(request.root, 'package.json'))('dep').dep);
attempt('resolveViaNodePath', () => createRequire(path.join(request.root, 'package.json')).resolve('dep'));
out.importEsm = await import(pathToFileURL(path.join(app, 'src', 'entry.mjs')).href).then((m) => m.flavour, (error) => ({ error: error.code }));
attempt('viewExists', () => fs.existsSync(path.join(app, 'node_modules', 'dep', 'package.json')));
attempt('viewRead', () => JSON.parse(fs.readFileSync(path.join(app, 'node_modules', 'dep', 'package.json'), 'utf8')).version);
attempt('viewList', () => fs.readdirSync(path.join(request.root, 'node_modules')).sort());
attempt('write', () => { fs.writeFileSync(path.join(request.root, 'node_modules', 'dep', 'planted.txt'), 'x'); return 'written'; });
attempt('mkdir', () => { fs.mkdirSync(path.join(request.root, 'node_modules', 'planted')); return 'made'; });
attempt('remove', () => { fs.rmSync(path.join(request.root, 'node_modules', 'dep', 'index.js')); return 'removed'; });
attempt('symlink', () => { fs.symlinkSync(path.join(request.root, 'no-such-target'), path.join(request.root, 'no-such-dir', 'link'), 'junction'); return 'linked'; });
attempt('grandchild', () => { const r = spawnSync(process.execPath, ['--input-type=module', '-e', 'process.stdout.write(import.meta.resolve("esm-dep"))'], { cwd: app, encoding: 'utf8', env: { SYSTEMROOT: process.env.SYSTEMROOT ?? '' } }); return r.status === 0 ? r.stdout : { error: r.stderr.split(/\\r?\\n/).find(Boolean) }; });
attempt('typescript', () => {
  const ts = createRequire(path.join(process.env.STARCI_SPEC_RUNTIME, 'package.json'))('typescript');
  const hit = ts.resolveModuleName('dep', path.join(app, 'src', 'a.ts'), { moduleResolution: ts.ModuleResolutionKind.Node10 }, ts.sys).resolvedModule;
  return hit ? hit.resolvedFileName : null;
});
out.baseRoot = request.root;
fs.writeFileSync(request.out, JSON.stringify({ slice: { issues: [] }, probe: out }));
`;

test('the measuring child reads the live dependencies through the view: nested first, ESM, TypeScript, node grandchildren', async (t) => {
  const live = liveRepo(t);
  const liveModulesBefore = hashTree(path.join(live, 'node_modules')), appModulesBefore = hashTree(path.join(live, 'apps', 'app', 'node_modules'));
  const statusBefore = run(live, ['status', '--porcelain', '--ignored']);
  const resolved = resolveSliceBase(live, 'HEAD');
  assert.equal(resolved.ok, true);
  const tree = materializeBaseTree(live, resolved, { files: ['apps/app/src/a.ts'], atBase: ['apps/app/src/a.ts'] });
  let disposed = null;
  t.after(() => { if (!disposed) tree.dispose(); });
  assert.equal(fs.existsSync(path.join(tree.root, 'node_modules')), false, 'the base tree holds no node_modules');
  assert.equal(fs.existsSync(path.join(tree.root, 'apps', 'app', 'src', 'a.ts')), true);
  assert.deepEqual(linksUnder(tree.temp), [], 'no link after materializing');
  const entry = path.join(tree.temp, 'fixture-entry.mjs');
  fs.writeFileSync(entry, ENTRY);
  // The fixture entry needs the runtime's own TypeScript: pass the runtime's package.json to resolve it from.
  const env = { ...process.env };
  const report = await measureBaseTree(tree, { files: ['apps/app/src/a.ts'], profile: 'next', entry, env: { ...env, STARCI_SPEC_RUNTIME: ROOT } }).catch((error) => ({ failed: error.message }));
  assert.ok(!report.failed, report.failed);
  const probe = report.probe;
  assert.equal(probe.requireNested, '2.0.0', 'a base file resolves the nested node_modules of its own directory first');
  assert.equal(probe.requireRoot, '1.0.0');
  assert.equal(fs.realpathSync(probe.resolveViaNodePath), fs.realpathSync(path.join(live, 'node_modules', 'dep', 'index.js')), 'require.resolve falls back to NODE_PATH at the live node_modules');
  assert.equal(probe.importEsm, 'esm', 'an ESM import from a base file resolves from the live repository');
  assert.deepEqual([probe.viewExists, probe.viewRead], [true, '2.0.0'], 'fs reads of base node_modules read the live ones');
  assert.deepEqual(probe.viewList, ['dep', 'esm-dep']);
  assert.deepEqual([probe.write, probe.mkdir, probe.remove], [{ error: 'EROFS' }, { error: 'EROFS' }, { error: 'EROFS' }], 'nothing is written into the live repository through the view');
  assert.deepEqual(probe.symlink, { error: 'EPERM' }, 'the measuring process never creates a link');
  assert.match(String(probe.grandchild), /node_modules\/esm-dep\/index\.js$/, `a node grandchild with a sanitized environment still reads through the view: ${JSON.stringify(probe.grandchild)}`);
  assert.equal(probe.baseRoot, path.join(live, path.relative(tree.gitRoot, tree.root)), 'report paths are rebased onto the live repository');
  if (probe.typescript && typeof probe.typescript === 'object') assert.fail(`TypeScript resolution failed: ${JSON.stringify(probe.typescript)}`);
  assert.match(String(probe.typescript).replaceAll('\\', '/'), /apps\/app\/node_modules\/dep\/index\.d\.ts$/, 'TypeScript resolves the nested package through the view');
  assert.deepEqual(linksUnder(tree.temp), [], 'no link in the base tree after the measurement');
  disposed = tree.dispose();
  assert.deepEqual([disposed.ok, disposed.links], [true, []]);
  assert.equal(fs.existsSync(tree.temp), false, 'the base tree is removed');
  assert.equal(hashTree(path.join(live, 'node_modules')), liveModulesBefore, 'the live node_modules is byte-for-byte unchanged');
  assert.equal(hashTree(path.join(live, 'apps', 'app', 'node_modules')), appModulesBefore);
  assert.equal(run(live, ['status', '--porcelain', '--ignored']), statusBefore, 'the live checkout is unchanged');
});

test('a failing measuring child rejects with its reason, and the tree is still removed without a link', async (t) => {
  const live = liveRepo(t);
  const tree = materializeBaseTree(live, resolveSliceBase(live, 'HEAD'), { files: [], atBase: [] });
  const entry = path.join(tree.temp, 'fail.mjs');
  fs.writeFileSync(entry, 'console.error("boom: no report"); process.exit(4);\n');
  await assert.rejects(measureBaseTree(tree, { files: [], profile: 'next', entry }), /exited 4: boom: no report/);
  const disposed = tree.dispose();
  assert.deepEqual([disposed.ok, disposed.links, fs.existsSync(tree.temp)], [true, [], false]);
});

test('the view maps only base-tree node_modules to live, and a live workspace package back to its base copy', () => {
  const base = path.resolve('/tmp/base/repo'), live = path.resolve('/work/live');
  const copies = new Set([path.join(base, 'packages', 'ui')]);
  const view = viewPaths({ base, live, exists: (p) => copies.has(p) });
  assert.equal(view.toLive(path.join(base, 'node_modules', 'dep', 'index.js')), path.join(live, 'node_modules', 'dep', 'index.js'));
  assert.equal(view.toLive(path.join(base, 'apps', 'app', 'node_modules', 'dep')), path.join(live, 'apps', 'app', 'node_modules', 'dep'));
  assert.equal(view.toLive(path.join(base, 'apps', 'app', 'src', 'a.ts')), null, 'a base source file is its own');
  assert.equal(view.toLive(path.join(live, 'node_modules', 'dep')), null, 'a path outside the base tree is never mapped');
  assert.equal(view.toBase(path.join(live, 'packages', 'ui')), path.join(base, 'packages', 'ui'), 'a workspace link resolves to the base copy');
  assert.equal(view.toBase(path.join(live, 'packages', 'gone')), path.join(live, 'packages', 'gone'), 'no copy: the live path stands');
  assert.equal(view.toBase(path.join(live, 'node_modules', 'dep')), path.join(live, 'node_modules', 'dep'), 'a dependency stays live');
  assert.equal(view.liveOf(path.join(base, 'apps', 'x.mjs')), path.join(live, 'apps', 'x.mjs'));
});

test('the child environment preloads the view and points NODE_PATH at the live node_modules, nearest first', (t) => {
  const live = liveRepo(t);
  const tree = { gitRoot: path.resolve('/tmp/base/live'), root: path.resolve('/tmp/base/live/apps/app'), live: { root: path.join(live, 'apps', 'app'), gitRoot: live } };
  assert.deepEqual(liveNodeModules(tree.live.root, live), [path.join(live, 'apps', 'app', 'node_modules'), path.join(live, 'node_modules')]);
  const env = baseViewEnv(tree, { NODE_OPTIONS: '--max-old-space-size=4096', NODE_PATH: '' });
  assert.equal(env.NODE_PATH, [path.join(live, 'apps', 'app', 'node_modules'), path.join(live, 'node_modules')].join(path.delimiter));
  assert.match(env.NODE_OPTIONS, /^--max-old-space-size=4096 --import=file:.*scoped-lint-base-view\.mjs$/);
  assert.deepEqual(JSON.parse(env.STARCI_SCOPED_LINT_BASE_VIEW), { base: tree.gitRoot, live });
  const rebased = rebaseReport({ a: [`${tree.gitRoot}${path.sep}x.ts`, `${tree.gitRoot.replaceAll('\\', '/')}/y.ts`], n: 1 }, tree);
  assert.deepEqual(rebased, { a: [`${live}${path.sep}x.ts`, `${live.replaceAll('\\', '/')}/y.ts`], n: 1 });
});
