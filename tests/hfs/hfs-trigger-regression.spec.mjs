// proves: HFS_STACKS_SHAPE@lite
// proves: HFS_HOST_CRON@lite HFS_HOST_CRON@full
// proves: HFS_DEPLOY_COMPOSE_ON_VPS@lite HFS_DEPLOY_COMPOSE_ON_VPS@full
// proves: HFS_SLOT_REQUIRED_MISSING@lite HFS_SLOT_REQUIRED_MISSING@full
import assert from 'node:assert/strict';
import test from 'node:test';
import { DEPLOY_SCRIPT, DEPLOY_WORKFLOW, STACKS_DECLARATION, triggerFixture } from '../helpers/trigger-fixture.mjs';

const findingsFor = (report, code, file) => report.findings.filter(finding => finding.code === code && finding.path === file);
const errorsFor = (report, code, file) => findingsFor(report, code, file).filter(finding => finding.level === 'error');

for (const edition of ['lite', 'full']) {
  test(`alpha.15 trigger regression@${edition}: real app check refuses the incident and judges its repair`, async t => {
    const fixture = triggerFixture(t, edition);
    const incident = fixture.check();

    await t.test('host watchdog and Compose production deployment are refused on both automation surfaces', () => {
      assert.equal(incident.ok, false);
      assert.equal(incident.profile, 'app');
      assert.equal(incident.machine.status, 'ran');
      for (const file of [DEPLOY_SCRIPT, DEPLOY_WORKFLOW]) {
        assert.ok(errorsFor(incident, 'HFS_HOST_CRON', file).length > 0, `${edition}: HFS_HOST_CRON at ${file}`);
        assert.ok(errorsFor(incident, 'HFS_DEPLOY_COMPOSE_ON_VPS', file).length > 0,
          `${edition}: HFS_DEPLOY_COMPOSE_ON_VPS at ${file}`);
      }
    });

    await t.test('application-stacks.yaml is required even when deployment automation is present', () => {
      fixture.remove(STACKS_DECLARATION);
      try {
        const missing = fixture.check();
        assert.equal(missing.ok, false);
        assert.ok(errorsFor(missing, 'HFS_SLOT_REQUIRED_MISSING', STACKS_DECLARATION)
          .some(finding => finding.slot === 'app.starcistacks'), `${edition}: HFS_SLOT_REQUIRED_MISSING for application-stacks.yaml`);
      } finally {
        fixture.writeManifest();
      }
    });

    const declarationExpectation = edition === 'lite'
      ? 'lite production without docker-swarm is refused by the stacks declaration check'
      : 'full production may declare a non-Swarm runtime without being forced to Swarm';
    await t.test(declarationExpectation, () => {
      assert.equal(fixture.manifest.environments.production.runtime, 'docker-compose');
      const shape = findingsFor(incident, 'HFS_STACKS_SHAPE', STACKS_DECLARATION);
      if (edition === 'lite') {
        assert.ok(shape.some(finding => finding.level === 'error' && finding.message.includes('docker-swarm')),
          'lite: missing HFS_STACKS_SHAPE for production without docker-swarm; host-cron findings do not prove this obligation');
        return;
      }
      assert.deepEqual(shape, [], 'full: the non-Swarm production declaration is accepted');
      fixture.remove(DEPLOY_SCRIPT);
      fixture.remove(DEPLOY_WORKFLOW);
      const declared = fixture.check();
      assert.equal(declared.machine.status, 'ran');
      assert.deepEqual(declared.findings.filter(finding => finding.code === 'HFS_STACKS_SHAPE'), [],
        'full: non-Swarm production without the violating automation has no stacks shape findings');
    });

    fixture.repair();
    const repaired = fixture.check();
    await t.test('the same fixture with declared Swarm ingress and no host cron or Compose has no incident findings', () => {
      assert.equal(fixture.manifest.environments.production.runtime, 'docker-swarm');
      assert.equal(repaired.machine.status, 'ran');
      for (const code of ['HFS_STACKS_SHAPE', 'HFS_HOST_CRON', 'HFS_DEPLOY_COMPOSE_ON_VPS']) {
        assert.deepEqual(repaired.findings.filter(finding => finding.code === code), [], `${edition}: repaired ${code}`);
      }
      assert.deepEqual(findingsFor(repaired, 'HFS_SLOT_REQUIRED_MISSING', STACKS_DECLARATION), [],
        `${edition}: repaired application-stacks.yaml requirement`);
    });
  });
}
