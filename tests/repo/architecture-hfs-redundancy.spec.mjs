import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from '../helpers/hfs-arch-fixture.mjs';

// HFS check 4 and 5 (R21, R25, R30): dead code is an error in every gate (HFS_UNUSED_EXPORT, HFS_UNUSED_FILE), one name has one
// declaration (HFS_DUPLICATE_SYMBOL) and a declaration has one name (HFS_ALIAS_REEXPORT). Each rule has a tree that fires and a
// tree that stays clean; the backend profile and the frontend profile are both judged.

const paths = (report, ruleId) => findings(report, ruleId).map(item => item.path).sort();
const names = (report, ruleId) => findings(report, ruleId).map(item => item.name).sort();

const composed = {
  'apps/core/src/app.module.ts': "import { a } from '../../../src/features/a';\nexport const AppModule = [a];\n",
  'src/features/a/index.ts': "import { used } from '../../modules/domain/x';\nexport const a = [used];\n",
};

// ---- HFS_UNUSED_EXPORT on the backend owner entries (R25 a) -------------------------------------------------------

test('R25: a backend feature and a backend domain entry both report an export nobody outside imports', t => {
  const root = archFixture(t, {
    files: {
      'apps/core/src/app.module.ts': "import { a, b } from '../../../src/features/a';\nexport const AppModule = [a, b];\n",
      'src/features/a/index.ts': "import { used } from '../../modules/domain/x';\nexport const a = [used];\nexport const b = 1;\nexport const dead = 2;\n",
      'src/modules/domain/x/index.ts': 'export const used = 1;\nexport const unused = 2;\n',
    },
  });
  const report = runArch(root);
  const dead = findings(report, 'HFS_UNUSED_EXPORT').map(item => `${item.path}:${item.name}`).sort();
  assert.deepEqual(dead, ['src/features/a/index.ts:dead', 'src/modules/domain/x/index.ts:unused']);
});

test('R25: a backend tree whose exports are all used reports no dead export', t => {
  const root = archFixture(t, {
    files: {
      'apps/core/src/app.module.ts': "import { a } from '../../../src/features/a';\nexport const AppModule = [a];\n",
      'src/features/a/index.ts': "import { used } from '../../modules/domain/x';\nexport const a = [used];\n",
      'src/modules/domain/x/index.ts': 'export const used = 1;\n',
    },
  });
  assert.deepEqual(findings(runArch(root), 'HFS_UNUSED_EXPORT'), []);
});

// ---- HFS_UNUSED_FILE (R25 b) --------------------------------------------------------------------------------------

test('R25: a file no root reaches is HFS_UNUSED_FILE, one only a spec imports too, a type-only import reaches', t => {
  const root = archFixture(t, {
    files: {
      ...composed,
      'src/modules/domain/x/index.ts': "export { used } from './used';\n",
      'src/modules/domain/x/used.ts': "import type { Shape } from './shape';\nexport const used: Shape = 1;\n",
      'src/modules/domain/x/shape.ts': 'export type Shape = number;\n',
      'src/modules/domain/x/orphan.ts': 'export const orphan = 1;\n',
      'src/modules/domain/x/spec-only.ts': 'export const specOnly = 1;\n',
      'src/modules/domain/x/spec-only.spec.ts': "import { specOnly } from './spec-only';\nvoid specOnly;\n",
    },
  });
  const report = runArch(root);
  assert.deepEqual(paths(report, 'HFS_UNUSED_FILE'), ['src/modules/domain/x/orphan.ts', 'src/modules/domain/x/spec-only.ts']);
  const hit = findings(report, 'HFS_UNUSED_FILE')[0];
  assert.equal(hit.line, 1);
  assert.match(hit.message, /not reached from any root/);
  assert.equal(report.coverage.hfsMachine.deadExports.unusedFiles, 2);
  assert.ok(report.coverage.checkedRuleIds.includes('HFS_UNUSED_FILE'));
});

test('R25: a tree in which every file is reached from an app entry reports no unused file', t => {
  const root = archFixture(t, {
    files: {
      ...composed,
      'src/modules/domain/x/index.ts': "export { used } from './used';\n",
      'src/modules/domain/x/used.ts': "import type { Shape } from './shape';\nexport const used: Shape = 1;\n",
      'src/modules/domain/x/shape.ts': 'export type Shape = number;\n',
    },
  });
  assert.deepEqual(findings(runArch(root), 'HFS_UNUSED_FILE'), []);
});

test('R25: main.ts and app.module.ts are roots, an app file they do not reach is unused', t => {
  const root = archFixture(t, {
    files: {
      'apps/core/src/main.ts': "import { boot } from './boot';\nboot();\n",
      'apps/core/src/boot.ts': 'export const boot = () => 1;\n',
      'apps/core/src/stray.ts': 'export const stray = 1;\n',
    },
  });
  assert.deepEqual(paths(runArch(root), 'HFS_UNUSED_FILE'), ['apps/core/src/stray.ts']);
});

test('R25: a package entry is a root and the file it does not reach is unused', t => {
  const root = archFixture(t, {
    files: {
      'tsconfig.json': `${JSON.stringify({
        compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', allowJs: true, skipLibCheck: true, noEmit: true },
        include: ['src/**/*', 'apps/**/*', 'packages/**/*'],
      })}\n`,
      'packages/shared/package.json': JSON.stringify({ name: '@fixture/shared', private: true }),
      'packages/shared/src/index.ts': "export { used } from './used';\n",
      'packages/shared/src/used.ts': 'export const used = 1;\n',
      'packages/shared/src/orphan.ts': 'export const orphan = 1;\n',
    },
  });
  assert.deepEqual(paths(runArch(root), 'HFS_UNUSED_FILE'), ['packages/shared/src/orphan.ts']);
});

test('R25 FE: route files are roots, a component nothing imports is unused, a file a framework config names by string is reached', t => {
  const files = {
    'apps/web/src/app/[locale]/page.tsx': "import { Page } from '../../features/pages/Home';\nexport default Page;\n",
    'apps/web/src/features/pages/Home/index.tsx': "import { Btn } from '../../../components/leaves/Btn';\nexport const Page = Btn;\n",
    'apps/web/src/components/leaves/Btn/index.tsx': 'export const Btn = 1;\n',
    'apps/web/src/components/leaves/Dead/index.tsx': 'export const Dead = 1;\n',
    'apps/web/src/modules/i18n/request.ts': 'export default {};\n',
    'apps/web/next.config.ts': "const request = './src/modules/i18n/request.ts';\nexport default { request };\n",
  };
  const report = runArch(archFixture(t, { profile: 'fe', files }));
  assert.deepEqual(paths(report, 'HFS_UNUSED_FILE'), ['apps/web/src/components/leaves/Dead/index.tsx']);
  const unnamed = runArch(archFixture(t, { profile: 'fe', files: { ...files, 'apps/web/next.config.ts': 'export default {};\n' } }));
  assert.deepEqual(paths(unnamed, 'HFS_UNUSED_FILE'), ['apps/web/src/components/leaves/Dead/index.tsx', 'apps/web/src/modules/i18n/request.ts']);
});

// ---- HFS_DUPLICATE_SYMBOL (R21) -----------------------------------------------------------------------------------

test('R21: a public name that another file also declares and exports is HFS_DUPLICATE_SYMBOL, in both directions', t => {
  const root = archFixture(t, {
    files: {
      ...composed,
      'src/modules/domain/x/index.ts': "export { InjectPrimaryEntityManager } from './x.decorators';\nexport { used } from './used';\n",
      'src/modules/domain/x/x.decorators.ts': 'export const InjectPrimaryEntityManager = () => 1;\n',
      'src/modules/domain/x/used.ts': 'export const used = 1;\n',
      'src/modules/domain/y/index.ts': "export { InjectPrimaryEntityManager } from './y.decorators';\n",
      'src/modules/domain/y/y.decorators.ts': 'export const InjectPrimaryEntityManager = () => 2;\n',
    },
  });
  const report = runArch(root);
  const hits = findings(report, 'HFS_DUPLICATE_SYMBOL');
  assert.deepEqual(hits.map(item => item.path).sort(), ['src/modules/domain/x/x.decorators.ts', 'src/modules/domain/y/y.decorators.ts']);
  assert.ok(hits.every(item => item.name === 'InjectPrimaryEntityManager'));
  assert.ok(hits[0].otherDeclarations.length === 1);
  assert.match(hits[0].message, /one name, one declaration/);
  assert.ok(report.coverage.checkedRuleIds.includes('HFS_DUPLICATE_SYMBOL'));
});

test('R21: a function, a type and an enum declared again under a public name are duplicates whatever their kind', t => {
  const root = archFixture(t, {
    files: {
      ...composed,
      'src/modules/domain/x/index.ts': "export { used } from './used';\nexport type { Shape } from './shape';\nexport { Kind } from './kind';\n",
      'src/modules/domain/x/used.ts': 'export const used = 1;\n',
      'src/modules/domain/x/shape.ts': 'export interface Shape { a: number }\n',
      'src/modules/domain/x/kind.ts': "export enum Kind { A = 'a' }\n",
      'src/modules/domain/z/private.ts': 'export function used() { return 2; }\nexport type Shape = string;\nexport class Kind {}\n',
    },
  });
  const report = runArch(root);
  assert.deepEqual(names(report, 'HFS_DUPLICATE_SYMBOL'), ['Kind', 'Shape', 'used']);
});

test('R21: a re-export of one declaration, a private local of the same name and a default export are not duplicates', t => {
  const root = archFixture(t, {
    files: {
      ...composed,
      'src/modules/domain/x/index.ts': "export { used } from './used';\n",
      'src/modules/domain/x/used.ts': 'export const used = 1;\n',
      'src/modules/domain/y/index.ts': "export { used } from '../x';\n",
      'src/modules/domain/z/local.ts': 'const used = 2;\nexport default used;\n',
      'src/modules/domain/w/local.ts': 'export default 3;\n',
    },
  });
  assert.deepEqual(findings(runArch(root), 'HFS_DUPLICATE_SYMBOL'), []);
});

test('R21 FE: a hook exported by one domain and declared again in another owner is a duplicate', t => {
  const root = archFixture(t, {
    profile: 'fe',
    files: {
      'apps/web/src/hooks/cart/index.ts': "export { useThing } from './useThing';\n",
      'apps/web/src/hooks/cart/useThing.ts': 'export const useThing = () => 1;\n',
      'apps/web/src/hooks/orders/useThing.ts': 'export const useThing = () => 2;\n',
    },
  });
  assert.deepEqual(paths(runArch(root), 'HFS_DUPLICATE_SYMBOL'), ['apps/web/src/hooks/cart/useThing.ts']);
});

// ---- HFS_ALIAS_REEXPORT (R30) -------------------------------------------------------------------------------------

test('R30: every alias re-export form is HFS_ALIAS_REEXPORT, a plain re-export and a spec are not', t => {
  const root = archFixture(t, {
    files: {
      ...composed,
      'src/modules/domain/x/index.ts': [
        "export { inner as renamed } from './inner';",
        "export { default as Thing } from './thing';",
        "export * as ns from './ns';",
        "export type { Shape as Contract } from './shape';",
        "export { plain } from './plain';",
        "import { local } from './local';",
        'export { local as other };',
        '',
      ].join('\n'),
      'src/modules/domain/x/inner.ts': 'export const inner = 1;\n',
      'src/modules/domain/x/thing.ts': 'export default 1;\n',
      'src/modules/domain/x/ns.ts': 'export const one = 1;\n',
      'src/modules/domain/x/shape.ts': 'export type Shape = number;\n',
      'src/modules/domain/x/plain.ts': 'export const plain = 1;\n',
      'src/modules/domain/x/local.ts': 'export const local = 1;\n',
      'src/modules/domain/x/alias.spec.ts': "export { plain as fromSpec } from './plain';\n",
    },
  });
  const report = runArch(root);
  const hits = findings(report, 'HFS_ALIAS_REEXPORT');
  assert.deepEqual(hits.map(item => item.name).sort(), ['Contract', 'Thing', 'ns', 'other', 'renamed']);
  assert.ok(hits.every(item => item.path === 'src/modules/domain/x/index.ts' && item.line > 0));
  assert.ok(report.coverage.checkedRuleIds.includes('HFS_ALIAS_REEXPORT'));
});

test('R30: names exported by their own declaration and an explicit same-name specifier are clean', t => {
  const root = archFixture(t, {
    files: {
      ...composed,
      'src/modules/domain/x/index.ts': "export { used } from './used';\nexport { same as same } from './same';\n",
      'src/modules/domain/x/used.ts': 'export const used = 1;\n',
      'src/modules/domain/x/same.ts': 'export const same = 1;\n',
    },
  });
  assert.deepEqual(findings(runArch(root), 'HFS_ALIAS_REEXPORT'), []);
});

test('R30 FE: an alias re-export is refused in the frontend profile too', t => {
  const root = archFixture(t, {
    profile: 'fe',
    files: {
      'apps/web/src/modules/config/index.ts': "export { value as setting } from './value';\n",
      'apps/web/src/modules/config/value.ts': 'export const value = 1;\n',
    },
  });
  assert.deepEqual(names(runArch(root), 'HFS_ALIAS_REEXPORT'), ['setting']);
});

test('R30: an exported const, type or interface that only renames another declaration of the repository is HFS_ALIAS_REEXPORT', t => {
  const root = archFixture(t, {
    files: {
      ...composed,
      'src/modules/domain/x/index.ts': "export { used } from './used';\nexport { Original, Mode, helper, Options, Shape, Config } from './original';\nexport { Renamed, Moved, Bound, Optioned, Shaped, ConfigAlias, Ns } from './aliases';\n",
      'src/modules/domain/x/used.ts': 'export const used = 1;\n',
      'src/modules/domain/x/original.ts': [
        'export class Original {}',
        'export enum Mode { On }',
        'export function helper(): number { return 1; }',
        'export interface Options { flag: boolean }',
        'export type Shape = { width: number };',
        'export const Config = { url: "u" };',
        '',
      ].join('\n'),
      'src/modules/domain/x/aliases.ts': [
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
    },
  });
  const report = runArch(root);
  const hits = findings(report, 'HFS_ALIAS_REEXPORT');
  assert.deepEqual(hits.map(item => `${item.name}=${item.aliasOf}`).sort(), ['Bound=helper', 'ConfigAlias=Config', 'Moved=helper', 'Ns=Mode', 'Optioned=Options', 'Renamed=Original', 'Shaped=Shape']);
  assert.ok(hits.every(item => item.path === 'src/modules/domain/x/aliases.ts' && item.line > 0));
});

test('R30: a const with a real initializer, a member that is data, a generic or bodied type and a package type are not aliases', t => {
  const root = archFixture(t, {
    files: {
      ...composed,
      'src/modules/domain/x/index.ts': "export { used } from './used';\nexport { Base, Settings, limit } from './base';\nexport { Limit, Extended, Boxed, Wrapped, Packaged, Copy } from './fine';\n",
      'src/modules/domain/x/used.ts': 'export const used = 1;\n',
      'src/modules/domain/x/base.ts': 'export interface Base { id: string }\nexport const Settings = { limit: 3 };\nexport const limit = 4;\n',
      'src/modules/domain/x/fine.ts': [
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
  });
  assert.deepEqual(findings(runArch(root), 'HFS_ALIAS_REEXPORT'), []);
});

test('R30 FE: an exported const or type renaming another repository declaration is refused in the frontend profile too', t => {
  const root = archFixture(t, {
    profile: 'fe',
    files: {
      'apps/web/src/modules/config/index.ts': "export { value, Shape, Renamed, Label } from './config';\n",
      'apps/web/src/modules/config/value.ts': 'export const value = 1;\nexport interface Shape { width: number }\n',
      'apps/web/src/modules/config/config.ts': "import { value, Shape } from './value';\nexport { value, Shape };\nexport const Renamed = value;\nexport type Label = Shape;\n",
    },
  });
  assert.deepEqual(names(runArch(root), 'HFS_ALIAS_REEXPORT'), ['Label', 'Renamed']);
});
