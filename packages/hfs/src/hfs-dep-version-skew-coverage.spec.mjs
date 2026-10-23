// proves: HFS_DEP_VERSION_SKEW@lite
// proves: HFS_DEP_VERSION_SKEW@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openHfs } from '../runtime/scripts/hfs/slots.mjs';
import { depFindings } from '../runtime/scripts/hfs/rules/deps.mjs';

const CODE = 'HFS_DEP_VERSION_SKEW';
const WORKSPACE = 'fe/packages/ui/package.json';

for (const edition of ['lite', 'full']) {
  test(`${CODE}@${edition}: reject a conflicting dependency and accept the aligned version`, (t) => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-proof-direct-deps-'));
    t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
    const files = ['package.json', WORKSPACE];
    fs.mkdirSync(path.dirname(path.join(repoRoot, WORKSPACE)), { recursive: true });
    const declaration = {
      hfs: 3, kind: 'app', project: 'proof', edition,
      sides: {
        be: { apps: [{ name: 'api', kind: 'api' }] },
        fe: { apps: [{ name: 'web', kind: 'next' }], optionalSlots: ['fe.package.ui'] },
      },
    };
    fs.writeFileSync(path.join(repoRoot, 'hfs.json'), JSON.stringify(declaration));
    const { repo } = openHfs({ repoRoot });
    assert.equal(repo.edition, edition);
    fs.writeFileSync(path.join(repoRoot, 'package.json'), JSON.stringify({ private: true, workspaces: ['fe/packages/*'], dependencies: { 'left-pad': '1.3.0' } }));
    fs.writeFileSync(path.join(repoRoot, WORKSPACE), JSON.stringify({ name: '@proof/ui', dependencies: { 'left-pad': '1.0.0' } }));
    assert.equal(depFindings({ repoRoot, files, repo })[0].code, CODE);
    fs.writeFileSync(path.join(repoRoot, WORKSPACE), JSON.stringify({ name: '@proof/ui', dependencies: { 'left-pad': '1.3.0' } }));
    assert.deepEqual(depFindings({ repoRoot, files, repo }), []);
  });
}
