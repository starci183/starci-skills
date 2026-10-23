// proves: STACKS_SECRET_NOT_EXTERNAL@full STACKS_SECRET_UNVERSIONED@full STACKS_SECRET_ENV_LITERAL@full
// proves: STACKS_PORT_PUBLISHED@full STACKS_SECOND_INGRESS@full STACKS_DNS_UNDECLARED@full
// proves: STACKS_HOST_UNROUTED@full STACKS_TLS_UNDECLARED@full STACKS_PLACEMENT_MISSING@full
// proves: STACKS_HEALTHCHECK_MISSING@full STACKS_UPDATE_POLICY_MISSING@full
// proves: STACKS_RELEASE_UNDECLARED@full BACKUP_UNDECLARED@full BACKUP_PROOF_MISSING@full STACKS_MODEL_UNAVAILABLE@full
// proves: HFS_SCHEDULE_UNDECLARED@full STACKS_INGRESS_UNDECLARED@full STACKS_INGRESS_UNKNOWN@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stacksSwarmFindings } from '../runtime/scripts/hfs/rules/stacks-swarm.mjs';
import { stacksIngressFindings } from '../runtime/scripts/hfs/rules/stacks-ingress.mjs';
import { stacksReleaseFindings } from '../runtime/scripts/hfs/rules/stacks-release.mjs';

const RECORDS = {
  'model-unavailable': (await import('./fixtures/hfs-stacks-full/model-unavailable.mjs')).default,
  passing: (await import('./fixtures/hfs-stacks-full/passing.mjs')).default,
  violating: (await import('./fixtures/hfs-stacks-full/violating.mjs')).default,
};
const HARDENING_CODES = [
  'STACKS_SECRET_NOT_EXTERNAL', 'STACKS_SECRET_UNVERSIONED', 'STACKS_SECRET_ENV_LITERAL',
  'STACKS_PORT_PUBLISHED', 'STACKS_DNS_UNDECLARED', 'STACKS_HOST_UNROUTED', 'STACKS_TLS_UNDECLARED',
  'STACKS_PLACEMENT_MISSING', 'STACKS_HEALTHCHECK_MISSING', 'STACKS_UPDATE_POLICY_MISSING',
];
const RELEASE_CODES = ['STACKS_RELEASE_UNDECLARED', 'BACKUP_UNDECLARED', 'BACKUP_PROOF_MISSING'];
const INGRESS_CODES = ['STACKS_SECOND_INGRESS', 'STACKS_INGRESS_UNDECLARED', 'STACKS_INGRESS_UNKNOWN'];

function fixture(t, name) {
  const record = structuredClone(RECORDS[name]);
  assert.equal(record.edition, 'full');
  const base = path.resolve(os.tmpdir());
  const repoRoot = fs.mkdtempSync(path.join(base, 'hfs-stacks-full-'));
  t.after(() => {
    assert.ok(repoRoot.startsWith(base + path.sep));
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });
  for (const [relative, content] of Object.entries(record.files)) {
    const target = path.resolve(repoRoot, relative);
    assert.ok(target.startsWith(repoRoot + path.sep));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, typeof content === 'string' ? content : JSON.stringify(content));
  }
  return { context: { repoRoot, files: Object.keys(record.files), isRoot: true,
    repo: { ...record.files['hfs.json'], profile: 'app' } }, expect: record.expect };
}

const compareCodes = (left, right) => left.localeCompare(right);
const distinctCodes = findings => [...new Set(findings.map(finding => finding.code))].sort(compareCodes);

for (const code of HARDENING_CODES) {
  test(`${code}@full: dedicated tracked passing fixture passes`, t => {
    const value = fixture(t, 'passing');
    assert.deepEqual(stacksSwarmFindings(value.context).filter(finding => finding.code === code), []);
  });

  test(`${code}@full: dedicated tracked violating fixture fails`, t => {
    const value = fixture(t, 'violating');
    assert.ok(stacksSwarmFindings(value.context).some(finding => finding.code === code));
  });
}

for (const code of RELEASE_CODES) {
  test(`${code}@full: dedicated tracked passing fixture passes`, t => {
    const value = fixture(t, 'passing');
    assert.deepEqual(stacksReleaseFindings(value.context).filter(finding => finding.code === code), []);
  });

  test(`${code}@full: dedicated tracked violating fixture fails`, t => {
    const value = fixture(t, 'violating');
    assert.ok(stacksReleaseFindings(value.context).some(finding => finding.code === code));
  });
}

for (const code of INGRESS_CODES) {
  test(`${code}@full: dedicated tracked passing fixture passes`, t => {
    const value = fixture(t, 'passing');
    assert.deepEqual(stacksIngressFindings(value.context).filter(finding => finding.code === code), []);
  });

  test(`${code}@full: dedicated tracked violating fixture fails`, t => {
    const value = fixture(t, 'violating');
    assert.ok(stacksIngressFindings(value.context).some(finding => finding.code === code));
  });
}

test('STACKS_MODEL_UNAVAILABLE@full: dedicated tracked passing model passes', t => {
  const value = fixture(t, 'passing');
  assert.deepEqual(stacksReleaseFindings(value.context).filter(finding => finding.code === 'STACKS_MODEL_UNAVAILABLE'), []);
});

test('STACKS_MODEL_UNAVAILABLE@full: dedicated missing rendered model fails', t => {
  const value = fixture(t, 'model-unavailable');
  assert.ok(stacksReleaseFindings(value.context).some(finding => finding.code === 'STACKS_MODEL_UNAVAILABLE'));
});

test('HFS_SCHEDULE_UNDECLARED@full: dedicated declared CLI job passes', t => {
  const value = fixture(t, 'passing');
  assert.deepEqual(stacksReleaseFindings(value.context).filter(finding => finding.code === 'HFS_SCHEDULE_UNDECLARED'), []);
});

test('HFS_SCHEDULE_UNDECLARED@full: dedicated undeclared replicated job fails', t => {
  const value = fixture(t, 'violating');
  assert.ok(stacksReleaseFindings(value.context).some(finding => finding.code === 'HFS_SCHEDULE_UNDECLARED'));
});

for (const name of ['passing', 'violating', 'model-unavailable']) {
  test(`R266/R267/R268/R275@full: dedicated ${name} fixture matches every recorded expectation`, t => {
    const value = fixture(t, name);
    const swarm = stacksSwarmFindings(value.context);
    const ingress = stacksIngressFindings(value.context);
    const release = stacksReleaseFindings(value.context);
    assert.deepEqual(distinctCodes([...swarm, ...ingress.filter(finding => finding.code === 'STACKS_SECOND_INGRESS')]), value.expect.R266.toSorted(compareCodes));
    assert.deepEqual(distinctCodes(release.filter(finding => finding.code !== 'HFS_SCHEDULE_UNDECLARED')), value.expect.R267.toSorted(compareCodes));
    assert.deepEqual(distinctCodes(release.filter(finding => finding.code === 'HFS_SCHEDULE_UNDECLARED')), value.expect.R268.toSorted(compareCodes));
    assert.deepEqual(distinctCodes(ingress.filter(finding => finding.code !== 'STACKS_SECOND_INGRESS')), value.expect.R275.toSorted(compareCodes));
  });
}
