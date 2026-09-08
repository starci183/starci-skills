// The installer must produce a tree the validators accept, refuse to overwrite a .claude it did not
// install, keep a person's local edit across update, and write the two bootstraps exactly once.
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test as nodeTest } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { PAYLOAD, init, update, doctor } = await import('../bin/starci-skills.mjs');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const test = nodeTest;
const quiet = () => {};

test('a clean relocated install opens and confirms one project-owned workflow across repository roles', async () => {
  const source = mkdtempSync(path.join(tmpdir(), 'starci laptop source ')); const owner = mkdtempSync(path.join(tmpdir(), 'starci laptop product '));
  try {
    init({ dir: source, force: false, bootstrap: true }, quiet);
    const git = (...args) => execFileSync('git', ['-C', owner, ...args], { windowsHide: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    git('init'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-m', 'Fixture');
    const { declareOwner, discoveryFor } = await import('./v23-test-fixture.mjs'); declareOwner(source, 'sample', owner);
    const installed = await import(pathToFileURL(path.join(source, '.claude/scripts/session-open.mjs')));
    const { scopeHash } = await import(pathToFileURL(path.join(source, '.claude/scripts/mission-scope.mjs')));
    const mission = { language: 'en', goal: 'Check the declared boundary', target: 'sample', includes: ['readiness'], outputs: ['readiness report'], doneWhen: [{ evidence: 'readiness is observed', producedBy: 'environment.preflight' }], verification: 'Inspect the declared boundary', sourceRef: 'user:fixture', discovery: discoveryFor('sample', { head: git('rev-parse', 'HEAD') }) };
    const input = { project: 'sample', hostBinding: { kind: 'codex-task', hostId: 'relocated-task', worktree: source, sourcePromptRef: 'user:fixture' }, mission };
    const opened = await installed.openSession(path.join(owner, '.worktrees/sessions'), input);
    const state = JSON.parse(readFileSync(path.join(opened.session, 'state.json')));
    const statement = 'Approve the complete displayed scope.';
    const authority = { kind: 'scope-answer', sourceRef: 'user:answer', statement, scopeHash: scopeHash(state.mission), presentedScopeHash: scopeHash(state.mission), coverage: Object.fromEntries(['goal', 'impact', 'destination', 'stage', 'verification'].map(field => [field, statement])) };
    await installed.confirmSession(opened.session, { selected: 'as-stated', selectedBy: 'user', sourceRef: authority.sourceRef, authority });
    assert.equal((await installed.openSession(path.join(owner, '.worktrees/sessions'), input)).session, opened.session);
    assert.equal(doctor({ dir: source, quick: true }, quiet), 0);
    assert.ok(!existsSync(path.join(source, '.worktrees/sessions')));
  } finally { rmSync(source, { recursive: true, force: true }); rmSync(owner, { recursive: true, force: true }); }
});

function freshRepo() {
  const repo = mkdtempSync(path.join(tmpdir(), 'starci-skills-'));
  writeFileSync(path.join(repo, '.gitignore'), 'node_modules/\n');
  return repo;
}

test('the explicit package allowlist and metadata define the complete installed runtime', () => {
  const shipped = ['package.json', ...pkg.files.map((f) => f.replace(/\/$/, ''))];
  assert.deepEqual([...PAYLOAD].sort(), [...new Set(shipped)].sort());
  for (const stale of ['sites', 'docs', 'tests', '.github']) assert.ok(!shipped.includes(stale), `${stale} must not ship`);
  const policy = JSON.parse(readFileSync(path.join(root, 'resources/orchestrator.json'), 'utf8')).workflowTopologies;
  for (const source of policy.sources) assert.ok(PAYLOAD.includes(source), 'a required public evidence source must survive init, not merely npm pack');
  assert.equal(pkg.bin['starci-skills'], 'bin/starci-skills.mjs');
  assert.equal(pkg.publishConfig.access, 'public');
  assert.match(readFileSync(path.join(root, 'INDEX.md'), 'utf8'), new RegExp(`^# StarCi Skills ${pkg.version.replace(/\./g, '\\.')}$`, 'm'));
});

test('init installs the tree, writes both bootstraps and the sessions ignore, and doctor --quick passes', () => {
  const repo = freshRepo();
  try {
    const manifest = init({ dir: repo, force: false, bootstrap: true }, quiet);
    assert.equal(manifest.version, pkg.version);
    assert.equal(manifest.profile, 'lite');
    for (const p of PAYLOAD) assert.ok(existsSync(path.join(repo, '.claude', p)), `${p} not installed`);
    assert.equal(readFileSync(path.join(repo, '.claude', 'package.json'), 'utf8'), readFileSync(path.join(root, 'package.json'), 'utf8'));
    for (const name of ['CLAUDE.md', 'AGENTS.md']) {
      const text = readFileSync(path.join(repo, name), 'utf8');
      assert.match(text, /\.claude\/skills\/starci-lite\/SKILL\.md/);
      assert.match(text, /For every user prompt, enter \[StarCi Lite\]/);
      assert.match(text, /Existing full workflows keep their current session and gates/);
    }
    assert.match(readFileSync(path.join(repo, '.gitignore'), 'utf8'), /^\.worktrees\/sessions\/$/m);
    assert.equal(doctor({ dir: repo, quick: true }, quiet), 0);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('an installed current workflow fixture creates its own complete runtime and confirmed owner', async t => {
  const repo = freshRepo();
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  init({ dir: repo, force: false, bootstrap: false }, quiet);
  const installedRoot = path.join(repo, '.claude');
  const { createSourceFixture } = await import(pathToFileURL(path.join(installedRoot, 'scripts/workflow-source-fixture.mjs')));
  const f = await createSourceFixture(t, { sessionId: 'installed-source-owner' });
  for (const ref of PAYLOAD) assert.ok(existsSync(path.join(f.root, ref)), `fixture lost installed resource ${ref}`);
  assert.equal(f.state().lifecycle.phase, 'active');
  assert.equal(f.state().id, 'installed-source-owner');
  assert.deepEqual(readFileSync(path.join(f.root, 'package.json')), readFileSync(path.join(root, 'package.json')));
});

test('init refuses a populated .claude it did not install, and --force replaces only runtime paths', () => {
  const repo = freshRepo();
  try {
    mkdirSync(path.join(repo, '.claude'));
    writeFileSync(path.join(repo, '.claude', 'settings.json'), '{}\n');
    const localEvidence = path.join(repo, '.claude', 'tests', 'evidence', 'local-note.md');
    mkdirSync(path.dirname(localEvidence), { recursive: true });
    writeFileSync(localEvidence, 'User-owned evidence, not a runtime payload.\n');
    assert.throws(() => init({ dir: repo, force: false, bootstrap: false }, quiet), /was not installed by/);
    init({ dir: repo, force: true, bootstrap: false }, quiet);
    assert.ok(existsSync(path.join(repo, '.claude', 'settings.json')), 'a file outside the runtime paths survives --force');
    assert.equal(readFileSync(localEvidence, 'utf8'), 'User-owned evidence, not a runtime payload.\n', 'copying an allowlisted public note must preserve sibling evidence');
    assert.ok(!existsSync(path.join(repo, 'CLAUDE.md')), '--no-bootstrap writes no bootstrap');
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('update keeps a locally changed file and lists it; --force takes the package version', () => {
  const repo = freshRepo();
  try {
    init({ dir: repo, force: false, bootstrap: false }, quiet);
    const target = path.join(repo, '.claude', 'workflows', 'README.md');
    const original = readFileSync(target, 'utf8');
    writeFileSync(target, `${original}\nlocal note\n`);
    unlinkSync(path.join(repo, '.claude', 'routing.json'));
    const lines = [];
    const manifest = update({ dir: repo, force: false }, (l) => lines.push(l));
    assert.deepEqual(manifest.keptLocal, ['workflows/README.md']);
    assert.match(readFileSync(target, 'utf8'), /local note/);
    assert.ok(existsSync(path.join(repo, '.claude', 'routing.json')), 'a deleted runtime file comes back');
    assert.ok(lines.some((l) => l.startsWith('kept workflows/README.md')));
    update({ dir: repo, force: true }, quiet);
    assert.equal(readFileSync(target, 'utf8'), original);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('update adds prompt routing once to an existing bootstrap without replacing local instructions', () => {
  const repo = freshRepo();
  try {
    init({ dir: repo, force: false, bootstrap: false }, quiet);
    const custom = '# Team instructions\n\nKeep our local review policy.\n';
    writeFileSync(path.join(repo, 'AGENTS.md'), custom);
    update({ dir: repo, force: false }, quiet);
    const first = readFileSync(path.join(repo, 'AGENTS.md'), 'utf8');
    assert.ok(first.startsWith(custom), 'local instructions survive the entry upgrade');
    assert.ok(first.includes('.claude/skills/starci-lite/SKILL.md'), 'a pre-existing file without a StarCi link is also routed');
    assert.equal(first.split('<!-- starci:prompt-entry -->').length - 1, 1);
    update({ dir: repo, force: false }, quiet);
    assert.equal(readFileSync(path.join(repo, 'AGENTS.md'), 'utf8'), first, 'updating again does not append duplicate policy');
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('update --no-bootstrap preserves existing host instructions byte for byte', () => {
  const repo = freshRepo();
  try {
    init({ dir: repo, force: false, bootstrap: false }, quiet);
    const custom = '# Existing host\nRead .claude/INDEX.md.\n';
    writeFileSync(path.join(repo, 'AGENTS.md'), custom);
    update({ dir: repo, force: false, bootstrap: false }, quiet);
    assert.equal(readFileSync(path.join(repo, 'AGENTS.md'), 'utf8'), custom);
    assert.ok(!existsSync(path.join(repo, 'CLAUDE.md')));
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('init adds entry to both existing host files while preserving their custom content', () => {
  const repo = freshRepo();
  try {
    const originals = { 'AGENTS.md': '# Team\r\nCustom Codex instructions.', 'CLAUDE.md': '# Team\nCustom Claude instructions.\n' };
    for (const [name, content] of Object.entries(originals)) writeFileSync(path.join(repo, name), content);
    init({ dir: repo, force: false, bootstrap: true }, quiet);
    for (const [name, content] of Object.entries(originals)) {
      const result = readFileSync(path.join(repo, name), 'utf8');
      assert.ok(result.startsWith(content), name);
      assert.equal(result.split('<!-- starci:prompt-entry -->').length - 1, 1);
      assert.ok(result.includes('.claude/skills/starci-lite/SKILL.md'));
    }
  } finally { rmSync(repo, { recursive: true, force: true }); }
});
