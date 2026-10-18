import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { renderTargets } from '../sync/index.mjs';
import { ciWorkflowCommands } from '../sync/ci-commands.mjs';
import { parseYaml } from '../runtime/engine/yaml.mjs';

const report = 'be/coverage/lcov.info';
const check = 'npx starci app check --coverage-from ' + report;
const exampleCheck = 'node node_modules/@starci/hfs/runtime/scripts/hfs/example-secrets.mjs --run . -- ' + check;
const wire = 'fe/apps/web/src/modules/api/graphql/__generated__/wire.ts';
const quote = value => process.platform === 'win32' ? `"${value}"` : "'" + value.replaceAll("'", "'\\''") + "'";
const nodeCommand = file => [process.execPath, file].map(quote).join(' ');

/** Preserve the rendered shell sequence; only its external generator and check processes are fixture doubles. */
function exercise(t, command, invocation, codegenExit) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-ci-coverage-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, '.gitignore'), '__generated__/\n');
  const generator = path.join(root, 'generate.cjs');
  const checker = path.join(root, 'check.cjs');
  fs.writeFileSync(generator, `const fs = require('node:fs');
const code = Number(process.argv[2]);
if (code) process.exit(code);
fs.mkdirSync(${JSON.stringify(path.posix.dirname(wire))}, { recursive: true });
fs.writeFileSync(${JSON.stringify(wire)}, 'export type Wire = string;\\n');
`);
  fs.writeFileSync(checker, `const fs = require('node:fs');
fs.writeFileSync('check-called', 'yes');
if (!fs.existsSync(${JSON.stringify(wire)})) {
  console.error('generated wire input is missing');
  process.exit(1);
}
fs.writeFileSync('proof-passed', 'yes');
`);
  assert.equal(fs.existsSync(path.join(root, wire)), false, 'the fresh job starts without ignored generated inputs');
  assert.ok(command.includes(invocation), 'the rendered check process is available at its existing boundary');
  const run = command.replace(invocation, nodeCommand(checker))
    .replace('npm run codegen --silent', nodeCommand(generator) + ' ' + codegenExit);
  assert.doesNotMatch(run, /\b(?:npm|npx)\b/, 'all external app programs are substituted; the fixture never installs or downloads');
  const result = spawnSync(run, { cwd: root, encoding: 'utf8', shell: true, windowsHide: true, timeout: 15_000 });
  assert.equal(result.status, codegenExit, result.error?.message ?? `${result.stdout}${result.stderr}`);
  assert.equal(fs.existsSync(path.join(root, 'check-called')), codegenExit === 0, 'a failed generator stops the check');
  assert.equal(fs.existsSync(path.join(root, 'proof-passed')), codegenExit === 0, 'the check runs with generated inputs');
}

for (const edition of ['full', 'lite']) {
  test(`${edition} fresh coverage prepares ignored wire inputs and stops when codegen fails`, t => {
    const hfs = { hfs: 3, kind: 'app', edition, project: 'coverage-proof', sides: {
      be: { apps: [{ name: 'api', kind: 'api' }] },
      fe: { apps: [{ name: 'web', kind: 'next' }], reads: ['be/contracts/'] },
    } };
    const target = renderTargets(hfs, {}).find(item => item.path === '.github/workflows/ci.yml');
    assert.ok(target, 'the managed CI is rendered');
    const step = parseYaml(target.content).jobs.coverage.steps.find(item => item.name === 'coverage proof');
    assert.ok(step, 'the coverage proof belongs to the fresh coverage job');
    for (const code of [0, 7]) exercise(t, step.run, check, code);
  });
}

test('runtime examples prepare wire inputs before the isolated check starts', t => {
  const command = ciWorkflowCommands({ runtimeExample: true }).ciCoverageProof;
  for (const code of [0, 7]) exercise(t, command, exampleCheck, code);
});
