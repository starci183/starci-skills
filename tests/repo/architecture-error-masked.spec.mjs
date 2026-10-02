import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings, errorsFiles } from '../helpers/hfs-arch-be-fixture.mjs';

// R39 error-masked (BE_ERROR_MASKED): one APP_FILTER from platform/errors per api app, and the GraphQL module registration
// passes the formatError platform/errors exports.

const APP = ({ providers, imports = '', extra = '' }) => `import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { AllExceptionsFilter, formatError } from '../../../src/modules/platform/errors';
${extra}
@Module({ imports: [${imports}], providers: [${providers}] })
export class AppModule {}
`;
const FILTER = '{ provide: APP_FILTER, useClass: AllExceptionsFilter }';
const hits = report => findings(report, 'BE_ERROR_MASKED');

test('BE: one APP_FILTER from platform/errors and a GraphQL registration with its formatError raise nothing', t => {
  const root = archFixture(t, { files: { ...errorsFiles, 'apps/core/src/app.module.ts': APP({ providers: FILTER, imports: 'GraphQLModule.forRoot({ formatError })' }) } });
  const report = runArch(root);
  assert.deepEqual(hits(report), []);
  assert.equal(report.coverage.hfsMachine.errorMasked.apps, 1);
  assert.equal(report.coverage.hfsMachine.errorMasked.graphqlRegistrations, 1);
  assert.ok(report.coverage.checkedRuleIds.includes('BE_ERROR_MASKED'));
});

test('BE: no APP_FILTER, and two of them, are each one finding on the app root', t => {
  const none = runArch(archFixture(t, { files: { ...errorsFiles, 'apps/core/src/app.module.ts': APP({ providers: '' }) } }));
  assert.equal(hits(none).length, 1);
  assert.match(hits(none)[0].message, /provides 0 APP_FILTER entries/);
  const two = runArch(archFixture(t, { files: { ...errorsFiles, 'apps/core/src/app.module.ts': APP({ providers: `${FILTER}, ${FILTER}` }) } }));
  assert.match(hits(two)[0].message, /provides 2 APP_FILTER entries/);
});

test('BE: a filter declared outside platform/errors, or provided by factory, is refused', t => {
  const local = runArch(archFixture(t, {
    files: { ...errorsFiles, 'apps/core/src/app.module.ts': APP({ providers: '{ provide: APP_FILTER, useClass: LocalFilter }', extra: 'class LocalFilter { catch(): void {} }' }) },
  }));
  assert.equal(hits(local).length, 1);
  assert.match(hits(local)[0].message, /must be `useClass` of the filter declared in platform\/errors/);
  const factory = runArch(archFixture(t, {
    files: { ...errorsFiles, 'apps/core/src/app.module.ts': APP({ providers: '{ provide: APP_FILTER, useFactory: () => new AllExceptionsFilter() }' }) },
  }));
  assert.equal(hits(factory).length, 1);
});

test('BE: a lookalike token that is not APP_FILTER from @nestjs/core is not the filter', t => {
  const root = archFixture(t, {
    files: { ...errorsFiles, 'apps/core/src/app.module.ts': "import { Module } from '@nestjs/common';\nimport { APP_FILTER } from './tokens';\nimport { AllExceptionsFilter } from '../../../src/modules/platform/errors';\n@Module({ providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }] })\nexport class AppModule {}\n", 'apps/core/src/tokens.ts': 'export const APP_FILTER = "x";\n' },
  });
  assert.match(hits(runArch(root))[0].message, /provides 0 APP_FILTER entries/);
});

test('BE: a GraphQL registration without formatError, or with another one, is refused; a non-api app is not judged', t => {
  const without = runArch(archFixture(t, { files: { ...errorsFiles, 'apps/core/src/app.module.ts': APP({ providers: FILTER, imports: 'GraphQLModule.forRoot({ playground: false })' }) } }));
  assert.equal(hits(without).length, 1);
  assert.match(hits(without)[0].message, /must pass the `formatError` exported by platform\/errors/);
  const own = runArch(archFixture(t, {
    files: { ...errorsFiles, 'apps/core/src/app.module.ts': APP({ providers: FILTER, imports: 'GraphQLModule.forRootAsync({ useFactory: () => ({ formatError: (error: unknown) => error }) })' }) },
  }));
  assert.equal(hits(own).length, 1);
  const worker = runArch(archFixture(t, {
    apps: [{ name: 'core', kind: 'api' }, { name: 'jobs', kind: 'worker' }],
    files: { ...errorsFiles, 'apps/core/src/app.module.ts': APP({ providers: FILTER }), 'apps/jobs/src/app.module.ts': 'export const AppModule = 1;\n' },
  }));
  assert.deepEqual(hits(worker), []);
});

test('BE: an APP_FILTER built by a helper outside the app root file is followed: counted once, and judged by its class', t => {
  const helper = use => `import { APP_FILTER } from '@nestjs/core';
import { AllExceptionsFilter } from '../../../src/modules/platform/errors';
class LocalFilter { catch(): void {} }
export const filterProvider = () => ({ provide: APP_FILTER, useClass: ${use} });
`;
  const root = `import { Module } from '@nestjs/common';
import { filterProvider } from './filter-provider';
@Module({ providers: [filterProvider()] })
export class AppModule {}
`;
  const ok = runArch(archFixture(t, { files: { ...errorsFiles, 'apps/core/src/filter-provider.ts': helper('AllExceptionsFilter'), 'apps/core/src/app.module.ts': root } }));
  assert.deepEqual(hits(ok), []);
  const local = runArch(archFixture(t, { files: { ...errorsFiles, 'apps/core/src/filter-provider.ts': helper('LocalFilter'), 'apps/core/src/app.module.ts': root } }));
  assert.equal(hits(local).length, 1);
  assert.match(hits(local)[0].message, /must be `useClass` of the filter declared in platform\/errors/);
});
