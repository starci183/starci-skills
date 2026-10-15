// proves: RT_CLI_CATALOG_DRIFT@lite
// proves: RT_CLI_CATALOG_DRIFT@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const generator = fileURLToPath(new URL('../../scripts/cli/gen-catalog.mjs', import.meta.url));
const globalYaml = `commands: [explain]
flags:
  - {name: json, type: boolean}
  - {name: cwd, type: string}
  - {name: quiet, type: boolean}
  - {name: help, type: boolean}
  - {name: edition, type: enum, enum: [full, lite]}
`;

function fixture(t, edition) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-r198-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const put = (file, text) => {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  };
  put('package.json', JSON.stringify({ name: 'starci', version: '0.0.0-fixture' }));
  put('modules/cli/commands/_global.yaml', globalYaml);
  put('modules/cli/commands/kernel/_group.yaml', 'group: kernel\nsummary: kernel verbs\nowner: runtime\nruntimeSide: host\n');
  put('modules/cli/commands/kernel/settle.yaml', `group: kernel
verb: settle
owner: runtime
summary: settle the fixture
impl: {script: scripts/kernel/cli.mjs, args: [settle]}
flags: []
exit: {0: clean, 1: findings, 2: bad usage}
json: flag
examples: ['starci kernel settle']
editions: [${edition}]
`);
  return root;
}

const run = (root, mode) => spawnSync(process.execPath, [generator, mode, '--root', root], { encoding: 'utf8' });

for (const edition of ['lite', 'full']) {
  test(`${edition} valid generated catalog passes the drift checker`, (t) => {
    const root = fixture(t, edition);
    const write = run(root, '--write');
    assert.equal(write.status, 0, write.stderr);
    const check = run(root, '--check');
    assert.equal(check.status, 0, check.stderr);
    assert.ok(!check.stderr.includes('RT_CLI_CATALOG_DRIFT'));
  });

  test(`${edition} invalid generated documentation produces catalog drift`, (t) => {
    const root = fixture(t, edition);
    const write = run(root, '--write');
    assert.equal(write.status, 0, write.stderr);
    fs.appendFileSync(path.join(root, 'docs/cli.md'), '\nUnrendered fixture text.\n');
    const check = run(root, '--check');
    assert.equal(check.status, 1, check.stderr);
    assert.ok(check.stderr.includes('RT_CLI_CATALOG_DRIFT'));
    assert.ok(check.stderr.includes('docs/cli.md'));
  });
}
