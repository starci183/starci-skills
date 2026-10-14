import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { openHfs } from '../../scripts/hfs/slots.mjs';
import { contractFindings, contractEmitFindings, CONTRACT_SNAPSHOT_DRIFT } from '../../scripts/hfs/rules/contract.mjs';

// proves: HFS_CONTRACT_SNAPSHOT_DRIFT@lite
// proves: HFS_CONTRACT_SNAPSHOT_DRIFT@full
// R23: compose groups and app-owned GraphQL transports require the app's committed contract in either edition.

const GRAPHQL = 'type Query {\n  hello: String!\n}\n';
const OPENAPI = '{"openapi":"3.1.0","paths":{}}\n';
const SNAPSHOT = 'contracts/core/schema.graphql';
const OPERATION_SNAPSHOT = 'contracts/core/openapi.json';
const ROOT = path.resolve(import.meta.dirname, '..', '..');
const CORE = { name: 'core', kind: 'api' };
const CLI = { name: 'cli', kind: 'cli' };

function writeFiles(root, files) {
  for (const [relative, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    fs.writeFileSync(path.join(root, relative), content);
  }
}

function fixture(t, edition, files, apps = [CORE, CLI]) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-contract-compose-'));
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  writeFiles(repoRoot, files);
  const resolver = openHfs({ declaration: {
    hfs: 3, kind: 'app', project: 'fixture', edition,
    sides: {
      be: { apps, optionalSlots: ['be.contract.graphql', 'be.contract.openapi'] },
      fe: { apps: [{ name: 'web', kind: 'next' }] },
    },
  }, side: 'be' });
  return { repoRoot, files: Object.keys(files), repo: resolver.repo, resolver };
}

function emitting(graphql, openapi = null) {
  return ({ declaration, outDir }) => {
    assert.deepEqual(declaration.apps, [CORE], 'only API apps are emitted');
    const artifacts = { [SNAPSHOT]: graphql, [OPERATION_SNAPSHOT]: openapi };
    const written = Object.keys(artifacts).filter(file => artifacts[file] !== null);
    writeFiles(outDir, Object.fromEntries(written.map(file => [file, artifacts[file]])));
    return { written, skipped: written.length ? [] : ['core'] };
  };
}

function assertMissing(findings, snapshot = SNAPSHOT, app = 'core') {
  assert.equal(findings.length, 1, JSON.stringify(findings));
  assert.equal(findings[0].code, CONTRACT_SNAPSHOT_DRIFT);
  assert.equal(findings[0].level, 'error');
  assert.equal(findings[0].path, snapshot);
  assert.equal(findings[0].app, app);
  assert.match(findings[0].message, /not committed/);
  assert.match(findings[0].message, /npm run contract:emit/);
}

for (const edition of ['lite', 'full']) {
  test(`HFS_CONTRACT_SNAPSHOT_DRIFT (${edition}): a composition closure through groups and re-exports needs a schema even without a transport file`, t => {
    const files = {
      'apps/core/src/app.module.ts': 'import { platformModules } from /* composition */ "./compose/platform"; export const AppModule = platformModules;',
      'apps/core/src/compose/platform.ts': 'export { platformModules } from /* platform */ "./platform-core.js";',
      'apps/core/src/compose/platform-core.ts': 'import { GraphqlModule } from /* capability */ "@modules/platform/graphql"; export const platformModules = [GraphqlModule.register({ isGlobal: true })];',
    };
    const missing = fixture(t, edition, files);
    assertMissing(contractFindings(missing));
    assert.deepEqual(contractFindings(fixture(t, edition, { ...files, [SNAPSHOT]: GRAPHQL })), []);
  });

  test(`HFS_CONTRACT_SNAPSHOT_DRIFT (${edition}): a directly composed GraphQL platform still requires a schema`, t => {
    const files = {
      'apps/core/src/app.module.ts': 'import { GraphqlModule } from "../../../src/modules/platform/graphql/index.ts"; export const AppModule = GraphqlModule;',
    };
    assertMissing(contractFindings(fixture(t, edition, files)));
    assert.deepEqual(contractFindings(fixture(t, edition, { ...files, [SNAPSHOT]: GRAPHQL })), []);
  });

  test(`HFS_CONTRACT_SNAPSHOT_DRIFT (${edition}): the app's reachable GraphQL transport requires a schema without a platform import`, t => {
    const files = {
      'apps/core/src/app.module.ts': 'import { OrdersGraphqlModule } from "@features/api/orders"; export const AppModule = OrdersGraphqlModule;',
      'src/features/api/orders/index.ts': 'export { OrdersGraphqlModule } from "./transport/graphql/orders-graphql.module";',
      'src/features/api/orders/transport/graphql/orders-graphql.module.ts': 'export class OrdersGraphqlModule {}',
    };
    assertMissing(contractFindings(fixture(t, edition, files)));
    assert.deepEqual(contractFindings(fixture(t, edition, { ...files, [SNAPSHOT]: GRAPHQL })), []);
  });

  test(`HFS_CONTRACT_SNAPSHOT_DRIFT (${edition}): another API app does not inherit a composed service's GraphQL transports`, t => {
    const files = {
      'apps/core/src/app.module.ts': 'import { OrdersGraphqlModule } from "@features/api/orders"; export const AppModule = OrdersGraphqlModule;',
      'apps/probes/src/app.module.ts': 'export class AppModule {}',
      'src/features/api/orders/index.ts': 'export { OrdersGraphqlModule } from "./transport/graphql/orders-graphql.module";',
      'src/features/api/orders/transport/graphql/orders-graphql.module.ts': 'export class OrdersGraphqlModule {}',
    };
    const apps = [CORE, { name: 'probes', kind: 'api' }, CLI];
    assertMissing(contractFindings(fixture(t, edition, files, apps)));
    assert.deepEqual(contractFindings(fixture(t, edition, { ...files, [SNAPSHOT]: GRAPHQL }, apps)), []);
  });

  test(`HFS_CONTRACT_SNAPSHOT_DRIFT (${edition}): an explicitly app-owned transport applies only to that app`, t => {
    const input = fixture(t, edition, { 'apps/core/src/app.module.ts': 'export class AppModule {}' });
    const transport = 'apps/core/src/transport/orders.resolver.ts';
    const other = { name: 'probes', kind: 'api' };
    input.repo = { ...input.repo, apps: [CORE, other, CLI] };
    input.files.push(transport);
    input.resolver = { classifyPath: file => file === transport
      ? { slot: 'be.transport.graphql', bindings: { app: 'core' } } : { slot: null } };
    assertMissing(contractFindings(input));
    input.files.push(SNAPSHOT);
    assert.deepEqual(contractFindings(input), []);
  });

  test(`HFS_CONTRACT_SNAPSHOT_DRIFT (${edition}): unrelated transports, unused groups, comments, and import cycles do not make an app serve GraphQL`, t => {
    const input = fixture(t, edition, {
      'apps/core/src/app.module.ts': 'import { modules } from "./compose/probes"; export const AppModule = modules; // from "@modules/platform/graphql"',
      'apps/core/src/compose/probes.ts': 'export { modules } from "./cycle";',
      'apps/core/src/compose/cycle.ts': 'export { modules } from "./probes"; const note = \'from "@modules/platform/graphql"\';',
      'apps/core/src/compose/unused.ts': 'import { GraphqlModule } from "@modules/platform/graphql";',
      'src/features/api/unrelated/transport/graphql/find.resolver.ts': 'export class FindResolver {}',
    });
    assert.deepEqual(contractFindings(input), []);
  });

  test(`HFS_CONTRACT_SNAPSHOT_DRIFT (${edition}): external platform names and type-only imports do not compose the backend GraphQL server`, t => {
    const input = fixture(t, edition, {
      'apps/core/src/app.module.ts': `
import { GraphqlModule } from "some-package/platform/graphql";
import type { GraphqlOptions } from "@modules/platform/graphql";
import { type GraphqlConfig } from "@modules/platform/graphql/config";
export type { GraphqlOptions } from "@modules/platform/graphql";
export { type GraphqlConfig } from "@modules/platform/graphql/config";
type Module = import("@modules/platform/graphql").GraphqlModule;
export const AppModule = GraphqlModule;
`,
    });
    assert.deepEqual(contractFindings(input), []);
  });

  test(`HFS_CONTRACT_SNAPSHOT_DRIFT (${edition}): emitted snapshots report not-committed independently of the static finder`, t => {
    const input = fixture(t, edition, {});
    const result = contractEmitFindings({ ...input, emit: emitting(GRAPHQL, OPENAPI) });
    assert.deepEqual(result.apps, [
      { app: 'core', artifact: 'schema.graphql', status: 'not-committed' },
      { app: 'core', artifact: 'openapi.json', status: 'not-committed' },
    ]);
    assert.deepEqual(result.findings.map(finding => ({ code: finding.code, path: finding.path, drift: finding.drift })), [
      { code: CONTRACT_SNAPSHOT_DRIFT, path: SNAPSHOT, drift: 'not-committed' },
      { code: CONTRACT_SNAPSHOT_DRIFT, path: OPERATION_SNAPSHOT, drift: 'not-committed' },
    ]);
    assert.ok(result.findings.every(finding => finding.level === 'error' && /npm run contract:emit/.test(finding.message)));
  });

  test(`HFS_CONTRACT_SNAPSHOT_DRIFT (${edition}): fresh snapshots and an app emitting no contracts remain green`, t => {
    const fresh = fixture(t, edition, { [SNAPSHOT]: GRAPHQL.replaceAll('\n', '\r\n'), [OPERATION_SNAPSHOT]: OPENAPI });
    const result = contractEmitFindings({ ...fresh, emit: emitting(GRAPHQL, OPENAPI) });
    assert.deepEqual(result.findings, []);
    assert.deepEqual(result.apps.map(app => app.status), ['fresh', 'fresh']);
    const none = contractEmitFindings({ ...fixture(t, edition, {}), emit: emitting(null) });
    assert.deepEqual(none.findings, []);
    assert.deepEqual(none.apps, [{ app: 'core', artifact: 'schema.graphql', status: 'none' }]);
  });

  test(`HFS_CONTRACT_SNAPSHOT_DRIFT (${edition}): an untracked or missing emitted schema is an error`, t => {
    const untracked = fixture(t, edition, { [SNAPSHOT]: GRAPHQL });
    untracked.files = [];
    assertMissing(contractEmitFindings({ ...untracked, emit: emitting(GRAPHQL) }).findings);
    const missing = fixture(t, edition, {});
    missing.files = [SNAPSHOT];
    assertMissing(contractEmitFindings({ ...missing, emit: emitting(GRAPHQL) }).findings);
  });
}

for (const [example, edition, app] of [['lite-app', 'lite', 'api'], ['ecommerce-app', 'full', 'order']]) {
  test(`HFS_CONTRACT_SNAPSHOT_DRIFT (${edition}): ${example} stays green and removing its ${app} schema reports drift`, () => {
    const relative = `examples/${example}/be/`;
    const files = execFileSync('git', ['ls-files', '-z', '--', relative], { cwd: ROOT, encoding: 'utf8' })
      .split('\0').filter(Boolean).map(file => file.slice(relative.length));
    const repoRoot = path.join(ROOT, 'examples', example, 'be');
    const resolver = openHfs({ repoRoot });
    assert.equal(resolver.repo.edition, edition);
    assert.deepEqual(contractFindings({ repoRoot, files, repo: resolver.repo, resolver }), []);
    const snapshot = `contracts/${app}/schema.graphql`;
    assert.ok(files.includes(snapshot), 'the example commits the contract before mutation');
    assertMissing(contractFindings({ repoRoot, files: files.filter(file => file !== snapshot), repo: resolver.repo, resolver }), snapshot, app);
  });
}

test('the contract rules leave a frontend profile unjudged', () => {
  const input = { repoRoot: ROOT, files: [], repo: { profile: 'fe' }, resolver: { classifyPath: () => { throw new Error('not called'); } } };
  assert.deepEqual(contractFindings(input), []);
  assert.deepEqual(contractEmitFindings({ ...input, emit: () => { throw new Error('not called'); } }), { findings: [], apps: [] });
});
