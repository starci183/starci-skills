// ruleParams.be.unitRoles of knowledge/hfs/slots.yaml is THE list of unit-tested roles of a back end: every consumer reads it or is
// held equal to it here (the jest preset's coverage sources, the Sonar and Codecov scope sync renders from them, the unit-run gate).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadSlotManifest } from '../../scripts/hfs/slots.mjs';
import { unitRolesOf } from '../../scripts/hfs/manifest-shape.mjs';
import { coverageExclusions, coverageScope } from '../../packages/hfs/sync/index.mjs';
import { servicesOf, unitRoleOf } from '../../scripts/gates/unit-run.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const jestPreset = createRequire(import.meta.url)('../../packages/jest-preset/index.cjs');
const manifest = loadSlotManifest();
const roles = unitRolesOf(manifest);

test('the jest preset measures exactly the coverage of the unit-tested roles, each at 100 per file', () => {
  assert.deepEqual(jestPreset.COVERAGE_SOURCES, roles.map((role) => role.coverage));
  for (const key of Object.keys(jestPreset.starciJestConfig().coverageThreshold)) assert.ok(roles.some((role) => `./${role.coverage}` === key), key);
});

test('the Sonar and Codecov scope sync renders is the unit-tested roles, and no covered role is excluded', () => {
  const presets = { coverageSources: [...jestPreset.COVERAGE_SOURCES] };
  assert.deepEqual(coverageScope(presets), roles.map((role) => `be/${role.coverage}`));
  const excluded = coverageExclusions(presets, manifest);
  for (const role of roles) assert.equal(excluded.includes(`be/**/*.${role.role}.ts`), false, `${role.role} is measured, not excluded`);
  assert.ok(excluded.includes('be/**/*.handler.ts'), 'a thin role stays outside the scope');
});

test('the unit-run gate finds the subjects of every role and only those', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'unit-roles-'));
  try {
    for (const rel of ['be/src/modules/domain/order/order.service.ts', 'be/src/features/cli/migrate/subs/run.cli.ts', 'be/src/features/cli/migrate/migrate.cli.ts',
      'be/src/features/api/order/application/place.handler.ts', 'be/src/modules/domain/order/order.cli.ts', 'be/src/tests/fixtures/x.service.ts']) {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), 'export {};\n');
    }
    assert.deepEqual(servicesOf(root, roles), ['be/src/features/cli/migrate/migrate.cli.ts', 'be/src/features/cli/migrate/subs/run.cli.ts', 'be/src/modules/domain/order/order.service.ts']);
    assert.equal(unitRoleOf('be/src/modules/domain/order/order.cli.ts', roles), null, 'a .cli.ts outside the cli feature root is no cli command');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a unitRoles entry is refused when its spec, coverage or role does not hold together', () => {
  const text = fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'knowledge', 'hfs', 'slots.yaml'), 'utf8');
  for (const bad of [
    text.replace('{role: cli, spec: cli.spec,', '{role: cli, spec: cli.test,'),
    text.replace('coverage: "src/features/cli/**/*.cli.ts"', 'coverage: "src/features/cli/**/*.ts"'),
    text.replace('{role: cli, spec: cli.spec, slot: be.cli,', '{role: unknownrole, spec: unknownrole.spec, slot: be.cli,'),
  ]) {
    assert.notEqual(bad, text);
    assert.throws(() => loadSlotManifest({ text: bad }), /unitRoles/);
  }
  assert.ok(parseYaml(text).ruleParams.be.unitRoles.length >= 2);
});
