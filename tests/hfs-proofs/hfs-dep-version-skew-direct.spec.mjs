// proves: HFS_DEP_VERSION_SKEW@lite
// proves: HFS_DEP_VERSION_SKEW@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openHfs } from '../../scripts/hfs/slots.mjs';
import { depFindings } from '../../scripts/hfs/rules/deps.mjs';

const CODE = 'HFS_DEP_VERSION_SKEW';
const WORKSPACE = 'fe/packages/ui/package.json';

for (const edition of ['lite', 'full']) {
  test(`${CODE}@${edition}: direct checker rejects conflicting declarations and accepts one version`, (t) => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-proof-deps-direct-'));
    t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
    const declaration = { hfs: 3, kind: 'app', project: 'proof', edition, sides: { be: { apps: [{ name: 'api', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }], optionalSlots: ['fe.package.ui'] } } };
    fs.writeFileSync(path.join(repoRoot, 'hfs.json'), JSON.stringify(declaration));
    assert.equal(openHfs({ repoRoot }).repo.edition, edition);
    fs.writeFileSync(path.join(repoRoot, 'package.json'), JSON.stringify({ dependencies: { 'left-pad': '1.3.0' } }));
    fs.mkdirSync(path.dirname(path.join(repoRoot, WORKSPACE)), { recursive: true });
    const write = (version) => fs.writeFileSync(path.join(repoRoot, WORKSPACE), JSON.stringify({ name: '@proof/ui', dependencies: { 'left-pad': version } }));
    const files = ['package.json', WORKSPACE];

    write('1.0.0');
    assert.deepEqual(depFindings({ repoRoot, files }).map((finding) => finding.code), [CODE]);
    write('1.3.0');
    assert.deepEqual(depFindings({ repoRoot, files }), []);
  });
}
