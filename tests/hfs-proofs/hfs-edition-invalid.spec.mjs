// proves: HFS_EDITION_INVALID@lite
// proves: HFS_EDITION_INVALID@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkRepo } from '../../scripts/hfs/check.mjs';
import { loadSlotManifest, resolveRepoDeclaration } from '../../scripts/hfs/slots.mjs';
import { checkEdition } from '../../packages/hfs/upgrade/check.mjs';

const manifest = loadSlotManifest();
for (const edition of ['lite', 'full']) {
  test(`HFS_EDITION_INVALID: refuse a misspelled ${edition} declaration and accept its repair`, async (t) => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-invalid-edition-'));
    t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
    const declaration = {
      hfs: 3, kind: 'app', project: 'demo', edition,
      sides: { be: { apps: [{ name: 'api', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } },
    };
    const check = () => checkRepo({ repoRoot, files: ['hfs.json'], tree: false });
    const invalid = { ...declaration, edition: `${edition}-unknown` };
    fs.writeFileSync(path.join(repoRoot, 'hfs.json'), JSON.stringify(invalid));
    assert.throws(() => resolveRepoDeclaration(manifest, invalid), (error) =>
      error.code === 'HFS_EDITION_INVALID' && error.details.edition === invalid.edition);
    const refused = check();
    assert.equal(refused.ok, false);
    assert.deepEqual(refused.findings.map(({ code, path: file, level }) => ({ code, file, level })), [{
      code: 'HFS_EDITION_INVALID', file: 'hfs.json', level: 'error',
    }]);

    fs.writeFileSync(path.join(repoRoot, 'hfs.json'), JSON.stringify(declaration));
    assert.equal(resolveRepoDeclaration(manifest, declaration).edition, edition);
    assert.deepEqual(check().findings.filter((finding) => finding.code === 'HFS_EDITION_INVALID'), []);

    // Keep a valid, explicitly editioned app on disk while testing the CLI's edition selector as well.
    let normalCalls = 0;
    const normal = () => { normalCalls += 1; return 'normal-check'; };
    await assert.rejects(checkEdition({ repoRoot, edition: `${edition}-unknown`, normal, manifest }),
      (error) => error.code === 'HFS_EDITION_INVALID');
    assert.equal(normalCalls, 0, 'an invalid selector must refuse before the normal check');
    if (edition === 'full') {
      await assert.rejects(checkEdition({ repoRoot, edition: 'lite', normal, manifest }),
        (error) => error.code === 'HFS_EDITION_INVALID' && /only an edition lite app to full/.test(error.message));
      assert.equal(normalCalls, 0, 'a full app cannot be judged with a lite override');
    }
    assert.equal(await checkEdition({ repoRoot, edition, normal, manifest }), 'normal-check');
    assert.equal(normalCalls, 1, 'the matching selector runs the existing edition check');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(repoRoot, 'hfs.json'), 'utf8')), declaration);
  });
}
