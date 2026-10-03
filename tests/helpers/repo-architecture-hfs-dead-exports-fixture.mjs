import { archFixture, runArch } from './hfs-arch-fixture.mjs';

const scenario = (x, extra = {}) => Object.freeze({ x: `src/modules/domain/${x}/index.ts`, ...extra });

export const DEAD_EXPORT_SCENARIOS = Object.freeze({
  lineAndOwner: scenario('dead-line'),
  aliasAndOwner: scenario('alias-owner'),
  namespace: scenario('namespace-use'),
  dynamic: scenario('dynamic-use'),
  typeOnly: scenario('type-only-use'),
  defaultExport: scenario('default-used', { deadX: 'src/modules/domain/default-dead/index.ts' }),
  reexportUsed: scenario('reexport-used-source', { y: 'src/modules/domain/reexport-used-owner/index.ts' }),
  reexportDead: scenario('reexport-dead-source', { y: 'src/modules/domain/reexport-dead-owner/index.ts' }),
  specOnly: scenario('spec-only-use'),
  roleConsumers: scenario('role-consumers'),
  otherSpec: scenario('other-spec'),
  cliAndWorld: scenario('cli-world'),
  doorSpec: scenario('door-spec'),
});

const roleConsumerFiles = (name, extra = {}) => ({
  [`src/modules/domain/${name}/index.ts`]: 'export const TOKEN = 1;\nexport type Params = { a: number };\nexport const nobody = 2;\nexport const onlyE2e = 3;\n',
  [`src/features/api/${name}/${name}.service.spec.ts`]: `import { TOKEN } from '../../../modules/domain/${name}';\nit('uses', () => { expect(TOKEN).toBe(1); });\n`,
  [`src/tests/fixtures/builders/${name}.builder.ts`]: `import type { Params } from '../../../modules/domain/${name}';\nexport const build = (): Params => ({ a: 1 });\n`,
  [`src/tests/e2e/${name}/${name}.e2e-spec.ts`]: `import { onlyE2e } from '../../../modules/domain/${name}';\nit('uses', () => { expect(onlyE2e).toBe(3); });\n`,
  ...extra,
});

// One immutable repository lets the real architecture entry parse and build its export/import graph once. Each scenario has
// its own owner and consumer folders, so every assertion remains path-local and tests are independent of execution order.
const FILES = {
  'apps/core/src/app.module.ts': 'export const AppModule = 1;\nexport const extra = 2;\n',

  'src/modules/domain/dead-line/index.ts': 'export const used = 1;\nexport const unused = 2;\nexport function alsoUnused() { return 3; }\n',
  'src/features/api/dead-line/index.ts': "import { used } from '../../../modules/domain/dead-line';\nexport const deadLine = used;\n",

  'src/modules/domain/alias-owner/index.ts': "import { inner } from './inner';\nexport { inner as renamed };\nexport const local = 1;\n",
  'src/modules/domain/alias-owner/inner.ts': "import { local } from './index';\nexport const inner = local;\n",
  'src/features/api/alias-owner/index.ts': "import { renamed as r } from '../../../modules/domain/alias-owner';\nexport const aliasOwner = r;\n",

  'src/modules/domain/namespace-use/index.ts': 'export const one = 1;\nexport const two = 2;\n',
  'src/features/api/namespace-use/index.ts': "import * as value from '../../../modules/domain/namespace-use';\nexport const namespaceUse = value;\n",

  'src/modules/domain/dynamic-use/index.ts': 'export const one = 1;\nexport const two = 2;\n',
  'src/features/api/dynamic-use/index.ts': "export const dynamicUse = () => import('../../../modules/domain/dynamic-use');\n",

  'src/modules/domain/type-only-use/index.ts': 'export type Shape = { a: number };\nexport type Other = string;\n',
  'src/features/api/type-only-use/index.ts': "import type { Shape } from '../../../modules/domain/type-only-use';\nexport const typeOnlyUse: Shape = { a: 1 };\n",

  'src/modules/domain/default-used/index.ts': 'export default 1;\n',
  'src/features/api/default-used/index.ts': "import one from '../../../modules/domain/default-used';\nexport const defaultUsed = one;\n",
  'src/modules/domain/default-dead/index.ts': 'export default 1;\nexport const named = 2;\n',
  'src/features/api/default-dead/index.ts': "import { named } from '../../../modules/domain/default-dead';\nexport const defaultDead = named;\n",

  'src/modules/domain/reexport-used-source/index.ts': 'export const helper = 1;\nexport const other = 2;\n',
  'src/modules/domain/reexport-used-owner/index.ts': "export { helper } from '../reexport-used-source';\nexport { other } from '../reexport-used-source';\n",
  'src/features/api/reexport-used/index.ts': "import { helper } from '../../../modules/domain/reexport-used-owner';\nexport const reexportUsed = helper;\n",

  'src/modules/domain/reexport-dead-source/index.ts': 'export const helper = 1;\n',
  'src/modules/domain/reexport-dead-owner/index.ts': "export { helper } from '../reexport-dead-source';\n",

  'src/modules/domain/spec-only-use/index.ts': 'export const onlySpec = 1;\n',
  'src/features/api/spec-only-use/index.ts': 'export const specOnlyUse = 1;\n',
  'src/features/api/spec-only-use/spec-only-use.spec.ts': "import { onlySpec } from '../../../modules/domain/spec-only-use';\nvoid onlySpec;\n",

  ...roleConsumerFiles('role-consumers'),
  ...roleConsumerFiles('other-spec', {
    'src/features/api/other-spec/other-spec.handler.spec.ts': "import { nobody } from '../../modules/domain/other-spec';\nit('uses', () => { expect(nobody).toBe(2); });\n",
  }),
  ...roleConsumerFiles('cli-world', {
    'src/modules/domain/cli-world/index.ts': 'export const TOKEN = 1;\nexport type Params = { a: number };\nexport const nobody = 2;\nexport const onlyE2e = 3;\nexport const SOURCE = 4;\nexport const openSource = () => 5;\n',
    'src/features/cli/migrate-cli-world/subs/run.cli.spec.ts': "import { SOURCE } from '../../../../modules/domain/cli-world';\nit('uses', () => { expect(SOURCE).toBe(4); });\n",
    'src/tests/world/test-world.config.ts': "import { openSource } from '../../modules/domain/cli-world';\nexport const open = openSource;\n",
  }),
  ...roleConsumerFiles('door-spec', {
    'src/features/webhooks/door-spec/transport/http/door-spec.webhook.spec.ts': "import { nobody } from '../../../../../modules/domain/door-spec';\nit('uses', () => { expect(nobody).toBe(2); });\n",
  }),
};

export function deadExportsFixture(registerCleanup) {
  const root = archFixture({ after: registerCleanup }, { files: FILES });
  return Object.freeze({ report: runArch(root), scenarios: DEAD_EXPORT_SCENARIOS });
}
