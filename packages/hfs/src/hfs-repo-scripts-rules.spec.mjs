// BE_INTEGRATION_SPEC_MISSING (R112): every back-end integration (src/modules/integrations/<provider>/ holding <provider>.config.ts)
// has an integration spec that registers its module, references its ErrorCode enum and drives an outage through the test world.
// Restored from tests/hfs/hfs-repo-scripts-rules.spec.mjs and run against the bundled checker; the rule is judged in the full edition.
// proves: BE_INTEGRATION_SPEC_MISSING@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { integrationSpecFindings } from '../runtime/scripts/hfs/rules/integration-specs.mjs';

const CODE = 'BE_INTEGRATION_SPEC_MISSING';
const PAY = 'be/src/modules/integrations/pay';
const PAY_SPEC = 'be/src/tests/integration/pay/pay-client.integration-spec.ts';
const MODULE = 'export class PayModule {\n  static register(options: object): object {\n    return options;\n  }\n}\n';

const payIntegration = (extra = {}) => ({
  [`${PAY}/pay.config.ts`]: 'export const parsePayConfig = (): { readonly url: string } => ({ url: "x" });\n',
  [`${PAY}/errors/pay.error.ts`]: "export enum PayErrorCode {\n  Refused = 'PAY_REFUSED',\n}\nexport const PAY_ERROR_KINDS = { [PayErrorCode.Refused]: 'invalid' };\n",
  [`${PAY}/pay.module.ts`]: MODULE,
  [`${PAY}/index.ts`]: "export { PAY_ERROR_KINDS, PayErrorCode } from './errors/pay.error';\nexport { PayModule } from './pay.module';\n",
  ...extra,
});

const specText = ({ modules, refusal = 'await expect(Promise.reject({ code: PayErrorCode.Refused })).rejects.toMatchObject({ code: PayErrorCode.Refused })', outage = 'await world.fake.pay.failNext({ status: 500 })', head = '' }) => [
  "import { PayErrorCode, PayModule } from '../../../modules/integrations/pay';",
  "import { useTestWorld } from '../../world/use-test-world';",
  head,
  "describe('pay', () => {",
  `  const world = useTestWorld({ modules: ${modules} });`,
  "  it('refuses and survives an outage', async () => {",
  `    ${refusal};`,
  `    ${outage};`,
  '  });',
  '});',
  '',
].join('\n');

const IMPORT_FROM_INTEGRATION = "import { PayErrorCode, PayModule } from '../../../modules/integrations/pay';";

/** The findings of a temp back end holding `files`, judged in `edition`. */
function judge(t, edition, files) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-integration-specs-'));
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(repoRoot, file)), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, file), text);
  }
  return integrationSpecFindings({ repoRoot, files: Object.keys(files), repo: { edition } }).filter((finding) => finding.code === CODE);
}

const missingOf = (found) => found.map((finding) => finding.missing);

test('BE_INTEGRATION_SPEC_MISSING full: an integration without an integration spec is a violation on its folder', (t) => {
  const found = judge(t, 'full', payIntegration());
  assert.deepEqual(found.map((finding) => [finding.path, finding.provider, finding.missing]), [[`${PAY}/`, 'pay', ['spec']]]);
});

test('BE_INTEGRATION_SPEC_MISSING full: a spec that does not register the integration module, by origin and not by name, is refused', (t) => {
  const local = specText({ modules: '[() => PayModule.register({})]' })
    .replace(IMPORT_FROM_INTEGRATION, "import { PayErrorCode } from '../../../modules/integrations/pay';\nclass PayModule { static register(o: object): object { return o; } }");
  assert.deepEqual(missingOf(judge(t, 'full', payIntegration({ [PAY_SPEC]: local }))), [['modules']]);
  const other = specText({ modules: '[() => OtherModule.register({})]', head: "import { OtherModule } from '../../../modules/platform/other';" });
  assert.deepEqual(missingOf(judge(t, 'full', payIntegration({ [PAY_SPEC]: other, 'be/src/modules/platform/other/index.ts': 'export class OtherModule { static register(o: object): object { return o; } }\n' }))), [['modules']]);
});

test('BE_INTEGRATION_SPEC_MISSING full: a spec with no ErrorCode enum reference or no world outage is refused, naming what it lacks', (t) => {
  const noEnum = specText({ modules: '[() => PayModule.register({})]', refusal: 'expect(PayModule).toBeDefined()' });
  assert.deepEqual(missingOf(judge(t, 'full', payIntegration({ [PAY_SPEC]: noEnum }))), [['errorCode']]);
  const readOnly = specText({ modules: '[() => PayModule.register({})]', outage: 'await world.infra.redis.size()' });
  assert.deepEqual(missingOf(judge(t, 'full', payIntegration({ [PAY_SPEC]: readOnly }))), [['outage']]);
});

test('BE_INTEGRATION_SPEC_MISSING full: a correct pair passes, inline or through an exported factory list of another file', (t) => {
  assert.deepEqual(judge(t, 'full', payIntegration({ [PAY_SPEC]: specText({ modules: '[() => PayModule.register({})]' }) })), []);
  const viaList = specText({ modules: 'PAY_MODULES', head: "import { PAY_MODULES } from '../../world/test-capabilities.options';" })
    .replace(IMPORT_FROM_INTEGRATION, "import { PayErrorCode } from '../../../modules/integrations/pay';")
    .replace('await world.fake.pay.failNext({ status: 500 })', 'await world.infra.postgresql.connection("primary").during(async () => undefined)');
  assert.deepEqual(judge(t, 'full', payIntegration({
    [PAY_SPEC]: viaList,
    'be/src/tests/world/test-capabilities.options.ts': "import { PayModule } from '../../modules/integrations/pay';\nconst BASE = [() => PayModule.register({ isGlobal: true })];\nexport const PAY_MODULES = [...BASE];\n",
  })), []);
  const peer = specText({ modules: '[() => PayModule.register({})]', outage: 'await world.apps.order.during(async () => undefined)' });
  assert.deepEqual(judge(t, 'full', payIntegration({ [PAY_SPEC]: peer })), []);
});

test('BE_INTEGRATION_SPEC_MISSING lite: the rule is judged in the full edition only, so an integration without a spec passes', (t) => {
  assert.deepEqual(judge(t, 'lite', payIntegration()), []);
});
