// proves: RT_DOC_NO_OWNER@lite
// proves: RT_DOC_NO_OWNER@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { docOwnerFindings } from '../../scripts/checks/check-doc-owner.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const fixture = (t, edition, header) => {
  const root = mkdtemp(t, `starci-doc-owner-proof-${edition}-`);
  fs.mkdirSync(path.join(root, 'docs'));
  fs.mkdirSync(path.join(root, 'knowledge/hfs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'hfs.json'), JSON.stringify({ hfs: 3, kind: 'app', project: 'proof', edition, sides: { be: { apps: [{ name: 'api', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } } }));
  fs.writeFileSync(path.join(root, 'knowledge/hfs/rules.yaml'), 'rules: []\n');
  fs.writeFileSync(path.join(root, 'docs/rules.md'), `${header}# Rules guide\n\nThe catalog owns these application rules.\n`);
  return root;
};

for (const edition of ['lite', 'full']) {
  test(`${edition}: a document without an ownership header is refused`, (t) => {
    const findings = docOwnerFindings(fixture(t, edition, ''));
    assert.deepEqual(findings.map((f) => [f.code, f.path]), [['RT_DOC_NO_OWNER', 'docs/rules.md']]);
    assert.match(findings[0].message, /first non-empty line.*Owner:.*Task:/);
  });

  test(`${edition}: a document that names an existing catalog owner passes`, (t) => {
    assert.deepEqual(docOwnerFindings(fixture(t, edition, 'Owner: knowledge/hfs/rules.yaml\n')), []);
  });
}
