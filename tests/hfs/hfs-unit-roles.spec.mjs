// ruleParams.be.unitRoles of knowledge/hfs/slots.yaml is THE list of roles whose unit spec is required, and ruleParams.be.logicRoles the roles the unit
// run MEASURES inside the slots whose `coverage` is required: every consumer reads them or is held equal to them here (the jest scope the
// preset gets, the Sonar and Codecov scope sync renders, the unit-run gate).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadSlotManifest } from '../../scripts/hfs/slots.mjs';
import { logicRolesOf, thinRolesOf, unitRolesOf } from '../../scripts/hfs/manifest-shape.mjs';
import { coverageScope, jestCoverage, sonarCoverageExclusions } from '../../scripts/hfs/coverage-scope.mjs';
import { servicesOf, unitFindings, unitRoleOf } from '../../scripts/gates/unit-run.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const jestPreset = createRequire(import.meta.url)('../../packages/jest-preset/index.cjs');
const manifest = loadSlotManifest();
const roles = unitRolesOf(manifest);
const text = fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'knowledge', 'hfs', 'slots.yaml'), 'utf8');

test('the jest preset measures exactly the logic roles of the measured roots, each at 100 per file', () => {
  assert.equal(jestPreset.COVERAGE_SOURCES, undefined, 'the services-only list is gone: the scope is rendered, never a constant');
  const scope = jestCoverage(manifest);
  const config = jestPreset.starciJestConfig({ coverage: scope });
  const wanted = scope.roots.map((root) => `./${jestPreset.rootGlob(root, scope.roles)}`);
  for (const key of Object.keys(config.coverageThreshold)) assert.ok(wanted.includes(key), key);
  assert.deepEqual(scope.roles, logicRolesOf(manifest));
  assert.ok(scope.roots.every((root) => root.startsWith('src/modules/')), 'only the modules are measured: a feature is thin and never in a root');
});

test('the Sonar and Codecov scope sync renders is the logic roles of the measured roots, and no logic role is excluded', () => {
  const excluded = sonarCoverageExclusions(manifest);
  for (const role of logicRolesOf(manifest)) assert.equal(excluded.includes(`be/**/*.${role}.ts`), false, `${role} is measured, not excluded`);
  for (const role of manifest.ruleParams.be.suffixes.filter((suffix) => !logicRolesOf(manifest).includes(suffix))) assert.ok(excluded.includes(`be/**/*.${role}.ts`), `${role} is declaration, excluded`);
  assert.ok(excluded.includes('be/**/*.handler.ts'), 'a thin role stays outside the scope');
  assert.deepEqual(coverageScope(manifest).codecovPaths, coverageScope(manifest).roots.map((root) => `be/${root}**`));
});

test('every unit role is a logic role or tied to a slot, and the thin roles are roles of the vocabulary', () => {
  for (const role of roles) assert.ok(role.slot !== undefined || logicRolesOf(manifest).includes(role.role), `${role.role} is measured wherever its slot admits it`);
  for (const role of [...logicRolesOf(manifest), ...thinRolesOf(manifest)]) assert.ok(manifest.ruleParams.be.suffixes.includes(role), role);
});

test('the unit-run gate finds the subjects of every spec-required role and every measured file, and only those', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'unit-roles-'));
  try {
    for (const rel of ['be/src/modules/domain/order/order.service.ts', 'be/src/modules/domain/order/pricing.policy.ts', 'be/src/modules/integrations/pay/pay.client.ts', 'be/src/modules/domain/order/persistence/order.sql.ts',
      'be/src/modules/domain/order/persistence/orphan.service.ts', 'be/src/modules/domain/order/order.entity.ts', 'be/src/features/cli/migrate/subs/run.cli.ts', 'be/src/features/cli/migrate/migrate.cli.ts',
      'be/src/features/api/order/application/place.handler.ts', 'be/src/features/api/order/transport/graphql/order.mapper.ts', 'be/src/modules/domain/order/order.cli.ts', 'be/src/tests/fixtures/x.service.ts']) {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), 'export {};\n');
    }
    assert.deepEqual(servicesOf(root, roles), [
      'be/src/features/cli/migrate/migrate.cli.ts', 'be/src/features/cli/migrate/subs/run.cli.ts',
      'be/src/modules/domain/order/order.service.ts', 'be/src/modules/domain/order/persistence/orphan.service.ts', 'be/src/modules/domain/order/pricing.policy.ts', 'be/src/modules/integrations/pay/pay.client.ts',
    ], 'measured files and spec-required roles (a service anywhere, a cli command of the cli root); a handler, a feature mapper, an entity and a .cli.ts outside the cli root are neither');
    assert.equal(unitRoleOf('be/src/modules/domain/order/order.cli.ts', roles), null, 'a .cli.ts outside the cli feature root is no cli command');
    assert.equal(unitRoleOf('be/src/modules/domain/order/pricing.policy.ts', roles), null, 'a policy owes coverage, not a spec of its own');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the unit-run findings: coverage below 100 on a measured file, a spec only where one is required, and no spec owed by a measured policy', () => {
  const full = { lines: 100, branches: 100, functions: 100, statements: 100 };
  const summary = {
    services: [
      { path: 'a.policy.ts', role: 'policy', measured: true, specRequired: false, coverage: { ...full, branches: 50 }, spec: null, kit: null },
      { path: 'b.service.ts', role: 'service', measured: true, specRequired: true, coverage: full, spec: null, kit: null },
      { path: 'c.cli.ts', role: 'cli', measured: false, specRequired: true, coverage: { lines: null, branches: null, functions: null, statements: null }, spec: 'c.cli.spec.ts', kit: { missing: [], forbidden: [], constructsSubject: false } },
    ],
  };
  assert.deepEqual(unitFindings(summary).map((finding) => `${finding.rule} ${finding.path}`), ['coverage-below a.policy.ts', 'spec-missing b.service.ts']);
});

test('a unitRoles, logicRoles or thinRoles entry is refused when it does not hold together', () => {
  for (const bad of [
    text.replace('{role: cli, spec: cli.spec,', '{role: cli, spec: cli.test,'),
    text.replace('{role: service, spec: service.spec}', '{role: service, spec: service.spec, coverage: "src/**/*.service.ts"}'),
    text.replace('{role: cli, spec: cli.spec, slot: be.cli,', '{role: unknownrole, spec: unknownrole.spec, slot: be.cli,'),
    text.replace('logicRoles: [service,', 'logicRoles: [unknownrole,'),
    text.replace('thinRoles: [handler,', 'thinRoles: [handler, handler, notarole,'),
    text.replace('logicRoles: [service, ', 'logicRoles: ['),
  ]) {
    assert.notEqual(bad, text);
    assert.throws(() => loadSlotManifest({ text: bad }), /unitRoles|logicRoles|thinRoles|unit role/);
  }
  assert.ok(parseYaml(text).ruleParams.be.unitRoles.length >= 2);
});
