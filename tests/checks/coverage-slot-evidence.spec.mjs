import test from 'node:test';
import assert from 'node:assert/strict';
import { coverageRuleFindings } from '../../scripts/checks/lib/coverage-rules.mjs';

const EDITIONS = ['lite', 'full'];
const TEMPLATE = 'packages/hfs/templates/fe/auth-callback/route.ts';

function contextFor(edition) {
  return {
    catalog: { rules: [] },
    manifest: { editions: EDITIONS, profiles: ['fe'], slots: [{
      id: 'fe.route.callback', profiles: ['fe'], path: 'apps/<app>/src/app/auth/callback/route.ts',
      presence: 'required', tracked: 'tracked', tier: 'route', tests: 'none',
    }] },
    files: new Map(), examples: [], edition,
  };
}

const slotOf = (context) => context.manifest.slots[0];
const relevant = (context, code) => coverageRuleFindings(context)
  .filter((finding) => finding.code === code && finding.edition === context.edition);

for (const edition of EDITIONS) {
  test(`slot templateNa accepts a passing ${edition} product-owned reason`, () => {
    const context = contextFor(edition);
    assert.equal(relevant(context, 'RT_COVERAGE_NO_TEMPLATE').length, 1);
    slotOf(context).templateNa = 'Callback configuration is supplied by the product.';
    assert.deepEqual(relevant(context, 'RT_COVERAGE_NO_TEMPLATE'), []);
    assert.equal(relevant(context, 'RT_COVERAGE_NO_EXAMPLE').length, 1);
  });

  test(`slot templateNa refuses invalid ${edition} reasons`, () => {
    for (const templateNa of ['', '  ', null, false, 42]) {
      const context = contextFor(edition);
      slotOf(context).templateNa = templateNa;
      assert.equal(relevant(context, 'RT_COVERAGE_NO_TEMPLATE').length, 1);
    }
  });

  test(`an existing ${edition} slot template supplies evidence only in its named edition`, () => {
    const context = contextFor(edition);
    slotOf(context).exemplifiedBy = [{ path: TEMPLATE, edition }];
    context.files.set(TEMPLATE, 'export async function GET() {}');
    assert.deepEqual(relevant(context, 'RT_COVERAGE_NO_TEMPLATE'), []);
    const other = edition === 'lite' ? 'full' : 'lite';
    assert.equal(coverageRuleFindings(context).filter((finding) => finding.code === 'RT_COVERAGE_NO_TEMPLATE'
      && finding.edition === other).length, 1);
    context.files.delete(TEMPLATE);
    assert.equal(relevant(context, 'RT_COVERAGE_NO_TEMPLATE').length, 1);
  });

  test(`dedicated ${edition} fixtures pass only when scoped and matching the slot path`, () => {
    const context = contextFor(edition);
    const fixture = `tests/fixtures/coverage/${edition}/fe/apps/web/src/app/auth/callback/route.ts`;
    slotOf(context).exemplifiedBy = [{ path: fixture, edition }];
    context.files.set(fixture, 'export async function GET() {}');
    assert.deepEqual(relevant(context, 'RT_COVERAGE_NO_EXAMPLE'), []);
    assert.equal(relevant(context, 'RT_COVERAGE_NO_TEMPLATE').length, 1);
    const other = edition === 'lite' ? 'full' : 'lite';
    assert.equal(coverageRuleFindings(context).filter((finding) => finding.code === 'RT_COVERAGE_NO_EXAMPLE'
      && finding.edition === other).length, 1);
    slotOf(context).exemplifiedBy = [fixture];
    assert.equal(relevant(context, 'RT_COVERAGE_NO_EXAMPLE').length, 1, 'unscoped paths cannot claim an edition');
    slotOf(context).exemplifiedBy = [{ path: fixture, edition }];
    context.files.set(fixture, '  ');
    assert.equal(relevant(context, 'RT_COVERAGE_NO_EXAMPLE').length, 1, 'empty fixtures are insufficient');
    context.files.delete(fixture);
    assert.equal(relevant(context, 'RT_COVERAGE_NO_EXAMPLE').length, 1, 'missing fixtures are insufficient');
    const unrelated = `tests/fixtures/coverage/${edition}/fe/apps/web/src/app/health/live/route.ts`;
    context.files.set(unrelated, 'export async function GET() {}');
    slotOf(context).exemplifiedBy = [{ path: unrelated, edition }];
    assert.equal(relevant(context, 'RT_COVERAGE_NO_EXAMPLE').length, 1, 'another route cannot prove the callback slot');
  });
}
