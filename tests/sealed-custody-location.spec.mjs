import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateWork } from '../scripts/checks/work-validate.mjs';
import { SEALED_LOCATION_RE } from '../scripts/checks/check-work-artifacts.mjs';
import { loadCatalog } from '../scripts/kernel/why.mjs';

// Owner ruling 2026-09-29, corrected 2026-10-01: a sealed secret lives only at .starcistacks/<env>/secrets/<slug>.enc
// (app-relative: .starcistacks sits at the app root beside the Work tree, never under be/); the Work tree holds the identity record whose custody.sealed points there and never a sealed file. Fixtures hold no values.
function tree(sealed, extra = {}, provider = 'keycloak') {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-sealed-'));
  const files = {
    '.starciwork/index.yaml': 'schema: work/catalog@1\nid: fixture\nfeatures: []\n',
    '.starciwork/_resources/identities/collab/resource.yaml': `schema: work/resource@1\nid: identity.nivo.collab\nkind: identity\nowner: nivo-be\nrevision: planned@2026-09-29\ndisposable: true\ncustody: {provider: ${provider}${sealed === undefined ? '' : `, sealed: ${JSON.stringify(sealed)}`}}\nroles: [host]\n`,
    ...extra,
  };
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(repo, ...rel.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, 'utf8');
  }
  return { repo, work: path.join(repo, '.starciwork') };
}

const codes = list => list.filter(line => /SEALED_/.test(line));

test('the location pattern accepts exactly .starcistacks/<env>/secrets/<slug>.enc at the app root, app-relative; the side form is not it', () => {
  for (const ok of ['.starcistacks/dev/secrets/collab-uat.enc', '.starcistacks/vps/secrets/uat.enc']) assert.ok(SEALED_LOCATION_RE.test(ok), ok);
  for (const bad of ['.starciwork/_resources/identities/collab/secrets.enc.yaml', '.starcistacks/dev/secrets/collab/secrets.yaml.enc',
    '.starcistacks/dev/secrets/collab.yaml.enc', '.starcistacks/dev/runtime/collab.enc', 'none - planned', '', 'be/.starcistacks/dev/secrets/collab-uat.enc', 'fe/.starcistacks/dev/secrets/collab-uat.enc', '.starcistacks/dev/secrets/x.enc/../y.enc']) {
    assert.ok(!SEALED_LOCATION_RE.test(bad), bad);
  }
});

test('a sealed path under the app root .starcistacks/<env>/secrets/ raises no sealed refusal, in default and strict mode', (t) => {
  const { repo, work } = tree('.starcistacks/dev/secrets/identity-collab.enc');
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  for (const strict of [false, true]) {
    const report = validateWork(work, { strict });
    assert.deepEqual(codes(report.refused), [], report.refused.join('\n'));
    assert.ok(!report.refused.some(r => r.includes('identity.nivo.collab') || r.includes('collab/resource.yaml')), report.refused.join('\n'));
  }
});

for (const [name, sealed] of [
  ['a path inside .starciwork', '.starciwork/_resources/identities/collab/secrets.enc.yaml'],
  ['the be side form be/.starcistacks/...', 'be/.starcistacks/dev/secrets/identity-collab.enc'],
  ['a per-slug directory', '.starcistacks/dev/secrets/collab/secrets.yaml.enc'],
  ['the retired none placeholder', 'none - not sealed yet'],
]) {
  test(`custody.sealed as ${name} is refused with SEALED_CUSTODY_LOCATION and never opened`, (t) => {
    const { repo, work } = tree(sealed);
    t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
    const report = validateWork(work);
    assert.equal(report.ok, false);
    assert.ok(report.refused.some(r => r.includes('SEALED_CUSTODY_LOCATION')), report.refused.join('\n'));
    const strict = validateWork(work, { strict: true });
    assert.ok(strict.refused.some(r => r.includes('SCHEMA_VIOLATION') && r.includes('collab/resource.yaml')), strict.refused.join('\n'));
  });
}

test('the be side form be/.starcistacks/... is refused by name: the SEALED_CUSTODY_LOCATION message says it sits under the be/ side', (t) => {
  const { repo, work } = tree('be/.starcistacks/dev/secrets/identity-collab.enc');
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const refused = validateWork(work).refused.filter(r => r.includes('SEALED_CUSTODY_LOCATION'));
  assert.ok(refused.some(r => r.includes('under the be/ side') && r.includes('.starcistacks lives only at the app root')), refused.join('\n'));
});

test('provider: none is the one holds-no-secret form: it carries no sealed key, and a sealed key on it is refused', (t) => {
  const none = tree(undefined, {}, 'none');
  const bad = tree('.starcistacks/dev/secrets/collab-uat.enc', {}, 'none');
  const missing = tree(undefined);
  t.after(() => { for (const x of [none, bad, missing]) fs.rmSync(x.repo, { recursive: true, force: true }); });
  for (const strict of [false, true]) {
    assert.deepEqual(codes(validateWork(none.work, { strict }).refused), []);
    assert.ok(validateWork(bad.work, { strict }).refused.some(r => strict ? r.includes('SCHEMA_VIOLATION') : r.includes('SEALED_CUSTODY_LOCATION')));
    assert.ok(validateWork(missing.work, { strict }).refused.some(r => strict ? r.includes('SCHEMA_VIOLATION') : r.includes('SEALED_CUSTODY_LOCATION')));
  }
});

test('a sealed file kept under .starciwork is refused with SEALED_FILE_IN_WORK', (t) => {
  const { repo, work } = tree('.starcistacks/dev/secrets/identity-collab.enc', {
    '.starciwork/_resources/identities/collab/secrets.enc.yaml': 'placeholder: not a secret\n',
  });
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const report = validateWork(work);
  assert.equal(report.ok, false);
  assert.ok(report.refused.some(r => r.includes('SEALED_FILE_IN_WORK') && r.includes('secrets.enc.yaml')), report.refused.join('\n'));
});

test('both codes are catalogued with Vietnamese text', () => {
  const catalog = loadCatalog();
  for (const code of ['SEALED_CUSTODY_LOCATION', 'SEALED_FILE_IN_WORK']) {
    assert.match(catalog[code].title_vi, /\S/);
    assert.match(catalog[code].nextStep_vi, /git mv|custody\.sealed/);
  }
});
