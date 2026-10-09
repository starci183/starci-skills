// Replay of the wrong-tree class of 2026-10-08/09 (registry: components-resolve-the-tree-each-by-itself): four times a component read or wrote the wrong tree because it
// resolved "which directory" itself - the grammar context read the brand record from the product's main checkout while a finished brand leg had written it in the workflow tree;
// the autopilot's direction and draw gates read the same records from the main checkout; a capture looked for Playwright and esbuild only in product directories.
// Sequence: the world of the draw-render-tool fixture (a workflow tree with a brand record, a main checkout with none), then a main checkout that holds an OLDER brand record of
// another family, then the tools looked up from a tree with no install.
// Real: scripts/lib/roots.mjs, the grammar context resolver, the autopilot gate evidence, the render tool lookup. Stubbed: nothing. Fixture: tests/fixtures/replay/draw-render-tool.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadFixture, replayWorld, write } from '../helpers/replay-world.mjs';
import { resolveGrammarContext } from '../../scripts/kernel/grammar-context.mjs';
import { workRecordPath, WORK_DIR_NAME } from '../../scripts/lib/roots.mjs';
import { renderToolStatus } from '../../scripts/work/render-tools.mjs';

const fixture = loadFixture('draw-render-tool');
const family = (file) => /family: (\S+)/.exec(fs.readFileSync(file, 'utf8'))[1];

test('the grammar context and the record helper read the brand record of the workflow tree, and fall back to the main checkout only when the tree has none', (t) => {
  const world = replayWorld(t, fixture, { tree: true });
  const treeBrand = workRecordPath('brand/index.yaml', { tree: world.tree.dir, repo: world.repo });
  assert.equal(treeBrand, path.join(world.tree.dir, WORK_DIR_NAME, 'brand', 'index.yaml'), 'only the tree holds the record');
  assert.equal(workRecordPath('brand/index.yaml', { tree: null, repo: world.repo }), path.join(world.repo, WORK_DIR_NAME, 'brand', 'index.yaml'), 'no tree: the main checkout path');
  write(world.repo, `${WORK_DIR_NAME}/brand/index.yaml`, fs.readFileSync(treeBrand, 'utf8').replace('family: starci', 'family: older'));
  assert.equal(family(workRecordPath('brand/index.yaml', { tree: world.tree.dir, repo: world.repo })), 'starci', 'both trees hold one: the workflow tree wins');
  const grammar = resolveGrammarContext({ skillRoot: ROOT, repo: world.repo, tree: world.tree.dir, binding: null });
  assert.equal(grammar.family, 'starci', 'the grammar context follows the workflow tree');
  assert.equal(resolveGrammarContext({ skillRoot: ROOT, repo: world.repo, tree: null, binding: null }).family, 'older', 'without a tree the main checkout answers');
});

test('a capture tool is looked up from the tree the work happens in and ends at the runtime install, so a tree with no install is served', (t) => {
  const world = replayWorld(t, fixture, { tree: true });
  assert.equal(fs.existsSync(path.join(world.tree.dir, 'node_modules')), false, 'the tree is a fresh worktree: no install');
  const status = renderToolStatus([world.tree.dir, world.repo]);
  assert.ok(status.esbuild, 'esbuild resolves from the runtime');
  assert.ok(status.playwright, 'Playwright resolves from the runtime');
});
