// proves: HFS_FORMAT@lite
// proves: HFS_FORMAT@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { openHfs } from '../../scripts/hfs/slots.mjs';
import { formatFindings, loadPrettier } from '../../packages/hfs/sync/format.mjs';

const CODE = 'HFS_FORMAT';
const prettierRoot = path.dirname(createRequire(import.meta.url).resolve('prettier/package.json'));

for (const edition of ['lite', 'full']) {
  test(`${CODE}@${edition}: the installed formatter reports a file and accepts its formatted output`, async (t) => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-proof-format-'));
    t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
    fs.writeFileSync(path.join(repoRoot, 'hfs.json'), JSON.stringify({ hfs: 3, kind: 'app', project: 'proof', edition, sides: { be: { apps: [{ name: 'api', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } } }));
    fs.writeFileSync(path.join(repoRoot, 'package.json'), JSON.stringify({ private: true }));
    fs.writeFileSync(path.join(repoRoot, '.prettierrc'), JSON.stringify({ semi: true, singleQuote: true }));
    fs.mkdirSync(path.join(repoRoot, 'node_modules'));
    fs.symlinkSync(prettierRoot, path.join(repoRoot, 'node_modules/prettier'), 'junction');
    const { repo } = openHfs({ repoRoot });
    assert.equal(repo.edition, edition);
    const file = 'example.ts';
    const absolute = path.join(repoRoot, file);
    const source = 'export const example={value:1}\n';
    fs.writeFileSync(absolute, source);
    const check = () => formatFindings({ repoRoot, files: [file], repo });
    const [finding] = await check();
    assert.equal(finding.code, CODE);
    assert.equal(finding.level, 'error');
    assert.equal(finding.path, file);
    const prettier = loadPrettier(repoRoot);
    const options = await prettier.resolveConfig(absolute);
    fs.writeFileSync(absolute, await prettier.format(source, { ...options, filepath: absolute }));
    assert.deepEqual(await check(), []);
  });
}
