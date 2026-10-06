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

const GLOBAL_YAML = `commands: [explain]
flags:
  - {name: json, type: boolean}
  - {name: cwd, type: string}
  - {name: quiet, type: boolean}
  - {name: help, type: boolean}
  - {name: edition, type: enum, enum: [full, lite]}
`;
const GROUP_YAML = `group: kernel\nsummary: kernel verbs\nowner: runtime\n`;
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
`;
const moduleYaml = (verb, flags, extra = '') => `group: kernel
verb: ${verb}
owner: runtime
summary: test module verb ${verb}
impl: {module: scripts/machine/${verb}.mjs, export: ${verb}}
effect: host
roles: [lead, owner]
conventions: [run this fixture under the host lock]
flags: [${flags.map(flagSig).join(', ')}]
exit: {0: ok, 1: refused, 2: bad usage}
json: flag
examples: ['starci kernel ${verb}']
editions: [full]
${extra}`;
const verbModule = (verb, usage, required) => `export default {
  verb: '${verb}',
  required: [${required.map((r) => `'${r}'`).join(', ')}],
  usage: '${usage}',
  run() { return { ok: true }; },
};
`;
const CLI_MJS = `#!/usr/bin/env node
const usage = (code) => {
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
const internalYaml = (entries = []) => entries.length ? `internal:
${entries.map((entry) => `  - path: ${entry.path}\n    why: ${entry.why ?? 'fixture internal entry'}\n    usedBy: [${entry.usedBy ?? 'scripts/owner.mjs'}]`).join('\n')}\n` : 'internal: []\n';
const writeInternal = (root, entries = []) => fs.writeFileSync(path.join(root, 'modules/cli/commands/_internal.yaml'), internalYaml(entries));

const fixture = (edit) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-cli-parity-'));
  const put = (rel, text) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
  put('modules/cli/commands/_global.yaml', GLOBAL_YAML);
  put('modules/cli/commands/_internal.yaml', internalYaml());
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
    put('modules/cli/commands/app/_group.yaml', 'group: app\nsummary: app verbs\nowner: "@starci/hfs"\n');
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

test('a module verb passes when its file declares the named export', () => {
  const root = fixture((t, put) => {
    put('modules/cli/commands/kernel/probe.yaml', moduleYaml('probe', ['workflow', ['deep', 'boolean']]));
    put('scripts/machine/probe.mjs', 'export async function probe() { return {code: 0}; }\n');
  });
  try {
    const report = checkCliParity(root);
    assert.equal(report.ok, true, JSON.stringify(report.findings));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('a module verb with a missing file is a handler finding', () => {
  const root = fixture((t, put) => put('modules/cli/commands/kernel/probe.yaml', moduleYaml('probe', [])));
  try {
    const report = checkCliParity(root);
    assert.ok(report.findings.some((f) => f.what === 'handler:kernel/probe' && /impl module .* does not exist/.test(f.detail)), JSON.stringify(report.findings));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('a module verb with a missing export is a handler finding', () => {
  const root = fixture((t, put) => {
    put('modules/cli/commands/kernel/probe.yaml', moduleYaml('probe', []));
    put('scripts/machine/probe.mjs', 'export const another = async () => ({code: 0});\n');
  });
  try {
    const report = checkCliParity(root);
    assert.ok(report.findings.some((f) => f.what === 'handler:kernel/probe' && /does not export probe/.test(f.detail)), JSON.stringify(report.findings));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('module policy metadata failures are catalog parity findings', () => {
  const root = fixture((t, put) => {
    put('modules/cli/commands/kernel/probe.yaml', moduleYaml('probe', [])
      .replace('effect: host\n', '')
      .replace('roles: [lead, owner]\n', ''));
    put('scripts/machine/probe.mjs', 'export function probe() { return {code: 0}; }\n');
  });
  try {
    const report = checkCliParity(root);
    assert.ok(report.findings.some((f) => /module impl requires effect/.test(f.detail)), JSON.stringify(report.findings));
    assert.ok(report.findings.some((f) => /module impl requires roles/.test(f.detail)), JSON.stringify(report.findings));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('a host-effect module without a convention is a catalog parity finding', () => {
  const root = fixture((t, put) => {
    put('modules/cli/commands/kernel/probe.yaml', moduleYaml('probe', []).replace('conventions: [run this fixture under the host lock]\n', ''));
    put('scripts/machine/probe.mjs', 'export const probe = async () => ({code: 0});\n');
  });
  try {
    const report = checkCliParity(root);
    assert.ok(report.findings.some((f) => /effect host requires at least one convention/.test(f.detail)), JSON.stringify(report.findings));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('a direct kernel-owned script outside the kernel group needs no cli.mjs switch case', () => {
  const root = fixture((t, put) => {
    put('scripts/kernel/sample-tool.mjs', '#!/usr/bin/env node\nconsole.log("ok");\n');
    put('modules/cli/commands/machine/_group.yaml', 'group: machine\nsummary: machine verbs\nowner: runtime\n');
    put('modules/cli/commands/machine/sample-tool.yaml', verbYaml('sample-tool', [])
      .replace('group: kernel', 'group: machine')
      .replace('impl: {script: scripts/kernel/cli.mjs, args: [sample-tool]}', 'impl: {script: scripts/kernel/sample-tool.mjs}')
      .replace('starci kernel sample-tool', 'starci machine sample-tool'));
  });
  try {
    const report = checkCliParity(root);
    assert.equal(report.ok, true, JSON.stringify(report.findings));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('an entry script needs either a catalog route or an internal declaration', () => {
  const root = fixture((t, put) => put('scripts/private.mjs', '#!/usr/bin/env node\nconsole.log("fixture");\n'));
  try {
    const red = checkCliParity(root);
    assert.ok(red.findings.some((f) => f.what === 'entry:scripts/private.mjs'), JSON.stringify(red.findings));
    writeInternal(root, [{ path: 'scripts/private.mjs' }]);
    const green = checkCliParity(root);
    assert.equal(green.ok, true, JSON.stringify(green.findings));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('a missing internal entry is stale, and becomes valid when its gated file exists', () => {
  const root = fixture();
  try {
    writeInternal(root, [{ path: 'scripts/private.mjs' }]);
    let report = checkCliParity(root);
    assert.ok(report.findings.some((f) => f.what === 'internal:scripts/private.mjs' && /does not exist/.test(f.detail)), JSON.stringify(report.findings));
    fs.writeFileSync(path.join(root, 'scripts/private.mjs'), '#!/usr/bin/env node\n');
    report = checkCliParity(root);
    assert.equal(report.ok, true, JSON.stringify(report.findings));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('an internal entry without an entry gate is stale, and a gate repairs it', () => {
  const root = fixture((t, put) => put('scripts/private.mjs', 'export const value = 1;\n'));
  try {
    writeInternal(root, [{ path: 'scripts/private.mjs' }]);
    let report = checkCliParity(root);
    assert.ok(report.findings.some((f) => f.what === 'internal:scripts/private.mjs' && /no entry gate/.test(f.detail)), JSON.stringify(report.findings));
    fs.writeFileSync(path.join(root, 'scripts/private.mjs'), '#!/usr/bin/env node\nexport const value = 1;\n');
    report = checkCliParity(root);
    assert.equal(report.ok, true, JSON.stringify(report.findings));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('a catalog implementation cannot also be internal, and removing it from the registry repairs parity', () => {
  const root = fixture();
  try {
    writeInternal(root, [{ path: 'scripts/kernel/cli.mjs' }]);
    let report = checkCliParity(root);
    assert.ok(report.findings.some((f) => f.what === 'internal:scripts/kernel/cli.mjs' && /catalog verb implementation/.test(f.detail)), JSON.stringify(report.findings));
    writeInternal(root);
    report = checkCliParity(root);
    assert.equal(report.ok, true, JSON.stringify(report.findings));
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
