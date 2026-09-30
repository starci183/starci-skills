import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from './_hfs-arch-be-fixture.mjs';

// R38 error codes (BE_ERROR_HOME, machine half): the values of every <C>ErrorCode enum are string literals prefixed with the
// capability in UPPER_SNAKE, without an _ERROR/_EXCEPTION suffix, and unique repo-wide.

const errorFile = (capability, body, tier = 'domain') => ({
  [`src/modules/${tier}/${capability}/index.ts`]: `export const ${capability.replace(/-/g, '_')} = 1;\n`,
  [`src/modules/${tier}/${capability}/errors/${capability}.error.ts`]: body,
});
const hits = report => findings(report, 'BE_ERROR_HOME');

test('BE: capability-prefixed, unique string codes raise nothing', t => {
  const report = runArch(archFixture(t, {
    files: {
      ...errorFile('purchase', 'export enum PurchaseErrorCode {\n  OfferNotFound = "PURCHASE_OFFER_NOT_FOUND",\n  AlreadyOwned = "PURCHASE_ALREADY_OWNED",\n}\n'),
      ...errorFile('learning-path', 'export enum LearningPathErrorCode {\n  Missing = "LEARNING_PATH_MISSING",\n}\nexport enum Unrelated {\n  X = "anything",\n}\n'),
    },
  }));
  assert.deepEqual(hits(report), []);
  assert.equal(report.coverage.hfsMachine.errorCodes.codes, 3);
  assert.ok(report.coverage.checkedRuleIds.includes('BE_ERROR_HOME'));
});

test('BE: a wrong prefix, a suffix, a lowercase code and a computed code are each a finding', t => {
  const found = hits(runArch(archFixture(t, {
    files: errorFile('purchase', `export enum PurchaseErrorCode {
  Wrong = "ORDER_NOT_FOUND",
  Suffix = "PURCHASE_NOT_FOUND_ERROR",
  Lower = "purchase_lower",
  Bare = "PURCHASE",
  Computed = \`PURCHASE_\${1}\`,
  Numeric = 4,
}
`),
  })));
  assert.equal(found.length, 6, JSON.stringify(found.map(item => item.message), null, 1));
  assert.ok(found.some(item => item.message.includes('Numeric must be a string literal')));
});

test('BE: a code repeated in two capabilities or twice in one enum is refused once', t => {
  const found = hits(runArch(archFixture(t, {
    files: {
      ...errorFile('purchase', 'export enum PurchaseErrorCode {\n  A = "PURCHASE_A",\n  B = "PURCHASE_A",\n}\n'),
      ...errorFile('purchase-plan', 'export enum PurchasePlanErrorCode {\n  A = "PURCHASE_PLAN_A",\n  Clash = "PURCHASE_A",\n}\n'),
    },
  })));
  const duplicates = found.filter(item => item.message.includes('already declared'));
  assert.equal(duplicates.length, 2, JSON.stringify(found.map(item => item.message), null, 1));
  const prefix = found.filter(item => item.path.includes('purchase-plan') && item.message.includes('must match PURCHASE_PLAN_'));
  assert.equal(prefix.length, 1, 'PURCHASE_A starts with PURCHASE_ but the plan capability is PURCHASE_PLAN');
});
