// proves: BE_MODULE_SHAPE@lite
// proves: BE_MODULE_SHAPE@full
import test from 'node:test';
import { appDeclaration } from './fixtures/app.mjs';
import { at, BE_DECLARATION, TYPED_ROOT, typedTester } from './fixtures/typed/tester.mjs';
import { hfsFromDeclaration } from './lib/hfs.mjs';
import {
  capabilityModuleShape,
  isGlobalOnlyInApp,
  noCrossOwnerModuleImport,
  noGlobalDecorator,
  noModuleLet,
  noNewInjectable,
  oneModulePerFile,
  staticModuleRegister,
  typedModuleDefinition,
} from './module-shape.mjs';

const MODULE = at('src/modules/domain/plan/plan.module.ts');
const APP = at('apps/api/src/app.module.ts');

for (const edition of ['lite', 'full']) {
  test(`${edition} accepts valid modules and rejects module-shape violations`, () => {
    const hfs = hfsFromDeclaration({ ...appDeclaration('be', BE_DECLARATION), edition }, TYPED_ROOT);
    const settings = { starci: { hfs } };
    const tester = typedTester();

    tester.run('no-global-decorator', noGlobalDecorator, {
      valid: [{ filename: MODULE, settings, code: '@Module({}) class PlanModule {}' }],
      invalid: [{
        filename: MODULE,
        settings,
        code: '@Global() @Module({}) class PlanModule {}',
        errors: [{ messageId: 'global' }],
      }],
    });

    tester.run('is-global-only-in-app', isGlobalOnlyInApp, {
      valid: [{ filename: APP, settings, code: 'const m = CatalogModule.register({ isGlobal: true })' }],
      invalid: [{
        filename: MODULE,
        settings,
        code: 'const m = CatalogModule.register({ isGlobal: true })',
        errors: [{ messageId: 'isGlobal' }],
      }],
    });

    tester.run('no-cross-owner-module-import', noCrossOwnerModuleImport, {
      valid: [{ filename: MODULE, settings, code: '@Module({ providers: [] }) class PlanModule {}' }],
      invalid: [{
        filename: MODULE,
        settings,
        code: 'import { CatalogModule } from "@modules/domain/catalog"; @Module({ imports: [CatalogModule] }) class PlanModule {}',
        errors: [{ messageId: 'cross' }],
      }],
    });

    tester.run('capability-module-shape', capabilityModuleShape, {
      valid: [{
        filename: MODULE,
        settings,
        code: 'import { ConfigurableModuleClass } from "./plan.module-definition"; @Module({}) export class PlanModule extends ConfigurableModuleClass {}',
      }],
      invalid: [{
        filename: MODULE,
        settings,
        code: '@Module({}) export class PlanModule {}',
        errors: [{ messageId: 'extendsBase' }],
      }],
    });

    tester.run('typed-module-definition', typedModuleDefinition, {
      valid: [{ filename: MODULE, settings, code: 'const b = new ConfigurableModuleBuilder<PlanOptions>()' }],
      invalid: [{
        filename: MODULE,
        settings,
        code: 'const b = new ConfigurableModuleBuilder()',
        errors: [{ messageId: 'untyped' }],
      }],
    });

    tester.run('static-module-register', staticModuleRegister, {
      valid: [{
        filename: MODULE,
        settings,
        code: '@Module({}) class M { static register(o: O) { return {} } }',
      }],
      invalid: [{
        filename: MODULE,
        settings,
        code: '@Module({}) class M { register(o: O) { return {} } }',
        errors: [{ messageId: 'notStatic' }],
      }],
    });

    tester.run('no-new-injectable', noNewInjectable, {
      valid: [{ filename: MODULE, settings, code: 'const p = new Map()' }],
      invalid: [{
        filename: MODULE,
        settings,
        code: '@Injectable() class LocalThing {} const t = new LocalThing()',
        errors: [{ messageId: 'construct' }],
      }],
    });

    tester.run('no-module-let', noModuleLet, {
      valid: [{ filename: MODULE, settings, code: 'const x = 1; function f() { let y = 2; return y }' }],
      invalid: [{ filename: MODULE, settings, code: 'let counter = 0', errors: [{ messageId: 'mutable' }] }],
    });

    tester.run('one-module-per-file', oneModulePerFile, {
      valid: [{ filename: MODULE, settings, code: '@Module({}) class A {} class B {}' }],
      invalid: [{
        filename: MODULE,
        settings,
        code: '@Module({}) class A {} @Module({}) class B {}',
        errors: [{ messageId: 'many' }],
      }],
    });
  });
}
