// The repository-hygiene tree checks of `starci app check` (scripts/hfs/rules): R102 BE_SPEC_PLACEMENT, R103 HFS_REPO_LOCAL_CHECK,
// R104 HFS_LINT_SUPPRESSION_FILE, R105 HFS_PROOF_COMMAND_FILE_MISSING, R111 HFS_PEER_INTEGRATION_MISSING, and the slot app.scripts that holds the app root `scripts/` folder.
// Each has a violating and a passing tree; the clean app of tests/helpers/hfs-cli-fixture.mjs is the passing base, checked at its root.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkRepo } from '../../scripts/hfs/check.mjs';
import { APP } from '../helpers/hfs-cli-fixture.mjs';
import { createHfsRepoScriptsRulesFixture } from '../helpers/hfs-hfs-repo-scripts-rules-fixture.mjs';

const { basePackage, dispose, put, repoOf } = createHfsRepoScriptsRulesFixture();
test.after(dispose);
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const only = (result, code) => result.findings.filter((f) => f.code === code);
const pathsOf = (result, code) => only(result, code).map((f) => f.path).sort();
const slotFindings = (result) => result.findings.filter((f) => f.code === 'HFS_SLOT_UNDECLARED' || f.code === 'HFS_FORBIDDEN_PRESENT');

// ------------------------------------------------------------------------------------------------ slot app.scripts

test('app.scripts: an empty folder holding only .gitkeep and an operational script are owned at the app root', () => {
  const result = checkRepo({ repoRoot: repoOf(APP, (dir) => {
    put(dir, 'scripts/.gitkeep', '');
    put(dir, 'scripts/rotate-logs.mjs', 'console.log("ok");\n');
    put(dir, 'scripts/cleanup.ps1', 'Write-Output ok\n');
    put(dir, 'scripts/warm.sh', 'echo ok\n');
  }) });
  assert.deepEqual(slotFindings(result).filter((f) => f.path.startsWith('scripts/')), []);
  assert.deepEqual(only(result, 'HFS_REPO_LOCAL_CHECK'), []);
});

test('app.scripts: a script of another kind (.ts) and a nested folder match no slot', () => {
  const result = checkRepo({ repoRoot: repoOf(APP, (dir) => {
    put(dir, 'scripts/codemod.ts');
    put(dir, 'scripts/seed/run.mjs');
  }) });
  assert.deepEqual(pathsOf(result, 'HFS_SLOT_UNDECLARED').filter((p) => p.startsWith('scripts/')), ['scripts/codemod.ts', 'scripts/seed/run.mjs']);
});

// ------------------------------------------------------------------------------------------------ R102 BE_SPEC_PLACEMENT

test('BE_SPEC_PLACEMENT: a spec in a be app, the app scripts/, be/tools/, beside a non-service file or under be/src/ elsewhere is refused', () => {
  const result = checkRepo({ repoRoot: repoOf(APP, (dir) => {
    put(dir, 'be/apps/core/src/core.composition.spec.ts');
    put(dir, 'scripts/x.spec.mjs');
    put(dir, 'scripts/probe.test.cjs');
    put(dir, 'be/tools/seed.spec.ts');
    put(dir, 'be/src/features/api/orders/application/place-order.spec.ts');
    put(dir, 'be/src/tests/misc/other.e2e-spec.ts');
  }) });
  assert.deepEqual(pathsOf(result, 'BE_SPEC_PLACEMENT'), ['be/apps/core/src/core.composition.spec.ts', 'be/src/features/api/orders/application/place-order.spec.ts', 'be/src/tests/misc/other.e2e-spec.ts', 'be/tools/seed.spec.ts', 'scripts/probe.test.cjs', 'scripts/x.spec.mjs']);
});

test('BE_SPEC_PLACEMENT: a service spec beside its service and the integration, e2e and contract layers are clean', () => {
  const result = checkRepo({ repoRoot: repoOf(APP, (dir) => {
    put(dir, 'be/src/modules/domain/billing/invoice.service.ts');
    put(dir, 'be/src/modules/domain/billing/invoice.service.spec.ts');
    put(dir, 'be/src/tests/integration/orders/claim.integration-spec.ts');
    put(dir, 'be/src/tests/e2e/orders/flow.e2e-spec.ts');
    put(dir, 'be/src/tests/contract/stripe/payments.contract-spec.ts');
    put(dir, 'scripts/rotate-logs.mjs');
  }) });
  assert.deepEqual(only(result, 'BE_SPEC_PLACEMENT'), []);
});

// ------------------------------------------------------------------------------------------------ R103 HFS_REPO_LOCAL_CHECK

test('HFS_REPO_LOCAL_CHECK: local rule sources, a check script and a script that runs a check are refused, at the root and in both sides', () => {
  const result = checkRepo({ repoRoot: repoOf(APP, (dir) => {
    put(dir, 'scripts/eslint-local-rules.mjs');
    put(dir, 'scripts/check-foo.mjs');
    put(dir, 'be/tools/check-bar.mjs');
    put(dir, 'fe/tools/check-baz.mjs');
    put(dir, 'be/eslint-plugin-local/index.mjs');
    put(dir, 'fe/eslint-plugin-local/index.mjs');
    put(dir, 'package.json', json({ name: 'demo', private: true, scripts: { 'lint:local': 'node scripts/check-foo.mjs', build: 'tsc' } }));
  }) });
  assert.deepEqual(pathsOf(result, 'HFS_REPO_LOCAL_CHECK'), ['be/eslint-plugin-local/index.mjs', 'be/tools/check-bar.mjs', 'fe/eslint-plugin-local/index.mjs', 'fe/tools/check-baz.mjs', 'package.json', 'scripts/check-foo.mjs', 'scripts/eslint-local-rules.mjs']);
});

test('HFS_REPO_LOCAL_CHECK: an operational script, an ordinary script and a script that runs no check are clean', () => {
  const result = checkRepo({ repoRoot: repoOf(APP, (dir) => {
    put(dir, 'scripts/rotate-logs.mjs');
    put(dir, 'package.json', json({ name: 'demo', private: true, scripts: { 'logs:rotate': 'node scripts/rotate-logs.mjs' } }));
  }) });
  assert.deepEqual(only(result, 'HFS_REPO_LOCAL_CHECK'), []);
});

// ------------------------------------------------------------------------------------------------ R104 HFS_LINT_SUPPRESSION_FILE

test('HFS_LINT_SUPPRESSION_FILE: a suppressions file, the lint:suppressions script, an eslint suppress flag and a suppressions config are refused, in either side', () => {
  for (const side of ['be', 'fe']) {
    const result = checkRepo({ repoRoot: repoOf(APP, (dir) => {
      put(dir, `${side}/eslint.suppressions.config.mjs`);
      put(dir, `${side}/eslint-suppressions.json`, '{}\n');
      put(dir, `${side}/eslint.config.mjs`, "export default [{ linterOptions: { suppressions: './eslint-suppressions.json' } }];\n");
      put(dir, 'package.json', json({ name: 'demo', private: true, scripts: { 'lint:suppressions': `node ${side}/eslint.suppressions.config.mjs`, lint: 'eslint --suppress-all .' } }));
    }) });
    assert.deepEqual(pathsOf(result, 'HFS_LINT_SUPPRESSION_FILE'), [`${side}/eslint-suppressions.json`, `${side}/eslint.config.mjs`, `${side}/eslint.suppressions.config.mjs`, 'package.json', 'package.json'], side);
  }
});

test('HFS_LINT_SUPPRESSION_FILE: plain eslint scripts and the standard config are clean', () => {
  const result = checkRepo({ repoRoot: repoOf(APP, (dir) => {
    put(dir, 'package.json', json({ name: 'demo', private: true, scripts: { lint: 'eslint --max-warnings=0 .', 'lint:fix': 'starci app lint --fix' } }));
  }) });
  assert.deepEqual(only(result, 'HFS_LINT_SUPPRESSION_FILE'), []);
});

// ------------------------------------------------------------------------------------------------ R105 HFS_PROOF_COMMAND_FILE_MISSING

const RECORD = (commands, repository) => `schema: work/implementation@1\nid: impl.demo.gate\nstate: todo\n${repository ? `repository: ${repository}\n` : ''}requiresProof:\n${Object.entries(commands).map(([kind, command]) => `  ${kind}:\n    required: true\n    command: ${JSON.stringify(command)}\n`).join('')}`;

test('HFS_PROOF_COMMAND_FILE_MISSING: a proof command that runs a deleted script or spec is refused, one finding per kind and path', () => {
  const result = checkRepo({ repoRoot: repoOf(APP, (dir) => {
    put(dir, '.starciwork/features/login/impl/demo/gate/index.yaml', RECORD({
      unit: 'node --test scripts/provision.spec.mjs',
      live: 'npm run test:e2e -- be/src/tests/e2e/login/gate.e2e-spec.ts',
    }));
  }) });
  const found = only(result, 'HFS_PROOF_COMMAND_FILE_MISSING');
  assert.deepEqual(found.map((f) => f.missing).sort(), ['be/src/tests/e2e/login/gate.e2e-spec.ts', 'scripts/provision.spec.mjs']);
  assert.deepEqual(found.map((f) => f.kind).sort(), ['live', 'unit']);
});

test('HFS_PROOF_COMMAND_FILE_MISSING: a command whose files exist, flags, globs, other repositories and build products are clean', () => {
  const result = checkRepo({ repoRoot: repoOf(APP, (dir) => {
    put(dir, 'be/src/tests/e2e/login/gate.e2e-spec.ts');
    put(dir, '.starciwork/features/login/impl/demo/gate/index.yaml', RECORD({
      e2e: 'npm run test:e2e -- be/src/tests/e2e/login/gate.e2e-spec.ts',
      implementation: 'node ../other/.claude/packages/cli/bin/starci.mjs runtime validate ../demo/.starciwork/features/login --strict --json',
      requirements: 'docker compose -f ../infra/compose.yaml build && node be/dist/apps/core/main.js --config "src/**/*.json" --port=3000',
    }));
  }) });
  assert.deepEqual(only(result, 'HFS_PROOF_COMMAND_FILE_MISSING'), []);
});

test('HFS_PROOF_COMMAND_FILE_MISSING: a record of the be or fe side is judged against the app root, where its proof command runs', () => {
  const result = checkRepo({ repoRoot: repoOf(APP, (dir) => {
    put(dir, 'be/src/tests/e2e/login/kept.e2e-spec.ts');
    put(dir, '.starciwork/features/login/impl/demo/gate/index.yaml', RECORD({ e2e: 'npm run test:e2e -- be/src/tests/e2e/login/gate.e2e-spec.ts' }, 'be'));
    put(dir, '.starciwork/features/login/impl/demo/kept/index.yaml', RECORD({ e2e: 'npm run test:e2e -- be/src/tests/e2e/login/kept.e2e-spec.ts' }, 'be'));
    put(dir, '.starciwork/features/login/impl/demo/page/index.yaml', RECORD({ typecheck: 'tsc -p fe/apps/gone/tsconfig.json --noEmit' }, 'fe'));
  }) });
  const found = only(result, 'HFS_PROOF_COMMAND_FILE_MISSING');
  assert.deepEqual(found.map((f) => [f.path, f.missing]).sort(), [
    ['.starciwork/features/login/impl/demo/gate/index.yaml', 'be/src/tests/e2e/login/gate.e2e-spec.ts'],
    ['.starciwork/features/login/impl/demo/page/index.yaml', 'fe/apps/gone/tsconfig.json'],
  ]);
});

test('HFS_PROOF_COMMAND_FILE_MISSING: a record of an implementation in another repository is not judged, its commands run there', () => {
  const result = checkRepo({ repoRoot: repoOf(APP, (dir) => {
    put(dir, '.starciwork/features/login/impl/other/gate/index.yaml', RECORD({ unit: 'npx vitest run apps/app/src/login.spec.ts' }, 'other-repo'));
  }) });
  assert.deepEqual(only(result, 'HFS_PROOF_COMMAND_FILE_MISSING'), []);
});

// ------------------------------------------------------------------------------------------------ R111 HFS_PEER_INTEGRATION_MISSING

const withDependencies = (dependencies, devDependencies = {}) => (dir) => {
  put(dir, 'package.json', json({ ...basePackage, dependencies: { ...(basePackage.dependencies ?? {}), ...dependencies }, devDependencies: { ...(basePackage.devDependencies ?? {}), ...devDependencies } }));
};
const APOLLO_ON_EXPRESS5 = { '@nestjs/apollo': '^13.4.5', '@nestjs/platform-express': '11.2.5' };

test('HFS_PEER_INTEGRATION_MISSING: @nestjs/apollo on @nestjs/platform-express 11 without @as-integrations/express5 is refused, and a devDependency does not count', () => {
  const missing = only(checkRepo({ repoRoot: repoOf(APP, withDependencies(APOLLO_ON_EXPRESS5)) }), 'HFS_PEER_INTEGRATION_MISSING');
  assert.deepEqual(missing.map((f) => [f.path, f.pair, f.requires]), [['package.json', 'nestjs-apollo-express5', '@as-integrations/express5']]);
  assert.match(missing[0].message, /@nestjs\/apollo \^13\.4\.5 with @nestjs\/platform-express 11\.2\.5/);
  const devOnly = only(checkRepo({ repoRoot: repoOf(APP, withDependencies(APOLLO_ON_EXPRESS5, { '@as-integrations/express5': '^1.1.2' })) }), 'HFS_PEER_INTEGRATION_MISSING');
  assert.equal(devOnly.length, 1);
  assert.match(devOnly[0].message, /only a devDependency/);
});

test('HFS_PEER_INTEGRATION_MISSING: the declared peer, another major of the driver, and an app without the integration are clean', () => {
  for (const dependencies of [
    { ...APOLLO_ON_EXPRESS5, '@as-integrations/express5': '^1.1.2' },
    { '@nestjs/apollo': '^12.0.0', '@nestjs/platform-express': '^10.4.0' },
    { '@nestjs/platform-express': '11.2.5' },
  ]) {
    assert.deepEqual(only(checkRepo({ repoRoot: repoOf(APP, withDependencies(dependencies)) }), 'HFS_PEER_INTEGRATION_MISSING'), [], JSON.stringify(dependencies));
  }
});

test('HFS_PEER_INTEGRATION_MISSING: the pair catalog is a starci/hfs-peer-integrations@1 document', async () => {
  const { createRequire } = await import('node:module');
  const { parseYaml } = await import('../../engine/yaml.mjs');
  const root = path.resolve(import.meta.dirname, '..', '..');
  const loaded = createRequire(path.join(root, 'package.json'))('ajv/dist/2020.js');
  const Ajv2020 = loaded?.default ?? loaded;
  // A starci/schema@1 document stamps its own kind and id beside the JSON Schema body.
  const { schema: kind, id, ...body } = parseYaml(fs.readFileSync(path.join(root, 'modules/schemas/hfs-peer-integrations.schema.yaml'), 'utf8'));
  assert.deepEqual([kind, id], ['starci/schema@1', 'starci/hfs-peer-integrations@1']);
  const validate = new Ajv2020({ strict: false, allErrors: true, logger: false }).compile(body);
  const catalog = parseYaml(fs.readFileSync(path.join(root, 'knowledge/hfs/peer-integrations.yaml'), 'utf8'));
  assert.equal(validate(catalog), true, JSON.stringify(validate.errors));
  assert.equal(validate({ ...catalog, pairs: [{ id: 'x', when: [], requires: 'y', why: 'z' }] }), false, 'a pair with no condition is refused');
});

// ------------------------------------------------------------------------------------------------ R112 BE_INTEGRATION_SPEC_MISSING

const PAY = 'be/src/modules/integrations/pay';
const withPayIntegration = (specs = {}) => (dir) => {
  put(dir, `${PAY}/pay.config.ts`, 'export const parsePayConfig = (): { readonly url: string } => ({ url: "x" });\n');
  put(dir, `${PAY}/errors/pay.error.ts`, "export enum PayErrorCode {\n  Refused = 'PAY_REFUSED',\n}\nexport const PAY_ERROR_KINDS = { [PayErrorCode.Refused]: 'invalid' };\n");
  put(dir, `${PAY}/pay.module.ts`, 'export class PayModule {\n  static register(options: object): object {\n    return options;\n  }\n}\n');
  put(dir, `${PAY}/index.ts`, "export { PAY_ERROR_KINDS, PayErrorCode } from './errors/pay.error';\nexport { PayModule } from './pay.module';\n");
  for (const [rel, text] of Object.entries(specs)) put(dir, rel, text);
};
const PAY_SPEC = 'be/src/tests/integration/pay/pay-client.integration-spec.ts';
const specText = ({ modules, refusal = "await expect(Promise.reject({ code: PayErrorCode.Refused })).rejects.toMatchObject({ code: PayErrorCode.Refused })", outage = "await world.fake.pay.failNext({ status: 500 })", head = '' }) => [
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
const r112 = (mutate) => only(checkRepo({ repoRoot: repoOf(APP, mutate) }), 'BE_INTEGRATION_SPEC_MISSING');

test('BE_INTEGRATION_SPEC_MISSING: an integration without an integration spec is refused on its folder', () => {
  const findings = r112(withPayIntegration());
  assert.deepEqual(findings.map((f) => [f.path, f.provider, f.missing]), [[`${PAY}/`, 'pay', ['spec']]]);
});

test('BE_INTEGRATION_SPEC_MISSING: a spec that does not register the integration module, by origin not by name, is refused', () => {
  const local = specText({ modules: '[() => PayModule.register({})]' }).replace("import { PayErrorCode, PayModule } from '../../../modules/integrations/pay';", "import { PayErrorCode } from '../../../modules/integrations/pay';\nclass PayModule { static register(o: object): object { return o; } }");
  assert.deepEqual(r112(withPayIntegration({ [PAY_SPEC]: local })).map((f) => f.missing), [['modules']]);
  const other = specText({ modules: '[() => OtherModule.register({})]', head: "import { OtherModule } from '../../../modules/platform/other';" });
  assert.deepEqual(r112(withPayIntegration({ [PAY_SPEC]: other, 'be/src/modules/platform/other/index.ts': 'export class OtherModule { static register(o: object): object { return o; } }\n' })).map((f) => f.missing), [['modules']]);
});

test('BE_INTEGRATION_SPEC_MISSING: a spec with no ErrorCode enum reference or no world outage is refused, naming what it lacks', () => {
  const noEnum = specText({ modules: '[() => PayModule.register({})]', refusal: "expect(PayModule).toBeDefined()" });
  assert.deepEqual(r112(withPayIntegration({ [PAY_SPEC]: noEnum })).map((f) => f.missing), [['errorCode']]);
  const readOnly = specText({ modules: '[() => PayModule.register({})]', outage: 'await world.infra.redis.size()' });
  assert.deepEqual(r112(withPayIntegration({ [PAY_SPEC]: readOnly })).map((f) => f.missing), [['outage']]);
});

test('BE_INTEGRATION_SPEC_MISSING: a correct pair passes, inline or through an exported factory list of another file', () => {
  assert.deepEqual(r112(withPayIntegration({ [PAY_SPEC]: specText({ modules: '[() => PayModule.register({})]' }) })), []);
  const viaList = specText({ modules: 'PAY_MODULES', head: "import { PAY_MODULES } from '../../world/test-capabilities.options';" }).replace("import { PayErrorCode, PayModule } from '../../../modules/integrations/pay';", "import { PayErrorCode } from '../../../modules/integrations/pay';");
  assert.deepEqual(r112(withPayIntegration({
    [PAY_SPEC]: viaList.replace('await world.fake.pay.failNext({ status: 500 })', 'await world.infra.postgresql.connection("primary").during(async () => undefined)'),
    'be/src/tests/world/test-capabilities.options.ts': "import { PayModule } from '../../modules/integrations/pay';\nconst BASE = [() => PayModule.register({ isGlobal: true })];\nexport const PAY_MODULES = [...BASE];\n",
  })), []);
  const peer = specText({ modules: '[() => PayModule.register({})]', outage: 'await world.apps.order.during(async () => undefined)' });
  assert.deepEqual(r112(withPayIntegration({ [PAY_SPEC]: peer })), []);
});

// ------------------------------------------------------------------------------------------------ R113 FE_GRAPHQL_CONTRACT

const SHOP_CONTRACT = `"""The shop service."""
scalar DateTime

enum Channel {
  EMAIL
  PUSH
}

input AddItemInput {
  productId: ID!
  quantity: Int!
  note: String
}

type ItemType {
  productId: ID!
  quantity: Int!
  channel: Channel!
  at: DateTime!
}

type Query {
  cart: [ItemType!]!
  item(input: ItemInput!): ItemType!
}

input ItemInput {
  productId: ID!
}

type Mutation {
  addItem(input: AddItemInput!): ItemType! @deprecated(reason: "kept")
}
`;
const PEOPLE_CONTRACT = 'type Query {\n  me: PersonType!\n}\n\ntype PersonType {\n  personId: ID!\n}\n';
const withDocuments = (documents) => (dir) => {
  put(dir, 'be/contracts/shop/schema.graphql', SHOP_CONTRACT);
  put(dir, 'be/contracts/people/schema.graphql', PEOPLE_CONTRACT);
  for (const [name, text] of Object.entries(documents)) put(dir, `fe/apps/web/src/modules/services/${name}.graphql`, text);
};
const r113 = (documents) => only(checkRepo({ repoRoot: repoOf(APP, withDocuments(documents)) }), 'FE_GRAPHQL_CONTRACT');

test('FE_GRAPHQL_CONTRACT: documents that match their contract pass, each judged by the contract serving its root field', () => {
  assert.deepEqual(r113({
    'add-item': 'mutation AddItem($input: AddItemInput!) {\n  addItem(input: $input) { productId quantity channel at }\n}\n',
    item: 'query Item($productId: ID!) {\n  item(input: { productId: $productId }) { ...Line }\n}\nfragment Line on ItemType { productId __typename }\n',
    me: '# the signed-in person\nquery Me { me { personId } }\n',
    cart: '{ cart { productId } }\n',
  }), []);
});

test('FE_GRAPHQL_CONTRACT: an argument the contract does not take, a missing input and an unused variable are named on the document', () => {
  const findings = r113({ 'add-item': 'mutation AddItem($input: AddItemInput!) {\n  addItem(request: $input) { productId }\n}\n' });
  assert.deepEqual(findings.map((f) => [f.path, f.operation, f.service]), [['fe/apps/web/src/modules/services/add-item.graphql', 'AddItem', 'shop']]);
  assert.match(findings[0].message, /passes request, which Mutation\.addItem does not take \(it takes input\)/);
  assert.match(findings[0].message, /omits input, which Mutation\.addItem requires/);
  assert.match(findings[0].message, /declares \$input, which no argument uses/);
});

test('FE_GRAPHQL_CONTRACT: unknown fields, input fields, missing required input fields, variable types and selection shapes are refused', () => {
  const findings = r113({
    'unknown-output': 'query Q { cart { productId sku } }\n',
    'missing-selection': 'query Q { cart }\n',
    'scalar-selection': 'query Q { cart { quantity { value } } }\n',
    'variable-type': 'query Q($id: String!) { item(input: { productId: $id }) { productId } }\n',
    'unknown-input': 'mutation M { addItem(input: { productId: "p", colour: "red" }) { productId } }\n',
    'missing-input': 'mutation M { addItem(input: { productId: "p" }) { productId } }\n',
    'unknown-root': 'query Q { orders { id } }\n',
    syntax: 'query Q { cart { productId }\n',
  });
  const problems = (name) => findings.filter((f) => f.path.endsWith(`/${name}.graphql`)).flatMap((f) => f.problems ?? [f.message]);
  assert.match(problems('unknown-output').join(), /Q\.cart\.sku is not a field of ItemType/);
  assert.match(problems('missing-selection').join(), /Q\.cart is a ItemType, which needs a selection/);
  assert.match(problems('scalar-selection').join(), /Q\.cart\.quantity is a Int, which selects no fields/);
  assert.match(problems('variable-type').join(), /takes ID!, but \$id is String!/);
  assert.match(problems('unknown-input').join(), /names colour, which the input AddItemInput does not declare/);
  assert.match(problems('missing-input').join(), /omits quantity, which the input AddItemInput requires/);
  assert.match(problems('unknown-root').join(), /asks query orders, but no contract of .* declares query orders/);
  assert.match(problems('syntax').join(), /is not a GraphQL document/);
});
