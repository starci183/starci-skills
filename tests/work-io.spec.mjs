import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseYaml, stringifyYaml } from '../engine/yaml.mjs';
import { layoutTreeMain, loadUiRecords } from '../scripts/work/layout-tree.mjs';
import { RECORD_DEPTH, indexFilesUnder, parseUiRef, workRootOf, writeRecordFile } from '../scripts/work/work-io.mjs';
import { buildProduct, uiSkeleton } from './fixtures/layout-tree.mjs';

// The helpers the scripts/work tools and the work checks share (redundancy audit workui f03/f04/f06/f15/f21).
const temp = (t) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-work-io-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir; };

test('writeRecordFile replaces a record whole through a temp file, and a failed rename leaves the record and no temp', (t) => {
  const dir = temp(t);
  const file = path.join(dir, 'rec', 'index.yaml');
  writeRecordFile(file, 'rev: 1\n');
  writeRecordFile(file, 'rev: 2\n');
  assert.equal(fs.readFileSync(file, 'utf8'), 'rev: 2\n');
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ['index.yaml'], 'no temp file is left beside the record');
  // A destination the rename cannot replace (a directory) throws; nothing half-written stays behind.
  const blocked = path.join(dir, 'blocked', 'index.yaml');
  fs.mkdirSync(path.join(blocked, 'inner'), { recursive: true });
  assert.throws(() => writeRecordFile(blocked, 'rev: 3\n'));
  assert.deepEqual(fs.readdirSync(path.dirname(blocked)), ['index.yaml']);
});

test('indexFilesUnder walks RECORD_DEPTH levels and skips record assets and kernel evidence; loadUiRecords sees a deep record', (t) => {
  const dir = temp(t);
  const deep = path.join(dir, 'features', ...Array.from({ length: 9 }, (_, i) => `d${i}`));
  fs.mkdirSync(deep, { recursive: true });
  fs.writeFileSync(path.join(deep, 'index.yaml'), stringifyYaml(uiSkeleton('ui.deep.screen', { route: '/deep', surface: 'page' })));
  for (const skip of ['assets', 'evidence', 'kernel-evidence', 'node_modules']) {
    fs.mkdirSync(path.join(dir, 'features', skip), { recursive: true });
    fs.writeFileSync(path.join(dir, 'features', skip, 'index.yaml'), 'schema: x\n');
  }
  assert.deepEqual(indexFilesUnder(path.join(dir, 'features')), [path.join(deep, 'index.yaml')]);
  assert.ok(RECORD_DEPTH >= 9);
  assert.deepEqual([...loadUiRecords(dir).keys()], ['ui.deep.screen'], 'a record nine directories under features/ is found (the old walk stopped at eight)');
  const tooDeep = path.join(dir, 'features', ...Array.from({ length: RECORD_DEPTH + 1 }, (_, i) => `x${i}`));
  fs.mkdirSync(tooDeep, { recursive: true });
  fs.writeFileSync(path.join(tooDeep, 'index.yaml'), 'schema: x\n');
  assert.equal(indexFilesUnder(path.join(dir, 'features')).includes(path.join(tooDeep, 'index.yaml')), false);
});

test('workRootOf finds the enclosing .starciwork and answers null outside one; parseUiRef reads ui.<id>:<path> only', (t) => {
  const dir = temp(t);
  const ui = path.join(dir, '.starciwork', 'features', 'a', 'ui', 'b');
  fs.mkdirSync(ui, { recursive: true });
  assert.equal(workRootOf(ui), path.join(dir, '.starciwork'));
  assert.equal(workRootOf(path.parse(dir).root), null);
  assert.deepEqual(parseUiRef('ui.home.app-layout:assets/directions/x.png'), { id: 'ui.home.app-layout', path: 'assets/directions/x.png' });
  assert.equal(parseUiRef('shell/assets/layouts/root--desktop--light.png'), null);
});

test('layout-tree plan without --node prints its usage and writes nothing', (t) => {
  const p = buildProduct(t, { files: {} });
  assert.equal(layoutTreeMain(['plan', '--work', p.work, '--node', '/(app)', '--files', 'layout,page', '--write']).exitCode, 0);
  const file = path.join(p.work, 'shell', 'index.yaml');
  const before = fs.readFileSync(file, 'utf8');
  const bare = layoutTreeMain(['plan', '--work', p.work, '--files', 'layout', '--write']);
  assert.equal(bare.exitCode, 2);
  assert.match(bare.text, /^Usage: layout-tree\.mjs plan .*--node <id>/);
  assert.equal(fs.readFileSync(file, 'utf8'), before, 'no rev+1 with a "Planned ." change');
  assert.equal(parseYaml(before).rev, 1);
});
