import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const skillRoot = path.resolve(import.meta.dirname, '..');

const KEY_DIST_PATHS = [
  'workflows/catalog.json',
  'ops/catalog.json',
  'knowledge/catalog.json',
  'manifest.json',
  'knowledge/code-examples/backend/graphql-command/INDEX.json',
  'knowledge/code-examples/frontend/connected-block/INDEX.json',
];

function disposable(t, prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return dir;
}

function run(command, args, options = {}) {
  const isNpm = command === 'npm';
  return spawnSync(command, args, {
    encoding: 'utf8',
    timeout: options.timeout ?? 300000,
    cwd: options.cwd,
    env: options.env ?? process.env,
    // Windows needs a shell to resolve npm.cmd on PATH.
    shell: isNpm && process.platform === 'win32',
    windowsHide: true,
  });
}

function assertSingleLineJson(file) {
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(text.endsWith('\n'), `${file} must end with a final newline`);
  const body = text.slice(0, -1);
  assert.equal(body.includes('\n'), false, `${file} must be a single physical JSON line`);
  JSON.parse(body);
}

test('npm pack → extract → install → build produces key .dist paths without checkout imports', t => {
  assert.equal(fs.existsSync(path.join(skillRoot, 'scripts', 'compile-knowledge.mjs')), true, 'Knowledge compiler is required');
  assert.equal(
    fs.existsSync(path.join(skillRoot, 'knowledge', 'code-examples', 'backend', 'graphql-command')),
    true,
    'Required backend graphql-command example is missing',
  );
  assert.equal(
    fs.existsSync(path.join(skillRoot, 'knowledge', 'code-examples', 'frontend', 'connected-block')),
    true,
    'Required frontend connected-block example is missing',
  );
  assert.equal(fs.existsSync(path.join(skillRoot, 'package.json')), true, 'package.json is required');

  const packDir = disposable(t, 'starci-pack-out-');
  const extractDir = disposable(t, 'starci-pack-extract-');

  const pack = run('npm', ['pack', '--json', '--pack-destination', packDir], {
    cwd: skillRoot,
    timeout: 600000,
  });
  assert.equal(pack.status, 0, `npm pack failed: ${pack.stderr || pack.stdout}`);
  let packed;
  try {
    const parsed = JSON.parse(pack.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1));
    packed = Array.isArray(parsed) ? parsed[0] : parsed;
  } catch {
    const files = fs.readdirSync(packDir).filter(name => name.endsWith('.tgz'));
    assert.ok(files.length >= 1, `npm pack produced no tarball in ${packDir}: ${pack.stdout}`);
    packed = { filename: files[0] };
  }
  const tarball = path.join(packDir, packed.filename || packed.id || '');
  const tarballPath = fs.existsSync(tarball)
    ? tarball
    : path.join(packDir, fs.readdirSync(packDir).find(name => name.endsWith('.tgz')));
  assert.equal(fs.existsSync(tarballPath), true, `packed tarball missing: ${tarballPath}`);

  const extract = run('tar', ['-xzf', tarballPath, '-C', extractDir], { timeout: 120000 });
  if (extract.status !== 0) {
    // Windows fallback via npm pack content layout: use npm install of the tarball into a prefix.
    const installRoot = disposable(t, 'starci-pack-npm-');
    const installed = run('npm', ['install', tarballPath, '--prefix', installRoot, '--ignore-scripts'], {
      timeout: 600000,
    });
    assert.equal(installed.status, 0, `npm install of pack failed: ${installed.stderr || installed.stdout}`);
    const candidates = [
      path.join(installRoot, 'node_modules', 'starci'),
      ...fs.existsSync(path.join(installRoot, 'node_modules'))
        ? fs.readdirSync(path.join(installRoot, 'node_modules'))
          .filter(name => !name.startsWith('.'))
          .map(name => path.join(installRoot, 'node_modules', name))
        : [],
    ];
    const pkg = candidates.find(candidate => fs.existsSync(path.join(candidate, 'package.json')));
    assert.ok(pkg, 'packed package directory not found after npm install');
    return buildAndVerify(t, pkg, skillRoot);
  }

  const packageRoot = path.join(extractDir, 'package');
  assert.equal(fs.existsSync(path.join(packageRoot, 'package.json')), true, 'extracted package.json missing');
  assert.equal(fs.existsSync(path.join(packageRoot, '.dist')), false, 'pack payload must not include .dist');
  assert.equal(
    fs.existsSync(path.join(packageRoot, 'scripts', 'compile-knowledge.mjs')),
    true,
    'pack must include the knowledge compiler so install can build .dist',
  );

  buildAndVerify(t, packageRoot, skillRoot);
});

function buildAndVerify(t, packageRoot, checkoutRoot) {
  // Ensure the disposable package cannot resolve imports back into the checkout.
  assert.notEqual(
    path.resolve(packageRoot),
    path.resolve(checkoutRoot),
    'pack smoke must not build inside the checkout',
  );

  const install = run('npm', ['install', '--ignore-scripts'], {
    cwd: packageRoot,
    timeout: 600000,
  });
  // Dependencies may already be unnecessary when core/yaml.mjs is bundled; allow either outcome
  // as long as the subsequent build succeeds without checkout imports.
  if (install.status !== 0) {
    const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
    if (pkg.devDependencies || pkg.dependencies) {
      assert.equal(install.status, 0, `npm install in packed tree failed: ${install.stderr || install.stdout}`);
    }
  }

  const build = run('npm', ['run', 'build'], {
    cwd: packageRoot,
    timeout: 600000,
    env: {
      ...process.env,
      NODE_PATH: '',
    },
  });
  assert.equal(build.status, 0, `npm run build in packed tree failed: ${build.stderr || build.stdout}`);

  for (const rel of KEY_DIST_PATHS) {
    const file = path.join(packageRoot, '.dist', rel);
    assert.equal(fs.existsSync(file), true, `packed build missing .dist/${rel}`);
    assertSingleLineJson(file);
  }

  // Multi-file example bundles must remain resolvable from the packaged .dist knowledge output.
  for (const rel of [
    'knowledge/code-examples/backend/graphql-command/INDEX.json',
    'knowledge/code-examples/frontend/connected-block/INDEX.json',
  ]) {
    const doc = JSON.parse(fs.readFileSync(path.join(packageRoot, '.dist', rel), 'utf8'));
    assert.equal(doc.schema, 'starci/knowledge@1');
    assert.ok(doc.contents && typeof doc.contents === 'object', `${rel} must expose contents`);
    assert.ok(Object.keys(doc.contents).length >= 2, `${rel} must bundle multiple source files`);
  }

  // Guard against accidental checkout coupling: packaged tree must not contain a pointer file we never ship.
  assert.equal(fs.existsSync(path.join(packageRoot, '.git')), false, 'packed tree must not include .git');
  assert.notEqual(fs.realpathSync(packageRoot), fs.realpathSync(checkoutRoot));
}
