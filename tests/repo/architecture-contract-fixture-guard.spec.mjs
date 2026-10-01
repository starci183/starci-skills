import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from '../helpers/hfs-arch-be-fixture.mjs';

// R47 contract-fixture-guard (BE_CONTRACT_UNGUARDED): a fake under src/tests/world/fakes/<provider>/ that serves payload fixtures
// (payloads/*.json) needs a src/tests/contract/<provider>/*.contract-spec.ts that references those fixtures and asserts
// expect(shapeOf(real)).toEqual(shapeOf(fixture)).
const E = 'export const value = 1;\n';
const WORLD = {
  'src/tests/world/global-setup.ts': E,
  'src/tests/world/global-teardown.ts': E,
  'src/tests/world/use-test-world.ts': E,
};
const FIXTURE = provider => ({
  [`src/tests/world/fakes/${provider}/server.ts`]: E,
  [`src/tests/world/fakes/${provider}/payloads/create-intent.json`]: '{"id":"x"}\n',
});
const SPEC = (provider, body) => ({ [`src/tests/contract/${provider}/${provider}.contract-spec.ts`]: body });
const GUARD = provider => `import { shapeOf } from '../../world/payload-shape.policy';
import { renderPayload } from '../../world/fakes/payload.service';
declare const real: unknown;
describe('${provider} sandbox contract', () => {
  it('has the shape of the fixtures', () => {
    expect(shapeOf(real)).toEqual(shapeOf(renderPayload('${provider}', 'create-intent')));
  });
});
`;
const DECLARE = { declaration: { optionalSlots: [] } };
const hits = report => findings(report, 'BE_CONTRACT_UNGUARDED');
const run = (t, files) => runArch(archFixture(t, { files: { ...WORLD, ...files }, ...DECLARE }));

test('a fake with fixtures and a contract spec that references them and compares shapes raises nothing', t => {
  const report = run(t, { ...FIXTURE('sepay'), ...SPEC('sepay', GUARD('sepay')) });
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
  assert.ok(report.coverage.checkedRuleIds.includes('BE_CONTRACT_UNGUARDED'));
});

test('a fake without payload fixtures needs no contract spec', t => {
  const report = run(t, { 'src/tests/world/fakes/smtp/server.ts': E });
  assert.deepEqual(hits(report), []);
});

test('a fake with fixtures and no contract spec is refused at its first fixture', t => {
  const report = run(t, FIXTURE('sepay'));
  assert.deepEqual(hits(report).map(item => item.path), ['src/tests/world/fakes/sepay/payloads/create-intent.json']);
  assert.match(hits(report)[0].message, /there is no src\/tests\/contract\/sepay\/\*\.contract-spec\.ts/);
});

test('a contract spec that never compares shapes, compares without referencing the fixtures, or asserts on the wrong side is refused', t => {
  const report = run(t, {
    ...FIXTURE('sepay'), ...FIXTURE('payos'), ...FIXTURE('momo'),
    ...SPEC('sepay', "describe('x', () => { it('y', () => { expect(1).toBe(1); }); });\n"),
    ...SPEC('payos', GUARD('other').replace("'other'", "'unrelated'").replace("'other'", "'unrelated'")),
    ...SPEC('momo', GUARD('momo').replace("shapeOf(renderPayload('momo', 'create-intent'))", "renderPayload('momo', 'create-intent')")),
  });
  assert.deepEqual(hits(report).map(item => item.path).sort(), [
    'src/tests/world/fakes/momo/payloads/create-intent.json',
    'src/tests/world/fakes/payos/payloads/create-intent.json',
    'src/tests/world/fakes/sepay/payloads/create-intent.json',
  ]);
});

test('a shape helper the spec declares itself, not the imported world vocabulary, does not count', t => {
  const own = GUARD('sepay').replace("import { shapeOf } from '../../world/payload-shape.policy';\n", 'const shapeOf = (value: unknown): unknown => value;\n');
  const report = run(t, { ...FIXTURE('sepay'), ...SPEC('sepay', own) });
  assert.equal(hits(report).length, 1);
});

test('one guarding contract spec of several suffices, and a spec of another provider does not guard', t => {
  const report = run(t, {
    ...FIXTURE('sepay'), ...FIXTURE('payos'),
    ...SPEC('sepay', GUARD('sepay')),
    'src/tests/contract/sepay/extra.contract-spec.ts': "it('x', () => {});\n",
    ...SPEC('payos', GUARD('sepay')),
  });
  assert.deepEqual(hits(report).map(item => item.path), ['src/tests/world/fakes/payos/payloads/create-intent.json']);
});
