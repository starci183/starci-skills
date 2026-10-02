// coverage-scope.mjs derives, from the slot manifest alone, what a back end measures at 100 per file (R204): the jest roots and the
// none directories inside them, Sonar's coverage exclusions (the complement), the Codecov paths and one component per service app plus platform.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadSlotManifest } from '../../scripts/hfs/slots.mjs';
import { PLATFORM_COMPONENT, coverageComponents, coverageScope, isMeasured, jestCoverage, rootGlob } from '../../scripts/hfs/coverage-scope.mjs';

const text = fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'knowledge', 'hfs', 'slots.yaml'), 'utf8');
const manifest = loadSlotManifest();
/** The manifest with the `coverage` line of slot `id` replaced (the field follows the slot's `tests` line). */
const withCoverage = (id, value) => {
  const at = text.indexOf(`  - id: ${id}\n`);
  assert.ok(at >= 0, id);
  const end = text.indexOf('\n  - id: ', at + 1);
  const block = text.slice(at, end < 0 ? text.length : end);
  assert.match(block, /\n {4}coverage: (?:required|none)\n/, `${id} declares coverage`);
  return text.slice(0, at) + block.replace(/\n {4}coverage: (?:required|none)\n/, `\n    coverage: ${value}\n`) + (end < 0 ? '' : text.slice(end));
};

test('every tracked slot of the be profile declares coverage, and no other slot does', () => {
  for (const slot of manifest.slots) {
    const measured = slot.profiles.includes('be') && slot.tracked === 'tracked';
    assert.equal(slot.coverage !== undefined, measured, `${slot.id}: coverage is declared exactly by tracked be slots`);
    if (measured) assert.ok(['required', 'none'].includes(slot.coverage), slot.id);
  }
  assert.deepEqual(manifest.slots.filter((slot) => slot.coverage === 'required').map((slot) => slot.id).sort(), [
    'be.domain', 'be.integrations', 'be.integrations.model', 'be.platform', 'be.platform.event-bus', 'be.platform.jobs', 'be.platform.queue', 'be.projections',
  ], 'the logic of be/src/modules is the one measured thing: domain, platform (and its pattern capabilities), projections, integrations');
  assert.equal(manifest.slots.find((slot) => slot.id === 'be.feature.jobs').coverage, 'none');
  assert.equal(manifest.slots.find((slot) => slot.id === 'be.cli').coverage, 'none');
});

test('the loader refuses a be slot with no coverage, a value outside required|none, and coverage on a slot that is not a tracked be slot', () => {
  const cut = (id) => {
    const at = text.indexOf(`  - id: ${id}\n`);
    const end = text.indexOf('\n  - id: ', at + 1);
    return text.slice(0, at) + text.slice(at, end).replace(/ {4}coverage: (?:required|none)\n/, '') + text.slice(end);
  };
  assert.throws(() => loadSlotManifest({ text: cut('be.domain') }), /be\.domain: coverage must be one of required, none/);
  assert.throws(() => loadSlotManifest({ text: withCoverage('be.domain', 'maybe') }), /be\.domain: coverage must be one of required, none/);
  const fe = text.replace('  - id: fe.route\n', '  - id: fe.route\n    coverage: required\n');
  assert.notEqual(fe, text);
  assert.throws(() => loadSlotManifest({ text: fe }), /fe\.route: coverage belongs to a tracked slot of the be profile only/);
});

test('the scope of the manifest: the measured roots, the none directories inside them, and the Codecov paths', () => {
  const scope = coverageScope(manifest);
  assert.deepEqual(scope.roots, ['src/modules/domain/*/', 'src/modules/integrations/*/', 'src/modules/platform/*/', 'src/modules/projections/*/'], 'the pattern capabilities and be.integrations.model are inside these roots: only the minimal roots remain');
  assert.deepEqual(scope.excludes, [
    'src/modules/domain/*/errors/', 'src/modules/domain/*/messages/', 'src/modules/domain/*/persistence/', 'src/modules/integrations/*/errors/', 'src/modules/integrations/*/messages/',
    'src/modules/platform/*/messages/', 'src/modules/platform/*/persistence/', 'src/modules/projections/*/persistence/',
  ]);
  assert.deepEqual(scope.codecovPaths, scope.roots.map((root) => `be/${root}**`));
  assert.deepEqual(jestCoverage(manifest), { roots: scope.roots, roles: manifest.ruleParams.be.logicRoles, excludes: scope.excludes.map((dir) => `${dir}**`) });
  assert.equal(rootGlob('src/modules/domain/*/', ['service', 'policy']), 'src/modules/domain/*/**/*.{service,policy}.ts');
  assert.ok(scope.none.includes('src/features/api/*/') && scope.none.includes('src/tests/world/') && scope.none.includes('apps/*/src/'), 'every other subtree is never measured');
  assert.ok(!scope.none.some((path) => path.startsWith('src/modules/platform/event-bus') || path === 'src/modules/domain/*/'), 'a required slot is never in the none list');
});

test('Sonar excludes the complement: every none subtree, every non-logic role, the role-less names of the measured slots and fe/', () => {
  const { sonar, roles, none } = coverageScope(manifest);
  assert.deepEqual([...sonar], [...sonar].sort(), 'sorted, so the render is stable');
  assert.equal(new Set(sonar).size, sonar.length);
  for (const dir of none.filter((entry) => entry.endsWith('/'))) assert.ok(sonar.includes(`be/${dir}**`), dir);
  for (const role of manifest.ruleParams.be.suffixes) assert.equal(sonar.includes(`be/**/*.${role}.ts`), !roles.includes(role), `${role}: excluded exactly when it is not a logic role`);
  assert.ok(sonar.includes('be/src/modules/domain/*/index.ts') && sonar.includes('be/src/modules/platform/*/index.ts'), 'the index.ts of a measured slot is no logic');
  assert.ok(sonar.includes('fe/**'));
});

test('a slot flipped to none or required moves jest, Sonar and Codecov together', () => {
  const noIntegrationsText = withCoverage('be.integrations', 'none');
  const modelAt = noIntegrationsText.indexOf('  - id: be.integrations.model\n');
  const noIntegrations = loadSlotManifest({ text: noIntegrationsText.slice(0, modelAt) + noIntegrationsText.slice(modelAt).replace('    coverage: required\n', '    coverage: none\n') });
  const scope = coverageScope(noIntegrations);
  assert.ok(!scope.roots.some((root) => root.includes('integrations')), 'jest stops measuring integrations');
  assert.ok(scope.codecovPaths.every((entry) => !entry.includes('integrations')), 'Codecov stops judging them');
  assert.ok(scope.sonar.includes('be/src/modules/integrations/*/**') && !scope.sonar.includes('be/src/modules/integrations/*/index.ts'), 'Sonar excludes the whole subtree');
  // a nested none slot made required is a measured sub-root that the minimal root already covers
  const events = loadSlotManifest({ text: withCoverage('be.events', 'required') });
  assert.ok(coverageScope(events).roots.includes('src/modules/events/*/'));
  assert.ok(!coverageScope(events).none.includes('src/modules/events/*/'));
});

test('a measured root is a directory, and a none directory never contains a measured slot', () => {
  assert.throws(() => coverageScope(loadSlotManifest({ text: withCoverage('be.tests.fixtures.builders', 'required') })), /coverage: required but its path .* is not a directory/);
  assert.throws(() => coverageScope(loadSlotManifest({ text: withCoverage('be.platform', 'none') })), /a coverage: none directory .* contains a coverage: required slot/, 'be.platform.event-bus sits inside be.platform');
  assert.doesNotThrow(() => coverageScope(loadSlotManifest({ text: withCoverage('be.domain', 'none') })), 'no measured slot sits inside be.domain');
});

test('isMeasured: a logic role inside a measured root and outside its none directories', () => {
  const measured = (file) => isMeasured(manifest, file);
  for (const file of ['src/modules/domain/order/order.service.ts', 'src/modules/domain/order/policies/refund.policy.ts', 'src/modules/integrations/pay/pay.client.ts', 'src/modules/platform/event-bus/kafka.client.ts',
    'src/modules/projections/summary/summary.projection.ts', 'src/modules/platform/jobs/fenced.processor.ts']) assert.equal(measured(file), true, file);
  for (const file of ['src/features/api/order/application/place.handler.ts', 'src/features/api/order/application/place.service.ts', 'src/modules/domain/order/order.module.ts', 'src/modules/domain/order/order.entity.ts',
    'src/modules/domain/order/persistence/order.sql.ts', 'src/modules/domain/order/persistence/odd.service.ts', 'src/modules/domain/order/errors/order.error.ts', 'src/modules/domain/order/index.ts',
    'src/modules/events/order/order-placed.event.ts', 'src/modules/queues/order/order.queue.ts', 'src/modules/domain/order/order.service.spec.ts', 'src/tests/world/kit/x.service.ts', 'apps/api/src/main.ts']) assert.equal(measured(file), false, file);
});

test('components: a capability goes to the service app that alone composes it, to the app named like it when several do, else to platform; the cli app owns nothing', () => {
  const files = ['apps/identity/src/app.module.ts', 'apps/order/src/app.module.ts', 'apps/cli/src/app.module.ts', 'src/modules/domain/identity/auth.guard.ts', 'src/modules/domain/order/order.service.ts',
    'src/modules/domain/cart/cart.service.ts', 'src/modules/integrations/pay/pay.client.ts', 'src/modules/integrations/lonely/lonely.client.ts', 'src/modules/platform/clock/clock.module.ts'];
  const source = {
    'apps/identity/src/app.module.ts': "import { A } from '@modules/domain/identity'\nimport { P } from '@modules/integrations/pay'",
    'apps/order/src/app.module.ts': 'import { A } from "@modules/domain/identity"\nimport { O } from "@modules/domain/order"\nimport { C } from "@modules/domain/cart"\nimport { P } from "@modules/integrations/pay"',
    'apps/cli/src/app.module.ts': 'import { C } from "@modules/domain/cart"\nimport { L } from "@modules/integrations/lonely"',
  };
  const apps = [{ name: 'identity', kind: 'api' }, { name: 'order', kind: 'api' }, { name: 'cli', kind: 'cli' }];
  const components = coverageComponents(manifest, { files, read: (file) => source[file] ?? '', apps });
  assert.deepEqual(components.map((component) => [component.id, component.name]), [['identity', 'identity'], ['order', 'order'], [PLATFORM_COMPONENT, PLATFORM_COMPONENT]]);
  assert.deepEqual(components[0].paths, ['be/src/modules/domain/identity/**'], 'identity is imported by both services and named like the identity service');
  assert.deepEqual(components[1].paths, ['be/src/modules/domain/cart/**', 'be/src/modules/domain/order/**']);
  assert.deepEqual(components[2].paths, ['be/src/modules/integrations/lonely/**', 'be/src/modules/integrations/pay/**', 'be/src/modules/platform/*/**', 'be/src/modules/projections/*/**'],
    'pay is shared by both services, lonely is composed by the cli alone, the platform tier and a root with no capability stay in platform');
  assert.deepEqual(coverageComponents(manifest, { files: [], read: () => '', apps }), [{ id: PLATFORM_COMPONENT, name: PLATFORM_COMPONENT, paths: coverageScope(manifest).codecovPaths }], 'an app with no source yet is one platform component over the measured roots');
});
