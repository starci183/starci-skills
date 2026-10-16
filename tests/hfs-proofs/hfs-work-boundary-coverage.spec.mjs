// proves: HFS_STARCIWORK_LITE_FORBIDDEN@lite
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateWork } from '../../scripts/work/validate/work-validate.mjs';

function workFixture(t, edition, files = {}) {
  const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-work-coverage-'));
  t.after(() => fs.rmSync(appRoot, { recursive: true, force: true }));
  fs.writeFileSync(path.join(appRoot, 'hfs.json'), JSON.stringify({ kind: 'app', edition }));
  const workRoot = path.join(appRoot, '.starciwork');
  fs.mkdirSync(workRoot);
  for (const [file, content] of Object.entries(files)) {
    const target = path.join(workRoot, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return workRoot;
}

test('lite Work validator rejects a forbidden feature directory', (t) => {
  const workRoot = workFixture(t, 'lite');
  fs.mkdirSync(path.join(workRoot, 'features'));
  assert.deepEqual(validateWork(workRoot).refused.map((line) => line.slice(line.lastIndexOf('[') + 1, -1)), [
    'HFS_STARCIWORK_LITE_FORBIDDEN',
  ]);
});

test('lite Work validator accepts brand assets without full Work records', (t) => {
  const workRoot = workFixture(t, 'lite', { '.gitignore': '', 'brand/assets/reference.txt': 'brand reference' });
  assert.deepEqual(validateWork(workRoot).refused, []);
});

test('full Work validator accepts its catalog and feature records', (t) => {
  const workRoot = workFixture(t, 'full', {
    'index.yaml': 'schema: work/catalog@1\nid: fixture\nfeatures: []\n',
    'features/task/index.yaml': 'schema: work/feature@1\nid: task\ntitle: Task\ndescription: d\n',
  });
  assert.deepEqual(validateWork(workRoot).refused, []);
});
