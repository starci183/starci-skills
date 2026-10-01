// An authoring op is enqueued only onto the Work families its manifest writes (scripts/kernel/write-families.mjs).
// Since 2026-09-27T05:50Z business.decide went onto integration/, impl/ and src/ grants and architecture.decide
// onto journey/ (sn-learn-content, sn-subscription, modules-agentos, collab): each worker launched only to
// report blocked authority.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { familyGuardOf, familyOwners, familyViolations } from '../../scripts/kernel/write-families.mjs';

const OPS = path.resolve(import.meta.dirname, '..', '..', 'modules', 'ops', 'ops');
const brief = (op) => parseYaml(fs.readFileSync(path.join(OPS, `${op}.yaml`), 'utf8'));

test('business.decide and architecture.decide are guarded by their families; source-writing and node-relative ops are not', () => {
  const business = familyGuardOf(brief('business.decide'));
  assert.deepEqual([...business.families].sort(), ['br', 'data', 'decision', 'fr', 'journey', 'nfr']);
  assert.equal(business.overview, true);
  const architecture = familyGuardOf(brief('architecture.decide'));
  assert.deepEqual([...architecture.families].sort(), ['contract', 'integration', 'sds']);
  assert.equal(architecture.overview, false);
  for (const op of ['backend.implement', 'interface.draw', 'work.author', 'code.refactor', 'review.verify']) assert.equal(familyGuardOf(brief(op)), null, op);
});

test('the measured misroutes are refused; the op\'s own families, evidence and the work graph pass', () => {
  const business = familyGuardOf(brief('business.decide'));
  const refused = (paths) => familyViolations(business, paths).map((v) => v.family);
  assert.deepEqual(refused(['.starciwork/features/concepts/integration/academy-content-source']), ['integration']);
  assert.deepEqual(refused(['.starciwork/features/commerce/impl/starci-next/entitlement', 'src/modules/domain/entitlement', '.starciwork/evidence/wf-x.business']), ['impl', null]);
  assert.deepEqual(refused(['.starciwork/features/shared-lifecycle/architecture/sds/contracts/contract-sh-core-controlplane']), ['architecture']);
  assert.deepEqual(refused(['.starciwork/features/commerce', '.starciwork/features/commerce/index.yaml', '.starciwork/features/commerce/fr/checkout/**',
    '.starciwork/features/commerce/journey/buy', '.starciwork/evidence/wf-x.scope/work-graph.json']), []);
  const architecture = familyGuardOf(brief('architecture.decide'));
  assert.deepEqual(familyViolations(architecture, ['.starciwork/features/collab/journey/first-open']).map((v) => v.family), ['journey']);
  assert.deepEqual(familyViolations(architecture, ['D:/Repositories/nivo-backend/.starciwork/features/collab/sds/room', '.starciwork/features/collab/index.yaml']).map((v) => v.family), ['overview']);
});

test('the refusal names who writes each family', () => {
  const owners = familyOwners(fs.readdirSync(OPS).filter((f) => f.endsWith('.yaml')).map((f) => parseYaml(fs.readFileSync(path.join(OPS, f), 'utf8'))));
  assert.ok(owners.get('integration').includes('architecture.decide'));
  assert.ok(owners.get('fr').includes('business.decide'));
  assert.ok(owners.get('impl').includes('backend.implement'));
  assert.ok(owners.get('ui').includes('interface.draw'));
});
