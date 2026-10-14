// proves: HFS_CANON_PIN_DRIFT@lite
// proves: HFS_CANON_PIN_DRIFT@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { openHfs } from '../../scripts/hfs/slots.mjs';
import { pinFindings } from '../../scripts/hfs/pin-findings.mjs';

const CODE = 'HFS_CANON_PIN_DRIFT';
const pins = parseYaml(fs.readFileSync(path.resolve(import.meta.dirname, '../../knowledge/hfs/canon-pins.yaml'), 'utf8')).pins;

for (const edition of ['lite', 'full']) {
  for (const section of ['dependencies', 'devDependencies']) {
    test(`${CODE}@${edition}: ${section} must use the exact canon version`, (t) => {
      const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-proof-pins-'));
      t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
      fs.writeFileSync(path.join(repoRoot, 'hfs.json'), JSON.stringify({ hfs: 3, kind: 'app', project: 'proof', edition, sides: { be: { apps: [{ name: 'api', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } } }));
      const { repo } = openHfs({ repoRoot });
      assert.equal(repo.edition, edition);
      const write = (version) => fs.writeFileSync(path.join(repoRoot, 'package.json'), JSON.stringify({ private: true, [section]: { typescript: version } }));
      const check = () => pinFindings({ repoRoot, files: ['package.json'], profile: repo.profile, pins });
      write(`^${pins.typescript.version}`);
      const [drift] = check();
      assert.equal(drift.code, CODE);
      assert.equal(drift.path, 'package.json');
      assert.equal(drift.dependency, 'typescript');
      assert.equal(drift.section, section);
      assert.equal(drift.pinned, pins.typescript.version);
      assert.equal(drift.declared, `^${pins.typescript.version}`);
      write(pins.typescript.version);
      assert.deepEqual(check(), []);
    });
  }
}
