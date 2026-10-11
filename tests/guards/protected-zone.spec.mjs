// protected-zone.spec.mjs - the protected zone and op runtime-write boundary (rule R224) as tables: the one
// declaration, direct file verdicts, shell writers, and file-writing tool calls through the command guard.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { hookDecision } from '../../scripts/guards/command-guard.mjs';
import { PROTECTED_ZONE_FILE, catalogNames, loadProtectedZone, zoneOfPath } from '../../scripts/guards/protected-zone.mjs';
import { fileWriteVerdict, runtimeRootOf } from '../../scripts/guards/rights.mjs';
import { logRefusal } from '../../scripts/guards/refusals.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

/** The file-rights verdict of one write for a role: the pure verdict over the real zone declaration (what the hook computes, minus the hook). */
async function fileRightsVerdict({ role, filePath, tool = 'Edit', edit = null, guard = null, shell = false }) {
  if ((role !== 'supervisor' && role !== 'op') || !runtimeRootOf(filePath)) return null;
  const zone = role === 'supervisor' ? { ...zoneOfPath(filePath), catalogNames } : { runtimeRoot: runtimeRootOf(filePath) };
  return fileWriteVerdict({ role, filePath, tool, edit, guard, zone, shell });
}

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const DECLARATION = loadProtectedZone({ root: ROOT });
const ZONE_IDS = ['guard-and-rights', 'release-and-hooks', 'ci-triggers', 'test-policy', 'host-lock', 'permissions'];

const ZONE_PATHS = [
  ['scripts/guards/rights.mjs', 'guard-and-rights'],
  ['scripts/guards/command-guard.mjs', 'guard-and-rights'],
  ['scripts/guards/nested/x.mjs', 'guard-and-rights'],
  ['tests/guards/x.spec.mjs', 'guard-and-rights'],
  ['tests/guards/nested/x.spec.mjs', 'guard-and-rights'],
  ['modules/kernel/protected-zone.yaml', 'guard-and-rights'],
  ['scripts/supervisor/release-cut.mjs', 'release-and-hooks'],
  ['scripts/supervisor/push-git.mjs', 'release-and-hooks'],
  ['scripts/supervisor/push-mains.mjs', 'release-and-hooks'],
  ['scripts/hfs/runtime-rules/hook-shape.mjs', 'release-and-hooks'],
  ['packages/hfs/templates/app/hooks/husky/pre-push', 'release-and-hooks'],
  ['packages/hfs/templates/app/hooks/husky/pre-commit', 'release-and-hooks'],
  ['packages/hfs/templates/app/hooks/custom/nested', 'release-and-hooks'],
  ['.github/workflows/ci.yml', 'ci-triggers'],
  ['.github/workflows/nested/build.yml', 'ci-triggers'],
  ['packages/hfs/templates/app/ci-workflows/ci.yml', 'ci-triggers'],
  ['examples/a/.github/workflows/images.yml', 'ci-triggers'],
  ['examples/shape-slot/.github/workflows/ci.yml', 'ci-triggers'],
  ['scripts/lib/spec-deps.mjs', 'test-policy'],
  ['tests/setup/low-priority.mjs', 'test-policy'],
  ['tests/setup/nested/x.mjs', 'test-policy'],
  ['config.example.yaml', 'test-policy'],
  ['config.yaml', 'test-policy'],
  ['scripts/machine/host-lock.mjs', 'host-lock'],
  ['tests/machine/host-lock.spec.mjs', 'host-lock'],
  ['.claude/settings.json', 'permissions'],
  ['.claude/settings.local.json', 'permissions'],
  ['.codex/config.toml', 'permissions'],
  ['.codex/nested/config.toml', 'permissions'],
  ['.devin/config.toml', 'permissions'],
];

const NON_ZONE_PATHS = [
  'scripts/lib/other.mjs',
  'scripts/kernel/cli.mjs',
  'modules/ops/ops/x.yaml',
  'docs/readme.md',
  'packages/hfs/templates/app/skeleton/x',
  'examples/a/src/main.ts',
  'knowledge/hfs/runtime-slots.yaml',
  'knowledge/hfs/rules.yaml',
  'modules/kernel/failure-codes.yaml',
  'packages/hfs/templates/app/hooks',
  'scripts/supervisor/other.mjs',
  '.github/readme.md',
];

const runtimeCheckout = (t, prefix = 'rights-zone-') => {
  const root = mkdtemp(t, prefix);
  const marker = path.join(root, 'knowledge', 'hfs', 'runtime-slots.yaml');
  fs.mkdirSync(path.dirname(marker), { recursive: true });
  fs.writeFileSync(marker, 'slots: []\n');
  return root;
};

const fullPath = (root, rel) => path.join(root, ...rel.split('/'));
const zoneFor = (filePath) => ({ ...zoneOfPath(filePath, { declaration: DECLARATION }), catalogNames });
const fileCall = (tool, toolInput, cwd) => ({ tool_name: tool, cwd, tool_input: toolInput });
const shellCall = (tool, command, cwd) => fileCall(tool, { command }, cwd);
const envFor = (handle = '') => ({ ...process.env, ORCA_TERMINAL_HANDLE: handle, STARCI_ROLE: '' });
const quote = (file) => `"${file.replaceAll('\\', '/')}"`;

const bind = (t, kind, handle, body) => {
  const dir = path.join(process.env.STARCI_GUARDS_ROOT, kind);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${handle}.json`);
  fs.writeFileSync(file, JSON.stringify(body));
  t.after(() => fs.rmSync(file, { force: true }));
};

test('the YAML is the one declaration and its six zones map a table of runtime-relative paths', (t) => {
  assert.deepEqual(DECLARATION.zones.map((zone) => zone.id), ZONE_IDS);
  assert.deepEqual(DECLARATION.catalog.map((entry) => entry.file), ['knowledge/hfs/rules.yaml', 'modules/kernel/failure-codes.yaml']);
  assert.deepEqual(DECLARATION.catalog[0].ids, ['R221', 'R222', 'R223', 'R224', 'R225']);
  assert.deepEqual(DECLARATION.catalog[0].codes, ['CI_TRIGGERS_RELEASE_ONLY', 'RELEASE_NOTES', 'RIGHTS_ROLE_DENIED', 'RIGHTS_PROTECTED_ZONE', 'RT_HOOK_SHAPE']);
  assert.deepEqual(DECLARATION.catalog[1].ids, []);
  assert.deepEqual([...DECLARATION.catalog[1].codes].sort(), [
    'RIGHTS_GIT_PUSH', 'RIGHTS_GIT_TAG', 'RIGHTS_GIT_SYNC', 'RIGHTS_RAW_TOOL', 'RIGHTS_GIT_COMMIT', 'RIGHTS_NPM_PUBLISH', 'RIGHTS_SUITE_RUN',
    'RIGHTS_NPM_CI_UNLOCKED', 'RIGHTS_RELEASE_CUT', 'RIGHTS_PROTECTED_ZONE', 'RIGHTS_OP_RUNTIME_WRITE',
    'RIGHTS_PUSH_NOT_RELEASE', 'RT_HOOK_SHAPE', 'CI_TRIGGERS_RELEASE_ONLY', 'RELEASE_NOTES',
  ].sort());

  const yaml = fs.readFileSync(path.join(ROOT, PROTECTED_ZONE_FILE), 'utf8');
  for (const id of ZONE_IDS) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.equal([...yaml.matchAll(new RegExp(`^\\s*- id: ${escaped}\\s*$`, 'gm'))].length, 1, `${id} is declared exactly once`);
  }
  assert.equal(new Set(DECLARATION.zones.map((zone) => zone.id)).size, DECLARATION.zones.length, 'zone ids are unique');

  const injectedRoot = mkdtemp(t, 'rights-declaration-');
  const injected = loadProtectedZone({
    root: injectedRoot,
    read: () => 'zones:\n  - id: only-from-declaration\n    why: fixture\n    paths: [custom/**]\ncatalogEntries: []\n',
  });
  assert.deepEqual(injected.zones.map((zone) => zone.id), ['only-from-declaration'], 'the reader has no second hard-coded zone list');

  const runtime = runtimeCheckout(t);
  assert.ok(ZONE_PATHS.length + NON_ZONE_PATHS.length >= 30, 'the path table has at least thirty cases');
  for (const [rel, expected] of ZONE_PATHS) {
    const actual = zoneOfPath(fullPath(runtime, rel), { declaration: DECLARATION });
    assert.equal(actual.runtimeRoot, runtime, rel);
    assert.equal(actual.rel, rel, rel);
    assert.equal(actual.zone?.id ?? null, expected, rel);
  }
  for (const rel of NON_ZONE_PATHS) {
    const actual = zoneOfPath(fullPath(runtime, rel), { declaration: DECLARATION });
    assert.equal(actual.runtimeRoot, runtime, rel);
    assert.equal(actual.zone, null, rel);
  }
  assert.equal(zoneOfPath(fullPath(runtime, 'knowledge/hfs/rules.yaml'), { declaration: DECLARATION }).catalog?.file, 'knowledge/hfs/rules.yaml');
  assert.equal(zoneOfPath(fullPath(runtime, 'modules/kernel/failure-codes.yaml'), { declaration: DECLARATION }).catalog?.file, 'modules/kernel/failure-codes.yaml');

  const outside = mkdtemp(t, 'rights-outside-');
  assert.deepEqual(zoneOfPath(path.join(outside, 'scripts', 'guards', 'rights.mjs'), { declaration: DECLARATION }), {
    runtimeRoot: null, rel: null, zone: null, catalog: null,
  });
});

test('a supervisor is refused every zone and only protected catalog edits', async (t) => {
  const runtime = runtimeCheckout(t);
  for (const [rel] of ZONE_PATHS) {
    const filePath = fullPath(runtime, rel);
    const verdict = fileWriteVerdict({ role: 'supervisor', filePath, zone: zoneFor(filePath) });
    assert.equal(verdict?.code, 'RIGHTS_PROTECTED_ZONE', rel);
    assert.match(verdict.remedy, /owner proposal/i, rel);
    assert.equal((await fileRightsVerdict({ role: 'supervisor', filePath }))?.code, 'RIGHTS_PROTECTED_ZONE', rel);
  }
  const ordinary = fullPath(runtime, 'scripts/lib/other.mjs');
  assert.equal(fileWriteVerdict({ role: 'supervisor', filePath: ordinary, zone: zoneFor(ordinary) })?.code, 'RUNTIME_CHANGE_OWNED_BY_DEBUG');
  assert.equal((await fileRightsVerdict({ role: 'supervisor', filePath: ordinary }))?.code, 'RUNTIME_CHANGE_OWNED_BY_DEBUG');

  for (const entry of DECLARATION.catalog) {
    const filePath = fullPath(runtime, entry.file);
    for (const name of [...entry.ids, ...entry.codes]) {
      for (const edit of [{ old: `before ${name}`, new: 'after' }, { old: 'before', new: `after ${name}` }]) {
        const verdict = fileWriteVerdict({ role: 'supervisor', filePath, tool: 'Edit', edit, zone: zoneFor(filePath) });
        assert.equal(verdict?.code, 'RIGHTS_PROTECTED_ZONE', `${entry.file}: ${name}`);
      }
    }
    assert.equal(fileWriteVerdict({ role: 'supervisor', filePath, tool: 'Write', edit: { new: 'ordinary replacement' }, zone: zoneFor(filePath) })?.code,
      'RIGHTS_PROTECTED_ZONE', `${entry.file}: whole-file Write`);
  }

  const rules = fullPath(runtime, 'knowledge/hfs/rules.yaml');
  for (const text of ['R22', 'R2240', 'R2250', 'XR224', 'R999', 'OTHER_FAILURE']) {
    assert.equal(fileWriteVerdict({ role: 'supervisor', filePath: rules, tool: 'Edit', edit: { old: text, new: 'ordinary' }, zone: zoneFor(rules) })?.code, 'RUNTIME_CHANGE_OWNED_BY_DEBUG', text);
  }
  assert.equal(fileWriteVerdict({ role: 'supervisor', filePath: rules, tool: 'MultiEdit', edit: { old: 'ordinary', new: 'first\nR225\nlast' }, zone: zoneFor(rules) })?.code,
    'RIGHTS_PROTECTED_ZONE', 'joined MultiEdit text names a protected rule');
});

test('an op writes only its owned paths and the runtime temp directory, while other roles have no file-rights refusal', async (t) => {
  const runtime = runtimeCheckout(t, 'rights-op-runtime-');
  const workflow = path.join(runtime, 'workflow');
  const ownedFile = path.join(runtime, 'assigned.txt');
  const ownedDir = path.join(runtime, 'assigned');
  const guard = { role: 'op', workflowId: 'wf-1', op: 'backend.implement', workflowWorktree: workflow, owned: [ownedFile, ownedDir] };
  const runtimeOutside = path.join(runtime, 'src', 'outside.ts');
  const denied = await fileRightsVerdict({ role: 'op', filePath: runtimeOutside, guard });
  assert.equal(denied?.code, 'RIGHTS_OP_RUNTIME_WRITE');
  assert.match(denied.remedy, /lesson|upgrade request/i);
  assert.equal((await fileRightsVerdict({ role: 'op', filePath: path.join(workflow, 'src', 'inside.ts'), guard }))?.code, 'RIGHTS_OP_OUTSIDE_OWNED', 'inside the worktree but not owned');
  assert.equal(await fileRightsVerdict({ role: 'op', filePath: ownedFile, guard }), null);
  assert.equal(await fileRightsVerdict({ role: 'op', filePath: path.join(ownedDir, 'child.ts'), guard }), null);

  const workflowRuntime = path.join(runtime, 'workflow-runtime');
  const nestedMarker = path.join(workflowRuntime, 'knowledge', 'hfs', 'runtime-slots.yaml');
  fs.mkdirSync(path.dirname(nestedMarker), { recursive: true });
  fs.writeFileSync(nestedMarker, 'slots: []\n');
  const nestedGuard = { ...guard, workflowWorktree: workflowRuntime };
  assert.equal((await fileRightsVerdict({ role: 'op', filePath: path.join(workflowRuntime, 'scripts', 'app.mjs'), guard: nestedGuard }))?.code, 'RIGHTS_OP_OUTSIDE_OWNED',
    'a workflow worktree that is itself a runtime checkout is not an owned path: the scope refusal, not the runtime-write refusal');

  const outside = mkdtemp(t, 'rights-op-outside-');
  assert.equal(await fileRightsVerdict({ role: 'op', filePath: path.join(outside, 'src', 'main.ts'), guard }), null);

  const zonePath = fullPath(runtime, 'scripts/guards/rights.mjs');
  for (const role of ['lead', 'coordinator', 'release', null]) {
    assert.equal(fileWriteVerdict({ role, filePath: zonePath, zone: zoneFor(zonePath) }), null, String(role));
    assert.equal(await fileRightsVerdict({ role, filePath: zonePath }), null, String(role));
  }
});

const WRITERS = [
  ['Bash', 'sed -i', (file) => `sed -i s/a/b/ ${quote(file)}`],
  ['Bash', 'redirect', (file) => `echo x > ${quote(file)}`],
  ['Bash', 'cp', (file) => `cp source.txt ${quote(file)}`],
  ['Bash', 'mv', (file) => `mv ${quote(file)} moved.txt`],
  ['Bash', 'rm', (file) => `rm ${quote(file)}`],
  ['Bash', 'tee', (file) => `tee ${quote(file)}`],
  ['Bash', 'append redirect', (file) => `printf x >> ${quote(file)}`],
  ['PowerShell', 'Set-Content', (file) => `Set-Content -Path ${quote(file)} -Value x`],
  ['PowerShell', 'Add-Content', (file) => `Add-Content -Path ${quote(file)} -Value x`],
  ['PowerShell', 'Out-File', (file) => `Out-File -FilePath ${quote(file)} -InputObject x`],
];

test('shell writers are refused on a supervisor zone and are refused on an ordinary runtime path as a runtime change', async (t) => {
  const runtime = runtimeCheckout(t, 'rights-shell-supervisor-');
  const zonePath = fullPath(runtime, 'scripts/guards/rights.mjs');
  const ordinary = fullPath(runtime, 'scripts/lib/ordinary.mjs');
  const handle = 'rights-zone-supervisor';
  bind(t, 'seats', handle, { schema: 'starci/seat-guard@1', role: 'supervisor', terminal: handle, deniedTools: [] });
  for (const [tool, label, command] of WRITERS) {
    const refused = await hookDecision(shellCall(tool, command(zonePath), runtime), { env: envFor(handle) });
    assert.equal(refused?.verdict.code, 'RIGHTS_PROTECTED_ZONE', `${label}: zone`);
    assert.equal((await hookDecision(shellCall(tool, command(ordinary), runtime), { env: envFor(handle) }))?.verdict.code, 'RUNTIME_CHANGE_OWNED_BY_DEBUG', `${label}: ordinary`);
  }
});

test('shell writers obey the op workflow boundary', async (t) => {
  const runtime = runtimeCheckout(t, 'rights-shell-op-');
  const workflow = path.join(runtime, 'workflow');
  fs.mkdirSync(workflow, { recursive: true });
  const outside = path.join(runtime, 'src', 'outside.ts');
  const inside = path.join(workflow, 'src', 'inside.ts');
  const handle = 'rights-zone-op';
  bind(t, 'terminals', handle, {
    schema: 'starci/op-guard@1', role: 'op', jobId: 'job-1', workflowId: 'wf-1', op: 'backend.implement', owned: [path.join(workflow, 'src')], workflowWorktree: workflow,
  });
  const unowned = path.join(workflow, 'docs', 'unowned.md');
  for (const [tool, label, command] of WRITERS) {
    const refused = await hookDecision(shellCall(tool, command(outside), workflow), { env: envFor(handle) });
    assert.equal(refused?.verdict.code, 'RIGHTS_OP_RUNTIME_WRITE', `${label}: outside worktree`);
    assert.equal((await hookDecision(shellCall(tool, command(unowned), workflow), { env: envFor(handle) }))?.verdict.code, 'RIGHTS_OP_OUTSIDE_OWNED', `${label}: inside worktree, not owned`);
    assert.equal(await hookDecision(shellCall(tool, command(inside), path.join(workflow, 'src')), { env: envFor(handle) }), null, `${label}: owned`);
  }
});

test('reading zone paths and ordinary supervisor commands have no false positives', async (t) => {
  const runtime = runtimeCheckout(t, 'rights-readonly-');
  const zonePath = fullPath(runtime, 'scripts/guards/rights.mjs');
  const ordinary = fullPath(runtime, 'scripts/lib/ordinary.mjs');
  const handle = 'rights-zone-readonly';
  bind(t, 'seats', handle, { schema: 'starci/seat-guard@1', role: 'supervisor', terminal: handle, deniedTools: [] });
  const commands = [
    `cat ${quote(zonePath)}`,
    `grep role ${quote(zonePath)}`,
    `git diff -- ${quote(zonePath)}`,
    `ls ${quote(zonePath)}`,
    `sed s/a/b/ ${quote(zonePath)}`,
    'git status --short',
    `rg zone ${quote(ordinary)}`,
  ];
  for (const command of commands) {
    assert.equal(await hookDecision(shellCall('Bash', command, runtime), { env: envFor(handle) }), null, command);
  }
  // Raw tools the command policy refuses (R223) are refused for THAT reason, never as a zone write: a git add of a zone file stages it, it does not write it.
  for (const [command, code] of [['node scripts/x.mjs', 'SUPERVISOR_STARCI_ONLY'], ['node --check scripts/x.mjs', 'SUPERVISOR_STARCI_ONLY'], ['npm run build', 'RIGHTS_RAW_TOOL'], [`git add ${quote(zonePath)}`, 'RIGHTS_GIT_COMMIT']]) {
    assert.equal((await hookDecision(shellCall('Bash', command, runtime), { env: envFor(handle) }))?.verdict.code, code, command);
  }
});

const TOOL_INPUTS = (file) => [
  ['Edit', { file_path: file, old_string: 'old', new_string: 'new' }],
  ['Write', { file_path: file, content: 'new' }],
  ['MultiEdit', { file_path: file, edits: [{ old_string: 'old one', new_string: 'new one' }, { old_string: 'old two', new_string: 'new two' }] }],
  ['NotebookEdit', { notebook_path: file, old_string: 'old', new_source: 'new' }],
];

test('Edit, Write, MultiEdit and NotebookEdit keep their tool identity through supervisor and op decisions', async (t) => {
  const runtime = runtimeCheckout(t, 'rights-tools-');
  const workflow = path.join(runtime, 'workflow');
  const zonePath = fullPath(runtime, 'scripts/guards/rights.mjs');
  const opOutside = path.join(runtime, 'src', 'outside.ts');
  const opInside = path.join(workflow, 'src', 'inside.ts');
  const supervisor = 'rights-tools-supervisor';
  const op = 'rights-tools-op';
  bind(t, 'seats', supervisor, { schema: 'starci/seat-guard@1', role: 'supervisor', terminal: supervisor, deniedTools: [] });
  bind(t, 'terminals', op, {
    schema: 'starci/op-guard@1', role: 'op', jobId: 'job-tools', workflowId: 'wf-1', op: 'backend.implement', owned: [path.join(workflow, 'src')], workflowWorktree: workflow,
  });

  for (const [tool, input] of TOOL_INPUTS(zonePath)) {
    const decision = await hookDecision(fileCall(tool, input, runtime), { env: envFor(supervisor) });
    assert.equal(decision?.verdict.code, 'RIGHTS_PROTECTED_ZONE', tool);
    assert.equal(decision.verdict.tool, tool, tool);
  }
  const rules = fullPath(runtime, 'knowledge/hfs/rules.yaml');
  const joined = await hookDecision(fileCall('MultiEdit', {
    file_path: rules,
    edits: [{ old_string: 'ordinary one', new_string: 'ordinary two' }, { old_string: 'ordinary three', new_string: 'R225 replacement' }],
  }, runtime), { env: envFor(supervisor) });
  assert.equal(joined?.verdict.code, 'RIGHTS_PROTECTED_ZONE', 'MultiEdit joins every catalog edit before checking names');
  for (const [tool, input] of TOOL_INPUTS(opOutside)) {
    const decision = await hookDecision(fileCall(tool, input, runtime), { env: envFor(op) });
    assert.equal(decision?.verdict.code, 'RIGHTS_OP_RUNTIME_WRITE', tool);
    assert.equal(decision.verdict.tool, tool, tool);
  }
  for (const [tool, input] of TOOL_INPUTS(opInside)) {
    assert.equal(await hookDecision(fileCall(tool, input, runtime), { env: envFor(op) }), null, `${tool}: workflow worktree`);
  }
  for (const [tool, input] of TOOL_INPUTS(zonePath)) {
    assert.equal(await hookDecision(fileCall(tool, input, runtime), { env: envFor('') }), null, `${tool}: owner session`);
  }

  const decision = await hookDecision(fileCall('MultiEdit', TOOL_INPUTS(zonePath)[2][1], runtime), { env: envFor(supervisor) });
  const { tool, ...verdict } = decision.verdict;
  const entry = {
    tool,
    via: 'pre-tool-use',
    ...verdict,
    jobId: decision.guard?.jobId ?? null,
    workflowId: decision.guard?.workflowId ?? null,
    cwd: decision.cwd,
  };
  const logRoot = mkdtemp(t, 'rights-refusal-log-');
  logRefusal(entry, { root: logRoot });
  const logged = JSON.parse(fs.readFileSync(path.join(logRoot, 'runtime', 'guards', 'refusals.jsonl'), 'utf8').trim());
  delete logged.at;
  assert.deepEqual(logged, entry, 'logRefusal receives the decision data without changing it');
});
