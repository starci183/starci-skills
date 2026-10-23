// proves: HFS_CANON_PIN_DRIFT@lite
// proves: HFS_CANON_PIN_DRIFT@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseYaml } from '../runtime/engine/yaml.mjs';
import { checkRepo } from '../runtime/scripts/hfs/check.mjs';

const CODE = 'HFS_CANON_PIN_DRIFT';
const pins = parseYaml(fs.readFileSync(path.resolve(import.meta.dirname, '../runtime/knowledge/hfs/canon-pins.yaml'), 'utf8')).pins;

for (const edition of ['lite', 'full']) {
  test(`${CODE}@${edition}: repository check rejects a drifting pin and accepts the exact version`, (t) => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-proof-pin-checker-'));
    t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
    const declaration = { hfs: 3, kind: 'app', project: 'proof', edition, sides: { be: { apps: [{ name: 'api', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } } };
    fs.writeFileSync(path.join(repoRoot, 'hfs.json'), JSON.stringify(declaration));
    fs.mkdirSync(path.join(repoRoot, 'be'));
    fs.mkdirSync(path.join(repoRoot, 'fe'));
    const write = (version) => fs.writeFileSync(path.join(repoRoot, 'package.json'), JSON.stringify({ private: true, devDependencies: { typescript: version } }));
    const findings = () => checkRepo({ repoRoot, files: ['hfs.json', 'package.json'] }).findings.filter((finding) => finding.code === CODE);

    write(`^${pins.typescript.version}`);
    assert.deepEqual(findings().map((finding) => finding.code), [CODE]);
    write(pins.typescript.version);
    assert.deepEqual(findings(), []);
  });
}
