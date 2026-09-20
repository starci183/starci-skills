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
