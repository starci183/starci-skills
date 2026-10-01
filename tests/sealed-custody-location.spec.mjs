import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateWork } from '../scripts/checks/work-validate.mjs';
import { SEALED_LOCATION_RE } from '../scripts/checks/check-work-artifacts.mjs';
import { loadCatalog } from '../scripts/kernel/why.mjs';

// Owner ruling 2026-09-29: a sealed secret lives only at be/.starcistacks/<env>/secrets/<slug>.enc (app-relative: the
// Work tree sits at the app root, .starcistacks is the be side's); the Work tree holds the identity record whose custody.sealed points there and never a sealed file. Fixtures hold no values.
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

test('the location pattern accepts exactly be/.starcistacks/<env>/secrets/<slug>.enc, app-relative', () => {
  for (const ok of ['be/.starcistacks/dev/secrets/collab-uat.enc', 'be/.starcistacks/vps/secrets/uat.enc']) assert.ok(SEALED_LOCATION_RE.test(ok), ok);
  for (const bad of ['.starciwork/_resources/identities/collab/secrets.enc.yaml', 'be/.starcistacks/dev/secrets/collab/secrets.yaml.enc',
    'be/.starcistacks/dev/secrets/collab.yaml.enc', 'be/.starcistacks/dev/runtime/collab.enc', 'none - planned', '', '.starcistacks/dev/secrets/collab-uat.enc', 'fe/.starcistacks/dev/secrets/collab-uat.enc', 'be/.starcistacks/dev/secrets/x.enc/../y.enc']) {
    assert.ok(!SEALED_LOCATION_RE.test(bad), bad);
  }
});

test('a sealed path under be/.starcistacks/<env>/secrets/ raises no sealed refusal, in default and strict mode', (t) => {
  const { repo, work } = tree('be/.starcistacks/dev/secrets/identity-collab.enc');
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  for (const strict of [false, true]) {
    const report = validateWork(work, { strict });
    assert.deepEqual(codes(report.refused), [], report.refused.join('\n'));
    assert.ok(!report.refused.some(r => r.includes('identity.nivo.collab') || r.includes('collab/resource.yaml')), report.refused.join('\n'));
  }
});

for (const [name, sealed] of [
  ['a path inside .starciwork', '.starciwork/_resources/identities/collab/secrets.enc.yaml'],
  ['a side-relative path without the be/ prefix', '.starcistacks/dev/secrets/identity-collab.enc'],
  ['a per-slug directory', 'be/.starcistacks/dev/secrets/collab/secrets.yaml.enc'],
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

test('provider: none is the one holds-no-secret form: it carries no sealed key, and a sealed key on it is refused', (t) => {
  const none = tree(undefined, {}, 'none');
  const bad = tree('be/.starcistacks/dev/secrets/collab-uat.enc', {}, 'none');
  const missing = tree(undefined);
  t.after(() => { for (const x of [none, bad, missing]) fs.rmSync(x.repo, { recursive: true, force: true }); });
  for (const strict of [false, true]) {
    assert.deepEqual(codes(validateWork(none.work, { strict }).refused), []);
    assert.ok(validateWork(bad.work, { strict }).refused.some(r => strict ? r.includes('SCHEMA_VIOLATION') : r.includes('SEALED_CUSTODY_LOCATION')));
    assert.ok(validateWork(missing.work, { strict }).refused.some(r => strict ? r.includes('SCHEMA_VIOLATION') : r.includes('SEALED_CUSTODY_LOCATION')));
  }
});

test('a sealed file kept under .starciwork is refused with SEALED_FILE_IN_WORK', (t) => {
  const { repo, work } = tree('be/.starcistacks/dev/secrets/identity-collab.enc', {
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
