// cli-only-entry-raw.spec.mjs - R201 flags policy-refused raw commands only when guidance presents them as commands.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { main, scanCliOnlyEntry } from '../../scripts/checks/check-cli-only-entry.mjs';
import { loadCommandPolicy } from '../../scripts/guards/command-policy.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const POLICY = loadCommandPolicy({ root: ROOT });
const EMPTY_CATALOG = { groups: [] };

const scan = (values) => {
  const entries = new Map(Object.entries(values));
  return scanCliOnlyEntry('/fixture', {
    catalog: EMPTY_CATALOG,
    internal: [],
    policy: POLICY,
    files: [...entries.keys()],
    read: (file) => entries.get(file),
    generated: [],
  });
};

test('read-only commands in explicit guidance spans pass', () => {
  const report = scan({
    'docs/commands.md': [
      'Inspect with `git status` and `git log --oneline`.',
      '```sh',
      'git diff --stat',
      'rg policy scripts',
      '```',
      '$ git show HEAD',
    ].join('\n'),
  });
  assert.equal(report.ok, true, JSON.stringify(report.findings));
  assert.deepEqual(report.rawUseCounts, {});
});

test('internalized host prompts and procedure references retain native CLI-only enforcement', () => {
  const report = scan({
    '.starci/host/maintenance.md': 'Commit with `git commit -m repair`.\n',
    'skills/starci/references/release.md': 'Verify with `npm test`.\n',
  });
  assert.deepEqual(report.findings.map(({file, program, sub}) => [file, program, sub]), [
    ['.starci/host/maintenance.md', 'git', 'commit'],
    ['skills/starci/references/release.md', 'npm', 'test'],
  ]);
});

test('inline, fenced, shell-prompt, and PowerShell-prompt commands produce exact policy findings', () => {
  const report = scan({
    'docs/actions.md': [
      'Commit with `git commit -m x`.',
      '```sh',
      'npm test',
      'docker compose up',
      '```',
      '$ supabase start',
      '> node --test tests/x.spec.mjs',
      'PS> git add file',
    ].join('\n'),
  });
  assert.deepEqual(report.findings.map(({ file, line, program, sub, use }) => ({ file, line, program, sub, use })), [
    { file: 'docs/actions.md', line: 1, program: 'git', sub: 'commit', use: 'starci git commit' },
    { file: 'docs/actions.md', line: 3, program: 'npm', sub: 'test', use: 'starci test run --level L1|L2 in the runtime or starci gate unit --root <app> in an app' },
    { file: 'docs/actions.md', line: 4, program: 'docker', sub: 'compose', use: 'starci docker up, starci docker down, starci docker build, or starci docker ps; a release image proof is starci release images' },
    { file: 'docs/actions.md', line: 6, program: 'supabase', sub: 'start', use: "starci supabase start, starci supabase stop, or starci supabase status for the app's own stack" },
    { file: 'docs/actions.md', line: 7, program: 'node', sub: '--test', use: 'starci gate unit --root <app> (the op gate selects the specs of the change)' },
    { file: 'docs/actions.md', line: 8, program: 'git', sub: 'add', use: 'starci git commit' },
  ]);
});

test('environment assignments, cd prefixes, and command separators are classified one segment at a time', () => {
  const report = scan({
    'CONTEXT.md': [
      '`cd app && MODE=test git commit -m x`',
      '`npm run build; git status | playwright test`',
      '`npx vitest run`',
    ].join('\n'),
  });
  assert.deepEqual(report.findings.map(({ line, program, sub }) => ({ line, program, sub })), [
    { line: 1, program: 'git', sub: 'commit' },
    { line: 2, program: 'npm', sub: 'run' },
    { line: 2, program: 'playwright', sub: 'test' },
    { line: 3, program: 'npx', sub: 'vitest' },
  ]);
});

test('prohibitions, history, tests, generated runtime copies, policy data, and catalog prose are exempt', () => {
  const report = scan({
    'docs/safety.md': 'The raw command `git commit -m x` is denied. Never run `npm test`.',
    'CHANGELOG-next.md': '`git commit -m x`',
    'modules/kernel/contract-changes/old.yaml': 'summary: "`npm test` was retired"',
    'modules/kernel/command-policy.yaml': 'use: `docker compose up`',
    'tests/fixture.spec.mjs': 'const text = `supabase start`;',
    'packages/hfs/runtime/docs/readme.md': '`git commit -m x`',
    'modules/cli/commands/example/run.yaml': [
      'conventions:',
      '  - `git commit -m x` is mentioned as catalog know-how',
      'removed: [`npm test`]',
      'examples:',
      '  - use `docker compose up` here',
    ].join('\n'),
  });
  assert.deepEqual(report.findings.map(({ file, line, program, sub }) => ({ file, line, program, sub })), [
    { file: 'modules/cli/commands/example/run.yaml', line: 5, program: 'docker', sub: 'compose' },
  ]);
});

test('the report and human output include stable counts by the policy use text', () => {
  const report = scan({ 'knowledge/how.md': '`git commit -m x`\n`git add file`\n' });
  assert.deepEqual(report.rawUseCounts, { 'starci git commit': 2 });
  const state = { out: '', err: '' };
  const io = {
    stdout: { write: (value) => { state.out += value; } },
    stderr: { write: (value) => { state.err += value; } },
  };
  assert.equal(main([], io, { scan: () => report }), 1);
  assert.match(state.out, /knowledge\/how\.md:1 raw git commit in guidance: use starci git commit/);
  assert.match(state.out, /raw guidance by use:\n  2 starci git commit/);
  assert.equal(state.err, '');
});
