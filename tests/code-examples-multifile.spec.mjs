import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseYaml} from '../engine/yaml.mjs';

const skillRoot = path.resolve(import.meta.dirname, '..');
const examplesRoot = path.join(skillRoot, 'knowledge', 'code-examples');

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

// graphql-command and transactional-service contradicted R47 (a spec beside a handler), R87 (a forwarder service behind the
// handler) and R88 (a resolver that does more than dispatch): they are deleted, and the app examples (examples/<app>/be) are the
// backend reference. Every catalogued example is a folder, and every relatedExamples id in the knowledge names one.
const REMOVED = ['graphql-command', 'transactional-service'];
const catalogIds = () => parseYaml(fs.readFileSync(path.join(examplesRoot, 'index.yaml'), 'utf8')).examples.map(e => e.id);

test('the code-example catalog resolves; the examples that contradicted R47, R87 and R88 are gone', () => {
  for (const catalog of ['index.yaml', 'backend/index.yaml', 'frontend/index.yaml']) {
    const doc = parseYaml(fs.readFileSync(path.join(examplesRoot, catalog), 'utf8'));
    const base = path.dirname(path.join(examplesRoot, catalog));
    for (const example of doc.examples) assert.ok(fs.existsSync(path.join(base, example.path, 'index.yaml')), `${catalog} names ${example.path}, which has no manifest`);
    assert.deepEqual(doc.examples.filter(e => REMOVED.includes(e.id)), [], `${catalog} still names a removed example`);
  }
  for (const id of REMOVED) assert.equal(fs.existsSync(path.join(examplesRoot, 'backend', id)), false, `${id} is deleted`);
});

test('every relatedExamples id (an entry that is not a path) in the knowledge names a catalogued example', () => {
  const known = new Set(catalogIds());
  const walk = dir => fs.readdirSync(dir, {withFileTypes: true}).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.yaml') ? [path.join(dir, e.name)] : []);
  const dangling = [];
  for (const file of walk(path.join(skillRoot, 'knowledge'))) {
    let doc;
    try { doc = parseYaml(fs.readFileSync(file, 'utf8')); } catch { continue; }
    const visit = node => {
      if (Array.isArray(node)) { node.forEach(visit); return; }
      if (!node || typeof node !== 'object') return;
      for (const [key, value] of Object.entries(node)) {
        if (key === 'relatedExamples' && Array.isArray(value)) for (const id of value) { if (!String(id).includes('/') && !known.has(id)) dangling.push(`${path.relative(skillRoot, file)}: ${id}`); }
        else visit(value);
      }
    };
    visit(doc);
  }
  assert.deepEqual(dangling, []);
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
