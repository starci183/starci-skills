// proves: RT_HOOK_SHAPE@lite
// proves: RT_HOOK_SHAPE@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { hookShapeFindings, TEMPLATE_DIR } from '../../scripts/hfs/runtime-rules/hook-shape.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const commit = `${TEMPLATE_DIR}/pre-commit`;
const push = `${TEMPLATE_DIR}/pre-push`;
const templates = Object.fromEntries([commit, push].map((file) => [file, fs.readFileSync(path.join(root, file), 'utf8')]));
const findingsFor = (edition, files) => hookShapeFindings({
  repo: { kind: 'app', edition }, fileSet: new Set(Object.keys(files)), read: (file) => files[file],
});

for (const edition of ['lite', 'full']) {
  test(`${edition}: commit typechecks and push lint runs violate the hook gate model`, () => {
    const findings = findingsFor(edition, {
      [commit]: `${templates[commit]}\nnpm run typecheck\n`,
      [push]: `${templates[push]}\nnpm run lint\n`,
    });
    assert.deepEqual(findings.map((f) => [f.code, f.path]), [['RT_HOOK_SHAPE', commit], ['RT_HOOK_SHAPE', push]]);
    assert.match(findings[0].message, /commit gate.*typecheck/);
    assert.match(findings[1].message, /push gate.*lint run/);
  });

  test(`${edition}: the shipped commit and release-only push hooks pass`, () => {
    assert.deepEqual(findingsFor(edition, templates), []);
  });
}
