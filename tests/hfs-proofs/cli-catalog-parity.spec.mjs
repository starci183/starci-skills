// proves: RT_CLI_VERB_PARITY@lite
// proves: RT_CLI_VERB_PARITY@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkCliParity } from '../../scripts/checks/check-cli-parity.mjs';

const globalYaml = `commands: [explain]
flags:
  - {name: json, type: boolean}
  - {name: cwd, type: string}
  - {name: quiet, type: boolean}
  - {name: help, type: boolean}
  - {name: edition, type: enum, enum: [full, lite]}
`;

function fixture(t, edition, handler) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-r199-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const put = (file, text) => {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  };
  put('modules/cli/commands/_global.yaml', globalYaml);
  put('modules/cli/commands/_internal.yaml', 'internal: []\n');
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
  if (handler) put('scripts/kernel/cli.mjs', [
    'const usage = () => console.error(`use: starci kernel <verb>\n  settle`);',
    'const main = () => { switch (command) {',
    "  case 'settle': return 0;",
    '  default: return 2;',
    '} };',
  ].join('\n'));
  return root;
}

for (const edition of ['lite', 'full']) {
  test(`${edition} valid catalog verb resolves its handler`, (t) => {
    assert.deepEqual(checkCliParity(fixture(t, edition, true), { files: [] }).findings, []);
  });

  test(`${edition} invalid catalog verb rejects a missing handler`, (t) => {
    const report = checkCliParity(fixture(t, edition, false), { files: [] });
    assert.equal(report.ok, false);
    assert.ok(report.findings.some(({ rule, what }) => rule === 'RT_CLI_VERB_PARITY' && what === 'handler:kernel/settle'));
  });
}
