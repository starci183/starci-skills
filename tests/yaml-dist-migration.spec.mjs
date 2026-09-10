import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const skillRoot = path.resolve(import.meta.dirname, '..');
const fixturesRoot = path.join(import.meta.dirname, 'fixtures', 'yaml-dist');
const compilerFile = path.join(skillRoot, 'scripts', 'compile-knowledge.mjs');
const ensureBuildFile = path.join(skillRoot, 'scripts', 'ensure-build.mjs');
const buildFile = path.join(skillRoot, 'scripts', 'build-workflows.mjs');
const declarativeFile = path.join(skillRoot, 'scripts', 'compile-declarative.mjs');

assert.equal(fs.existsSync(compilerFile), true, 'Knowledge compiler is required (scripts/compile-knowledge.mjs)');
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

function disposable(t, prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return dir;
}

function isolateFixture(t, name) {
  const dir = disposable(t, `starci-yd-${name}-`);
  fs.cpSync(path.join(fixturesRoot, name), dir, { recursive: true });
  return dir;
}

async function loadCompileKnowledge() {
  const mod = await import(pathToFileURL(compilerFile).href);
  assert.equal(typeof mod.compileKnowledge, 'function', 'compileKnowledge export is required');
  return mod.compileKnowledge;
}

function assertSingleLineJson(file) {
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(text.endsWith('\n'), `${file} must end with a final newline`);
  assert.equal(text.endsWith('\n\n'), false, `${file} must not end with a blank line`);
  const body = text.slice(0, -1);
  assert.equal(body.includes('\n'), false, `${file} must be a single physical JSON line`);
  JSON.parse(body);
}

function walkJsonFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const visit = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && entry.name.endsWith('.json')) out.push(file);
    }
  };
  visit(dir);
  return out.sort((a, b) => a.localeCompare(b));
}

function copySkillForBuild(t) {
  const dir = disposable(t, 'starci-yd-build-');
  for (const name of [
    'config.example.json',
    'ops',
    'workflows',
    'profiles',
    'knowledge',
    'contracts',
    'specifications',
    'examples',
    'scripts',
    'core',
    'schemas',
    'package.json',
    'bin',
    'cli',
  ]) {
    const source = path.join(skillRoot, name);
    if (!fs.existsSync(source)) continue;
    fs.cpSync(source, path.join(dir, name), { recursive: true });
  }
  // Seed .dist so runtime-root consumers imported during build can resolve contracts.
  const dist = path.join(skillRoot, '.dist');
  assert.equal(fs.existsSync(dist), true, 'Checkout .dist must exist to seed disposable builds (run ensure-build first)');
  fs.cpSync(dist, path.join(dir, '.dist'), { recursive: true });
  return dir;
}

test('invalid YAML / duplicate keys / unknown fields / unresolved refs / traversal fail closed', async t => {
  const compileKnowledge = await loadCompileKnowledge();
  const cases = [
    { name: 'invalid-yaml', pattern: /Invalid or unsupported YAML|invalid|parse|syntax/i },
    { name: 'duplicate-keys', pattern: /Invalid or unsupported YAML|duplicate|unique|key/i },
    { name: 'unknown-fields', pattern: /Unknown field rulse/i },
    { name: 'unresolved-refs', pattern: /Missing rule ref MISSING-RULE/i },
    { name: 'path-traversal', pattern: /Unsafe|escape|\.\./i },
  ];
  for (const { name, pattern } of cases) {
    const dir = isolateFixture(t, name);
    assert.throws(
      () => compileKnowledge({ root: dir, write: false, check: false }),
      pattern,
      `${name} must fail closed`,
    );
  }

  if (fs.existsSync(declarativeFile)) {
    const mod = await import(`${pathToFileURL(declarativeFile).href}?t=${Date.now()}`);
    const compile = mod.compileDeclarative || mod.compile;
    assert.equal(typeof compile, 'function', 'compile-declarative must export compileDeclarative or compile');
  }
});

test('missing knowledge compiler fails ensure-build without deferred success', t => {
  assert.equal(fs.existsSync(ensureBuildFile), true, 'scripts/ensure-build.mjs is required');
  const dir = copySkillForBuild(t);
  fs.rmSync(path.join(dir, 'scripts', 'compile-knowledge.mjs'));
  const result = spawnSync(process.execPath, ['scripts/ensure-build.mjs'], {
    cwd: dir,
    encoding: 'utf8',
    timeout: 120000,
  });
  assert.notEqual(result.status, 0, 'ensure-build must fail when the knowledge compiler is missing');
  assert.equal(result.stdout.includes('"ok":true'), false, 'ensure-build must not report deferred success');
  assert.match(
    `${result.stderr}\n${result.stdout}`,
    /Knowledge compiler is required|compile-knowledge|required/i,
    'ensure-build must report a missing-compiler failure',
  );
});

test('two builds are byte-identical and .dist JSON is single-line with final newline', t => {
  assert.equal(fs.existsSync(buildFile), true, 'scripts/build-workflows.mjs is required');
  const dir = copySkillForBuild(t);
  const runBuild = () =>
    spawnSync(process.execPath, ['scripts/build-workflows.mjs'], {
      cwd: dir,
      encoding: 'utf8',
      timeout: 180000,
    });
  const first = runBuild();
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const dist = path.join(dir, '.dist');
  assert.equal(fs.existsSync(dist), true, 'build must create .dist');
  const snapshot = new Map();
  for (const file of walkJsonFiles(dist)) {
    assertSingleLineJson(file);
    snapshot.set(path.relative(dist, file).replaceAll('\\', '/'), fs.readFileSync(file));
  }
  assert.ok(snapshot.size > 0, 'build must emit .dist JSON files');

  const second = runBuild();
  assert.equal(second.status, 0, second.stderr || second.stdout);
  const again = walkJsonFiles(dist);
  assert.equal(again.length, snapshot.size, 'second build must emit the same file set');
  for (const file of again) {
    const rel = path.relative(dist, file).replaceAll('\\', '/');
    assert.ok(snapshot.has(rel), `unexpected file after second build: ${rel}`);
    assert.ok(fs.readFileSync(file).equals(snapshot.get(rel)), `byte mismatch after second build: ${rel}`);
    assertSingleLineJson(file);
  }
});

test('build:check is read-only for stale files and build creates missing .dist', t => {
  assert.equal(fs.existsSync(buildFile), true, 'scripts/build-workflows.mjs is required');
  const dir = copySkillForBuild(t);
  const built = spawnSync(process.execPath, ['scripts/build-workflows.mjs'], {
    cwd: dir,
    encoding: 'utf8',
    timeout: 180000,
  });
  assert.equal(built.status, 0, built.stderr || built.stdout);

  const target = path.join(dir, '.dist', 'workflows', 'catalog.json');
  assert.equal(fs.existsSync(target), true, 'expected .dist/workflows/catalog.json');
  const original = fs.readFileSync(target);
  const tampered = Buffer.concat([original.subarray(0, Math.max(0, original.length - 1)), Buffer.from('x\n')]);
  fs.writeFileSync(target, tampered);

  const checked = spawnSync(process.execPath, ['scripts/build-workflows.mjs', '--check'], {
    cwd: dir,
    encoding: 'utf8',
    timeout: 180000,
  });
  assert.notEqual(checked.status, 0, 'build:check must detect stale .dist output');
  assert.ok(fs.readFileSync(target).equals(tampered), 'build:check must not rewrite stale files');

  fs.rmSync(path.join(dir, '.dist'), { recursive: true, force: true });
  assert.equal(fs.existsSync(path.join(dir, '.dist')), false);
  const rebuilt = spawnSync(process.execPath, ['scripts/build-workflows.mjs'], {
    cwd: dir,
    encoding: 'utf8',
    timeout: 180000,
  });
  assert.equal(rebuilt.status, 0, rebuilt.stderr || rebuilt.stdout);
  assert.equal(fs.existsSync(path.join(dir, '.dist', 'workflows', 'catalog.json')), true, 'build must create missing .dist');
  assert.equal(fs.existsSync(path.join(dir, '.dist', 'knowledge', 'catalog.json')), true, 'build must emit knowledge catalog into .dist');
});

test('git ls-files .dist is empty', () => {
  const result = spawnSync('git', ['ls-files', '.dist'], {
    cwd: skillRoot,
    encoding: 'utf8',
    timeout: 30000,
  });
  assert.equal(result.status, 0, result.stderr || 'git ls-files .dist failed');
  assert.equal(result.stdout.trim(), '', `git must not track .dist files, found:\n${result.stdout}`);
});

test('multi-file examples remain resolvable from compiled .dist knowledge bundles', async t => {
  const compileKnowledge = await loadCompileKnowledge();
  const { parseYaml, stringifyYaml } = await import('../core/yaml.mjs');
  const targets = [
    {
      id: 'graphql-command',
      lane: 'backend',
      dir: path.join(skillRoot, 'knowledge', 'code-examples', 'backend', 'graphql-command'),
      required: ['example.resolver.ts', 'example.handler.ts'],
      appliesTo: 'backend',
      family: 'be',
    },
    {
      id: 'connected-block',
      lane: 'frontend',
      dir: path.join(skillRoot, 'knowledge', 'code-examples', 'frontend', 'connected-block'),
      required: ['index.tsx', 'component.tsx'],
      appliesTo: 'frontend',
      family: 'fe',
    },
  ];

  const dir = disposable(t, 'starci-yd-examples-');
  const rulesByFamily = new Map();
  for (const target of targets) {
    assert.equal(fs.existsSync(target.dir), true, `Required example missing: ${target.id}`);
    const manifest = parseYaml(fs.readFileSync(path.join(target.dir, 'index.yaml'), 'utf8'));
    assert.equal(manifest.schema, 'starci/code-example@1');
    if (!rulesByFamily.has(target.family)) rulesByFamily.set(target.family, new Set());
    for (const ruleId of manifest.relatedRules ?? []) rulesByFamily.get(target.family).add(ruleId);
  }

  for (const [family, ruleIds] of rulesByFamily) {
    const appliesTo = family === 'fe' ? 'frontend' : 'backend';
    const rulesYaml = [...ruleIds].sort().map(ruleId => `  - id: ${ruleId}
    title: Synthetic ${ruleId}
    kind: mandatory
    requirement: |
      Synthetic rule for multi-file example compile coverage.`).join('\n');
    fs.mkdirSync(path.join(dir, 'knowledge', 'patterns', family), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'knowledge', 'patterns', family, 'support.yaml'),
      `schema: starci/knowledge-source@1
id: ${family}.support
title: Support
purpose: |
  Synthetic rules satisfying example relatedRules refs.
appliesTo: [${appliesTo}]
family: ${family}
rules:
${rulesYaml}
`,
    );
  }

  for (const target of targets) {
    const dest = path.join(dir, 'knowledge', 'code-examples', target.lane, target.id);
    fs.cpSync(target.dir, dest, { recursive: true });
    const manifestPath = path.join(dest, 'index.yaml');
    const doc = parseYaml(fs.readFileSync(manifestPath, 'utf8'));
    const allowed = [
      'schema', 'id', 'title', 'purpose', 'appliesTo', 'relatedRules', 'files',
      'entrypoint', 'adapt', 'dependencies', 'verification', 'provenance',
    ];
    const cleaned = Object.fromEntries(allowed.filter(key => Object.hasOwn(doc, key)).map(key => [key, doc[key]]));
    fs.writeFileSync(manifestPath, stringifyYaml(cleaned));
  }

  const result = compileKnowledge({ root: dir, write: true, check: false });
  assert.equal(result.ok, true, 'multi-file example compile must succeed');
  for (const target of targets) {
    const rel = `knowledge/code-examples/${target.lane}/${target.id}/INDEX.json`;
    const file = path.join(dir, '.dist', rel);
    assert.equal(fs.existsSync(file), true, `missing packaged bundle ${rel}`);
    assertSingleLineJson(file);
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(doc.schema, 'starci/knowledge@1');
    assert.ok(doc.contents && typeof doc.contents === 'object', `${target.id} must expose contents`);
    for (const required of target.required) {
      assert.ok(Object.hasOwn(doc.contents, required), `${target.id} must include ${required}`);
      assert.ok(String(doc.contents[required]).length > 0, `${target.id} contents for ${required} must be non-empty`);
    }
    assert.ok(Object.keys(doc.contents).length >= 2, `${target.id} bundle must include multiple files`);
  }
});
