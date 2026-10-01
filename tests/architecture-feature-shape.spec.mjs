import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from './_hfs-arch-be-fixture.mjs';

// R29 feature-shape (BE_FEATURE_SHAPE): a feature root holds index.ts, <f>.module.ts, application/, transport/<protocol>/
// and messages/ only, and each of those holds only what its slot allows (knowledge/hfs/slots.yaml).
const E = 'export const value = 1;\n';
const GOOD = {
  'src/features/a/index.ts': E,
  'src/features/a/a.module.ts': E,
  'src/features/a/application/run.command.ts': E,
  'src/features/a/application/run.handler.ts': E,
  'src/features/a/application/support/run-order.policy.ts': E,
  'src/features/a/transport/graphql/a-graphql.module.ts': E,
  'src/features/a/transport/graphql/run.resolver.ts': E,
  'src/features/a/transport/graphql/run.mapper.ts': E,
  'src/features/a/transport/graphql/dto/run.input.ts': E,
  'src/features/a/transport/http/a-http.module.ts': E,
  'src/features/a/transport/http/run.controller.ts': E,
  'src/features/a/messages/a.messages.ts': E,
};
const DECLARE = { declaration: { optionalSlots: [] } };
const hits = report => findings(report, 'BE_FEATURE_SHAPE');
const paths = report => hits(report).map(item => item.path).sort();
const run = (t, files) => runArch(archFixture(t, { files: { ...GOOD, ...files }, ...DECLARE }));

test('a feature with the allowed root, application, transport and messages files raises no BE_FEATURE_SHAPE', t => {
  const report = run(t, {});
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
  assert.equal(report.coverage.hfsMachine.featureShape.status, 'checked');
  assert.equal(report.coverage.hfsMachine.featureShape.features, 1);
  assert.ok(report.coverage.checkedRuleIds.includes('BE_FEATURE_SHAPE'));
});

test('a stray file, a transport module, or a folder at the feature root is BE_FEATURE_SHAPE', t => {
  const report = run(t, {
    'src/features/a/helper.ts': E,
    'src/features/a/a-graphql.module.ts': E,
    'src/features/a/README.md': '# a\n',
    'src/features/a/shared/clock.ts': E,
  });
  assert.deepEqual(paths(report), ['src/features/a/README.md', 'src/features/a/a-graphql.module.ts', 'src/features/a/helper.ts', 'src/features/a/shared/clock.ts']);
  assert.match(hits(report).find(item => item.folder === 'shared').message, /no slot owns/);
});

test('a protocol-named folder under application/ and an unknown transport protocol are BE_FEATURE_SHAPE', t => {
  const report = run(t, {
    'src/features/a/application/graphql/run.resolver.ts': E,
    'src/features/a/transport/grpc/run.service.ts': E,
  });
  assert.deepEqual(paths(report), ['src/features/a/application/graphql/run.resolver.ts', 'src/features/a/transport/grpc/run.service.ts']);
});

// A handler has no spec of its own (BE-CONVENTION 1.16 unit standard, owner-locked lane UT; slot be.feature.application
// tests: none): only a <name>.service.ts has a colocated <name>.service.spec.ts, so a spec in a feature folder is a role
// the folder does not allow.
test('a file of a role its folder does not allow is BE_FEATURE_SHAPE (application and transport slots)', t => {
  const report = run(t, {
    'src/features/a/application/run.handler.spec.ts': E,
    'src/features/a/application/run.use-case.ts': E,
    'src/features/a/application/run.service.ts': E,
    'src/features/a/transport/graphql/run.controller.ts': E,
    'src/features/a/transport/http/dto/run.input.ts': E,
    'src/features/a/messages/other.messages.ts': E,
  });
  assert.deepEqual(paths(report), [
    'src/features/a/application/run.handler.spec.ts',
    'src/features/a/application/run.service.ts',
    'src/features/a/application/run.use-case.ts',
    'src/features/a/messages/other.messages.ts',
    'src/features/a/transport/graphql/run.controller.ts',
    'src/features/a/transport/http/dto/run.input.ts',
  ]);
});

test('domain capabilities and apps are not judged as features', t => {
  const report = run(t, { 'src/modules/domain/x/index.ts': E, 'src/modules/domain/x/x.service.ts': E, 'src/modules/domain/x/notes/readme.ts': E });
  assert.deepEqual(hits(report), []);
});
