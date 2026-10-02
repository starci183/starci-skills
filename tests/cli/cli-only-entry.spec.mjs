// cli-only-entry.spec.mjs - CLI_ONLY_ENTRY (R201).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CODE,
  EXEMPTIONS,
  generatedEntrySources,
  main,
  scanCliOnlyEntry,
} from '../../scripts/checks/check-cli-only-entry.mjs';

const catalog = {
  groups: [
    {
      group: 'runtime',
      verbs: [
        { verb: 'public', impl: { script: 'scripts/tools/public.mjs', args: [] }, removed: [] },
      ],
    },
    {
      group: 'guard',
      verbs: [
        { verb: 'verify-commit', impl: { script: 'scripts/guards/verify-commit.mjs', args: [] }, removed: [] },
      ],
    },
    {
      group: 'harness',
      verbs: [
        { verb: 'start', impl: { script: 'ui/start.mjs', args: [] }, removed: ['node ui/start.mjs'] },
      ],
    },
    {
      group: 'app',
      verbs: [
        { verb: 'lint', impl: null, removed: ['hfs lint', 'npx hfs lint'] },
      ],
    },
  ],
};
const internal = [
  { path: 'scripts/private.mjs', why: 'fixture internal entry', usedBy: ['scripts/owner.mjs'] },
  { path: 'scripts/work/validate/work-hygiene.mjs', why: 'fixture work hook entry', usedBy: ['scripts/guards/hook-install.mjs'] },
];

const scan = (values, options = {}) => {
  const entries = new Map(Object.entries(values));
  return scanCliOnlyEntry('/fixture', {
    catalog,
    internal,
    files: [...entries.keys()],
    read: (file) => entries.get(file),
    generated: [],
    ...options,
  });
};

test('direct node calls to catalog and internal entries have failing and passing forms', () => {
  assert.equal(CODE, 'CLI_ONLY_ENTRY');
  const bad = scan({
    'docs/actions.md': [
      'node scripts/tools/public.mjs',
      'node "$ROOT/scripts/private.mjs"',
      'node .claude/scripts/private.mjs',
    ].join('\n'),
  });
  assert.equal(bad.findings.length, 3, JSON.stringify(bad.findings));
  assert.ok(bad.findings.some((finding) => finding.use === 'starci runtime public'));
  assert.ok(bad.findings.some((finding) => finding.internal));
  const good = scan({ 'docs/actions.md': 'starci runtime public\nstarci workflow start\n' });
  assert.equal(good.ok, true, JSON.stringify(good.findings));
});

test('npm run wrappers around entries fail while a starci-backed script and invocation pass', () => {
  const bad = scan({
    'package.json': JSON.stringify({ scripts: { legacy: 'node scripts/private.mjs' } }),
    'docs/actions.md': 'npm run legacy\n',
  });
  assert.ok(bad.findings.some((finding) => finding.kind === 'node' && finding.file === 'package.json'), JSON.stringify(bad.findings));
  assert.ok(bad.findings.some((finding) => finding.kind === 'npm-run' && finding.file === 'docs/actions.md'), JSON.stringify(bad.findings));
  const good = scan({
    'package.json': JSON.stringify({ scripts: { public: 'starci runtime public' } }),
    'docs/actions.md': 'npm run public\n',
  });
  assert.equal(good.ok, true, JSON.stringify(good.findings));
});

test('R197 owns retired spellings while R201 still catches a direct non-retired entry', () => {
  const retired = scan({ 'docs/actions.md': 'node ui/start.mjs\nnpx hfs lint\n' });
  assert.equal(retired.ok, true, JSON.stringify(retired.findings));
  const direct = scan({ 'docs/actions.md': 'node scripts/private.mjs\n' });
  assert.equal(direct.findings.length, 1, JSON.stringify(direct.findings));
  assert.equal(direct.findings[0].code, CODE);
});

test('rendered hook output is scanned, with a starci rendering as the passing pair', () => {
  const bad = scan({}, { generated: [{ file: 'scripts/guards/hook-install.mjs', text: 'node scripts/guards/verify-commit.mjs\n' }] });
  assert.equal(bad.findings.length, 1, JSON.stringify(bad.findings));
  assert.equal(bad.findings[0].use, 'starci guard verify-commit');
  const good = scan({}, { generated: [{ file: 'scripts/guards/hook-install.mjs', text: 'starci guard verify-commit\n' }] });
  assert.equal(good.ok, true, JSON.stringify(good.findings));
});

test('the real command builders render through the injected seams', () => {
  const sources = generatedEntrySources();
  assert.ok(sources.some((source) => source.file === 'scripts/guards/hook-install.mjs'));
  const report = scan({}, { generated: sources });
  assert.ok(!report.findings.some((finding) => finding.script === 'scripts/guards/verify-commit.mjs'), JSON.stringify(report.findings));
  assert.ok(!report.findings.some((finding) => finding.script === 'scripts/work/validate/work-hygiene.mjs'), JSON.stringify(report.findings));
  assert.ok(!report.findings.some((finding) => finding.file === 'scripts/reconciler/boot.mjs'), JSON.stringify(report.findings));
});

test('every declared exemption has a pass fixture and nearby non-exempt text still fails', async (t) => {
  assert.deepEqual(Object.keys(EXEMPTIONS).sort(), [
    'catalogDeclarations',
    'dispatcher',
    'generatedRuntimeCopies',
    'history',
    'retirementSentences',
    'testSpawnHelpers',
    'variableScriptPaths',
  ]);
  const direct = 'node scripts/private.mjs\n';
  const cases = [
    ['dispatcher', { 'packages/cli/src/main.mjs': direct }, true],
    ['test spawn helper', { 'tests/tool.spec.mjs': "spawnSync('node scripts/private.mjs', { shell: true });\n" }, true],
    ['test documentation is not a spawn helper', { 'tests/tool.spec.mjs': "const docs = 'node scripts/private.mjs';\n" }, false],
    ['internal catalog', { 'modules/cli/commands/_internal.yaml': direct }, true],
    ['removed catalog field', { 'modules/cli/commands/runtime/public.yaml': "removed: ['node scripts/tools/public.mjs']\n" }, true],
    ['catalog example is not exempt', { 'modules/cli/commands/runtime/public.yaml': "removed: []\nexamples: ['node scripts/tools/public.mjs']\n" }, false],
    ['changelog', { 'CHANGELOG-next.md': direct }, true],
    ['contract history', { 'modules/kernel/contract-changes/old.yaml': direct }, true],
    ['generated runtime copy', { 'packages/hfs/runtime/scripts/call.mjs': direct }, true],
    ['variable script path', { 'scripts/caller.mjs': "spawn('node', [scriptPath]);\n" }, true],
    ['retirement sentence', { 'docs/actions.md': 'The invocation `node scripts/private.mjs` was removed.\n' }, true],
  ];
  for (const [name, files, passes] of cases) await t.test(name, () => {
    const report = scan(files);
    assert.equal(report.ok, passes, JSON.stringify(report.findings));
  });
});

const capture = () => {
  const state = { out: '', err: '' };
  return {
    state,
    io: {
      stdout: { write: (value) => { state.out += value; } },
      stderr: { write: (value) => { state.err += value; } },
    },
  };
};

test('main emits the JSON envelope and returns 0, 1, or 2', () => {
  assert.equal(CODE, 'CLI_ONLY_ENTRY');
  const redReport = { schema: 'starci/cli-only-entry-check@1', ok: false, code: CODE, files: 1, findings: [{ file: 'docs/x.md', line: 1, spelling: 'node scripts/private.mjs', internal: true }] };
  const red = capture();
  assert.equal(main(['--json'], red.io, { scan: () => redReport }), 1);
  assert.deepEqual(JSON.parse(red.state.out), redReport);

  const clean = capture();
  assert.equal(main([], clean.io, { scan: () => ({ ...redReport, ok: true, code: null, findings: [] }) }), 0);
  assert.match(clean.state.out, /no direct entry calls/);

  const missing = capture();
  assert.equal(main(['--root'], missing.io), 2);
  assert.match(missing.state.err, /--root needs a path/);
  const unknown = capture();
  assert.equal(main(['--wat'], unknown.io), 2);
  assert.match(unknown.state.err, /unknown argument/);
});
