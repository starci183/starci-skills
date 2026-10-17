// proves: BE_SOURCE_FORM@lite
// proves: BE_SOURCE_FORM@full
import assert from 'node:assert/strict';
import { dirname } from 'node:path';
import test from 'node:test';
import { checkRepo } from '../../scripts/hfs/check.mjs';
import { projectFixture } from '../../packages/eslint/be/fixtures/project/tester.mjs';

const suffixGood = 'src/features/api/orders/application/cancel-order.command.ts';
const suffixBad = 'src/features/api/orders/application/cancel-order.use-case.ts';
const files = {
  [suffixGood]: 'export class CancelOrderCommand {}',
  [suffixBad]: 'export class CancelOrderUseCase {}',
};

for (const edition of ['lite', 'full']) {
  test(`R89 ${edition} the repository check reports a forbidden source suffix and accepts a role suffix`, (t) => {
    const fixture = projectFixture({ edition, files });
    t.after(fixture.cleanup);
    const violating = checkRepo({ repoRoot: dirname(fixture.root), files: ['be/' + suffixBad], tree: false, phase: 'source' });
    assert.deepEqual(violating.findings.filter((finding) => finding.code === 'BE_SOURCE_FORM').map((finding) => finding.code), ['BE_SOURCE_FORM']);
    const passing = checkRepo({ repoRoot: dirname(fixture.root), files: ['be/' + suffixGood], tree: false, phase: 'source' });
    assert.deepEqual(passing.findings.filter((finding) => finding.code === 'BE_SOURCE_FORM').map((finding) => finding.code), []);
  });
}
