import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { init, update, doctor, PAYLOAD } from '../bin/starci-skills.mjs';
import { validateWorkspace } from '../core/index.mjs';

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
  result = work(root, ['op', 'workspace.manage']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Contract display only/);
  assert.deepEqual(fs.readdirSync(workRoot).sort(), ['.gitignore', '_schema', 'workspace.yaml']);
  assert.equal(read(root, '.worktrees/sessions/old/state.json'), historical);
  const doctorOutput = [];
  assert.equal(doctor({ dir: root, quick: true }, value => doctorOutput.push(value)), 0, doctorOutput.join('\n'));
  assert.ok(doctorOutput.some(line => /tests\/core.spec.mjs: [1-9]\d*\/[1-9]\d* tests passed/.test(line)), doctorOutput.join('\n'));
});

test('host bootstraps use packaged templates and leave bound BE/FE projects untouched on init and update', t => {
  const root = host(t);
  const backend = host(t), frontend = host(t);
  put(backend, '.work/workspace.yaml', 'synthetic business evidence stays here\n');
  put(backend, '.starci/plans/example/run/index.yaml', 'synthetic execution stays here\n');
  put(frontend, 'src/page.tsx', 'export default function Page() {}\n');
  const binding = JSON.stringify({schema:'starci/workspace-binding@1', project:'synthetic',
    repositories:{be:{pathFromSource:path.relative(root,backend),gitRepository:'synthetic/be'},
      fe:{pathFromSource:path.relative(root,frontend),gitRepository:'synthetic/fe'}},
    work:{ownerRole:'be',pathFromRepository:'.work'}});
  put(root, '.workspaces/projects/synthetic/work.json', binding);
  const snapshot = dir => fs.readdirSync(dir, {recursive:true}).filter(p => fs.statSync(path.join(dir,p)).isFile())
    .sort().map(p => [p,fs.readFileSync(path.join(dir,p),'utf8')]);
  const before = [snapshot(backend),snapshot(frontend)];
  init({dir:root,bootstrap:true},quiet);
  for (const file of ['AGENTS.md','CLAUDE.md']) {
    assert.equal(read(root,file),read(packageRoot,'init/'+file));
    assert.equal(read(root,'.claude/init/'+file),read(root,file));
    // Every relative Markdown target from the generated bootstrap must actually resolve.
    for (const match of read(root,file).matchAll(/\]\(([^)]+)\)/g)) {
      assert.equal(fs.statSync(path.resolve(root,match[1])).isFile(),true,match[1]);
    }
    assert.doesNotMatch(read(root,file),/INDEX\.md|direct-task|request\.json/);
  }
  const initial = read(root,'AGENTS.md');
  update({dir:root},quiet);
  update({dir:root},quiet);
  assert.equal(read(root,'AGENTS.md'),initial);
  assert.equal(read(root,'.workspaces/projects/synthetic/work.json'),binding);
  assert.deepEqual([snapshot(backend),snapshot(frontend)],before);
  for (const name of ['.work','.starci']) assert.equal(fs.existsSync(path.join(root,name)),false);
});

test('obsolete direct-task bootstrap migrates without altering custom host instructions', t => {
  const root = host(t);
  init({dir:root,bootstrap:true},quiet);
  const obsolete = '<!-- starci:prompt-entry -->\nUse the single [StarCi skill](.claude/SKILL.md) to select one workflow from .claude/workflows/catalog.json.\nUse direct-task for ad hoc work that does not fit a specialized workflow. Keep the selected matrix\nwithin three sequential rows and three parallel primary cells; verify requested outcomes before advancing.\nQuestions may stay read-only. Check/build .dist first. Preserve existing scope, evidence and user changes.\n<!-- /starci:prompt-entry -->';
  put(root,'AGENTS.md','# Custom host rule\n'+obsolete+'\n');
  update({dir:root},quiet);
  assert.ok(read(root,'AGENTS.md').startsWith('# Custom host rule\n'));
  assert.doesNotMatch(read(root,'AGENTS.md'),/direct-task/);
  assert.match(read(root,'AGENTS.md'),/\.workspaces\/projects/);
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
  assert.equal(result.version, JSON.parse(read(packageRoot, 'package.json')).version);
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
  assert.match(result, /single \[StarCi skill\]/);
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
  const result = update({ dir: root, profile: 'full', bootstrap: false }, quiet);
  assert.equal(result.profile, 'full');
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
  assert.ok(PAYLOAD.includes('core'));
  const catalog = JSON.parse(read(root, '.claude/ops/catalog.json'));
  assert.ok(catalog.ops.some(op => op.id === 'workspace.manage'));
  for (const op of catalog.ops) assert.ok(fs.existsSync(path.resolve(root, '.claude/ops', op.document)), op.id);
  const before = fs.readdirSync(root).sort();
  for (const args of [['run-everything'], ['op', 'nonexistent'], ['init']]) {
    const result = work(root, args);
    assert.equal(result.status, 1, result.stdout + result.stderr);
  }
  assert.deepEqual(fs.readdirSync(root).sort(), before);
});

test('public runtime Markdown links resolve within the shipped payload', () => {
  for (const relative of ['SKILL.md']) {
    const file = path.join(packageRoot, relative);
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/\]\(([^)]+)\)/g)) {
      const reference = match[1].split('#')[0];
      if (!reference || /^[a-z]+:/i.test(reference)) continue;
      assert.ok(fs.existsSync(path.resolve(path.dirname(file), reference)), `${relative}: ${reference}`);
    }
  }
});

test('retained domain knowledge links resolve without the retired orchestration tree', () => {
  const visit = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? visit(file) : entry.name.endsWith('.json') ? [file] : [];
  });
  for (const file of visit(path.join(packageRoot, 'knowledge'))) {
    for (const [, ref] of fs.readFileSync(file, 'utf8').matchAll(/\]\(([^)]+)\)/g)) {
      const reference = ref.split('#')[0];
      if (!reference || /^[a-z]+:/i.test(reference)) continue;
      const destination = path.resolve(path.dirname(file), reference);
      assert.ok(!path.relative(packageRoot, destination).startsWith('..'), 'knowledge reference remains package-local');
      assert.ok(fs.existsSync(destination), `${path.relative(packageRoot, file)}: ${reference}`);
    }
  }
});

test('doctor cannot downgrade an incomplete v3 installation into legacy success', t => {
  const root = host(t);
  init({ dir: root, bootstrap: false }, quiet);
  fs.unlinkSync(path.join(root, '.claude/cli/main.mjs'));
  assert.throws(() => doctor({ dir: root, quick: true }, quiet), /refusing fallback to legacy validation/);
});

test('doctor rejects an all-skipped runner even when its process exits successfully', t => {
  const root = host(t);
  init({ dir: root, bootstrap: false }, quiet);
  put(root, '.claude/tests/ops.spec.mjs', "import test from 'node:test'; test.skip('unexecuted check', () => {});\n");
  const output = [];
  assert.equal(doctor({ dir: root, quick: true }, value => output.push(value)), 1, output.join('\n'));
  assert.ok(output.some(line => line.startsWith('FAIL tests/ops.spec.mjs:')), output.join('\n'));
});

function ownRetired(root, relative, text, kept = false) {
  put(root, '.claude/' + relative, text);
  const file = path.join(root, '.claude/.starci-skills.json');
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  manifest.files[relative] = createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
  if (kept) manifest.keptLocal = [...(manifest.keptLocal ?? []), relative];
  fs.writeFileSync(file, JSON.stringify(manifest));
}

test('retirement removes only unchanged owned files and keeps data through repeated forced updates', t => {
  const root = host(t);
  init({ dir: root, bootstrap: true }, quiet);
  ownRetired(root, 'alias/alias.json', '{"oldAuthority":"worktrees"}');
  ownRetired(root, 'workflows/old.md', 'owned old workflow');
  ownRetired(root, 'ops/compatibility.md', 'old compatibility routing');
  ownRetired(root, 'skills/starci-lite/SKILL.md', 'owned lite');
  ownRetired(root, 'skills/starci-lite/local.md', 'previously preserved', true);
  ownRetired(root, 'knowledge/findings/local.jsonl', 'old record');
  put(root, '.claude/knowledge/findings/local.jsonl', 'user changed record');
  ownRetired(root, 'resources/settings.json', 'personal settings');
  ownRetired(root, '.work/keep.md', 'protected product');
  put(root, '.claude/workflows/unowned.md', 'unowned workflow');
  put(root, '.claude/skills/local-skill/SKILL.md', 'unowned local skill');
  put(root, '.worktrees/uat/keep.txt', 'product evidence');
  const result = update({ dir: root, force: true }, quiet);
  assert.ok(result.preservedRetired.includes('workflows/unowned.md'));
  assert.deepEqual(result.removedRetired.sort(), ['alias/alias.json', 'ops/compatibility.md', 'skills/starci-lite/SKILL.md', 'workflows/old.md']);
  for (const relative of result.removedRetired) assert.equal(fs.existsSync(path.join(root, '.claude', relative)), false);
  const preserved = {
    '.claude/skills/starci-lite/local.md': 'previously preserved',
    '.claude/knowledge/findings/local.jsonl': 'user changed record',
    '.claude/resources/settings.json': 'personal settings',
    '.claude/.work/keep.md': 'protected product',
    '.claude/workflows/unowned.md': 'unowned workflow',
    '.claude/skills/local-skill/SKILL.md': 'unowned local skill',
    '.worktrees/uat/keep.txt': 'product evidence',
  };
  // init on an owned install must also use preservation semantics.
  init({ dir: root, bootstrap: true, force: true }, quiet);
  for (const [relative, bytes] of Object.entries(preserved)) assert.equal(read(root, relative), bytes, relative);
});


test('V2 docs and sites survive forced update and init even when previously installer-owned', t => {
  const root=host(t);
  init({dir:root,bootstrap:true},quiet);
  ownRetired(root,'docs/index.mdx','original V2 documentation');
  ownRetired(root,'sites/skills/src/main.ts','original V2 site');
  put(root,'.claude/sites/skills/dist/index.html','local site build');
  put(root,'.claude/docs/local.md','user documentation');
  const expected={
    '.claude/docs/index.mdx':'original V2 documentation',
    '.claude/sites/skills/src/main.ts':'original V2 site',
    '.claude/sites/skills/dist/index.html':'local site build',
    '.claude/docs/local.md':'user documentation',
  };
  const result=update({dir:root,force:true},quiet);
  assert.ok(result.preservedRetired.includes('docs/index.mdx'));
  assert.ok(result.preservedRetired.includes('sites/skills/src/main.ts'));
  assert.equal(result.removedRetired.some(p=>p.startsWith('docs/')||p.startsWith('sites/')),false);
  init({dir:root,bootstrap:true,force:true},quiet);
  for(const [relative,bytes]of Object.entries(expected))assert.equal(read(root,relative),bytes);
});

test('retired traversal and junction manifest paths stop before writes', t => {
  const root = host(t), external = host(t);
  init({ dir: root, bootstrap: true }, quiet);
  put(external, 'keep.txt', 'outside-owned');
  ownRetired(root, 'alias/alias.json', '{}');
  const manifestPath = path.join(root, '.claude/.starci-skills.json');
  const original = read(root, '.claude/.starci-skills.json');
  const source = read(root, '.claude/SKILL.md');
  for (const relative of ['../outside.txt', 'alias/../../escape', 'C:/outside', 'alias\\outside']) {
    const manifest = JSON.parse(original);
    manifest.files[relative] = 'bad';
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    assert.throws(() => update({ dir: root, force: true }, quiet), /invalid installed manifest path/);
    assert.equal(read(root, '.claude/SKILL.md'), source);
    assert.equal(read(root, '.claude/alias/alias.json'), '{}');
  }
  fs.writeFileSync(manifestPath, original);
  fs.renameSync(path.join(root, '.claude/alias'), path.join(root, 'owned-alias-backup'));
  fs.symlinkSync(external, path.join(root, '.claude/alias'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => update({ dir: root, force: true }, quiet), /symlink\/junction/);
  assert.equal(read(external, 'keep.txt'), 'outside-owned');
  assert.equal(read(root, '.claude/SKILL.md'), source);
  fs.unlinkSync(path.join(root, '.claude/alias'));
});

test('Lite cannot be installed; an old managed Lite bootstrap upgrades without a broken reference', t => {
  const root = host(t);
  assert.throws(() => init({ dir: root, profile: 'lite', bootstrap: true }, quiet), /retired/);
  assert.equal(fs.existsSync(path.join(root, '.claude')), false);
  init({ dir: root, bootstrap: true }, quiet);
  const oldEntry = '<!-- starci:prompt-entry -->\nFor every user prompt, enter [StarCi Lite](.claude/skills/starci-lite/SKILL.md) and use its scope classification.\nExisting full workflows keep their current session and gates; formal UAT and publication use full StarCi.\n<!-- /starci:prompt-entry -->';
  put(root, 'AGENTS.md', '# Custom preserved\n\n' + oldEntry + '\n');
  ownRetired(root, 'skills/starci-lite/SKILL.md', 'old runtime');
  const file = path.join(root, '.claude/.starci-skills.json');
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  manifest.profile = manifest.bootstrapProfile = 'lite';
  fs.writeFileSync(file, JSON.stringify(manifest));
  assert.throws(() => update({ dir: root, bootstrap: false }, quiet), /must be migrated/);
  assert.equal(read(root, '.claude/skills/starci-lite/SKILL.md'), 'old runtime');
  update({ dir: root }, quiet);
  assert.equal(fs.existsSync(path.join(root, '.claude/skills/starci-lite/SKILL.md')), false);
  assert.match(read(root, 'AGENTS.md'), /Custom preserved/);
  assert.match(read(root, 'AGENTS.md'), /single \[StarCi skill\]/);
  assert.doesNotMatch(read(root, 'AGENTS.md'), /starci-lite/);
});

test('custom or no-bootstrap routing cannot retain a dangling retired runtime reference', t => {
  const root = host(t);
  init({ dir: root, bootstrap: true }, quiet);
  ownRetired(root, 'workflows/old.md', 'old workflow still consumed');
  const before = read(root, '.claude/.starci-skills.json');
  const current = read(root, 'AGENTS.md');
  for (const bootstrap of [true, false]) {
    put(root, 'AGENTS.md', current + '\nRead .claude/workflows/old.md before execution.\n');
    assert.throws(() => update({ dir: root, bootstrap, force: true }, quiet), /still require retired runtime paths/);
    assert.equal(read(root, '.claude/.starci-skills.json'), before);
    assert.equal(read(root, '.claude/workflows/old.md'), 'old workflow still consumed');
  }
});

test('source and relocated payload contain only current runtime, presets and domain knowledge', t => {
  const root = host(t);
  init({ dir: root, bootstrap: true }, quiet);
  const retired = ['alias', 'routing.json', 'helpers', 'operators', 'readiness', 'resources', 'templates', 'skills/starci-lite', 'knowledge/findings'];
  for (const relative of retired) {
    assert.equal(fs.existsSync(path.join(packageRoot, relative)), false, 'source: ' + relative);
    assert.equal(fs.existsSync(path.join(root, '.claude', relative)), false, 'installed: ' + relative);
  }
  const installed = JSON.parse(read(root, '.claude/package.json'));
  assert.equal(Object.hasOwn(installed.scripts, 'test:legacy'), false);
  assert.equal(fs.existsSync(path.join(root,'.claude/skills/catalog.json')),false);
  assert.match(read(root,'.claude/SKILL.md'),/^name: starci$/m);
  assert.equal(JSON.parse(read(root, '.claude/ops/catalog.json')).ops.length, 14);
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
