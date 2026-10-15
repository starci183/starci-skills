// proves: HFS_IDENTITY_CUSTODY@full
// proves: SEALED_CUSTODY_LOCATION@full
// proves: SEALED_FILE_IN_WORK@lite
// proves: SEALED_FILE_IN_WORK@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateWork } from '../../scripts/work/validate/work-validate.mjs';

const examples = { lite: 'lite-app', full: 'ecommerce-app' };
const identityPath = '.starciwork/_resources/identities/demo/resource.yaml';
const accountsPath = '.starciwork/features/f/uat/x/accounts.yaml';
const identity = sealed => JSON.stringify({ schema: 'work/resource@1', id: 'identity.f.demo', kind: 'identity', owner: 'fixture', revision: 'planned@2026-10-15', disposable: true, custody: { provider: 'keycloak', sealed }, roles: ['person'], details: {} });
const accounts = role => JSON.stringify({ schema: 'work/disposable-accounts@1', accounts: [{ role, identity: 'identity.f.demo' }] });
function appFixture(t, edition, files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-identity-proof-'));
  t.after(() => {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const declaration = fs.readFileSync(new URL('../../examples/' + examples[edition] + '/hfs.json', import.meta.url), 'utf8');
  const defaults = {
    'hfs.json': declaration,
    '.starciwork/brand/index.yaml': JSON.stringify({ schema: 'work/brand@1', id: 'brand', state: 'todo' }),
  };
  if (edition === 'full') Object.assign(defaults, {
    '.starciwork/index.yaml': JSON.stringify({ schema: 'work/catalog@1', id: 'fixture', features: [] }),
    [identityPath]: identity('.starcistacks/dev/secrets/identity-demo.enc'),
    '.starciwork/features/f/index.yaml': JSON.stringify({ schema: 'work/feature@1', id: 'f', title: 'fixture', description: 'custody proof' }),
    '.starciwork/features/f/uat/x/index.yaml': JSON.stringify({ schema: 'work/uat-flow@1', id: 'uat.f.x', title: 'fixture', state: 'todo', accounts: 'accounts.yaml' }),
    [accountsPath]: accounts('person'),
  });
  for (const [relative, content] of Object.entries({ ...defaults, ...files })) {
    const target = path.join(root, ...relative.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return path.join(root, '.starciwork');
}
const custodyFindings = work => validateWork(work).refused;

for (const edition of ['lite', 'full']) {
  test(edition + ' passes Work without sealed custody bytes', t => {
    assert.deepEqual(custodyFindings(appFixture(t, edition)).filter(line => line.includes('SEALED_FILE_IN_WORK')), []);
  });
  test(edition + ' rejects sealed custody bytes inside the Work brand tree', t => {
    const work = appFixture(t, edition, { '.starciwork/brand/custody.enc': 'sealed fixture marker\n' });
    assert.ok(custodyFindings(work).some(line => line.includes('SEALED_FILE_IN_WORK') && line.includes('custody.enc')));
  });
}

test('full passes app-root identity custody and a role the identity presents', t => {
  const work = appFixture(t, 'full');
  assert.deepEqual(custodyFindings(work).filter(line => line.includes('HFS_IDENTITY_CUSTODY')), []);
  assert.deepEqual(custodyFindings(work).filter(line => line.includes('SEALED_CUSTODY_LOCATION')), []);
});
test('full rejects identity custody whose filename does not match its slug', t => {
  const work = appFixture(t, 'full', { [identityPath]: identity('.starcistacks/dev/secrets/uat.enc') });
  assert.ok(custodyFindings(work).some(line => line.includes('HFS_IDENTITY_CUSTODY') && line.includes('identity-demo.enc')));
});
test('full rejects custody sealed under a side instead of the app root', t => {
  const work = appFixture(t, 'full', { [identityPath]: identity('be/.starcistacks/dev/secrets/identity-demo.enc') });
  assert.ok(custodyFindings(work).some(line => line.includes('SEALED_CUSTODY_LOCATION') && line.includes('under the be/ side')));
});
test('full rejects UAT selecting a role its identity does not present', t => {
  const work = appFixture(t, 'full', { [accountsPath]: accounts('admin') });
  assert.ok(custodyFindings(work).some(line => line.includes('HFS_IDENTITY_CUSTODY') && line.includes('role admin')));
});
