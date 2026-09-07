import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { init, update, doctor, PAYLOAD } from '../bin/starci-skills.mjs';
import { validateWorkspace } from './core/index.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const quiet = () => {};
function host(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-v3-install-'));
  t.after(() => {
    assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('starci-v3-install-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  return root;
}
function put(root, relative, bytes) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
  return file;
}
const read = (root, relative) => fs.readFileSync(path.join(root, relative), 'utf8');
function work(root, args) {
  return spawnSync(process.execPath, [path.join(root, '.claude/bin/starci-skills.mjs'), 'work', ...args], {
    cwd: root, encoding: 'utf8', windowsHide: true,
  });
}

test('relocated package uses v3 CLI and leaves product evidence/legacy data untouched', t => {
  const root = host(t);
  const historical = '{"outcome":"not-run","note":"preserve this original"}\n';
  put(root, '.worktrees/sessions/old/state.json', historical);
  put(root, 'AGENTS.md', '# Team\r\nKeep this exact custom instruction.\r\n');
  init({ dir: root, bootstrap: true }, quiet);
  assert.equal(read(root, '.worktrees/sessions/old/state.json'), historical);
  assert.ok(read(root, 'AGENTS.md').startsWith('# Team\r\nKeep this exact custom instruction.\r\n'));
  assert.match(read(root, '.gitignore'), /^\.work\/_local\/$/m);
  assert.doesNotMatch(read(root, '.gitignore'), /^\/?\.work\/$/m);
  assert.equal(fs.existsSync(path.join(root, '.work')), false);
  const workRoot = path.join(root, '.work');
  let result = work(root, ['init', workRoot, '--id', 'relocated-fixture']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).productWorkExecuted, false);
  result = work(root, ['validate', workRoot]);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.equal(JSON.parse(result.stdout).ok, true);
  result = work(root, ['op', 'goal.setup']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Contract display only/);
  assert.deepEqual(fs.readdirSync(workRoot).sort(), ['.gitignore', 'workspace.yaml']);
  assert.equal(read(root, '.worktrees/sessions/old/state.json'), historical);
  const doctorOutput = [];
  assert.equal(doctor({ dir: root, quick: true }, value => doctorOutput.push(value)), 0, doctorOutput.join('\n'));
  assert.ok(doctorOutput.some(line => /v3\/core.spec.mjs: [1-9]\d*\/[1-9]\d* tests passed/.test(line)), doctorOutput.join('\n'));
});

test('major upgrade requires opt-in before writing and never converts existing work evidence', t => {
  const root = host(t);
  init({ dir: root, bootstrap: true }, quiet);
  const manifestPath = path.join(root, '.claude/.starci-skills.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.version = '2.5.0';
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  const before = fs.readFileSync(manifestPath, 'utf8');
  const bootstrap = read(root, 'AGENTS.md');
  put(root, '.work/business/node.md', 'User-owned current specification; do not convert.');
  put(root, '.worktrees/uat/evidence.txt', 'Historical unverified evidence.');
  assert.throws(() => update({ dir: root }, quiet), /--upgrade-major/);
  assert.equal(fs.readFileSync(manifestPath, 'utf8'), before);
  assert.equal(read(root, 'AGENTS.md'), bootstrap);
  const result = update({ dir: root, upgradeMajor: true }, quiet);
  assert.equal(result.version, '3.0.0-alpha.1');
  assert.equal(read(root, '.work/business/node.md'), 'User-owned current specification; do not convert.');
  assert.equal(read(root, '.worktrees/uat/evidence.txt'), 'Historical unverified evidence.');
});

test('known old managed entry is replaced, custom text and CRLF suffix preserved', t => {
  const root = host(t);
  init({ dir: root, bootstrap: true }, quiet);
  const old = '<!-- starci:prompt-entry -->\nFor every user prompt, enter [StarCi](.claude/INDEX.md) before planning or target work and follow\nthe entry\'s user-session and goal protocol. Follow-up prompts reuse that host session.\n<!-- /starci:prompt-entry -->';
  const current = read(root, 'AGENTS.md');
  const managed = current.match(/<!-- starci:prompt-entry -->[\s\S]*?<!-- \/starci:prompt-entry -->/)[0];
  const suffix = '\r\n# Team\r\nPreserve this suffix.\r\n';
  put(root, 'AGENTS.md', current.replace(managed, old).replace(/\n/g, '\r\n') + suffix);
  update({ dir: root }, quiet);
  const result = read(root, 'AGENTS.md');
  assert.ok(result.endsWith(suffix));
  assert.doesNotMatch(result, /Follow-up prompts reuse that host session/);
  assert.match(result, /bounded op chain/);
  assert.equal((result.match(/<!-- starci:prompt-entry -->/g) ?? []).length, 1);
});

test('custom protocol conflict stops before installer payload changes', t => {
  const root = host(t);
  init({ dir: root, bootstrap: true }, quiet);
  const custom = '# Team\n<!-- starci:prompt-entry -->\nUse our custom orchestrator.\n<!-- /starci:prompt-entry -->\n';
  put(root, 'AGENTS.md', custom);
  const before = read(root, '.claude/.starci-skills.json');
  assert.throws(() => update({ dir: root }, quiet), /custom StarCi entry/);
  assert.equal(read(root, 'AGENTS.md'), custom);
  assert.equal(read(root, '.claude/.starci-skills.json'), before);
});

test('unmanaged v2 session mandate is not mixed with the new selected-op protocol', t => {
  const root = host(t);
  init({ dir: root, bootstrap: true }, quiet);
  const custom = '# Team\nNothing is designed, written or committed outside a session: use validated request.json.\n';
  put(root, 'AGENTS.md', custom);
  const before = read(root, '.claude/.starci-skills.json');
  assert.throws(() => update({ dir: root }, quiet), /custom v2 session\/chain protocol/);
  assert.equal(read(root, 'AGENTS.md'), custom);
  assert.equal(read(root, '.claude/.starci-skills.json'), before);
});

test('installer refuses a junction payload before touching external ownership', t => {
  const root = host(t);
  const external = host(t);
  put(external, 'keep.txt', 'Unrelated target must survive.');
  fs.symlinkSync(external, path.join(root, '.claude'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => init({ dir: root, bootstrap: true, force: true }, quiet), /symlink\/junction/);
  assert.equal(read(external, 'keep.txt'), 'Unrelated target must survive.');
  assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
  fs.unlinkSync(path.join(root, '.claude'));
});

test('no-bootstrap does not claim changed host routing and local skill edits remain owned', t => {
  const root = host(t);
  init({ dir: root, bootstrap: true }, quiet);
  const before = read(root, 'AGENTS.md');
  const source = read(root, '.claude/SKILL.md');
  put(root, '.claude/SKILL.md', source + '\nLocal reviewed policy.\n');
  const result = update({ dir: root, profile: 'lite', bootstrap: false }, quiet);
  assert.equal(result.profile, 'lite');
  assert.equal(result.bootstrapProfile, 'full');
  assert.ok(result.keptLocal.includes('SKILL.md'));
  assert.equal(read(root, 'AGENTS.md'), before);
  assert.match(read(root, '.claude/SKILL.md'), /Local reviewed policy/);
});

test('linked host instructions and manifest cannot redirect installer writes outside the selected host', t => {
  const root = host(t);
  const external = host(t);
  put(external, 'keep.txt', 'External instructions must remain untouched.');
  fs.symlinkSync(external, path.join(root, 'AGENTS.md'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => init({ dir: root, bootstrap: true }, quiet), /regular owned file/);
  assert.equal(fs.existsSync(path.join(root, '.claude')), false);
  assert.equal(read(external, 'keep.txt'), 'External instructions must remain untouched.');
  fs.unlinkSync(path.join(root, 'AGENTS.md'));
  init({ dir: root, bootstrap: false }, quiet);
  fs.unlinkSync(path.join(root, '.claude/.starci-skills.json'));
  fs.symlinkSync(external, path.join(root, '.claude/.starci-skills.json'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => update({ dir: root }, quiet), /symlink\/junction/);
  assert.equal(read(external, 'keep.txt'), 'External instructions must remain untouched.');
  fs.unlinkSync(path.join(root, '.claude/.starci-skills.json'));
});

test('packaged v3 references survive relocation; malformed commands do not create a workflow', t => {
  const root = host(t);
  init({ dir: root, bootstrap: true }, quiet);
  assert.ok(PAYLOAD.includes('v3'));
  const catalog = JSON.parse(read(root, '.claude/v3/ops/catalog.json'));
  assert.ok(catalog.ops.some(op => op.id === 'goal.setup'));
  for (const op of catalog.ops) assert.ok(fs.existsSync(path.resolve(root, '.claude/v3/ops', op.document)), op.id);
  const before = fs.readdirSync(root).sort();
  for (const args of [['run-everything'], ['op', 'nonexistent'], ['init']]) {
    const result = work(root, args);
    assert.equal(result.status, 1, result.stdout + result.stderr);
  }
  assert.deepEqual(fs.readdirSync(root).sort(), before);
});

test('public runtime Markdown links resolve within the shipped payload', () => {
  for (const relative of ['INDEX.md', 'INDEX.vi.md', 'SKILL.md', 'SKILL.vi.md', 'README.md', 'README.vi.md', 'v3/README.md', 'v3/README.vi.md']) {
    const file = path.join(packageRoot, relative);
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/\]\(([^)]+)\)/g)) {
      const reference = match[1].split('#')[0];
      if (!reference || /^[a-z]+:/i.test(reference)) continue;
      assert.ok(fs.existsSync(path.resolve(path.dirname(file), reference)), `${relative}: ${reference}`);
    }
  }
});

test('doctor cannot downgrade an incomplete v3 installation into legacy success', t => {
  const root = host(t);
  init({ dir: root, bootstrap: false }, quiet);
  fs.unlinkSync(path.join(root, '.claude/v3/cli/main.mjs'));
  assert.throws(() => doctor({ dir: root, quick: true }, quiet), /refusing fallback to legacy validation/);
});

test('doctor rejects an all-skipped runner even when its process exits successfully', t => {
  const root = host(t);
  init({ dir: root, bootstrap: false }, quiet);
  put(root, '.claude/v3/ops.spec.mjs', "import test from 'node:test'; test.skip('unexecuted check', () => {});\n");
  const output = [];
  assert.equal(doctor({ dir: root, quick: true }, value => output.push(value)), 1, output.join('\n'));
  assert.ok(output.some(line => line.startsWith('FAIL v3/ops.spec.mjs:')), output.join('\n'));
});

test('a 300-piece multi-repository tree accepts a new unfinished domain without restructuring', t => {
  const root = host(t);
  put(root, 'workspace.yaml', JSON.stringify({ schema: 'work/workspace@1', id: 'wide-synthetic-workspace' }));
  for (const id of ['repo-backend', 'repo-frontend']) {
    put(root, `_resources/repositories/${id}/resource.yaml`, JSON.stringify({ schema: 'work/resource@1', id, kind: 'repository', owner: 'synthetic-owner', revision: 'r1', details: { source: 'synthetic fixture only' } }));
  }
  const add = (relative, metadata) => put(root, `${relative}/node.md`, `---\n${JSON.stringify({ schema: 'work/node@1', required: true, ...metadata }, null, 2)}\n---\nScope: synthetic sizing/extension fixture. Done when this selected piece is independently verified.\n`);
  add('product', { id: 'product', kind: 'business' });
  for (const domain of ['backend', 'frontend', 'security']) {
    add(`product/${domain}`, { id: domain, kind: 'branch' });
    for (let index = 0; index < 100; index++) add(`product/${domain}/piece-${index}`, {
      id: `${domain}.${index}`, kind: domain === 'security' ? 'custom.security' : 'implementation', state: 'todo',
      refs: [domain === 'frontend' ? 'repo-frontend' : 'repo-backend'], extensions: { example: { domain } },
    });
  }
  const result = validateWorkspace(root);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.nodes.length, 304);
  assert.equal(result.resources.length, 2);
  assert.equal(result.nodes.find(node => node.id === 'product').effectiveState, 'todo');
  assert.equal(result.warnings.filter(item => item.code === 'UNSUPPORTED_PROFILE').length, 100);
  assert.equal(result.nodes.some(node => node.effectiveState === 'done'), false);
});
