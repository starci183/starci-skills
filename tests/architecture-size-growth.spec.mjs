import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { archFixture, findings, gitCommit, runArch } from './_hfs-arch-fixture.mjs';

// HFS v2 check 6 (HFS_SIZE_GROWTH): ruleParams.be.fileLines.soft is 500 in the shipped manifest.
const BIG = 'src/modules/domain/alpha/alpha.service.ts';
const lines = (count, tag = 'a') => `${Array.from({ length: count }, (_, i) => `export const ${tag}${i} = ${i};`).join('\n')}\n`;

function rewrite(root, relative, content) {
  fs.mkdirSync(path.dirname(path.join(root, ...relative.split('/'))), { recursive: true });
  fs.writeFileSync(path.join(root, ...relative.split('/')), content);
  execFileSync('git', ['add', '-A'], { cwd: root });
}
const growth = (root, base) => {
  const report = runArch(root, { base });
  return { report, hits: findings(report, 'HFS_SIZE_GROWTH'), coverage: report.coverage.hfsMachine.sizeGrowth };
};

test('an over-soft file that grows fails, with the base line count', (t) => {
  const root = archFixture(t, { files: { [BIG]: lines(520) } });
  const base = gitCommit(root);
  rewrite(root, BIG, lines(530));
  const { hits, coverage } = growth(root, base);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].path, BIG);
  assert.equal(hits[0].lines, 530);
  assert.equal(hits[0].baseLines, 520);
  assert.equal(hits[0].soft, 500);
  assert.equal(coverage.status, 'checked');
  assert.equal(coverage.base, base);
  assert.equal(coverage.overSoft, 1);
  assert.equal(coverage.grown, 1);
  assert.equal(coverage.newOverSoft, 0);
});

test('an over-soft file that shrinks or stays unchanged passes', (t) => {
  const root = archFixture(t, { files: { [BIG]: lines(520) } });
  const base = gitCommit(root);
  assert.equal(growth(root, base).hits.length, 0);
  rewrite(root, BIG, lines(510));
  const { hits, coverage } = growth(root, base);
  assert.equal(hits.length, 0);
  assert.equal(coverage.overSoft, 1);
  assert.equal(coverage.grown, 0);
});

test('an under-soft file that grows past soft fails; growing within soft passes', (t) => {
  const root = archFixture(t, { files: { [BIG]: lines(490) } });
  const base = gitCommit(root);
  rewrite(root, BIG, lines(500));
  assert.equal(growth(root, base).hits.length, 0);
  rewrite(root, BIG, lines(501));
  const { hits } = growth(root, base);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].baseLines, 490);
  assert.equal(hits[0].lines, 501);
});

test('a new file over soft fails, a new file within soft passes', (t) => {
  const root = archFixture(t, { files: { [BIG]: lines(10) } });
  const base = gitCommit(root);
  rewrite(root, 'src/modules/domain/beta/beta.service.ts', lines(501, 'b'));
  rewrite(root, 'src/modules/domain/gamma/gamma.service.ts', lines(400, 'c'));
  const { hits, coverage } = growth(root, base);
  assert.deepEqual(hits.map(item => item.path), ['src/modules/domain/beta/beta.service.ts']);
  assert.equal(hits[0].baseLines, null);
  assert.equal(coverage.newOverSoft, 1);
  assert.equal(coverage.grown, 0);
});

test('without a resolvable base the check is unavailable and reports no finding', (t) => {
  const root = archFixture(t, { files: { [BIG]: lines(600) } });
  const report = runArch(root);
  assert.deepEqual(report.coverage.hfsMachine.sizeGrowth, { status: 'unavailable', reason: 'no merge-base' });
  assert.equal(findings(report, 'HFS_SIZE_GROWTH').length, 0);
  assert.equal(report.coverage.checkedRuleIds.includes('HFS_SIZE_GROWTH'), false);
});

test('without an explicit base and without an upstream the first parent of HEAD is the base', (t) => {
  const root = archFixture(t, { files: { [BIG]: lines(520) } });
  const first = gitCommit(root);
  rewrite(root, BIG, lines(540));
  gitCommit(root);
  const { hits, coverage } = growth(root);
  assert.equal(coverage.base, first);
  assert.equal(hits.length, 1);
});
