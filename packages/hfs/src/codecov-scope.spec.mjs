import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTargets } from '../sync/index.mjs';
import { parseYaml } from '../runtime/engine/yaml.mjs';
import { globExpression } from '../runtime/scripts/lib/glob.mjs';

const covered = 'be/src/modules/domain/orders/orders.service.ts';
const uncovered = 'be/src/modules/domain/orders/policies/payment.policy.ts';
const platformCovered = 'be/src/modules/platform/clock/clock.service.ts';
const platformUncovered = 'be/src/modules/platform/clock/deadline.policy.ts';
const measured = [covered, uncovered, platformCovered, platformUncovered];
// A shard reports every loaded import, including files outside the slot-derived logic scope.
const report = [
  { path: covered, lines: 4, hits: 4 },
  { path: uncovered, lines: 2, hits: 0 },
  { path: platformCovered, lines: 3, hits: 3 },
  { path: platformUncovered, lines: 3, hits: 0 },
  { path: 'be/src/modules/domain/orders/orders.config.ts', lines: 100, hits: 1 },
  { path: 'be/src/modules/domain/orders/orders.module.ts', lines: 20, hits: 5 },
  { path: 'be/src/modules/domain/orders/persistence/order.rows.ts', lines: 50, hits: 0 },
  { path: 'be/src/modules/domain/orders/persistence/hydrate.service.ts', lines: 5, hits: 0 },
  { path: 'be/src/modules/platform/clock/clock.config.ts', lines: 10, hits: 1 },
  { path: 'be/src/modules/integrations/supabase/supabase.jwks.ts', lines: 10, hits: 1 },
  { path: 'fe/apps/web/src/app/page.tsx', lines: 10, hits: 0 },
];

const matches = (patterns, file) => patterns.some(pattern => globExpression(pattern).test(file));
const selected = (config, paths, records) => records.filter(record => matches(paths, record.path) && !matches(config.ignore, record.path));
const reachesTarget = (records, status) => {
  const lines = records.reduce((total, record) => total + record.lines, 0);
  const hits = records.reduce((total, record) => total + record.hits, 0);
  assert.ok(lines > 0, 'a status keeps its measured files');
  return 100 * hits / lines >= Number.parseFloat(status.target);
};

for (const edition of ['full', 'lite']) {
  test(`${edition} rendered Codecov scope keeps uncovered logic and ignores incidental imports`, () => {
    const hfs = { hfs: 3, kind: 'app', edition, project: 'codecov-scope-proof', sides: {
      be: { apps: [{ name: 'api', kind: 'api' }], connections: [
        { name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'api', isolation: 'schema', provider: 'supabase' },
      ] },
      fe: { apps: [{ name: 'web', kind: 'next' }], reads: ['be/contracts/'] },
    } };
    const source = {
      files: ['apps/api/src/api.module.ts', ...report.filter(record => record.path.startsWith('be/')).map(record => record.path.slice(3))],
      read: file => file === 'apps/api/src/api.module.ts' ? "import { OrdersModule } from '@modules/domain/orders';" : '',
    };
    const target = renderTargets(hfs, {}, { source }).find(item => item.path === 'codecov.yml');
    assert.ok(target, 'the managed Codecov configuration is rendered');
    const config = parseYaml(target.content);
    const project = config.coverage.status.project.default;
    const retained = selected(config, project.paths, report).map(record => record.path);
    assert.deepEqual(retained, measured, 'the provider denominator is exactly the measured logic, including uncovered files');
    const allCovered = report.map(record => measured.includes(record.path) ? { ...record, hits: record.lines } : record);
    const statuses = [
      ...Object.values(config.coverage.status).map(status => ({ paths: status.default.paths, rule: status.default })),
      ...config.component_management.individual_components.flatMap(component =>
        config.component_management.default_rules.statuses.map(rule => ({ paths: component.paths, rule }))),
    ];
    assert.deepEqual(config.component_management.individual_components.map(component => component.component_id), ['api', 'platform']);
    for (const { paths, rule } of statuses) {
      assert.equal(String(rule.target), '100%');
      assert.equal(String(rule.threshold), '0%');
      assert.equal(reachesTarget(selected(config, paths, report), rule), false, 'uncovered measured logic still fails project, patch and component gates');
      assert.equal(reachesTarget(selected(config, paths, allCovered), rule), true, 'partial incidental imports do not lower the measured coverage');
    }
  });
}
