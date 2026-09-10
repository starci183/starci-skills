import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseYaml, stringifyYaml} from '../core/yaml.mjs';

const skillRoot = path.resolve(import.meta.dirname, '..');
const examplesRoot = path.join(skillRoot, 'knowledge', 'code-examples');
const compilerFile = path.join(skillRoot, 'scripts', 'compile-knowledge.mjs');

function readManifest(exampleDir) {
  const file = path.join(exampleDir, 'index.yaml');
  assert.equal(fs.existsSync(file), true, `expected manifest at ${file}`);
  return parseYaml(fs.readFileSync(file, 'utf8'));
}

function listedPaths(manifest) {
  assert.ok(Array.isArray(manifest.files), 'code-example manifest must declare files[]');
  return manifest.files.map(entry => {
    assert.equal(typeof entry?.path, 'string');
    assert.equal(entry.path.includes('\\'), false, `manifest path must use forward slashes: ${entry.path}`);
    assert.equal(path.isAbsolute(entry.path), false, `manifest path must be relative: ${entry.path}`);
    assert.equal(entry.path.split('/').includes('..'), false, `manifest path must not escape: ${entry.path}`);
    return entry.path.replaceAll('\\', '/');
  });
}

function existingListedFiles(exampleDir, relativePaths) {
  return relativePaths.filter(rel => fs.existsSync(path.join(exampleDir, rel)));
}

function assertMultiFileExample(exampleDir, exampleId) {
  assert.equal(fs.existsSync(exampleDir), true);
  const manifest = readManifest(exampleDir);
  assert.equal(manifest.schema, 'starci/code-example@1');
  assert.equal(manifest.id, exampleId);
  const paths = listedPaths(manifest);
  assert.ok(paths.length >= 2, `${exampleId} manifest must list multiple files`);
  const present = existingListedFiles(exampleDir, paths);
  return {manifest, paths, present};
}

function tempSkill(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-examples-'));
  t.after(() => {
    assert.equal(path.dirname(dir), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith('starci-examples-'));
    fs.rmSync(dir, {recursive: true, force: true});
  });
  fs.mkdirSync(path.join(dir, 'knowledge'), {recursive: true});
  return dir;
}

function write(dir, relative, body) {
  const file = path.join(dir, relative);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, body);
}

async function loadCompile() {
  assert.equal(fs.existsSync(compilerFile), true, 'scripts/compile-knowledge.mjs is required');
  const mod = await import(pathToFileURL(compilerFile).href);
  assert.equal(typeof mod.compileKnowledge, 'function');
  return mod.compileKnowledge;
}

test('graphql-command is a multi-file backend example when present', t => {
  const exampleDir = path.join(examplesRoot, 'backend', 'graphql-command');
  if (!fs.existsSync(exampleDir)) {
    assert.fail('Required backend graphql-command example is missing');
    return;
  }
  const {paths, present} = assertMultiFileExample(exampleDir, 'graphql-command');
  assert.ok(
    paths.includes('example.resolver.ts') && paths.includes('example.handler.ts'),
    'graphql-command must declare resolver and handler paths',
  );
  assert.ok(present.length >= 2, 'graphql-command folder must contain multiple listed source files');
});

test('connected-block is a multi-file frontend example when present', t => {
  const exampleDir = path.join(examplesRoot, 'frontend', 'connected-block');
  if (!fs.existsSync(exampleDir)) {
    assert.fail('Required frontend connected-block example is missing');
    return;
  }
  const {paths, present} = assertMultiFileExample(exampleDir, 'connected-block');
  assert.ok(
    paths.includes('index.tsx') && paths.includes('component.tsx'),
    'connected-block must declare connected owner and pure renderer paths',
  );
  const nonManifestEntries = fs.readdirSync(exampleDir).filter(name => name !== 'index.yaml');
  if (nonManifestEntries.length > 0) {
    assert.ok(present.length >= 2, 'connected-block folder must contain multiple listed source files once sources exist');
  }
});

test('compiled example bundles include multi-file paths for graphql-command / connected-block when available', async t => {
  const targets = [
    {
      id: 'graphql-command',
      lane: 'backend',
      dir: path.join(examplesRoot, 'backend', 'graphql-command'),
      required: ['example.resolver.ts', 'example.handler.ts'],
      ruleId: 'BE-FUNCTION-1',
      appliesTo: 'backend',
    },
    {
      id: 'connected-block',
      lane: 'frontend',
      dir: path.join(examplesRoot, 'frontend', 'connected-block'),
      required: ['index.tsx', 'component.tsx'],
      ruleId: 'FE-FUNCTION-1',
      appliesTo: 'frontend',
    },
  ];

  if (!targets.length) {
    assert.fail('Required example folders are missing');
    return;
  }
  if (!fs.existsSync(compilerFile)) {
    assert.fail('Knowledge compiler is required');
    return;
  }

  const ready = [];
  for (const target of targets) {
    const {manifest, paths, present} = assertMultiFileExample(target.dir, target.id);
    const missingRequired = target.required.filter(rel => !present.includes(rel));
    assert.deepEqual(missingRequired, [], 'Required example sources are missing');
    assert.ok(present.length >= 2, 'Example requires multiple source files');
    // Only compile when every manifest-listed file exists; otherwise the compiler correctly rejects.
    assert.equal(present.length, paths.length, 'Every declared example source must exist');
    ready.push({...target, manifest, paths, present});
  }

  if (!ready.length) {
    assert.fail('Required example bundles are incomplete');
    return;
  }

  const compileKnowledge = await loadCompile();
  const dir = tempSkill(t);

  const rulesByLane = new Map();
  for (const target of ready) {
    if (!rulesByLane.has(target.appliesTo)) rulesByLane.set(target.appliesTo, new Set());
    for (const ruleId of target.manifest.relatedRules ?? []) rulesByLane.get(target.appliesTo).add(ruleId);
    rulesByLane.get(target.appliesTo).add(target.ruleId);
  }

  for (const [appliesTo, ruleIds] of rulesByLane) {
    const family = appliesTo === 'frontend' ? 'fe' : 'be';
    const rulesYaml = [...ruleIds].sort().map(ruleId => `  - id: ${ruleId}
    title: Synthetic ${ruleId}
    kind: mandatory
    requirement: |
      Synthetic rule for multi-file example compile coverage.`).join('\n');
    write(dir, `knowledge/patterns/${family}/support.yaml`, `schema: starci/knowledge-source@1
id: ${family}.support
title: Support
purpose: |
  Synthetic rules satisfying example relatedRules refs.
appliesTo: [${appliesTo}]
family: ${family}
rules:
${rulesYaml}
`);
  }

  for (const target of ready) {
    const dest = path.join(dir, 'knowledge', 'code-examples', target.lane, target.id);
    fs.cpSync(target.dir, dest, {recursive: true});
    // Isolate compile coverage to the code-example@1 contract (drop transitional extras).
    const manifestPath = path.join(dest, 'index.yaml');
    const doc = parseYaml(fs.readFileSync(manifestPath, 'utf8'));
    const allowed = [
      'schema', 'id', 'title', 'purpose', 'appliesTo', 'relatedRules', 'files',
      'entrypoint', 'adapt', 'dependencies', 'verification', 'provenance',
    ];
    const cleaned = Object.fromEntries(allowed.filter(key => Object.hasOwn(doc, key)).map(key => [key, doc[key]]));
    fs.writeFileSync(manifestPath, stringifyYaml(cleaned));
  }

  const result = compileKnowledge({root: dir, write: false, check: false});
  for (const target of ready) {
    const outRel = `knowledge/code-examples/${target.lane}/${target.id}/INDEX.json`;
    assert.ok(result.files.has(outRel), `missing compiled bundle ${outRel}`);
    const doc = JSON.parse(result.files.get(outRel).toString('utf8'));
    assert.equal(doc.schema, 'starci/knowledge@1');
    assert.equal(doc.id, target.id);
    assert.ok(doc.contents && typeof doc.contents === 'object', `${target.id} bundle must include contents`);
    for (const rel of target.required) {
      assert.ok(Object.hasOwn(doc.contents, rel), `${target.id} bundle must include multi-file path ${rel}`);
      assert.ok(String(doc.contents[rel]).length > 0, `${target.id} contents for ${rel} must be non-empty`);
    }
    assert.ok(Object.keys(doc.contents).length >= 2, `${target.id} bundle must include multiple file paths`);
  }
});
