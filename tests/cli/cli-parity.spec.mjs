// cli-parity.spec.mjs — RT_CLI_VERB_PARITY (R199): the catalog of modules/cli/commands
// and the code agree (scripts/checks/check-cli-parity.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { checkCliParity, checkCliParityMain, flagsOfUsage } from '../../scripts/checks/check-cli-parity.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const GLOBAL_YAML = `flags:
  - {name: json, type: boolean}
  - {name: cwd, type: string}
  - {name: quiet, type: boolean}
  - {name: help, type: boolean}
  - {name: edition, type: enum, enum: [full]}
`;
const GROUP_YAML = `group: kernel\nsummary: kernel verbs\nowner: runtime\nsince: 1.0.0-alpha.4\n`;
const flagSig = (f) => (typeof f === 'string' ? `{name: ${f}, type: string, required: true}` : `{name: ${f[0]}, type: ${f[1]}${f[2] ? ', required: true' : ''}}`);
const verbYaml = (verb, flags) => `group: kernel
verb: ${verb}
owner: runtime
summary: test verb ${verb}
impl: {script: scripts/kernel/cli.mjs, args: [${verb}]}
flags: [${flags.map(flagSig).join(', ')}]
exit: {0: ok, 1: refused, 2: bad usage}
json: flag
examples: ['starci kernel ${verb} --repo <path>']
editions: [full]
since: 1.0.0-alpha.4
removed: ['starci api ${verb}']
`;
const verbModule = (verb, usage, required) => `export default {
  verb: '${verb}',
  required: [${required.map((r) => `'${r}'`).join(', ')}],
  usage: '${usage}',
  run() { return { ok: true }; },
};
`;
const CLI_MJS = `const usage = (code) => {
  console.error(\`use: node scripts/kernel/cli.mjs <cmd> --repo <path> [...]
  probe   --workflow <id> [--deep]\`);
  process.exit(code);
};
const main = async () => {
  switch (cmd) {
    case 'builtin': return 0;
    case 'settle': return 0;
    default: return 2;
  }
};
`;

const fixture = (edit) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-cli-parity-'));
  const put = (rel, text) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
  put('modules/cli/commands/_global.yaml', GLOBAL_YAML);
  put('modules/cli/commands/kernel/_group.yaml', GROUP_YAML);
  put('modules/cli/commands/kernel/probe.yaml', verbYaml('probe', ['workflow', ['deep', 'boolean']]));
  put('modules/cli/commands/kernel/builtin.yaml', verbYaml('builtin', ['job']));
  put('modules/cli/commands/kernel/settle.yaml', verbYaml('settle', ['job', ['sync-tail', 'boolean']]));
  put('scripts/kernel/cli.mjs', CLI_MJS);
  put('scripts/kernel/verbs/probe.mjs', verbModule('probe', 'probe --workflow <id> [--deep]', ['workflow']));
  put('scripts/kernel/api-boolean-flags.txt', 'sync-tail\n');
  try { edit?.(root, put); } catch (e) { fs.rmSync(root, { recursive: true, force: true }); throw e; }
  return root;
};

test('the real tree: every catalog verb has a handler and doc, exit 0', () => {
  const report = checkCliParity(repoRoot);
  assert.equal(report.rule, 'RT_CLI_VERB_PARITY');
  assert.deepEqual(report.findings, [], 'parity findings');
  assert.equal(report.ok, true);
  assert.ok(report.verbs.includes('kernel settle'), 'kernel settle is catalogued');
  const run = spawnSync(process.execPath, [path.join(repoRoot, 'scripts/checks/check-cli-parity.mjs')], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout + run.stderr);
});

test('a happy fixture passes and every resolved verb is reported', () => {
  const root = fixture();
  try {
    const report = checkCliParity(root);
    assert.equal(report.rule, 'RT_CLI_VERB_PARITY');
    assert.equal(report.ok, true, JSON.stringify(report.findings));
    assert.equal(report.skipped.length, 0, 'no app group catalogued in the fixture');
    assert.deepEqual(report.verbs.sort(), ['kernel builtin', 'kernel probe', 'kernel settle']);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('an app group with no packages/hfs/src/main.mjs is skipped, not a finding', () => {
  const root = fixture((t, put) => {
    put('modules/cli/commands/app/_group.yaml', 'group: app\nsummary: app verbs\nowner: "@starci/hfs"\nsince: 1.0.0-alpha.4\n');
    put('modules/cli/commands/app/lint.yaml', `group: app
verb: lint
owner: "@starci/hfs"
summary: lint the app
impl: null
flags: []
exit: {0: ok, 1: findings, 2: bad usage}
json: flag
examples: ['starci app lint']
editions: [full]
since: 1.0.0-alpha.4
removed: ['hfs lint']
`);
  });
  try {
    const report = checkCliParity(root);
    assert.equal(report.ok, true, JSON.stringify(report.findings));
    assert.equal(report.skipped.length, 1);
    assert.match(report.skipped[0], /packages\/hfs\/src\/main\.mjs/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('a verb module with no catalog file is a finding', () => {
  const root = fixture((t) => fs.rmSync(path.join(t, 'modules/cli/commands/kernel/probe.yaml')));
  try {
    const report = checkCliParity(root);
    assert.equal(report.ok, false);
    assert.ok(report.findings.some((f) => /probe\.mjs has no catalog file/.test(f.detail)));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('a catalog verb with no handler is a finding', () => {
  const root = fixture((t, put) => put('modules/cli/commands/kernel/ghost.yaml', verbYaml('ghost', ['job'])));
  try {
    const report = checkCliParity(root);
    assert.equal(report.ok, false);
    assert.ok(report.findings.some((f) => f.what === 'handler:kernel/ghost'));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('a usage or required flag the catalog lacks is a finding', () => {
  const root = fixture((t, put) => {
    put('scripts/kernel/verbs/probe.mjs', verbModule('probe', 'probe --workflow <id> [--deep] [--strict]', ['workflow', 'strict']));
  });
  try {
    const report = checkCliParity(root);
    assert.equal(report.ok, false);
    assert.ok(report.findings.some((f) => f.what === 'flags:kernel/probe' && /--deep|--strict/.test(f.detail)), JSON.stringify(report.findings));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('a boolean flag of api-boolean-flags.txt in no catalog is a finding', () => {
  const root = fixture((t, put) => put('scripts/kernel/api-boolean-flags.txt', 'sync-tail\nphantom-flag\n'));
  try {
    const report = checkCliParity(root);
    assert.equal(report.ok, false);
    assert.ok(report.findings.some((f) => /--phantom-flag is in no kernel verb/.test(f.detail)), JSON.stringify(report.findings));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('flagsOfUsage drops the global five, prose in parentheses and family placeholders', () => {
  assert.deepEqual(flagsOfUsage('incident --workflow <id> --until-<type> <spec> [--json] (a bare --until-message works)'), ['workflow']);
});

test('a broken catalog or a bad argument is a refusal, not a pass', () => {
  const root = fixture((t, put) => put('modules/cli/commands/kernel/probe.yaml', 'group: kernel\nverb: probe\n'));
  try {
    const result = checkCliParityMain(['--root', root, '--json']);
    assert.equal(result.exitCode, 1);
    assert.match(result.text, /missing required key/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
  assert.equal(checkCliParityMain(['--nope']).exitCode, 2);
});
