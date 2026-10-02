import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { findings } from '../helpers/hfs-arch-be-fixture.mjs';
import { errorMaskedFixture } from '../helpers/repo-architecture-error-masked-fixture.mjs';

// R39 error-masked (BE_ERROR_MASKED): one APP_FILTER from platform/errors per api app, and the GraphQL module registration
// passes the formatError platform/errors exports.

const hits = report => findings(report, 'BE_ERROR_MASKED');

let fixture;
const cleanups = [];
before(() => { fixture = errorMaskedFixture({ after: cleanup => cleanups.push(cleanup) }); });
after(() => { for (const cleanup of cleanups.reverse()) cleanup(); });

test('BE: one APP_FILTER from platform/errors and a GraphQL registration with its formatError raise nothing', () => {
  const report = fixture.report('control');
  assert.deepEqual(hits(report), []);
  assert.equal(report.coverage.hfsMachine.errorMasked.apps, 1);
  assert.equal(report.coverage.hfsMachine.errorMasked.graphqlRegistrations, 1);
  assert.ok(report.coverage.checkedRuleIds.includes('BE_ERROR_MASKED'));
});

test('BE: no APP_FILTER, and two of them, are each one finding on the app root', () => {
  const none = fixture.report('none');
  assert.equal(hits(none).length, 1);
  assert.match(hits(none)[0].message, /provides 0 APP_FILTER entries/);
  const two = fixture.report('two');
  assert.match(hits(two)[0].message, /provides 2 APP_FILTER entries/);
});

test('BE: a filter declared outside platform/errors, or provided by factory, is refused', () => {
  const local = fixture.report('local');
  assert.equal(hits(local).length, 1);
  assert.match(hits(local)[0].message, /must be `useClass` of the filter declared in platform\/errors/);
  const factory = fixture.report('factory');
  assert.equal(hits(factory).length, 1);
});

test('BE: a lookalike token that is not APP_FILTER from @nestjs/core is not the filter', () => {
  assert.match(hits(fixture.report('lookalike'))[0].message, /provides 0 APP_FILTER entries/);
});

test('BE: a GraphQL registration without formatError, or with another one, is refused; a non-api app is not judged', () => {
  const without = fixture.report('withoutFormat');
  assert.equal(hits(without).length, 1);
  assert.match(hits(without)[0].message, /must pass the `formatError` exported by platform\/errors/);
  const own = fixture.report('ownFormat');
  assert.equal(hits(own).length, 1);
  const worker = fixture.report('worker');
  assert.deepEqual(hits(worker), []);
});

test('BE: an APP_FILTER built by a helper outside the app root file is followed: counted once, and judged by its class', () => {
  const ok = fixture.report('helperOk');
  assert.deepEqual(hits(ok), []);
  const local = fixture.report('helperLocal');
  assert.equal(hits(local).length, 1);
  assert.match(hits(local)[0].message, /must be `useClass` of the filter declared in platform\/errors/);
});
