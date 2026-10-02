import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from '../helpers/hfs-arch-fixture.mjs';

// HFS check 4 and 5 (R21, R25, R30): dead code is an error in every gate (HFS_UNUSED_EXPORT, HFS_UNUSED_FILE), one name has one
// declaration (HFS_DUPLICATE_SYMBOL) and a declaration has one name (HFS_ALIAS_REEXPORT). Each rule has a tree that fires and a
// tree that stays clean; the backend profile and the frontend profile are both judged.

const matching = (report, ruleId, prefixes = []) => findings(report, ruleId)
  .filter(item => prefixes.length === 0 || prefixes.some(prefix => item.path.startsWith(prefix)));
const paths = (report, ruleId, prefixes) => matching(report, ruleId, prefixes).map(item => item.path).sort();
const names = (report, ruleId, prefixes) => matching(report, ruleId, prefixes).map(item => item.name).sort();

const cleanups = [];
const fixtureContext = { after: cleanup => cleanups.push(cleanup) };
let reports;

before(() => {
  const r25Shared = runArch(archFixture(fixtureContext, {
    apps: [
      { name: 'core', kind: 'api' },
      { name: 'unused-files', kind: 'api' },
      { name: 'all-reached', kind: 'api' },
    ],
    files: {
      'apps/core/src/app.module.ts': [
        "import { deadExportA, deadExportB } from '../../../src/features/api/dead-export';",
        "import { cleanExportA } from '../../../src/features/api/clean-export';",
        'export const AppModule = [deadExportA, deadExportB, cleanExportA];',
        '',
      ].join('\n'),
      'src/features/api/dead-export/index.ts': "import { deadExportUsed } from '../../../modules/domain/dead-export';\nexport const deadExportA = [deadExportUsed];\nexport const deadExportB = 1;\nexport const dead = 2;\n",
      'src/modules/domain/dead-export/index.ts': 'export const deadExportUsed = 1;\nexport const unused = 2;\n',
      'src/features/api/clean-export/index.ts': "import { cleanExportUsed } from '../../../modules/domain/clean-export';\nexport const cleanExportA = [cleanExportUsed];\n",
      'src/modules/domain/clean-export/index.ts': 'export const cleanExportUsed = 1;\n',
      'apps/unused-files/src/app.module.ts': "import { unusedFilesUsed } from '../../../src/modules/domain/unused-files';\nexport const AppModule = [unusedFilesUsed];\n",
      'apps/unused-files/src/main.ts': 'void 0;\n',
      'src/modules/domain/unused-files/index.ts': "export { unusedFilesUsed } from './used';\n",
      'src/modules/domain/unused-files/used.ts': "import type { UnusedFilesShape } from './shape';\nexport const unusedFilesUsed: UnusedFilesShape = 1;\n",
      'src/modules/domain/unused-files/shape.ts': 'export type UnusedFilesShape = number;\n',
      'src/modules/domain/unused-files/orphan.ts': 'export const unusedFilesOrphan = 1;\n',
      'src/modules/domain/unused-files/spec-only.ts': 'export const unusedFilesSpecOnly = 1;\n',
      'src/modules/domain/unused-files/spec-only.spec.ts': "import { unusedFilesSpecOnly } from './spec-only';\nvoid unusedFilesSpecOnly;\n",
      'apps/all-reached/src/app.module.ts': "import { allReachedUsed } from '../../../src/modules/domain/all-reached';\nexport const AppModule = [allReachedUsed];\n",
      'apps/all-reached/src/main.ts': 'void 0;\n',
      'src/modules/domain/all-reached/index.ts': "export { allReachedUsed } from './used';\n",
      'src/modules/domain/all-reached/used.ts': "import type { AllReachedShape } from './shape';\nexport const allReachedUsed: AllReachedShape = 1;\n",
      'src/modules/domain/all-reached/shape.ts': 'export type AllReachedShape = number;\n',
    },
  }));

  const r25Roots = runArch(archFixture(fixtureContext, {
    apps: [{ name: 'roots', kind: 'api' }],
    files: {
      'tsconfig.json': `${JSON.stringify({
        compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', allowJs: true, skipLibCheck: true, noEmit: true },
        include: ['src/**/*', 'apps/**/*', 'packages/**/*'],
      })}\n`,
      'apps/core/src/main.ts': null,
      'apps/core/src/app.module.ts': null,
      'apps/roots/src/main.ts': "import { boot } from './boot';\nboot();\n",
      'apps/roots/src/app.module.ts': 'export const AppModule = 1;\n',
      'apps/roots/src/boot.ts': 'export const boot = () => 1;\n',
      'apps/roots/src/stray.ts': 'export const stray = 1;\n',
      'packages/shared/package.json': JSON.stringify({ name: '@fixture/shared', private: true }),
      'packages/shared/src/index.ts': "export { packageUsed } from './used';\n",
      'packages/shared/src/used.ts': 'export const packageUsed = 1;\n',
      'packages/shared/src/orphan.ts': 'export const packageOrphan = 1;\n',
    },
  }));

  const r21Backend = runArch(archFixture(fixtureContext, {
    files: {
      'apps/core/src/app.module.ts': "import { a } from '../../../src/features/api/a';\nexport const AppModule = [a];\n",
      'src/features/api/a/index.ts': [
        "import { InjectPrimaryEntityManager as xManager } from '../../../modules/domain/dup-x';",
        "import { InjectPrimaryEntityManager as yManager } from '../../../modules/domain/dup-y';",
        "import { used, Shape, Kind } from '../../../modules/domain/kinds';",
        "import { shared } from '../../../modules/domain/clean-x';",
        'export const a = [xManager, yManager, used, Shape, Kind, shared];',
        '',
      ].join('\n'),
      'src/modules/domain/dup-x/index.ts': "export { InjectPrimaryEntityManager } from './x.decorators';\n",
      'src/modules/domain/dup-x/x.decorators.ts': 'export const InjectPrimaryEntityManager = () => 1;\n',
      'src/modules/domain/dup-y/index.ts': "export { InjectPrimaryEntityManager } from './y.decorators';\n",
      'src/modules/domain/dup-y/y.decorators.ts': 'export const InjectPrimaryEntityManager = () => 2;\n',
      'src/modules/domain/kinds/index.ts': "export { used } from './used';\nexport type { Shape } from './shape';\nexport { Kind } from './kind';\n",
      'src/modules/domain/kinds/used.ts': 'export const used = 1;\n',
      'src/modules/domain/kinds/shape.ts': 'export interface Shape { a: number }\n',
      'src/modules/domain/kinds/kind.ts': "export enum Kind { A = 'a' }\n",
      'src/modules/domain/candidate/private.ts': 'export function used() { return 2; }\nexport type Shape = string;\nexport class Kind {}\n',
      'src/modules/domain/clean-x/index.ts': "export { shared } from './shared';\n",
      'src/modules/domain/clean-x/shared.ts': 'export const shared = 1;\n',
      'src/modules/domain/clean-y/index.ts': "export { shared } from '../clean-x';\n",
      'src/modules/domain/clean-local/local.ts': 'const shared = 2;\nexport default shared;\n',
      'src/modules/domain/clean-default/local.ts': 'export default 3;\n',
    },
  }));

  const r30Backend = runArch(archFixture(fixtureContext, {
    files: {
      'apps/core/src/app.module.ts': "import { a } from '../../../src/features/api/a';\nexport const AppModule = [a];\n",
      'src/features/api/a/index.ts': [
        "import { aliasFormsUsed } from '../../../modules/domain/alias-forms';",
        "import { cleanUsed } from '../../../modules/domain/clean-reexport';",
        "import { aliasDeclarationsUsed } from '../../../modules/domain/alias-declarations';",
        "import { nonaliasesUsed } from '../../../modules/domain/nonaliases';",
        'export const a = [aliasFormsUsed, cleanUsed, aliasDeclarationsUsed, nonaliasesUsed];',
        '',
      ].join('\n'),
      'src/modules/domain/alias-forms/index.ts': [
        "export { aliasFormsUsed } from './used';",
        "export { inner as renamed } from './inner';",
        "export { default as Thing } from './thing';",
        "export * as ns from './ns';",
        "export type { Shape as Contract } from './shape';",
        "export { plain } from './plain';",
        "import { local } from './local';",
        'export { local as other };',
        '',
      ].join('\n'),
      'src/modules/domain/alias-forms/used.ts': 'export const aliasFormsUsed = 1;\n',
      'src/modules/domain/alias-forms/inner.ts': 'export const inner = 1;\n',
      'src/modules/domain/alias-forms/thing.ts': 'export default 1;\n',
      'src/modules/domain/alias-forms/ns.ts': 'export const one = 1;\n',
      'src/modules/domain/alias-forms/shape.ts': 'export type Shape = number;\n',
      'src/modules/domain/alias-forms/plain.ts': 'export const plain = 1;\n',
      'src/modules/domain/alias-forms/local.ts': 'export const local = 1;\n',
      'src/modules/domain/alias-forms/alias.spec.ts': "export { plain as fromSpec } from './plain';\n",
      'src/modules/domain/clean-reexport/index.ts': "export { cleanUsed } from './used';\nexport { same as same } from './same';\n",
      'src/modules/domain/clean-reexport/used.ts': 'export const cleanUsed = 1;\n',
      'src/modules/domain/clean-reexport/same.ts': 'export const same = 1;\n',
      'src/modules/domain/alias-declarations/index.ts': "export { aliasDeclarationsUsed } from './used';\nexport { Original, Mode, helper, Options, Shape, Config } from './original';\nexport { Renamed, Moved, Bound, Optioned, Shaped, ConfigAlias, Ns } from './aliases';\n",
      'src/modules/domain/alias-declarations/used.ts': 'export const aliasDeclarationsUsed = 1;\n',
      'src/modules/domain/alias-declarations/original.ts': [
        'export class Original {}',
        'export enum Mode { On }',
        'export function helper(): number { return 1; }',
        'export interface Options { flag: boolean }',
        'export type Shape = { width: number };',
        'export const Config = { url: "u" };',
        '',
      ].join('\n'),
      'src/modules/domain/alias-declarations/aliases.ts': [
        "import { Original, Mode, helper, Options, Shape, Config } from './original';",
        "import * as original from './original';",
        'export const Renamed = Original;',
        'export const Moved = helper;',
        'export const Bound = original.helper;',
        'export type Optioned = Options;',
        'export interface Shaped extends Shape {}',
        'export const ConfigAlias = Config;',
        'export const Ns = Mode;',
        '',
      ].join('\n'),
      'src/modules/domain/nonaliases/index.ts': "export { nonaliasesUsed } from './used';\nexport { Base, Settings, limit } from './base';\nexport { Limit, Extended, Boxed, Wrapped, Packaged, Copy } from './fine';\n",
      'src/modules/domain/nonaliases/used.ts': 'export const nonaliasesUsed = 1;\n',
      'src/modules/domain/nonaliases/base.ts': 'export interface Base { id: string }\nexport const Settings = { limit: 3 };\nexport const limit = 4;\n',
      'src/modules/domain/nonaliases/fine.ts': [
        "import { Base, Settings, limit } from './base';",
        "import type { Thing } from 'some-package';",
        'export const Limit = Settings.limit;',
        'export interface Extended extends Base { name: string }',
        'export type Boxed<T> = Array<T>;',
        'export type Wrapped = Base[];',
        'export type Packaged = Thing;',
        'export const Copy = limit + 1;',
        '',
      ].join('\n'),
    },
  }));

  const frontend = runArch(archFixture(fixtureContext, {
    profile: 'fe',
    apps: [
      { name: 'web', kind: 'next' },
      { name: 'web-unnamed', kind: 'next' },
      { name: 'hooks', kind: 'next' },
      { name: 'direct-alias', kind: 'next' },
      { name: 'declaration-alias', kind: 'next' },
    ],
    files: {
      'apps/web/src/app/[locale]/page.tsx': "import { Page } from '../../features/pages/Home';\nexport default Page;\n",
      'apps/web/src/features/pages/Home/index.tsx': "import { Btn } from '../../../components/leaves/Btn';\nexport const Page = Btn;\n",
      'apps/web/src/components/leaves/Btn/index.tsx': 'export const Btn = 1;\n',
      'apps/web/src/components/leaves/Dead/index.tsx': 'export const Dead = 1;\n',
      'apps/web/src/modules/i18n/request.ts': 'export default {};\n',
      'apps/web/next.config.ts': "const request = './src/modules/i18n/request.ts';\nexport default { request };\n",
      'apps/web-unnamed/src/app/[locale]/page.tsx': "import { Page } from '../../features/pages/Home';\nexport default Page;\n",
      'apps/web-unnamed/src/features/pages/Home/index.tsx': "import { Btn } from '../../../components/leaves/Btn';\nexport const Page = Btn;\n",
      'apps/web-unnamed/src/components/leaves/Btn/index.tsx': 'export const Btn = 1;\n',
      'apps/web-unnamed/src/components/leaves/Dead/index.tsx': 'export const Dead = 1;\n',
      'apps/web-unnamed/src/modules/i18n/request.ts': 'export default {};\n',
      'apps/web-unnamed/next.config.ts': 'export default {};\n',
      'apps/hooks/src/hooks/cart/index.ts': "export { useThing } from './useThing';\n",
      'apps/hooks/src/hooks/cart/useThing.ts': 'export const useThing = () => 1;\n',
      'apps/hooks/src/hooks/orders/useThing.ts': 'export const useThing = () => 2;\n',
      'apps/direct-alias/src/modules/config/index.ts': "export { value as setting } from './value';\n",
      'apps/direct-alias/src/modules/config/value.ts': 'export const value = 1;\n',
      'apps/declaration-alias/src/modules/config/index.ts': "export { value, Shape, Renamed, Label } from './config';\n",
      'apps/declaration-alias/src/modules/config/value.ts': 'export const value = 1;\nexport interface Shape { width: number }\n',
      'apps/declaration-alias/src/modules/config/config.ts': "import { value, Shape } from './value';\nexport { value, Shape };\nexport const Renamed = value;\nexport type Label = Shape;\n",
    },
  }));

  reports = { r25Shared, r25Roots, r21Backend, r30Backend, frontend };
});

after(() => {
  for (const cleanup of cleanups.reverse()) cleanup();
});

// ---- HFS_UNUSED_EXPORT on the backend owner entries (R25 a) -------------------------------------------------------

test('R25: a backend feature and a backend domain entry both report an export nobody outside imports', () => {
  const dead = matching(reports.r25Shared, 'HFS_UNUSED_EXPORT', ['src/features/api/dead-export/', 'src/modules/domain/dead-export/'])
    .map(item => `${item.path}:${item.name}`).sort();
  assert.deepEqual(dead, ['src/features/api/dead-export/index.ts:dead', 'src/modules/domain/dead-export/index.ts:unused']);
});

test('R25: a backend tree whose exports are all used reports no dead export', () => {
  assert.deepEqual(matching(reports.r25Shared, 'HFS_UNUSED_EXPORT', ['src/features/api/clean-export/', 'src/modules/domain/clean-export/']), []);
});

// ---- HFS_UNUSED_FILE (R25 b) --------------------------------------------------------------------------------------

test('R25: a file no root reaches is HFS_UNUSED_FILE, one only a spec imports too, a type-only import reaches', () => {
  const unused = matching(reports.r25Shared, 'HFS_UNUSED_FILE', ['src/modules/domain/unused-files/']);
  assert.deepEqual(unused.map(item => item.path).sort(), ['src/modules/domain/unused-files/orphan.ts', 'src/modules/domain/unused-files/spec-only.ts']);
  const hit = unused[0];
  assert.equal(hit.line, 1);
  assert.match(hit.message, /not reached from any root/);
  assert.equal(reports.r25Shared.coverage.hfsMachine.deadExports.unusedFiles, 2);
  assert.ok(reports.r25Shared.coverage.checkedRuleIds.includes('HFS_UNUSED_FILE'));
});

test('R25: a tree in which every file is reached from an app entry reports no unused file', () => {
  assert.deepEqual(matching(reports.r25Shared, 'HFS_UNUSED_FILE', ['src/modules/domain/all-reached/']), []);
});

test('R25: main.ts and app.module.ts are roots, an app file they do not reach is unused', () => {
  assert.deepEqual(paths(reports.r25Roots, 'HFS_UNUSED_FILE', ['apps/roots/']), ['apps/roots/src/stray.ts']);
});

test('R25: a package entry is a root and the file it does not reach is unused', () => {
  assert.deepEqual(paths(reports.r25Roots, 'HFS_UNUSED_FILE', ['packages/shared/']), ['packages/shared/src/orphan.ts']);
});

test('R25 FE: route files are roots, a component nothing imports is unused, a file a framework config names by string is reached', () => {
  assert.deepEqual(paths(reports.frontend, 'HFS_UNUSED_FILE', ['apps/web/']), ['apps/web/src/components/leaves/Dead/index.tsx']);
  assert.deepEqual(paths(reports.frontend, 'HFS_UNUSED_FILE', ['apps/web-unnamed/']), ['apps/web-unnamed/src/components/leaves/Dead/index.tsx', 'apps/web-unnamed/src/modules/i18n/request.ts']);
});

// ---- HFS_DUPLICATE_SYMBOL (R21) -----------------------------------------------------------------------------------

test('R21: a public name that another file also declares and exports is HFS_DUPLICATE_SYMBOL, in both directions', () => {
  const hits = matching(reports.r21Backend, 'HFS_DUPLICATE_SYMBOL', ['src/modules/domain/dup-x/', 'src/modules/domain/dup-y/']);
  assert.deepEqual(hits.map(item => item.path).sort(), ['src/modules/domain/dup-x/x.decorators.ts', 'src/modules/domain/dup-y/y.decorators.ts']);
  assert.ok(hits.every(item => item.name === 'InjectPrimaryEntityManager'));
  assert.ok(hits[0].otherDeclarations.length === 1);
  assert.match(hits[0].message, /one name, one declaration/);
  assert.ok(reports.r21Backend.coverage.checkedRuleIds.includes('HFS_DUPLICATE_SYMBOL'));
});

test('R21: a function, a type and an enum declared again under a public name are duplicates whatever their kind', () => {
  assert.deepEqual(names(reports.r21Backend, 'HFS_DUPLICATE_SYMBOL', ['src/modules/domain/kinds/']), ['Kind', 'Shape', 'used']);
});

test('R21: a re-export of one declaration, a private local of the same name and a default export are not duplicates', () => {
  assert.deepEqual(matching(reports.r21Backend, 'HFS_DUPLICATE_SYMBOL', ['src/modules/domain/clean-']), []);
});

test('R21 FE: a hook exported by one domain and declared again in another owner is a duplicate', () => {
  assert.deepEqual(paths(reports.frontend, 'HFS_DUPLICATE_SYMBOL', ['apps/hooks/']), ['apps/hooks/src/hooks/cart/useThing.ts']);
});

// ---- HFS_ALIAS_REEXPORT (R30) -------------------------------------------------------------------------------------

test('R30: every alias re-export form is HFS_ALIAS_REEXPORT, a plain re-export and a spec are not', () => {
  const hits = matching(reports.r30Backend, 'HFS_ALIAS_REEXPORT', ['src/modules/domain/alias-forms/']);
  assert.deepEqual(hits.map(item => item.name).sort(), ['Contract', 'Thing', 'ns', 'other', 'renamed']);
  assert.ok(hits.every(item => item.path === 'src/modules/domain/alias-forms/index.ts' && item.line > 0));
  assert.ok(reports.r30Backend.coverage.checkedRuleIds.includes('HFS_ALIAS_REEXPORT'));
});

test('R30: names exported by their own declaration and an explicit same-name specifier are clean', () => {
  assert.deepEqual(matching(reports.r30Backend, 'HFS_ALIAS_REEXPORT', ['src/modules/domain/clean-reexport/']), []);
});

test('R30 FE: an alias re-export is refused in the frontend profile too', () => {
  assert.deepEqual(names(reports.frontend, 'HFS_ALIAS_REEXPORT', ['apps/direct-alias/']), ['setting']);
});

test('R30: an exported const, type or interface that only renames another declaration of the repository is HFS_ALIAS_REEXPORT', () => {
  const hits = matching(reports.r30Backend, 'HFS_ALIAS_REEXPORT', ['src/modules/domain/alias-declarations/']);
  assert.deepEqual(hits.map(item => `${item.name}=${item.aliasOf}`).sort(), ['Bound=helper', 'ConfigAlias=Config', 'Moved=helper', 'Ns=Mode', 'Optioned=Options', 'Renamed=Original', 'Shaped=Shape']);
  assert.ok(hits.every(item => item.path === 'src/modules/domain/alias-declarations/aliases.ts' && item.line > 0));
});

test('R30: a const with a real initializer, a member that is data, a generic or bodied type and a package type are not aliases', () => {
  assert.deepEqual(matching(reports.r30Backend, 'HFS_ALIAS_REEXPORT', ['src/modules/domain/nonaliases/']), []);
});

test('R30 FE: an exported const or type renaming another repository declaration is refused in the frontend profile too', () => {
  assert.deepEqual(names(reports.frontend, 'HFS_ALIAS_REEXPORT', ['apps/declaration-alias/']), ['Label', 'Renamed']);
});
