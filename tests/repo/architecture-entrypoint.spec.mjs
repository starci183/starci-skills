import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from '../helpers/hfs-arch-be-fixture.mjs';

// R33 entrypoint-only-in-apps (BE_ENTRYPOINT_ONLY_IN_APPS): NestFactory.create* and a top-level bootstrap() live in
// apps/<app>/src/main.ts only.

const MAIN = "import { NestFactory } from '@nestjs/core';\nimport { AppModule } from './app.module';\nasync function bootstrap() { const app = await NestFactory.create(AppModule); await app.listen(3000); }\nvoid bootstrap();\n";
const hits = report => findings(report, 'BE_ENTRYPOINT_ONLY_IN_APPS');

test('BE: NestFactory and bootstrap() in apps/<app>/src/main.ts raise nothing', t => {
  const report = runArch(archFixture(t, { files: { 'apps/core/src/main.ts': MAIN, 'apps/core/src/app.module.ts': 'export class AppModule {}\n' } }));
  assert.deepEqual(hits(report), []);
  assert.equal(report.coverage.hfsMachine.entrypoints.entrypoints, 1);
  assert.ok(report.coverage.checkedRuleIds.includes('BE_ENTRYPOINT_ONLY_IN_APPS'));
});

test('BE: NestFactory.create* outside an app main.ts is refused wherever it is', t => {
  const report = runArch(archFixture(t, {
    files: {
      'apps/core/src/main.ts': MAIN,
      'apps/core/src/app.module.ts': 'export class AppModule {}\n',
      'src/features/a/index.ts': "import { NestFactory } from '@nestjs/core';\nexport const start = (module: unknown) => NestFactory.createApplicationContext(module);\n",
      'src/tests/fixtures/boot.ts': "import * as nest from '@nestjs/core';\nexport const boot = (module: unknown) => nest.NestFactory.create(module);\n",
      'apps/core/src/other.ts': "import { NestFactory as Factory } from '@nestjs/core';\nexport const other = (module: unknown) => Factory.createMicroservice(module);\n",
    },
  }));
  assert.deepEqual(hits(report).map(item => item.path).sort(), ['apps/core/src/other.ts', 'src/features/a/index.ts', 'src/tests/fixtures/boot.ts']);
});

test('BE: a top-level bootstrap() call outside main.ts is refused in its plain, void and chained forms', t => {
  const report = runArch(archFixture(t, {
    files: {
      'apps/core/src/main.ts': MAIN,
      'apps/core/src/app.module.ts': 'export class AppModule {}\n',
      'src/features/a/one.ts': 'declare function bootstrap(): Promise<void>;\nbootstrap();\n',
      'src/features/a/two.ts': 'declare function bootstrap(): Promise<void>;\nvoid bootstrap();\n',
      'src/features/a/three.ts': 'declare function bootstrap(): Promise<void>;\nbootstrap().catch(() => undefined);\n',
      'src/features/a/index.ts': 'export const fine = (): void => { const bootstrap = (): void => undefined; bootstrap(); };\n',
    },
  }));
  assert.deepEqual(hits(report).map(item => item.path).sort(), ['src/features/a/one.ts', 'src/features/a/three.ts', 'src/features/a/two.ts']);
});

test('BE: a lookalike NestFactory that is not from @nestjs/core is not an entrypoint', t => {
  const report = runArch(archFixture(t, {
    files: { 'src/features/a/index.ts': 'const NestFactory = { create: (module: unknown) => module };\nexport const fake = NestFactory.create(1);\n' },
  }));
  assert.deepEqual(hits(report), []);
});

test('BE: the test world (be.tests.world) is a composition root and may call NestFactory; another test folder and a feature may not', t => {
  const boot = "import { NestFactory } from '@nestjs/core';\nexport const boot = (module: unknown) => NestFactory.create(module);\n";
  const report = runArch(archFixture(t, {
    files: {
      'apps/core/src/main.ts': MAIN,
      'apps/core/src/app.module.ts': 'export class AppModule {}\n',
      'src/tests/world/use-test-world.ts': boot,
      'src/tests/fixtures/boot.ts': boot,
      'src/features/a/index.ts': boot,
    },
  }));
  assert.deepEqual(hits(report).map(item => item.path).sort(), ['src/features/a/index.ts', 'src/tests/fixtures/boot.ts']);
});
