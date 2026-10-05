// retired-cli.spec.mjs - RT_RETIRED_CLI_CALL (R197).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CODE,
  main,
  maskCatalogRemoved,
  retiredCallsInText,
  retiredMatchers,
  scanRetiredCli,
} from '../../scripts/checks/check-retired-cli.mjs';

const catalog = {
  groups: [
    {
      group: 'kernel',
      verbs: [
        { verb: 'record-checks', removed: ['starci api check', 'node scripts/kernel/cli.mjs check'] },
        { verb: 'survey', removed: ['starci api survey', 'node scripts/kernel/cli.mjs survey'] },
      ],
    },
    {
      group: 'app',
      verbs: [
        { verb: 'emit', removed: ['hfs emit-contracts', 'npx hfs emit-contracts'] },
        { verb: 'lint', removed: ['hfs lint', 'npx hfs lint'] },
        { verb: 'stack', removed: ['starci-test-stack', 'npx starci-test-stack'] },
      ],
    },
    { group: 'check', verbs: [{ verb: 'run', removed: [] }] },
  ],
};
const matchers = retiredMatchers(catalog);
const calls = (text, file = 'docs/commands.md') => retiredCallsInText(text, file, matchers);

test('each retired spelling family has a failing and passing fixture', async (t) => {
  assert.equal(CODE, 'RT_RETIRED_CLI_CALL');
  const pairs = [
    { name: 'catalog spelling and renamed replacement', bad: 'Run `starci api check --repo .`.', good: 'Run `starci kernel record-checks --repo .`.', use: 'starci kernel record-checks' },
    { name: 'starci api group', bad: 'Run `starci api custom-verb`.', good: 'Run `starci kernel custom-verb`.', use: 'starci kernel custom-verb' },
    { name: 'bare api kernel verb', bad: 'Run `api survey --repo .`.', good: 'Run `starci kernel survey --repo .`.', use: 'starci kernel survey' },
    { name: 'root runtime kernel script', bad: 'Run `node scripts/kernel/cli.mjs survey --repo .`.', good: 'Run `starci kernel survey --repo .`.', use: 'starci kernel survey' },
    { name: 'installed runtime kernel script', bad: 'Run `node .claude/scripts/kernel/cli.mjs survey --repo .`.', good: 'Run `starci kernel survey --repo .`.', use: 'starci kernel survey' },
    { name: 'root bin', bad: 'Run `node bin/' + 'starci.mjs runtime check`.', good: 'Run `starci runtime check`.', use: 'starci' },
    { name: 'hfs verb', bad: 'Run `hfs lint`.', good: 'Run `starci app lint`.', use: 'starci app lint' },
    { name: 'npx hfs', bad: 'Run `npx hfs`.', good: 'Run `npx starci app lint`.', use: 'starci app' },
    { name: 'test stack binary', bad: 'Run `starci-test-stack up`.', good: 'Run `starci app stack up`.', use: 'starci app stack' },
  ];
  for (const pair of pairs) await t.test(pair.name, () => {
    const bad = calls(pair.bad);
    assert.equal(bad.length, 1, JSON.stringify(bad));
    assert.equal(bad[0].use, pair.use);
    assert.deepEqual(calls(pair.good), []);
  });
  assert.deepEqual(calls('The hfs slot map is data, not a command.'), [], 'a non-catalog word after hfs is prose');
});

test('each removed top-level starci verb has a failing and passing fixture', () => {
  const pairs = {
    init: 'starci runtime install',
    update: 'starci runtime update',
    doctor: 'starci runtime doctor',
    version: 'starci runtime version',
    validate: 'starci runtime validate',
    check: 'starci runtime check',
    start: 'starci workflow start',
    goal: 'starci workflow define',
  };
  for (const [verb, replacement] of Object.entries(pairs)) {
    const bad = calls(`Run \`starci ${verb}\`.`);
    assert.equal(bad.length, 1, verb);
    assert.equal(bad[0].use, replacement);
    assert.deepEqual(calls(`Run \`${replacement}\`.`), [], replacement);
  }
  assert.deepEqual(calls('Run `starci runtime check`.'), [], 'the runtime group is not the retired top-level check');
  assert.deepEqual(calls('Run `starci check run --level L2`.'), [], 'a current verb under the check group is not the retired top-level check');
});

test('overlapping generic spellings produce one finding and exact catalog replacements win', () => {
  const findings = calls('Run `npx hfs emit-contracts --json`.');
  assert.equal(findings.length, 1, JSON.stringify(findings));
  assert.equal(findings[0].spelling, 'npx hfs emit-contracts');
  assert.equal(findings[0].use, 'starci app emit');
});

test('bare api is limited to the specified runtime-owned directories and root Markdown', () => {
  assert.equal(calls('Run `api survey`.', 'scripts/tool.mjs').length, 1);
  assert.equal(calls('Run `api survey`.', 'README.md').length, 1);
  assert.deepEqual(calls('Run `api survey`.', 'packages/product/readme.md'), []);
  assert.deepEqual(calls('Run `api unknown`.', 'scripts/tool.mjs'), [], 'only catalogued kernel verbs are bare-api commands');
});

test('catalog removed fields are exempt, but another catalog field is still checked', () => {
  const inline = "removed: ['starci api survey']\nexamples: ['starci kernel survey']\n";
  const block = "removed:\n  - starci api survey\n  - node scripts/kernel/cli.mjs survey\nexamples: ['starci kernel survey']\n";
  assert.deepEqual(calls(inline, 'modules/cli/commands/kernel/survey.yaml'), []);
  assert.deepEqual(calls(block, 'modules/cli/commands/kernel/survey.yaml'), []);
  assert.equal(calls("removed: []\nexamples: ['starci api survey']\n", 'modules/cli/commands/kernel/survey.yaml').length, 1);
  assert.equal(maskCatalogRemoved(block).length, block.length, 'masking preserves line offsets');
});

test('history, changelogs, generated files, the dispatcher table, and this spec are exempt', () => {
  const text = 'Run `starci api survey`.\n';
  for (const file of [
    'CHANGELOG.md',
    'CHANGELOG-next.md',
    'packages/cli/CHANGELOG.md',
    'packages/hfs/runtime/scripts/old.mjs',
    'packages/eslint/fe/runtime/scripts/old.mjs',
    'package-lock.json',
    'packages/example/package-lock.json',
    'packages/cli/src/catalog.generated.mjs',
    'tests/cli/retired-cli.spec.mjs',
  ]) assert.deepEqual(calls(text, file), [], file);
  assert.equal(calls(text, 'modules/kernel/current.yaml').length,1,'current source gets no historical directory waiver');
});

test('a retired module filename grants no blanket exemption', () => {
  const file = 'packages/cli/src/removed.mjs';
  const findings = calls('Run `starci api survey`.', file);
  assert.equal(findings.length, 1, JSON.stringify(findings));
  assert.equal(findings[0].file, file);
  assert.equal(findings[0].code, CODE);
  assert.equal(findings[0].use, 'starci kernel survey');
  assert.deepEqual(calls('Run `starci kernel survey`.', file), []);
});

test('only the dispatcher removed-name table is masked in its generator', () => {
  const source = `const RETIRED_BUILTINS = [
  { spelling: 'starci api survey', use: 'starci kernel survey' },
];
const accidental = 'starci api survey';
`;
  const findings = calls(source, 'scripts/cli/gen-catalog.mjs');
  assert.equal(findings.length, 1, JSON.stringify(findings));
  assert.equal(findings[0].line, 4);
});

test('removed, retired, and replaced sentences are exempt sentence-by-sentence', () => {
  for (const word of ['removed', 'retired', 'replaced']) {
    assert.deepEqual(calls(`The command \`starci api survey\` was ${word}.`), [], word);
  }
  const findings = calls('`starci api survey` was removed. Run `starci api survey` now.');
  assert.equal(findings.length, 1, JSON.stringify(findings));
  assert.equal(findings[0].line, 1);
});

test('the kernel handler and variable-based handler plumbing are exact exemptions', () => {
  assert.deepEqual(
    calls("console.error('use: node scripts/kernel/cli.mjs survey');", 'scripts/kernel/cli.mjs'),
    [],
    'scripts/kernel/cli.mjs may print its own usage path',
  );
  assert.equal(calls("console.error('use: starci api survey');", 'scripts/kernel/cli.mjs').length, 1, 'other retired invocations in the handler still fail');
  const plumbing = "const cli = path.join(root, 'scripts', 'kernel', 'cli.mjs');\nspawn(process.execPath, [cli, 'survey']);\n";
  assert.deepEqual(calls(plumbing, 'scripts/cli/main.mjs'), [], 'a path assembled into a variable is not invocation text');
});

test('scan reads only the supplied tracked text files and skips binary data', () => {
  const values = new Map([
    ['docs/fail.md', 'heading\nRun `starci api survey`.\n'],
    ['docs/pass.md', 'Run `starci kernel survey`.\n'],
    ['assets/blob.bin', Buffer.from([0, 1, 2, 3])],
    ['docs/untracked.md', 'Run `starci api survey`.\n'],
  ]);
  const report = scanRetiredCli('/fixture', {
    catalog,
    files: ['docs/fail.md', 'docs/pass.md', 'assets/blob.bin'],
    read: (file) => values.get(file),
  });
  assert.equal(report.ok, false);
  assert.equal(report.code, CODE);
  assert.equal(report.files, 2);
  assert.equal(report.findings.length, 1);
  assert.deepEqual(report.findings[0], {
    code: CODE,
    file: 'docs/fail.md',
    line: 2,
    spelling: 'starci api survey',
    use: 'starci kernel survey',
    text: 'Run `starci api survey`.',
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

test('main emits the JSON envelope and returns 0/1/2', () => {
  assert.equal(CODE, 'RT_RETIRED_CLI_CALL');
  const red = { schema: 'starci/retired-cli-check@1', ok: false, code: CODE, files: 1, findings: [{ file: 'docs/x.md', line: 3, spelling: 'hfs lint', use: 'starci app lint' }] };
  const first = capture();
  assert.equal(main(['--json'], first.io, { scan: () => red }), 1);
  assert.deepEqual(JSON.parse(first.state.out), red);
  assert.equal(first.state.err, '');

  const clean = capture();
  assert.equal(main([], clean.io, { scan: () => ({ ...red, ok: true, code: null, findings: [] }) }), 0);
  assert.match(clean.state.out, /no retired CLI calls/);

  const bad = capture();
  assert.equal(main(['--root'], bad.io), 2);
  assert.match(bad.state.err, /--root needs a path/);
  const unknown = capture();
  assert.equal(main(['--wat'], unknown.io), 2);
  assert.match(unknown.state.err, /unknown argument/);
});
