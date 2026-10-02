import { archFixture, runArch, errorsFiles } from './hfs-arch-be-fixture.mjs';

const APP = ({ providers, imports = '', extra = '' }) => `import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { AllExceptionsFilter, formatError } from '../../../src/modules/platform/errors';
${extra}
@Module({ imports: [${imports}], providers: [${providers}] })
export class AppModule {}
`;

const FILTER = '{ provide: APP_FILTER, useClass: AllExceptionsFilter }';

const HELPER = use => `import { APP_FILTER } from '@nestjs/core';
import { AllExceptionsFilter } from '../../../src/modules/platform/errors';
class LocalFilter { catch(): void {} }
export const filterProvider = () => ({ provide: APP_FILTER, useClass: ${use} });
`;

const HELPER_ROOT = `import { Module } from '@nestjs/common';
import { filterProvider } from './filter-provider';
@Module({ providers: [filterProvider()] })
export class AppModule {}
`;

const appFile = (app, relative = 'app.module.ts') => `apps/${app}/src/${relative}`;

const OVERLAY_APPS = [
  ['none', 'api'],
  ['two', 'api'],
  ['local', 'api'],
  ['factory', 'api'],
  ['lookalike', 'api'],
  ['without-format', 'api'],
  ['own-format', 'api'],
  ['worker-core', 'api'],
  ['jobs', 'worker'],
  ['helper-ok', 'api'],
  ['helper-local', 'api'],
].map(([name, kind]) => ({ name, kind }));

const OVERLAY_FILES = {
  ...errorsFiles,
  [appFile('none')]: APP({ providers: '' }),
  [appFile('two')]: APP({ providers: `${FILTER}, ${FILTER}` }),
  [appFile('local')]: APP({ providers: '{ provide: APP_FILTER, useClass: LocalFilter }', extra: 'class LocalFilter { catch(): void {} }' }),
  [appFile('factory')]: APP({ providers: '{ provide: APP_FILTER, useFactory: () => new AllExceptionsFilter() }' }),
  [appFile('lookalike')]: "import { Module } from '@nestjs/common';\nimport { APP_FILTER } from './tokens';\nimport { AllExceptionsFilter } from '../../../src/modules/platform/errors';\n@Module({ providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }] })\nexport class AppModule {}\n",
  [appFile('lookalike', 'tokens.ts')]: 'export const APP_FILTER = "x";\n',
  [appFile('without-format')]: APP({ providers: FILTER, imports: 'GraphQLModule.forRoot({ playground: false })' }),
  [appFile('own-format')]: APP({ providers: FILTER, imports: 'GraphQLModule.forRootAsync({ useFactory: () => ({ formatError: (error: unknown) => error }) })' }),
  [appFile('worker-core')]: APP({ providers: FILTER }),
  [appFile('jobs')]: 'export const AppModule = 1;\n',
  [appFile('helper-ok')]: HELPER_ROOT,
  [appFile('helper-ok', 'filter-provider.ts')]: HELPER('AllExceptionsFilter'),
  [appFile('helper-local')]: HELPER_ROOT,
  [appFile('helper-local', 'filter-provider.ts')]: HELPER('LocalFilter'),
};

const SCENARIO_APPS = {
  none: ['none'],
  two: ['two'],
  local: ['local'],
  factory: ['factory'],
  lookalike: ['lookalike'],
  withoutFormat: ['without-format'],
  ownFormat: ['own-format'],
  worker: ['worker-core', 'jobs'],
  helperOk: ['helper-ok'],
  helperLocal: ['helper-local'],
};

function reportForApps(report, apps) {
  const prefixes = apps.map(app => `apps/${app}/`);
  return Object.freeze({
    ...report,
    violations: report.violations.filter(item => prefixes.some(prefix => item.path?.startsWith(prefix))),
  });
}

/** Two real architecture-machine runs: an exact positive control and one immutable repository of failure overlays. */
export function errorMaskedFixture(t) {
  const controlRoot = archFixture(t, {
    files: {
      ...errorsFiles,
      'apps/core/src/app.module.ts': APP({ providers: FILTER, imports: 'GraphQLModule.forRoot({ formatError })' }),
    },
  });
  const overlayRoot = archFixture(t, { apps: OVERLAY_APPS, files: OVERLAY_FILES });
  const controlReport = runArch(controlRoot);
  const overlayReport = runArch(overlayRoot);
  const reports = new Map([
    ['control', Object.freeze(controlReport)],
    ...Object.entries(SCENARIO_APPS).map(([name, apps]) => [name, reportForApps(overlayReport, apps)]),
  ]);
  return Object.freeze({
    report(name) {
      const report = reports.get(name);
      if (!report) throw new Error(`Unknown error-masked scenario: ${name}`);
      return report;
    },
  });
}
